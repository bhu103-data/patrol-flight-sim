#!/usr/bin/env python3
"""Extract bounded 2014 NYC DCP MN05 roof + facade cached meshes.

Only original Rhino BrepFace.GetMesh(MeshType.Any) triangles are used.
Roof patches match by 2D area overlap; vertical facade patches match only
when their XY projection uniquely follows a current official footprint edge.
Relative source Z is normalized to the newer HEIGHTROOF for display only.
Absolute 2014 vertical datum is deliberately not asserted or imported.
"""
from __future__ import annotations
import collections
import hashlib
import json
import math
import pathlib
import sys

import rhino3dm
from shapely.geometry import Polygon

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from official_mn05_projection import (
    metric_to_mn05_stateplane,
    mn05_stateplane_to_metric,
    ORIGIN_WGS84,
    METRES_PER_DEG_LATITUDE,
    METRES_PER_DEG_LONGITUDE,
)
from mn05_facade_source_support import (
    cached_mesh_triangles,
    match_facade_patch,
    match_roof_triangles,
    relative_height_metres, plausible_height_ratio,
)

DIR = pathlib.Path("artifacts/nyc-official-mn05")
SOURCE = DIR / "mn05-source.3dm"
PROBE = DIR / "mn05-probe.json"
ROOF_SOURCE = DIR / "times-square-original-roof-mesh.json"
OUTPUT = DIR / "mn05-roof-facade-metric-preview.json"
BOUNDS_METRES = (-315.0, -175.0, 380.0, 530.0)
BOUND_SOURCE = [
    metric_to_mn05_stateplane(x, y)
    for x in (BOUNDS_METRES[0], BOUNDS_METRES[2])
    for y in (BOUNDS_METRES[1], BOUNDS_METRES[3])
]
MINX = min(p[0] for p in BOUND_SOURCE)
MINY = min(p[1] for p in BOUND_SOURCE)
MAXX = max(p[0] for p in BOUND_SOURCE)
MAXY = max(p[1] for p in BOUND_SOURCE)
ZIP_SHA = "71e6242c55ca7069f67c0bfd8e6d4764c9e6020a361e6bfa77880effe7520bf2"
MODEL_SHA = "b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"
MAX_FACADE_PATCHES = 5000
MAX_FACADE_TRIANGLES = 50000
MAX_ROOF_TRIANGLES = 150000


def local_from_wgs(lon, lat):
    return ((lon - ORIGIN_WGS84[0]) * METRES_PER_DEG_LONGITUDE,
            (lat - ORIGIN_WGS84[1]) * METRES_PER_DEG_LATITUDE)


def load_buildings():
    source = json.loads(pathlib.Path("assets/nyc/times-square-footprints.json").read_text())
    buildings = []
    for row in source["features"]:
        rings = row.get("rings", [])
        if len(rings) != 1 or len(rings[0]) < 4 or row.get("heightFt", 0) <= 0:
            continue
        outline = [local_from_wgs(*point[:2]) for point in rings[0]]
        polygon = Polygon(outline)
        if not polygon.is_valid or polygon.area < 2:
            continue
        buildings.append({
            "fid": int(row["fid"]),
            "heightFt": float(row["heightFt"]),
            "heightMetres": float(row["heightFt"]) * 0.3048,
            "geometry": polygon,
            "outline": [[round(x, 4), round(y, 4)] for x, y in outline],
        })
    if len(buildings) < 100:
        raise RuntimeError("Official 2026-11-20 Times Square footprint snapshot is incomplete")
    return buildings


def source_roof_patches(buildings):
    source = json.loads(ROOF_SOURCE.read_text())
    if (source.get("source3dmSHA256") != MODEL_SHA or
            source.get("sourceCRS") != "EPSG:2263 (US survey feet)"):
        raise RuntimeError("Roof source provenance does not match the pinned MN05 model")
    accepted = []
    rejected = collections.Counter()
    total_triangles = 0
    for patch in source.get("sourceRooftop3dMeshPatches", []):
        flat = patch["vertices"]
        points = [flat[i:i+3] for i in range(0, len(flat), 3)]
        indices = patch["sourceTriangles"]
        triangles = []
        for i in range(0, len(indices), 3):
            tri = [points[indices[i]], points[indices[i+1]], points[indices[i+2]]]
            triangles.append(tri)
        match = match_roof_triangles(triangles, buildings)
        if match is None:
            rejected["noUnique2022FootprintAreaMatch"] += 1
            continue
        accepted.append({
            "sourceUuid": patch["sourceObjectUUID"],
            "matchedFid": match["building"]["fid"],
            "coverage": float(match["coverage"]),
            "secondBestCoverage": float(match["secondBestCoverage"]),
            "coverageMargin": float(match["coverageMargin"]),
            "triangles": triangles,
        })
        total_triangles += len(triangles)
        if total_triangles > MAX_ROOF_TRIANGLES:
            raise RuntimeError("Matched original roof triangle budget exceeded")
    return accepted, rejected


