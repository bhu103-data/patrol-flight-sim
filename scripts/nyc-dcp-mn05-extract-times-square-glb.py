#!/usr/bin/env python3
"""Extract a bounded preview of official 2014 DCP building surfaces.

The output is a review artifact only. It does not change the PATROL runtime.
"""
from __future__ import annotations
import argparse, csv, hashlib, json, math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import rhino3dm
import trimesh
from pyproj import Transformer
from shapely.geometry import Polygon, Point, MultiPolygon
from shapely.ops import unary_union
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection

WGS84_TO_SP = Transformer.from_crs("EPSG:4326", "EPSG:2263", always_xy=True)
SP_TO_WGS84 = Transformer.from_crs("EPSG:2263", "EPSG:4326", always_xy=True)
ORIGIN = (-73.9864883, 40.75775)
FTUS_M = 1200.0 / 3937.0
FT_M = 0.3048
BBOX_WGS84 = (-73.9900, 40.7552, -73.9822, 40.7610)
SURFACE_LAYERS = {"Facade Surface", "RoofTop Surface"}
FOOTPRINT_LAYER = "FootPrint Surface"
DEFAULT_COLORS = {
    "Facade Surface": (176, 179, 181, 255),
    "RoofTop Surface": (125, 132, 138, 255),
}
A = 6378137.0
E2 = 6.6943799901413165e-3
DEG = math.pi / 180.0


def wgs84_to_local(lon, lat):
    lon0, lat0 = ORIGIN
    phi = lat0 * DEG
    s = math.sin(phi)
    d = 1.0 - E2 * s * s
    meridian = A * (1.0 - E2) / (d ** 1.5)
    prime = A / math.sqrt(d)
    east = (lon - lon0) * DEG * prime * math.cos(phi)
    north = (lat - lat0) * DEG * meridian
    return east, north


def current_bounds(features):
    points = []
    for feature in features:
        if len(feature.get("rings", [])) != 1:
            continue
        for lon, lat in feature["rings"][0]:
            points.append(wgs84_to_local(lon, lat))
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return (min(xs), min(ys), max(xs), max(ys))


def current_center(features):
    b = current_bounds(features)
    return ((b[0] + b[2]) * 0.5, (b[1] + b[3]) * 0.5)


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def layer_for(model, index):
    try:
        return model.Layers.FindIndex(index)
    except Exception:
        return None


def layer_name(model, index):
    layer = layer_for(model, index)
    return layer.Name if layer is not None else "layer-index-" + str(index)


def layer_color(layer, name):
    try:
        color = layer.Color
        rgba = [int(color.R), int(color.G), int(color.B), int(color.A)]
        if rgba[3] == 0:
            rgba[3] = 255
        return rgba
    except Exception:
        return list(DEFAULT_COLORS.get(name, (170, 170, 170, 255)))


def bbox_xy(geometry):
    box = geometry.GetBoundingBox()
    return [float(box.Min.X), float(box.Min.Y),
            float(box.Max.X), float(box.Max.Y)]


def intersects(a, b):
    return not (a[2] < b[0] or a[0] > b[2] or a[3] < b[1] or a[1] > b[3])


def mesh_data(mesh):
    vertices = np.asarray([[float(p.X), float(p.Y), float(p.Z)]
                           for p in mesh.Vertices], dtype=np.float64)
    faces = []
    for face in mesh.Faces:
        a, b, c, d = int(face.A), int(face.B), int(face.C), int(face.D)
        faces.append((a, b, c))
        if d != c:
            faces.append((a, c, d))
    if not len(vertices) or not faces:
        return None
    return vertices, np.asarray(faces, dtype=np.int64)


def mesh_polygon(vertices, faces):
    triangles = []
    for tri in faces:
        poly = Polygon(vertices[tri, :2])
        if poly.is_valid and poly.area > 1e-5:
            triangles.append(poly)
    if not triangles:
        return None
    geom = unary_union(triangles)
    if not geom.is_valid:
        geom = geom.buffer(0)
    if geom.is_empty or geom.area < 0.25:
        return None
    if isinstance(geom, GeometryCollection):
        polys = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
        if not polys:
            return None
        geom = unary_union(polys)
    return geom


