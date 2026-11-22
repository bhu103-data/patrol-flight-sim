#!/usr/bin/env python3
"""Extract authentic 2014 MN05 footprint-base and facade meshes for a bounded
current Times Square subset whose roof tops already match official OTI heights.

This is a source-geometry QA artifact, not a production importer. All facade
and roof triangles come from the original Rhino cached display tessellation.
"""
from __future__ import annotations

import hashlib
import json
import math
import pathlib
import statistics
import sys
import uuid

import rhino3dm

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from official_mn05_projection import mn05_stateplane_to_metric

ROOT = pathlib.Path(__file__).resolve().parents[2]
FOLDER = ROOT / "artifacts/nyc-official-mn05"
SOURCE = FOLDER / "mn05-source.3dm"
PROBE = FOLDER / "mn05-probe.json"
ROOF_MESH = FOLDER / "times-square-original-roof-mesh.json"
AUDIT = FOLDER / "roof-vertical-reference-audit.json"
FOOTPRINTS = ROOT / "assets/nyc/times-square-footprints.json"
OUT = FOLDER / "current-building-facade-pilot.json"
OUT_SUMMARY = FOLDER / "current-building-relative-height-audit.json"
ORIGIN = (-73.9864883, 40.756421)
RAD = math.pi / 180.0
A = 6378137.0
F = 1.0 / 298.257223563
E2 = F * (2.0 - F)
PHI = ORIGIN[1] * RAD
SIN_PHI = math.sin(PHI)
DENOM = math.sqrt(1.0 - E2 * SIN_PHI * SIN_PHI)
M_PER_RAD_LON = A / DENOM * math.cos(PHI)
M_PER_RAD_LAT = A * (1.0 - E2) / DENOM ** 3
MAX_FACADE_TRIANGLES = 150000
MAX_FACADE_VERTICES = 250000
VERTICAL_TOLERANCE_FT = 1.6


def wgs84_to_local(lon: float, lat: float) -> tuple[float, float]:
    return (
        (float(lon) - ORIGIN[0]) * RAD * M_PER_RAD_LON,
        (float(lat) - ORIGIN[1]) * RAD * M_PER_RAD_LAT,
    )


def point_on_segment(x, y, a, b, tolerance=0.12):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    if length2 <= tolerance * tolerance:
        return math.hypot(x - a[0], y - a[1]) <= tolerance
    t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / length2))
    px, py = a[0] + t * dx, a[1] + t * dy
    return math.hypot(x - px, y - py) <= tolerance


def point_in_ring(x, y, ring):
    inside = False
    if len(ring) < 3:
        return False
    j = len(ring) - 1
    for i, a in enumerate(ring):
        b = ring[j]
        if point_on_segment(x, y, a, b):
            return True
        if (a[1] > y) != (b[1] > y):
            crossing_x = (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]
            if x < crossing_x:
                inside = not inside
        j = i
    return inside


def mesh_face_indices(face):
    if all(hasattr(face, name) for name in ("A", "B", "C", "D")):
        values = (face.A, face.B, face.C, face.D)
    elif isinstance(face, (tuple, list)) and len(face) in (3, 4):
        values = tuple(face) + (tuple(face[-1:]) if len(face) == 3 else ())
    else:
        raise ValueError("Unexpected rhino3dm MeshFace representation")
    try:
        return tuple(int(value) for value in values)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError("Invalid Rhino cached mesh face indices") from exc


def face_triangles(mesh):
    count = len(mesh.Vertices)
    indices = []
    degenerate = 0
    points = [(float(v.X), float(v.Y), float(v.Z)) for v in mesh.Vertices]
    if any(not all(math.isfinite(t) for t in p) for p in points):
        raise ValueError("Non-finite original MN05 facade vertex")
    for face_index in range(len(mesh.Faces)):
        a, b, c, d = mesh_face_indices(mesh.Faces[face_index])
        triangles = [(a, b, c)]
        if d != c:
            triangles.append((a, c, d))
        for tri in triangles:
            if min(tri) < 0 or max(tri) >= count:
                raise ValueError("Original MN05 facade triangle index outside vertex pool")
            p, q, r = [points[i] for i in tri]
            u = [q[j] - p[j] for j in range(3)]
            v = [r[j] - p[j] for j in range(3)]
            cross = (
                u[1] * v[2] - u[2] * v[1],
                u[2] * v[0] - u[0] * v[2],
                u[0] * v[1] - u[1] * v[0],
            )
            if math.sqrt(sum(t * t for t in cross)) < 1e-8:
                degenerate += 1
                continue
            indices.extend(tri)
    return points, indices, degenerate