def source_facade_patches(model, buildings):
    layers = {i: str(layer.FullPath or layer.Name)
              for i, layer in enumerate(model.Layers)}
    facade_indices = {i for i, name in layers.items()
                      if "Facade Surface" in name}
    if not facade_indices:
        raise RuntimeError("Official MN05 Buildings::Facade Surface layer is missing")
    accepted = []
    rejected = collections.Counter()
    roi_objects = 0
    cached_faces = 0
    triangle_total = 0
    for object_index, obj in enumerate(model.Objects):
        if obj.Attributes.LayerIndex not in facade_indices:
            continue
        geom = obj.Geometry
        if not hasattr(geom, "Faces") or not hasattr(geom, "GetBoundingBox"):
            rejected["notBrepFacade"] += 1
            continue
        try:
            bbox = geom.GetBoundingBox()
            if bbox is None:
                rejected["missingBrepBounds"] += 1
                continue
            lo, hi = bbox.Min, bbox.Max
            if hi.X < MINX or lo.X > MAXX or hi.Y < MINY or lo.Y > MAXY:
                continue
        except Exception:
            rejected["invalidBrepBounds"] += 1
            continue
        roi_objects += 1
        for face_index, face in enumerate(geom.Faces):
            try:
                cached = face.GetMesh(rhino3dm.MeshType.Any)
            except Exception:
                rejected["cachedMeshReadError"] += 1
                continue
            if cached is None:
                rejected["noCachedFaceMesh"] += 1
                continue
            cached_faces += 1
            try:
                triangles, xy_points = cached_mesh_triangles(
                    cached, mn05_stateplane_to_metric)
                if not triangles:
                    rejected["emptyCachedFaceMesh"] += 1
                    continue
                match = match_facade_patch(xy_points, buildings)
                if match is None:
                    rejected["noUniqueFootprintBoundaryMatch"] += 1
                    continue
                if len(accepted) >= MAX_FACADE_PATCHES:
                    raise RuntimeError("Matched facade patch budget exceeded")
                triangle_total += len(triangles)
                if triangle_total > MAX_FACADE_TRIANGLES:
                    raise RuntimeError("Matched facade triangle budget exceeded")
                accepted.append({
                    "sourceUuid": str(obj.Attributes.Id),
                    "sourceObjectIndex": object_index,
                    "brepFaceIndex": face_index,
                    "matchedFid": match["building"]["fid"],
                    "boundaryCoverage": round(match["coverage"], 5),
                    "boundaryDistanceMetres": round(
                        match["boundaryDistanceMetres"], 4),
                    "triangles": triangles,
                })
            except RuntimeError:
                raise
            except Exception:
                rejected["invalidCachedFacadeGeometry"] += 1
    stats = {
        "facadeLayerNames": [layers[i] for i in sorted(facade_indices)],
        "facadeBrepObjectsInsideROI": roi_objects,
        "cachedFacadeFacesRead": cached_faces,
        "matchedFacadePatches": len(accepted),
        "matchedFacadeTriangles": triangle_total,
        "rejected": dict(rejected),
    }
    return accepted, stats