def mesh_centroid_normal(vertices, faces):
    centroid = vertices.mean(axis=0)
    normal_xy = np.array([0.0, 0.0])
    for tri in faces[:8]:
        a, b, c = vertices[tri]
        n = np.cross(b - a, c - a)
        norm = float(np.linalg.norm(n[:2]))
        if norm > 1e-7:
            normal_xy = n[:2] / norm
            break
    return centroid, normal_xy


def polygon_from_current(feature):
    ring = feature["rings"][0]
    coords = [WGS84_TO_SP.transform(float(lon), float(lat)) for lon, lat in ring]
    poly = Polygon(coords)
    if not poly.is_valid:
        poly = poly.buffer(0)
    return poly if not poly.is_empty and poly.area > 1.0 else None


def match_footprints(dcp_footprints, current_features):
    current = []
    for rec in current_features:
        if len(rec.get("rings", [])) != 1:
            continue
        poly = polygon_from_current(rec)
        if poly is not None:
            current.append({"fid": int(rec["fid"]), "heightFt": float(rec["heightFt"]), "poly": poly})
    pairs = []
    for dcp in dcp_footprints:
        for cur in current:
            inter = dcp["poly"].intersection(cur["poly"]).area
            if inter < 1.0:
                continue
            union = dcp["poly"].union(cur["poly"]).area
            iou = inter / max(union, 1e-9)
            cover_dcp = inter / max(dcp["poly"].area, 1e-9)
            cover_cur = inter / max(cur["poly"].area, 1e-9)
            centroid_dist = dcp["poly"].centroid.distance(cur["poly"].centroid)
            score = min(cover_dcp, cover_cur) * iou
            pairs.append((score, iou, cover_dcp, cover_cur, centroid_dist, dcp["index"], cur["fid"]))
    pairs.sort(reverse=True)
    used_dcp, used_fid, matches = set(), set(), []
    for score, iou, cd, cc, dist, di, fid in pairs:
        if di in used_dcp or fid in used_fid:
            continue
        row = {"dcpFootprintIndex": di, "fid": fid, "score": score,
               "iou": iou, "dcpCoverage": cd, "currentCoverage": cc,
               "centroidDistanceM": dist}
        matches.append(row)
        used_dcp.add(di)
        used_fid.add(fid)
    return current, matches, pairs


def assign_surface(vertices, faces, footprints, layer):
    centroid, normal_xy = mesh_centroid_normal(vertices, faces)
    point = Point(float(centroid[0]), float(centroid[1]))
    if layer == "Facade Surface" and np.linalg.norm(normal_xy) > 0.5:
        p1 = Point(*(centroid[:2] + normal_xy * 0.30))
        p2 = Point(*(centroid[:2] - normal_xy * 0.30))
        c1 = [fp for fp in footprints if fp["poly"].contains(p1)]
        c2 = [fp for fp in footprints if fp["poly"].contains(p2)]
        candidates = c1 if len(c1) == 1 else c2 if len(c2) == 1 else (c1 or c2)
        if candidates:
            return min(candidates, key=lambda fp: fp["poly"].area)
    if layer == "RoofTop Surface":
        candidates = [fp for fp in footprints if fp["poly"].covers(point)]
        if candidates:
            return min(candidates, key=lambda fp: fp["poly"].area)
    best = min(footprints, key=lambda fp: fp["poly"].distance(point))
    return best if best["poly"].distance(point) <= 2.0 else None


def append_mesh(target, vertices, faces, color):
    offset = len(target["vertices"])
    target["vertices"].extend(vertices.tolist())
    target["faces"].extend((faces + offset).tolist())
    target["colors"].extend([color] * len(vertices))