def load_candidates():
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    historic_rows = audit.get("historicComparison", {}).get("perHistoricBuilding", [])
    historic_ids = set()
    for row in historic_rows:
        if str(row.get("lastStatusType") or "").lower() in {
            "alteration", "demolition", "merged", "marked for demolition"
        }:
            if row.get("bin") not in (None, 0):
                historic_ids.add(("bin", row["bin"]))
            if row.get("doittId") not in (None, 0):
                historic_ids.add(("doitt", row["doittId"]))
    selected = {}
    for row in audit.get("perBuilding", []):
        delta = row.get("deltaSourceMinusOtiFt")
        year = row.get("constructionYear")
        if not (
            row.get("verticalComparisonEligible")
            and row.get("featureCode") == 2100
            and year is not None and year <= 2014
            and row.get("lastStatusType") == "Constructed"
            and delta is not None and abs(delta) <= VERTICAL_TOLERANCE_FT
            and row.get("otiGroundElevationFt") is not None
            and row.get("otiRoofHeightAboveGroundFt") is not None
        ):
            continue
        if (
            ("bin", row.get("bin")) in historic_ids
            or ("doitt", row.get("doittId")) in historic_ids
        ):
            continue
        selected[row["fid"]] = row
    if len(selected) < 20:
        raise ValueError(f"Too few high-confidence current building candidates: {len(selected)}")
    return audit, selected


def load_candidate_rings(selected):
    snapshot = json.loads(FOOTPRINTS.read_text(encoding="utf-8"))
    rings = {}
    for feature in snapshot.get("features", []):
        fid = feature.get("fid")
        if fid not in selected or len(feature.get("rings", [])) != 1:
            continue
        ring = [wgs84_to_local(p[0], p[1]) for p in feature["rings"][0]]
        if len(ring) > 1 and math.dist(ring[0], ring[-1]) <= 0.12:
            ring.pop()
        if len(ring) >= 3:
            rings[fid] = ring
    missing = sorted(set(selected) - set(rings))
    if missing:
        raise ValueError(f"Candidate FIDs missing a single-ring official footprint: {missing}")
    return rings


def match_center(center, rings):
    hits = [fid for fid, ring in rings.items() if point_in_ring(center[0], center[1], ring)]
    if len(hits) == 1:
        return hits[0], "center-contained"
    return None, "ambiguous" if len(hits) > 1 else "outside"


def mesh_match(vertices, rings):
    xy = [mn05_stateplane_to_metric(x, y) for x, y, _ in vertices]
    if not xy:
        return None, "empty"
    cx = sum(p[0] for p in xy) / len(xy)
    cy = sum(p[1] for p in xy) / len(xy)
    candidates = []
    for fid, ring in rings.items():
        fraction = sum(point_in_ring(x, y, ring) for x, y in xy) / len(xy)
        center_inside = point_in_ring(cx, cy, ring)
        score = fraction + (0.20 if center_inside else 0.0)
        if fraction >= 0.35 or (center_inside and fraction >= 0.20):
            candidates.append((score, fraction, center_inside, fid))
    candidates.sort(reverse=True)
    if not candidates:
        return None, "outside"
    if len(candidates) > 1 and candidates[0][0] - candidates[1][0] < 0.15:
        return None, "ambiguous"
    score, fraction, center_inside, fid = candidates[0]
    if fraction < 0.55 and not center_inside:
        return None, "partial"
    return fid, "vertex-contained"


def collect_base_z(geom):
    bbox = geom.GetBoundingBox()
    z_values = []
    if hasattr(geom, "Faces"):
        for face_index in range(len(geom.Faces)):
            try:
                mesh = geom.Faces[face_index].GetMesh(rhino3dm.MeshType.Any)
                if mesh:
                    z_values.extend(float(v.Z) for v in mesh.Vertices)
            except Exception:
                continue
    if not z_values:
        z_values = [float(bbox.Min.Z), float(bbox.Max.Z)]
    if not all(math.isfinite(z) for z in z_values):
        raise ValueError("Non-finite FootPrint Surface Z")
    return {
        "zMinRawFt": min(z_values),
        "zMedianRawFt": statistics.median(z_values),
        "zMaxRawFt": max(z_values),
        "zSampleCount": len(z_values),
    }