def main():
    report = {
        "schema": "patrol-mn05-2014-roof-facade-relative-height-v1",
        "source": "NYC DCP official 2014 Manhattan MN05 Rhino 3DM",
        "sourceUrl": "https://data.cityofnewyork.us/d/u5j4-zxpn",
        "sourceZipSha256": ZIP_SHA,
        "source3dmSha256": MODEL_SHA,
        "sourceYear": 2014,
        "sourceCRS": "EPSG:2263 US survey feet; transformed to local WGS84 east/north metres",
        "localOriginLonLat": list(ORIGIN_WGS84),
        "roiBoundsMetres": list(BOUNDS_METRES),
        "modernHeightSource": "NYC Building Footprints HEIGHTROOF snapshot retrieved 2026-11-20",
        "sourceVerticalDatumVerified": False,
        "sourceAbsoluteZUsed": False,
        "roofMatchUniquenessGate": {"minimumCoverage": 0.60, "minimumCoverageMargin": 0.08, "appliesTo": "roof patches only"},
        "heightRatioGate": {"min": 0.50, "max": 1.75,
            "meaning": "conservative source-Z-span / modern HEIGHTROOF plausibility filter; not vertical datum proof"},
        "verticalDisplayRule": "per-FID relative raw 2014 source Z normalized to current HEIGHTROOF; no absolute source elevation",
        "assetRole": "RESEARCH_PREVIEW_ONLY_NOT_PATROL_RUNTIME_OR_COLLISION",
        "meshAccepted": False,
        "errors": [],
    }
    try:
        previous = json.loads(PROBE.read_text())
        if (not previous.get("imported") or previous.get("sha256") != ZIP_SHA or
                previous.get("source3dmSha256") != MODEL_SHA):
            raise RuntimeError("Official MN05 ZIP/3DM provenance SHA mismatch")
        if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != MODEL_SHA:
            raise RuntimeError("Original MN05 Rhino bytes changed after source audit")
        model = rhino3dm.File3dm.Read(str(SOURCE))
        if model is None:
            raise RuntimeError("Original NYC DCP MN05 model failed to parse")
        model_units = getattr(getattr(model, "Settings", None), "ModelUnitSystem", None)
        try:
            model_units_value = int(model_units)
        except Exception:
            model_units_value = None
        report["sourceModelUnitSystem"] = str(model_units)
        report["sourceModelUnitSystemValue"] = model_units_value
        report["sourceVerticalUnitVerified"] = model_units_value == 9
        if model_units_value != 9:
            raise RuntimeError("Rhino ModelUnitSystem is not verified Feet (enum 9); cannot compare raw Z span with HEIGHTROOF feet")
        buildings = load_buildings()
        roofs, rejected_roofs = source_roof_patches(buildings)
        facades, facade_stats = source_facade_patches(model, buildings)
        report["sourceFacadeStats"] = facade_stats
        report["rejectedRoofPatches"] = dict(rejected_roofs)
        report["candidateRoofPatches"] = len(roofs)
        report["candidateFacadePatches"] = len(facades)

        building_by_fid = {b["fid"]: b for b in buildings}
        source_z = collections.defaultdict(list)
        for patch in roofs:
            for tri in patch["triangles"]:
                source_z[patch["matchedFid"]].extend(p[2] for p in tri)
        for patch in facades:
            for tri in patch["triangles"]:
                source_z[patch["matchedFid"]].extend(p[2] for p in tri)

        valid_fids = set()
        building_stats = []
        for fid, values in source_z.items():
            if len(values) < 3:
                continue
            low, high = min(values), max(values)
            if not math.isfinite(low) or not math.isfinite(high) or high-low < 0.25:
                continue
            building = building_by_fid[fid]
            height_ratio = (high-low) / building["heightFt"]
            if not plausible_height_ratio(high-low, building["heightFt"]):
                report.setdefault("heightRatioRejectedFids", []).append({
                    "fid": fid, "sourceZSpan": round(high-low, 4),
                    "modernHeightFt": round(building["heightFt"], 4),
                    "ratio": round(height_ratio, 4)})
                continue
            valid_fids.add(fid)
            building_stats.append({
                "fid": fid,
                "heightMetres": round(building["heightMetres"], 3),
                "sourceRelativeZRange": [round(low, 4), round(high, 4)],
                "sourceRelativeZSpan": round(high-low, 4),
                "sourceToModernHeightRatio": round(height_ratio, 4),
                "roofPatchCount": sum(1 for p in roofs if p["matchedFid"] == fid),
                "facadePatchCount": sum(1 for p in facades if p["matchedFid"] == fid),
                "outline": building["outline"],
            })
        if len(valid_fids) < 5:
            raise RuntimeError("Fewer than five buildings have matched source roof/facade height ranges")

        def display_triangles(patches, kind):
            output = []
            for patch in patches:
                fid = patch["matchedFid"]
                if fid not in valid_fids:
                    continue
                low, high = min(source_z[fid]), max(source_z[fid])
                height = building_by_fid[fid]["heightMetres"]
                for tri in patch["triangles"]:
                    vertices = []
                    for east, north, raw_z in tri:
                        if high-low < 0.25:
                            y = height
                        else:
                            y = relative_height_metres(raw_z, low, high, height)
                        vertices.append([round(east, 4), round(y, 4), round(north, 4)])
                    item = {
                        "sourceUuid": patch["sourceUuid"],
                        "matchedFid": fid,
                        "vertices": vertices,
                        "matchCoverage": patch.get("coverage",
                            patch.get("boundaryCoverage", 0.0)),
                    }
                    if kind == "roof":
                        item["secondBestCoverage"] = patch["secondBestCoverage"]
                        item["matchMargin"] = patch["coverageMargin"]
                    output.append(item)
            return output

        roof_triangles = display_triangles(roofs, "roof")
        facade_triangles = display_triangles(facades, "facade")
        if len(roof_triangles) < 100 or len(facade_triangles) < 100:
            raise RuntimeError("Matched roof/facade triangle count is below visual pilot threshold")
        report["counts"] = {
            "official2022Footprints": len(buildings),
            "matchedBuildingFids": len(valid_fids),
            "roofTriangles": len(roof_triangles),
            "facadeTriangles": len(facade_triangles),
            "roofPatches": len(roofs),
            "facadePatches": len(facades),
            "heightRatioRejectedFids": len(report.get("heightRatioRejectedFids", [])),
        }
        report["buildings"] = [b for b in building_stats if b["fid"] in valid_fids]
        report["roofTriangles"] = roof_triangles
        report["facadeTriangles"] = facade_triangles
        report["meshAccepted"] = True
    except Exception as error:
        report["errors"].append(type(error).__name__ + ": " + str(error))
    finally:
        SOURCE.unlink(missing_ok=True)
        OUTPUT.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
        summary = {k: v for k, v in report.items()
                   if k not in ("roofTriangles", "facadeTriangles", "buildings")}
        print("NYC official MN05 roof/facade relative-height QA",
              json.dumps(summary, ensure_ascii=False))
    if not report["meshAccepted"] or report["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