def preview_png(meshes, path):
    fig = plt.figure(figsize=(14, 10), dpi=140)
    ax = fig.add_subplot(111, projection="3d")
    all_points = []
    for item in meshes:
        verts = item["vertices"]
        faces = item["faces"]
        if len(faces) == 0:
            continue
        sample_faces = faces
        if len(sample_faces) > 80000:
            sample_faces = sample_faces[::max(1, len(sample_faces)//80000)]
        polygons = [verts[f] for f in sample_faces]
        color = np.asarray(item["color"][:3], dtype=float) / 255.0
        collection = Poly3DCollection(polygons, facecolors=[color], edgecolors="none", alpha=0.96)
        ax.add_collection3d(collection)
        all_points.append(verts)
    if not all_points:
        plt.close(fig)
        return
    pts = np.vstack(all_points)
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    center = (lo + hi) * 0.5
    span = max(float((hi-lo).max()), 1.0)
    ax.set_xlim(center[0]-span*.55, center[0]+span*.55)
    ax.set_ylim(center[2]-span*.55, center[2]+span*.55)
    ax.set_zlim(max(0, lo[1]-.5), hi[1]+2)
    ax.set_box_aspect((1, 1, max(.22, (hi[1]-lo[1])/span)))
    ax.view_init(elev=34, azim=-58)
    ax.set_xlabel("East (m)")
    ax.set_ylabel("South (m)")
    ax.set_zlabel("Height (m)")
    ax.set_title("NYC DCP 2014 — matched Times Square facade and roof surfaces")
    fig.tight_layout()
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)


def extract(model_path, footprints_path, report_path, glb_path, preview_path):
    model = rhino3dm.File3dm.Read(str(model_path))
    if model is None:
        raise RuntimeError("Cannot read Manhattan CD5 3DM")
    current_dataset = json.loads(footprints_path.read_text(encoding="utf-8"))
    current_features = current_dataset["features"]
    center_e, center_n = current_center(current_features)
    query_wgs = BBOX_WGS84
    corners = [WGS84_TO_SP.transform(query_wgs[0], query_wgs[1]),
               WGS84_TO_SP.transform(query_wgs[2], query_wgs[3])]
    query_sp = [min(corners[0][0], corners[1][0]), min(corners[0][1], corners[1][1]),
                max(corners[0][0], corners[1][0]), max(corners[0][1], corners[1][1])]

    dcp_footprints = []
    for obj in model.Objects:
        attrs, geom = obj.Attributes, obj.Geometry
        if layer_name(model, attrs.LayerIndex) != FOOTPRINT_LAYER:
            continue
        if not intersects(bbox_xy(geom), query_sp):
            continue
        for face in geom.Faces:
            cached = face.GetMesh(rhino3dm.MeshType.Any)
            if cached is None:
                continue
            data = mesh_data(cached)
            if data is None:
                continue
            vertices, faces = data
            poly = mesh_polygon(vertices, faces)
            if poly is None:
                continue
            dcp_footprints.append({
                "index": len(dcp_footprints),
                "guid": str(attrs.Id),
                "poly": poly,
                "baseZFtUS": float(np.median(vertices[:, 2])),
                "sourceVertices": len(vertices),
                "sourceTriangles": len(faces),
            })

    current, matches, all_pairs = match_footprints(dcp_footprints, current_features)
    accepted = []
    for match in matches:
        if (match["iou"] >= 0.60 and match["dcpCoverage"] >= 0.78 and
            match["currentCoverage"] >= 0.78 and match["centroidDistanceM"] <= 2.5):
            accepted.append(match)
    accepted_by_dcp = {m["dcpFootprintIndex"]: m for m in accepted}
    current_by_fid = {int(r["fid"]): r for r in current_features}
    footprint_by_index = {fp["index"]: fp for fp in dcp_footprints}

    groups = {
        m["fid"]: {"match": m, "dcp": footprint_by_index[m["dcpFootprintIndex"]],
                   "facade": {"vertices": [], "faces": [], "colors": []},
                   "roof": {"vertices": [], "faces": [], "colors": []},
                   "facadeObjects": 0, "roofObjects": 0, "topZFtUS": -math.inf}
        for m in accepted
    }
    layer_counts = Counter()
    layer_cached = Counter()
    unassigned = Counter()
    color_by_layer = {}
    sample_ids = defaultdict(list)

    for obj in model.Objects:
        attrs, geom = obj.Attributes, obj.Geometry
        layer = layer_name(model, attrs.LayerIndex)
        if layer not in SURFACE_LAYERS:
            continue
        bounds = bbox_xy(geom)
        if not intersects(bounds, query_sp):
            continue
        layer_counts[layer] += 1
        rhino_layer = layer_for(model, attrs.LayerIndex)
        color = layer_color(rhino_layer, layer)
        color_by_layer[layer] = color
        for face in geom.Faces:
            cached = face.GetMesh(rhino3dm.MeshType.Any)
            if cached is None:
                unassigned[layer] += 1
                continue
            data = mesh_data(cached)
            if data is None:
                unassigned[layer] += 1
                continue
            vertices, faces = data
            layer_cached[layer] += 1
            footprint = assign_surface(vertices, faces, dcp_footprints, layer)
            if footprint is None or footprint["index"] not in accepted_by_dcp:
                unassigned[layer] += 1
                continue
            match = accepted_by_dcp[footprint["index"]]
            fid = match["fid"]
            group = groups[fid]
            group["topZFtUS"] = max(group["topZFtUS"], float(vertices[:, 2].max()))
            target = group["facade"] if layer == "Facade Surface" else group["roof"]
            append_mesh(target, vertices, faces, color)
            if layer == "Facade Surface":
                group["facadeObjects"] += 1
            else:
                group["roofObjects"] += 1
            if len(sample_ids[layer]) < 8:
                sample_ids[layer].append(str(attrs.Id))

    scene = trimesh.Scene()
    report_meshes = []
    match_report = []
    total_vertices = total_triangles = 0
    scale_rejected = []
    for fid, group in groups.items():
        current_rec = current_by_fid[fid]
        base_z = group["dcp"]["baseZFtUS"]
        dcp_height_ft = group["topZFtUS"] - base_z
        target_height_m = float(current_rec["heightFt"]) * FT_M
        dcp_height_m = dcp_height_ft * FTUS_M
        scale = target_height_m / dcp_height_m if dcp_height_m > 0.5 else math.inf
        row = {**group["match"], "dcpFootprintGuid": group["dcp"]["guid"],
               "dcpBaseZFtUS": base_z, "dcpHeightM": dcp_height_m,
               "currentHeightFt": float(current_rec["heightFt"]),
               "currentHeightM": target_height_m, "heightScale": scale,
               "facadeSurfaceObjects": group["facadeObjects"],
               "roofSurfaceObjects": group["roofObjects"]}
        if not (0.75 <= scale <= 1.25):
            row["status"] = "height-mismatch-fallback"
            scale_rejected.append(row)
            match_report.append(row)
            continue
        row["status"] = "preview-exported"
        match_report.append(row)
        for layer_key, layer_name_value in [("facade", "Facade Surface"), ("roof", "RoofTop Surface")]:
            raw = group[layer_key]
            if not raw["faces"]:
                continue
            source_vertices = np.asarray(raw["vertices"], dtype=np.float64)
            source_faces = np.asarray(raw["faces"], dtype=np.int64)
            lon, lat = SP_TO_WGS84.transform(source_vertices[:, 0], source_vertices[:, 1])
            east, north = np.asarray([wgs84_to_local(float(x), float(y)) for x, y in zip(lon, lat)]).T
            out_vertices = np.column_stack([
                east - center_e,
                (source_vertices[:, 2] - base_z) * FTUS_M * scale,
                center_n - north
            ])
            colors = np.asarray(raw["colors"], dtype=np.uint8)
            tm = trimesh.Trimesh(vertices=out_vertices, faces=source_faces,
                                 vertex_colors=colors, process=False)
            node_name = f"nyc_dcp2014_fid_{fid}_{layer_key}"
            scene.add_geometry(tm, geom_name=node_name, node_name=node_name)
            total_vertices += len(out_vertices)
            total_triangles += len(source_faces)
            report_meshes.append({
                "name": node_name, "vertices": out_vertices,
                "faces": source_faces, "color": color_by_layer.get(layer_name_value, [170,170,170,255])
            })

    if total_triangles == 0:
        raise RuntimeError("No high-confidence DCP 2014 surfaces matched current Times Square footprints")
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    scene.export(str(glb_path), file_type="glb")
    preview_png(report_meshes, preview_path)

    matches_csv = report_path.parent / "matches.csv"
    with matches_csv.open("w", newline="", encoding="utf-8") as stream:
        fields = ["fid", "dcpFootprintIndex", "iou", "dcpCoverage", "currentCoverage",
                  "centroidDistanceM", "currentHeightFt", "dcpHeightM", "heightScale",
                  "facadeSurfaceObjects", "roofSurfaceObjects", "status"]
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for row in match_report:
            writer.writerow({k: row.get(k) for k in fields})

    report = {
        "schema": "patrol-nyc-dcp-mn05-times-square-glb-preview-v1",
        "purpose": "bounded extraction preview only; not runtime integration",
        "source": {
            "publisher": "NYC Department of City Planning / NYC Open Data",
            "dataset": "NYC 3D Model by Community District, 2014",
            "district": "Manhattan CD5",
            "archive": "nyc_3dmodel_mn05.zip",
            "archiveUrl": "https://www1.nyc.gov/assets/planning/download/zip/data-maps/open-data/nyc-3d-model/nyc_3dmodel_mn05.zip",
            "modelBytes": model_path.stat().st_size,
            "modelSha256": sha256(model_path),
            "currentFootprintSource": current_dataset.get("reference"),
            "currentFootprintRetrieved": current_dataset.get("retrieved"),
        },
        "transform": {
            "sourceCRS": "EPSG:2263 (NAD83 / New York Long Island, US survey feet)",
            "rhinoModelUnitSystem": str(model.Settings.ModelUnitSystem),
            "originWgs84": list(ORIGIN),
            "sceneCenterEastNorthM": [center_e, center_n],
            "vertical": "per-building DCP footprint base Z subtracted; current 2026 HEIGHTROOF retained by a scale ratio",
            "scaleCaveat": "Model units report Feet while CRS uses US survey feet; polygon matching is used as a placement/scale validation, not as a survey certification.",
        },
        "counts": {
            "currentFootprintsValid": len(current),
            "dcpFootprintsInTile": len(dcp_footprints),
            "oneToOneGreedyMatches": len(matches),
            "highConfidenceFootprintMatches": len(accepted),
            "heightScaleAccepted": sum(1 for x in match_report if x["status"] == "preview-exported"),
            "heightScaleRejected": len(scale_rejected),
            "facadeSurfaceObjectsInTile": layer_counts.get("Facade Surface", 0),
            "roofSurfaceObjectsInTile": layer_counts.get("RoofTop Surface", 0),
            "facadeCachedMeshesRead": layer_cached.get("Facade Surface", 0),
            "roofCachedMeshesRead": layer_cached.get("RoofTop Surface", 0),
            "unassignedFacadeObjects": unassigned.get("Facade Surface", 0),
            "unassignedRoofObjects": unassigned.get("RoofTop Surface", 0),
            "glbVertices": total_vertices,
            "glbTriangles": total_triangles,
            "glbBytes": glb_path.stat().st_size,
        },
        "layerColorsRgba": color_by_layer,
        "matches": match_report,
        "sampleObjectGuids": dict(sample_ids),
        "scaleRejected": scale_rejected,
        "output": {
            "glb": glb_path.name,
            "previewPng": preview_path.name,
            "matchesCsv": matches_csv.name,
        },
        "limitations": [
            "2014 source geometry, not a current 2026 facade survey.",
            "Only high-confidence footprint overlaps and height-scale ratios in [0.75, 1.25] are exported.",
            "Facade surfaces are geometric planes; no photo textures, windows, storefronts or LED panels are inferred.",
            "No current-day collision, road access, curb elevation or traffic logic is included.",
            "The GLB is a QA artifact only and is not enabled in PATROL runtime by this PR.",
        ],
        "readyForVisualReview": total_triangles > 0 and len(accepted) >= 10,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"counts": report["counts"], "readyForVisualReview": report["readyForVisualReview"],
                      "output": report["output"]}, indent=2))
    if not report["readyForVisualReview"]:
        raise RuntimeError("Too few high-confidence current-footprint matches for visual review")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--footprints", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--glb", required=True, type=Path)
    parser.add_argument("--preview", required=True, type=Path)
    args = parser.parse_args()
    extract(args.model, args.footprints, args.report, args.glb, args.preview)


if __name__ == "__main__":
    main()