def main():
    probe = json.loads(PROBE.read_text(encoding="utf-8"))
    mesh = json.loads(ROOF_MESH.read_text(encoding="utf-8"))
    expected_source_sha = "b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57"
    if probe.get("source3dmSha256") != expected_source_sha:
        raise ValueError("MN05 probe does not reference the vetted original Rhino source")
    if mesh.get("source3dmSHA256") != expected_source_sha:
        raise ValueError("Roof mesh does not reference the vetted original Rhino source")
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != expected_source_sha:
        raise ValueError("Temporary Rhino source bytes changed before facade extraction")
    audit, selected = load_candidates()
    rings = load_candidate_rings(selected)
    if "feet" not in str(probe.get("modelUnitSystem", "")).lower():
        raise ValueError("Original Rhino model Z unit is not explicitly recognised as feet")
    model = rhino3dm.File3dm.Read(str(SOURCE))
    if model is None:
        raise ValueError("Original NYC MN05 source model could not be read")
    layer_names = {
        i: str(layer.FullPath or layer.Name)
        for i, layer in enumerate(model.Layers)
    }
    base_layers = {
        i for i, name in layer_names.items()
        if name.endswith("FootPrint Surface") or name == "FootPrint Surface"
    }
    facade_layers = {
        i for i, name in layer_names.items()
        if name.endswith("Facade Surface") or name == "Facade Surface"
    }
    if not base_layers or not facade_layers:
        raise ValueError("Original MN05 FootPrint Surface or Facade Surface layer missing")
    base_by_fid = {fid: [] for fid in selected}
    facade_patches = []
    counts = {
        "footprintSurfaceObjectsInRoi": 0,
        "matchedFootprintSurfaceObjects": 0,
        "ambiguousFootprintSurfaceObjects": 0,
        "unmatchedFootprintSurfaceObjects": 0,
        "facadeObjectsInRoi": 0,
        "matchedFacadeFaces": 0,
        "ambiguousFacadeFaces": 0,
        "unmatchedFacadeFaces": 0,
        "facadeDegenerateTrianglesRejected": 0,
    }
    total_triangles = total_vertices = 0
    candidate_bounds = {}
    for fid, ring in rings.items():
        candidate_bounds[fid] = (
            min(p[0] for p in ring), min(p[1] for p in ring),
            max(p[0] for p in ring), max(p[1] for p in ring),
        )
    for obj in model.Objects:
        layer_index = obj.Attributes.LayerIndex
        if layer_index not in base_layers and layer_index not in facade_layers:
            continue
        geom = obj.Geometry
        if not hasattr(geom, "GetBoundingBox"):
            continue
        bbox = geom.GetBoundingBox()
        if bbox is None:
            continue
        center = mn05_stateplane_to_metric(
            (bbox.Min.X + bbox.Max.X) * 0.5,
            (bbox.Min.Y + bbox.Max.Y) * 0.5,
        )
        bbox_xy = (
            *mn05_stateplane_to_metric(bbox.Min.X, bbox.Min.Y),
            *mn05_stateplane_to_metric(bbox.Max.X, bbox.Max.Y),
        )
        # Fast bounded ROI rejection before reading cached face meshes.
        possible = [
            fid for fid, (xmin, ymin, xmax, ymax) in candidate_bounds.items()
            if not (
                bbox_xy[2] < xmin - 1.0 or bbox_xy[0] > xmax + 1.0
                or bbox_xy[3] < ymin - 1.0 or bbox_xy[1] > ymax + 1.0
            )
        ]
        if not possible:
            continue
        if layer_index in base_layers:
            counts["footprintSurfaceObjectsInRoi"] += 1
            fid, reason = match_center(center, {k: rings[k] for k in possible})
            if fid is None:
                if reason == "ambiguous":
                    counts["ambiguousFootprintSurfaceObjects"] += 1
                else:
                    counts["unmatchedFootprintSurfaceObjects"] += 1
                continue
            z = collect_base_z(geom)
            base_by_fid[fid].append({
                "sourceObjectUUID": str(obj.Attributes.Id),
                "geometryType": type(geom).__name__,
                "faceCount": len(geom.Faces) if hasattr(geom, "Faces") else None,
                "localCenterMetres": [round(center[0], 3), round(center[1], 3)],
                **{k: round(v, 4) if isinstance(v, float) else v for k, v in z.items()},
            })
            counts["matchedFootprintSurfaceObjects"] += 1
            continue
        counts["facadeObjectsInRoi"] += 1
        if not hasattr(geom, "Faces"):
            counts["unmatchedFacadeFaces"] += 1
            continue
        for face_index in range(len(geom.Faces)):
            try:
                cached = geom.Faces[face_index].GetMesh(rhino3dm.MeshType.Any)
                if cached is None:
                    counts["unmatchedFacadeFaces"] += 1
                    continue
                source_points, source_indices, degenerate = face_triangles(cached)
                if not source_indices:
                    counts["unmatchedFacadeFaces"] += 1
                    continue
                fid, reason = mesh_match(source_points, {k: rings[k] for k in possible})
                if fid is None:
                    if reason == "ambiguous":
                        counts["ambiguousFacadeFaces"] += 1
                    else:
                        counts["unmatchedFacadeFaces"] += 1
                    continue
                points = []
                for x, y, z in source_points:
                    east, north = mn05_stateplane_to_metric(x, y)
                    points.extend([round(east, 4), round(north, 4), round(z, 4)])
                triangle_count = len(source_indices) // 3
                total_triangles += triangle_count
                total_vertices += len(source_points)
                if total_triangles > MAX_FACADE_TRIANGLES or total_vertices > MAX_FACADE_VERTICES:
                    raise ValueError("Matched source facade mesh exceeds bounded triangle/vertex budget")
                facade_patches.append({
                    "fid": fid,
                    "sourceObjectUUID": str(obj.Attributes.Id),
                    "brepFaceIndex": face_index,
                    "vertices": points,
                    "sourceTriangles": source_indices,
                    "vertexCount": len(source_points),
                    "triangleCount": triangle_count,
                    "degenerateSourceTrianglesRejected": degenerate,
                    "sourceZMinRawFt": round(min(p[2] for p in source_points), 4),
                    "sourceZMaxRawFt": round(max(p[2] for p in source_points), 4),
                })
                counts["matchedFacadeFaces"] += 1
                counts["facadeDegenerateTrianglesRejected"] += degenerate
            except ValueError:
                raise
            except Exception as exc:
                raise RuntimeError(
                    f"Facade extraction failed for source object {obj.Attributes.Id} face {face_index}: "
                    f"{type(exc).__name__}: {exc}"
                ) from exc
    roof_by_uuid = {}
    for patch in mesh.get("sourceRooftop3dMeshPatches", []):
        roof_by_uuid.setdefault(patch["sourceObjectUUID"], []).append(patch)
    per_building = []
    candidate_mesh_ids = set()
    for fid, row in sorted(selected.items()):
        bases = base_by_fid[fid]
        z_medians = [item["zMedianRawFt"] for item in bases]
        base_z = statistics.median(z_medians) if z_medians else None
        roof_top = row.get("sourceRoofTopZFt")
        source_height = roof_top - base_z if roof_top is not None and base_z is not None else None
        oti_height = row.get("otiRoofHeightAboveGroundFt")
        delta = source_height - oti_height if source_height is not None and oti_height is not None else None
        base_ground_delta = (
            base_z - row["otiGroundElevationFt"]
            if base_z is not None and row.get("otiGroundElevationFt") is not None else None
        )
        facade_rows = [p for p in facade_patches if p["fid"] == fid]
        roof_ids = set(row.get("matchedObjectIds", []))
        candidate_mesh_ids.update(roof_ids)
        roof_triangles = sum(
            patch["triangleCount"]
            for object_id in roof_ids
            for patch in roof_by_uuid.get(object_id, [])
        )
        per_building.append({
            "fid": fid,
            "bin": row.get("bin"),
            "doittId": row.get("doittId"),
            "constructionYear": row.get("constructionYear"),
            "lastStatusType": row.get("lastStatusType"),
            "currentRoofTopDeltaFt": row.get("deltaSourceMinusOtiFt"),
            "sourceRoofTopZRawFt": roof_top,
            "footprintSurfaceObjectCount": len(bases),
            "sourceFootprintBaseZMinRawFt": min(z_medians) if z_medians else None,
            "sourceFootprintBaseZMedianRawFt": base_z,
            "sourceFootprintBaseZMaxRawFt": max(z_medians) if z_medians else None,
            "sourceRoofHeightAboveFootprintFt": round(source_height, 3) if source_height is not None else None,
            "otiHeightRoofFt": oti_height,
            "relativeHeightDeltaSourceMinusOtiFt": round(delta, 3) if delta is not None else None,
            "sourceBaseMinusOtiGroundFt": round(base_ground_delta, 3) if base_ground_delta is not None else None,
            "facadeFaceCount": len(facade_rows),
            "facadeTriangleCount": sum(p["triangleCount"] for p in facade_rows),
            "facadeVertexCount": sum(p["vertexCount"] for p in facade_rows),
            "roofTriangleCount": roof_triangles,
            "sourceFootprintSurfaceObjects": bases,
        })
    eligible = [
        row for row in per_building
        if row["relativeHeightDeltaSourceMinusOtiFt"] is not None
    ]
    abs_errors = [abs(row["relativeHeightDeltaSourceMinusOtiFt"]) for row in eligible]
    abs_errors_sorted = sorted(abs_errors)
    p95 = abs_errors_sorted[max(0, math.ceil(0.95 * len(abs_errors_sorted)) - 1)] if abs_errors_sorted else None
    preview_candidates = [
        row for row in per_building
        if row["footprintSurfaceObjectCount"] > 0
        and row["facadeFaceCount"] > 0
        and row["relativeHeightDeltaSourceMinusOtiFt"] is not None
        and abs(row["relativeHeightDeltaSourceMinusOtiFt"]) <= VERTICAL_TOLERANCE_FT
    ]
    report = {
        "schema": "patrol-nyc-mn05-current-building-facade-pilot-v1",
        "sourceRole": "READ_ONLY_2014_SOURCE_GEOMETRY_PILOT_NOT_RUNTIME",
        "source3dmSha256": probe.get("source3dmSha256"),
        "sourceCrs": "EPSG:2263 (US survey feet)",
        "modelUnitSystem": probe.get("modelUnitSystem"),
        "footprintSurfaceLayer": [layer_names[i] for i in sorted(base_layers)],
        "facadeSurfaceLayer": [layer_names[i] for i in sorted(facade_layers)],
        "candidateRule": (
            "Current OTI FEAT_CODE=2100, GEOMSOURCE photogrammetric, "
            "CNSTRCT_YR<=2014, LSTSTATYPE=Constructed, roof-top delta within ±1.6 ft, "
            "and no same BIN/DOITT_ID historic status record for Alteration/Demolition/Merged."
        ),
        "candidateCount": len(selected),
        "candidateFids": sorted(selected),
        "counts": counts,
        "facadeMeshBudget": {
            "triangles": total_triangles,
            "vertices": total_vertices,
            "maxTriangles": MAX_FACADE_TRIANGLES,
            "maxVertices": MAX_FACADE_VERTICES,
        },
        "relativeHeightComparison": {
            "sampleCount": len(eligible),
            "medianAbsoluteDeltaFt": round(statistics.median(abs_errors), 3) if abs_errors else None,
            "p95AbsoluteDeltaFt": round(p95, 3) if p95 is not None else None,
            "withinDcp95AccuracyBandCount": sum(v <= VERTICAL_TOLERANCE_FT for v in abs_errors),
            "withinDcp95AccuracyBandFraction": (
                round(sum(v <= VERTICAL_TOLERANCE_FT for v in abs_errors) / len(abs_errors), 4)
                if abs_errors else None
            ),
        },
        "previewCandidateCount": len(preview_candidates),
        "previewCandidateFids": [row["fid"] for row in preview_candidates],
        "verticalDatumStatus": "NOT_CERTIFIED",
        "runtimeImportAllowed": False,
        "perBuilding": per_building,
        "sourceFacadeMeshPatches": facade_patches,
    }
    OUT.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")) + "\n",
                   encoding="utf-8")
    summary = {k: v for k, v in report.items() if k not in ("perBuilding", "sourceFacadeMeshPatches")}
    OUT_SUMMARY.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
                           encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
