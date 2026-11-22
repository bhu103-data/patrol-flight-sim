#!/usr/bin/env python3
"""Import the official 2014 NYC DCP Flatiron model into PATROL's existing GLB slot.

Only cached Rhino render meshes are accepted. This script never invents or
procedurally meshes source geometry. It requires a current OTI footprint match
before extracting the 2014 model surfaces.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rhino3dm
import trimesh
from shapely.geometry import Polygon, box, mapping
from shapely.ops import unary_union

BIN = "1016278"
BBL = "1008510001"
TARGET_HEIGHT = 17.0
MAX_TRIANGLES = 25000
MAX_GLB_BYTES = 8 * 1024 * 1024
MIN_FOOTPRINT_IOU = 0.88
MAX_HAUSDORFF_FT = 5.0
MAX_HEIGHT_DELTA_FT = 12.0
SURFACE_LAYERS = {
    "surfacerooftop": "roof",
    "surfacefacade": "facade",
    "surfacefootprint": "base",
}
FALLBACK_COLORS = {
    "roof": (105, 105, 101, 255),
    "facade": (183, 170, 151, 255),
    "base": (132, 128, 120, 255),
}
LICENSE_TEXT = (
    "City of New York, Department of City Planning / DOITT, NYC 3D Model by "
    "Community District (2014 aerial survey). NYC Open Data public-use terms "
    "state that public data may be used without restrictions; source "
    "attribution retained. No warranty. This is a 2014 geometry source, not "
    "a 2026 as-built scan."
)
SOURCE_URL = "https://data.cityofnewyork.us/d/tnru-abg2"
TERMS_URL = "https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje"


def norm_layer(name: str) -> str:
    return "".join(ch.lower() for ch in str(name) if ch.isalnum())


def get_bbox(geometry):
    try:
        return geometry.GetBoundingBox(True)
    except TypeError:
        return geometry.GetBoundingBox()


def bbox_values(geometry):
    bb = get_bbox(geometry)
    return (
        float(bb.Min.X), float(bb.Min.Y), float(bb.Max.X), float(bb.Max.Y),
        float(bb.Min.Z), float(bb.Max.Z),
    )


def curve_polygon(geometry):
    points = None
    if hasattr(geometry, "TryGetPolyline"):
        try:
            ok, polyline = geometry.TryGetPolyline()
            if ok:
                points = [(float(polyline[i].X), float(polyline[i].Y))
                          for i in range(len(polyline))]
        except Exception:
            points = None
    if points is None and hasattr(geometry, "PointAt") and hasattr(geometry, "Domain"):
        try:
            domain = geometry.Domain
            t0, t1 = float(domain.T0), float(domain.T1)
            points = []
            for i in range(129):
                p = geometry.PointAt(t0 + (t1 - t0) * i / 128)
                points.append((float(p.X), float(p.Y)))
        except Exception:
            points = None
    if points is None or len(points) < 4:
        return None
    if math.dist(points[0], points[-1]) > 0.01:
        points.append(points[0])
    polygon = Polygon(points)
    if not polygon.is_valid:
        polygon = polygon.buffer(0)
    if polygon.is_empty:
        return None
    if polygon.geom_type == "MultiPolygon":
        polygon = max(polygon.geoms, key=lambda item: item.area)
    if polygon.area < 10:
        return None
    return polygon


def read_oti_footprint(path: Path):
    data = json.loads(path.read_text(encoding="utf-8"))
    features = data.get("features") or []
    selected = []
    selected_sr = None
    for feature in features:
        attrs = feature.get("attributes") or {}
        bin_value = str(attrs.get("BIN", "")).split(".")[0]
        bbl_value = str(attrs.get("BASE_BBL", "")).split(".")[0]
        if bin_value != BIN and bbl_value != BBL:
            continue
        geometry = feature.get("geometry") or {}
        rings = geometry.get("rings") or []
        if not rings:
            continue
        polygon = Polygon(rings[0], rings[1:] if len(rings) > 1 else None)
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if not polygon.is_empty:
            selected.append((polygon, attrs))
            selected_sr = geometry.get("spatialReference") or data.get("spatialReference") or {}
    if not selected:
        raise RuntimeError("Current OTI query returned no footprint for BIN 1016278 / BBL 1008510001")
    wkid = (selected_sr or {}).get("latestWkid") or (selected_sr or {}).get("wkid")
    if wkid not in (2263, 102718, "2263", "102718", None):
        raise RuntimeError("OTI footprint is not EPSG:2263 / NY Long Island feet: " + str(wkid))
    footprint = unary_union([item[0] for item in selected])
    attrs = selected[0][1]
    height_ft = float(attrs.get("HEIGHT_ROOF") or 0)
    if height_ft <= 0:
        raise RuntimeError("Current OTI HEIGHT_ROOF is missing or non-positive")
    return footprint, attrs, wkid, height_ft


def mesh_for_geometry(geometry):
    if isinstance(geometry, rhino3dm.Mesh):
        yield geometry
        return
    mesh_types = []
    for name in ("Render", "Any"):
        value = getattr(rhino3dm.MeshType, name, None)
        if value is not None and value not in mesh_types:
            mesh_types.append(value)
    if isinstance(geometry, rhino3dm.Brep):
        for face in geometry.Faces:
            for mesh_type in mesh_types:
                try:
                    mesh = face.GetMesh(mesh_type)
                except Exception:
                    mesh = None
                if mesh is not None:
                    yield mesh
                    break
        return
    if hasattr(geometry, "GetMesh"):
        for mesh_type in mesh_types:
            try:
                mesh = geometry.GetMesh(mesh_type)
            except Exception:
                mesh = None
            if mesh is not None:
                yield mesh
                break


def rgba_from_color(color, fallback):
    if color is None:
        return fallback
    try:
        return (
            int(color.R), int(color.G), int(color.B),
            int(getattr(color, "A", 255)),
        )
    except Exception:
        return fallback


def extract_mesh_arrays(model, layer_names, source_footprint):
    vertices_all = []
    faces_all = []
    colors_all = []
    layer_objects = Counter()
    mesh_count = 0
    original_triangles = 0
    min_z = math.inf
    max_z = -math.inf
    xy_gate = source_footprint.buffer(3.0)

    for obj in model.Objects:
        attrs = obj.Attributes
        layer_name = layer_names.get(int(attrs.LayerIndex), "")
        layer_key = norm_layer(layer_name)
        if layer_key not in SURFACE_LAYERS:
            continue
        category = SURFACE_LAYERS[layer_key]
        geometry = obj.Geometry
        try:
            x0, y0, x1, y1, z0, z1 = bbox_values(geometry)
        except Exception:
            continue
        object_xy = box(x0, y0, x1, y1)
        if not xy_gate.intersects(object_xy.buffer(0.25)):
            continue

        try:
            layer = model.Layers[int(attrs.LayerIndex)]
        except Exception:
            layer = None
        fallback = rgba_from_color(getattr(layer, "Color", None), FALLBACK_COLORS[category])

        for rhino_mesh in mesh_for_geometry(geometry):
            try:
                vertex_count = len(rhino_mesh.Vertices)
            except Exception:
                continue
            if vertex_count < 3 or len(rhino_mesh.Faces) < 1:
                continue
            local_vertices = np.asarray(
                [[float(v.X), float(v.Y), float(v.Z)] for v in rhino_mesh.Vertices],
                dtype=np.float64,
            )
            local_faces = []
            for face in rhino_mesh.Faces:
                try:
                    a, b, c, d = int(face.A), int(face.B), int(face.C), int(face.D)
                    if min(a, b, c, d) < 0 or max(a, b, c, d) >= vertex_count:
                        continue
                    if bool(face.IsTriangle) or c == d:
                        local_faces.append((a, c, b))
                    elif bool(face.IsQuad):
                        local_faces.append((a, c, b))
                        local_faces.append((a, d, c))
                except Exception:
                    continue
            if not local_faces:
                continue

            vertex_colors = []
            try:
                source_colors = rhino_mesh.VertexColors
                if len(source_colors) == vertex_count:
                    vertex_colors = [
                        rgba_from_color(color, fallback) for color in source_colors
                    ]
            except Exception:
                vertex_colors = []
            if not vertex_colors:
                vertex_colors = [fallback] * vertex_count

            offset = sum(len(chunk) for chunk in vertices_all)
            vertices_all.append(local_vertices)
            faces_all.append(np.asarray(local_faces, dtype=np.int64) + offset)
            colors_all.append(np.asarray(vertex_colors, dtype=np.uint8))
            layer_objects[category] += 1
            mesh_count += 1
            original_triangles += len(local_faces)
            min_z = min(min_z, float(local_vertices[:, 2].min()))
            max_z = max(max_z, float(local_vertices[:, 2].max()))

    if not vertices_all or not faces_all:
        raise RuntimeError(
            "No cached render meshes intersect the matched Flatiron footprint; "
            "the 3DM surfaces may not contain importable render meshes"
        )

    vertices = np.vstack(vertices_all)
    faces = np.vstack(faces_all)
    colors = np.vstack(colors_all)
    return vertices, faces, colors, {
        "mesh_count": mesh_count,
        "surface_objects_by_layer": dict(layer_objects),
        "original_triangles": int(original_triangles),
        "source_mesh_height_ft": float(max_z - min_z),
        "source_min_z_ft": float(min_z),
        "source_max_z_ft": float(max_z),
    }


def build_glb(vertices, faces, colors):
    # Centering and height normalization are performed by PATROL's existing
    # decodeGLB() loader. Keep the source model in local feet here.
    mesh = trimesh.Trimesh(
        vertices=vertices,
        faces=faces,
        vertex_colors=colors,
        process=True,
        validate=True,
    )
    if len(mesh.faces) < 450:
        raise RuntimeError("Imported source mesh has fewer than 450 triangles")
    original_triangles = int(len(mesh.faces))
    original_vertices = mesh.vertices.copy()
    original_colors = np.asarray(mesh.visual.vertex_colors).copy()

    targets = [MAX_TRIANGLES, 23000, 20000, 17500]
    last_error = None
    for target in targets:
        candidate = mesh
        if len(mesh.faces) > target:
            try:
                candidate = mesh.simplify_quadric_decimation(face_count=target)
                if candidate is None or len(candidate.faces) < 450:
                    raise RuntimeError("Quadric decimation returned an invalid mesh")
                from scipy.spatial import cKDTree
                nearest = cKDTree(original_vertices).query(candidate.vertices, k=1)[1]
                candidate.visual.vertex_colors = original_colors[nearest]
            except Exception as error:
                last_error = str(error)
                continue
        payload = candidate.export(file_type="glb")
        if isinstance(payload, str):
            payload = payload.encode("utf-8")
        if len(candidate.faces) <= MAX_TRIANGLES and len(payload) <= MAX_GLB_BYTES:
            return payload, candidate, {
                "original_triangles_after_cleanup": original_triangles,
                "final_triangles": int(len(candidate.faces)),
                "final_vertices": int(len(candidate.vertices)),
                "glb_bytes": int(len(payload)),
                "decimated": bool(len(candidate.faces) < original_triangles),
            }
        last_error = (
            "Candidate exceeds runtime limits: "
            + str(len(candidate.faces)) + " triangles / "
            + str(len(payload)) + " bytes"
        )
    raise RuntimeError("Could not fit official model into PATROL's GLB budget: " + str(last_error))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--footprint", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--provenance", required=True)
    parser.add_argument("--snapshot-date", required=True)
    args = parser.parse_args()

    source_path = Path(args.source)
    footprint_path = Path(args.footprint)
    output_path = Path(args.output)
    manifest_path = Path(args.manifest)
    report_path = Path(args.report)
    provenance_path = Path(args.provenance)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    provenance_path.parent.mkdir(parents=True, exist_ok=True)

    report = {
        "passed": False,
        "asset": "assets/nyc/scenario/flatiron.glb",
        "source": {
            "owner": "City of New York / NYC Department of City Planning / DOITT",
            "dataset": "NYC 3D Model by Community District",
            "district_file": "nyc_3dmodel_mn05.zip",
            "vintage": 2014,
            "horizontal_crs": "EPSG:2263",
            "url": SOURCE_URL,
            "terms_url": TERMS_URL,
            "rights": LICENSE_TEXT,
        },
        "target": {
            "building": "Flatiron Building",
            "address": "175 Fifth Avenue, Manhattan, New York, NY, USA",
            "BIN": BIN,
            "BBL": BBL,
            "patrol_landmark": "flatiron",
            "target_height_game_units": TARGET_HEIGHT,
            "placement": "Existing compressed PATROL landmark anchor; not georeferenced or 1:1",
        },
        "snapshot_date": args.snapshot_date,
        "limitations": [
            "2014 survey geometry, not a 2026 as-built scan",
            "No photogrammetric facade textures are claimed",
            "PATROL's Manhattan map is compressed and not a geospatial 1:1 replacement",
            "Only matched roof/facade/footprint surface layers are imported",
        ],
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
    }

    try:
        oti_poly, attrs, wkid, height_roof_ft = read_oti_footprint(footprint_path)
        report["target"]["HEIGHT_ROOF_ft"] = height_roof_ft
        report["target"]["DOITT_ID"] = attrs.get("DOITT_ID")
        report["target"]["OTI_LAST_EDITED_DATE"] = attrs.get("LAST_EDITED_DATE")
        report["target"]["OTI_spatial_reference_wkid"] = wkid

        model = rhino3dm.File3dm.Read(str(source_path))
        if model is None:
            raise RuntimeError("rhino3dm could not read the official 3DM file")
        unit = str(getattr(model.Settings, "ModelUnitSystem", "unknown"))
        report["source"]["rhino_model_units"] = unit

        layer_names = {}
        layer_inventory = Counter()
        for index in range(len(model.Layers)):
            layer = model.Layers[index]
            layer_names[index] = str(layer.Name)
        footprint_candidates = []
        target_center = oti_poly.centroid
        for obj in model.Objects:
            attrs_obj = obj.Attributes
            layer_name = layer_names.get(int(attrs_obj.LayerIndex), "")
            key = norm_layer(layer_name)
            layer_inventory[layer_name] += 1
            if key not in ("buildingfootprint", "surfacefootprint"):
                continue
            geometry = obj.Geometry
            try:
                bb = bbox_values(geometry)
                center_distance = math.hypot(
                    (bb[0] + bb[2]) * 0.5 - target_center.x,
                    (bb[1] + bb[3]) * 0.5 - target_center.y,
                )
            except Exception:
                center_distance = 0
            if center_distance > 250:
                continue
            candidate = curve_polygon(geometry)
            if candidate is None:
                continue
            intersection = candidate.intersection(oti_poly).area
            union_area = candidate.union(oti_poly).area
            iou = intersection / union_area if union_area else 0
            hausdorff = candidate.hausdorff_distance(oti_poly)
            footprint_candidates.append({
                "polygon": candidate,
                "layer": layer_name,
                "iou": float(iou),
                "hausdorff_ft": float(hausdorff),
                "centroid_distance_ft": float(candidate.centroid.distance(target_center)),
                "area_sqft": float(candidate.area),
            })
        if not footprint_candidates:
            raise RuntimeError(
                "No source footprint curve was found near the current OTI Flatiron footprint"
            )
        footprint_candidates.sort(
            key=lambda item: (item["iou"], -item["hausdorff_ft"]), reverse=True
        )
        best = footprint_candidates[0]
        report["source"]["footprint_match"] = {
            key: value for key, value in best.items() if key != "polygon"
        }
        report["source"]["nearby_footprint_candidate_count"] = len(footprint_candidates)
        report["source"]["layer_inventory"] = dict(layer_inventory)
        if best["iou"] < MIN_FOOTPRINT_IOU:
            raise RuntimeError(
                "2014 source footprint does not match current OTI footprint: IoU "
                + f"{best['iou']:.4f} < {MIN_FOOTPRINT_IOU:.2f}"
            )
        if best["hausdorff_ft"] > MAX_HAUSDORFF_FT:
            raise RuntimeError(
                "2014 source footprint differs from current OTI geometry by "
                + f"{best['hausdorff_ft']:.2f} ft"
            )

        source_poly = best["polygon"]
        geojson = {
            "type": "Feature",
            "properties": {
                "source": "NYC DCP / DOITT 2014 3D Model",
                "current_bin": BIN,
                "current_bbl": BBL,
                "footprint_iou": best["iou"],
                "hausdorff_ft": best["hausdorff_ft"],
            },
            "geometry": mapping(source_poly),
        }
        (report_path.parent / "flatiron-source-footprint.geojson").write_text(
            json.dumps(geojson, indent=2), encoding="utf-8"
        )

        vertices, faces, colors, mesh_report = extract_mesh_arrays(
            model, layer_names, source_poly
        )
        report["source"]["mesh"] = mesh_report
        height_delta = abs(mesh_report["source_mesh_height_ft"] - height_roof_ft)
        report["source"]["height_delta_vs_current_oti_ft"] = float(height_delta)
        if height_delta > MAX_HEIGHT_DELTA_FT:
            raise RuntimeError(
                "2014 model height differs from current OTI HEIGHT_ROOF by "
                + f"{height_delta:.2f} ft"
            )

        # Convert Rhino (east,north,up) to GLB (east,up,north). The existing
        # loader centers X/Z and scales Y to the manifest target height.
        glb_vertices = np.column_stack((vertices[:, 0], vertices[:, 2], vertices[:, 1]))
        glb_payload, final_mesh, glb_report = build_glb(
            glb_vertices, faces, colors
        )
        report["runtime"] = glb_report
        report["runtime"]["source_width_ft"] = float(
            glb_vertices[:, 0].max() - glb_vertices[:, 0].min()
        )
        report["runtime"]["source_depth_ft"] = float(
            glb_vertices[:, 2].max() - glb_vertices[:, 2].min()
        )
        report["runtime"]["source_height_ft"] = float(
            glb_vertices[:, 1].max() - glb_vertices[:, 1].min()
        )

        output_path.write_bytes(glb_payload)
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        entry = manifest["landmarks"]["flatiron"]
        entry["enabled"] = True
        entry["file"] = "scenario/flatiron.glb"
        entry["target_height"] = TARGET_HEIGHT
        entry["min_triangles"] = 450
        entry["license"] = LICENSE_TEXT
        manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

        provenance = {
            **report,
            "passed": True,
            "runtime": {
                **report["runtime"],
                "manifest_enabled": True,
                "manifest_target_height": TARGET_HEIGHT,
                "manifest_max_glb_bytes": MAX_GLB_BYTES,
            },
        }
        provenance_path.write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")

        notice_path = Path("assets/nyc/THIRD_PARTY_NOTICES.md")
        notice = notice_path.read_text(encoding="utf-8") if notice_path.exists() else ""
        marker = "## NYC Department of City Planning / DOITT — 2014 3D Model"
        if marker not in notice:
            notice += (
                "\n\n" + marker + "\n\n"
                + "- Asset: scenario/flatiron.glb (Flatiron Building, BIN 1016278).\n"
                + "- Source: [NYC 3D Model by Community District](" + SOURCE_URL + ").\n"
                + "- Data owner: City of New York, Department of City Planning / DOITT.\n"
                + "- Data vintage: 2014 aerial survey; district file nyc_3dmodel_mn05.zip.\n"
                + "- Coordinate reference: EPSG:2263; source model geometry matched to the current OTI footprint before extraction.\n"
                + "- Usage: NYC Open Data terms state public data may be used without restrictions; retain attribution. [Terms](" + TERMS_URL + ").\n"
                + "- Limitations: no photogrammetric facade textures are claimed; 2014 source, not a 2026 as-built scan; PATROL landmark placement remains compressed/non-georeferenced.\n"
            )
            notice_path.write_text(notice, encoding="utf-8")

        report["passed"] = True
        report["runtime"] = {
            **report["runtime"],
            "manifest_enabled": True,
            "manifest_target_height": TARGET_HEIGHT,
            "manifest_max_glb_bytes": MAX_GLB_BYTES,
        }
    except Exception as error:
        report["error"] = str(error)
        report["passed"] = False
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2))
        raise

    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
