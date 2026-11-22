#!/usr/bin/env python3
"""Conservatively spatially join 2014 MN05 roof/facade surfaces to 2014 footprints.

This is a source-only audit. It never guesses a 2022 FID and never modifies
PATROL runtime geometry. Facades are associated through their projected wall
lines; roof patches are associated through polygon overlap with the original
2014 FootPrint Surface mesh.
"""
from __future__ import annotations

import collections
import json
import math
import pathlib

from shapely.geometry import LineString, MultiPoint, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = pathlib.Path("artifacts/nyc-official-mn05")
FOOTPRINT_PATH = ROOT / "times-square-original-footprint-mesh.json"
ROOF_PATH = ROOT / "times-square-original-roof-mesh.json"
FACADE_PATH = ROOT / "times-square-original-facade-mesh.json"
OUTPUT = ROOT / "mn05-component-spatial-join.json"

FACADE_BOUNDARY_TOLERANCE_M = 0.60
FACADE_MIN_LINE_LENGTH_M = 0.80
FACADE_MIN_SCORE = 0.65
FACADE_MIN_SCORE_MARGIN = 0.12
ROOF_MIN_OVERLAP = 0.60
ROOF_MIN_OVERLAP_MARGIN = 0.15
MIN_POLYGON_AREA_M2 = 0.05


def xyz_vertices(patch: dict) -> list[tuple[float, float, float]]:
    flat = patch["vertices"]
    if len(flat) % 3:
        raise ValueError("Mesh vertex buffer is not XYZ-aligned")
    return [
        (float(flat[i]), float(flat[i + 1]), float(flat[i + 2]))
        for i in range(0, len(flat), 3)
    ]


def triangle_indices(patch: dict) -> list[tuple[int, int, int]]:
    flat = patch["sourceTriangles"]
    if len(flat) % 3:
        raise ValueError("Source triangle index buffer is not triangular")
    return [
        (int(flat[i]), int(flat[i + 1]), int(flat[i + 2]))
        for i in range(0, len(flat), 3)
    ]


def polygonal_only(geometry):
    if geometry.is_empty:
        return Polygon()
    if geometry.geom_type in ("Polygon", "MultiPolygon"):
        return geometry
    pieces = []
    for part in getattr(geometry, "geoms", []):
        if part.geom_type == "Polygon":
            pieces.append(part)
        elif part.geom_type == "MultiPolygon":
            pieces.extend(list(part.geoms))
    return unary_union(pieces) if pieces else Polygon()


def mesh_polygon(patch: dict):
    vertices = xyz_vertices(patch)
    triangles = []
    for a, b, c in triangle_indices(patch):
        if min(a, b, c) < 0 or max(a, b, c) >= len(vertices):
            raise ValueError("Source mesh triangle index outside vertex buffer")
        polygon = Polygon([
            (vertices[a][0], vertices[a][1]),
            (vertices[b][0], vertices[b][1]),
            (vertices[c][0], vertices[c][1]),
        ])
        if polygon.area > MIN_POLYGON_AREA_M2:
            triangles.append(polygon)
    if not triangles:
        return Polygon()
    geometry = polygonal_only(unary_union(triangles))
    if not geometry.is_valid:
        geometry = polygonal_only(geometry.buffer(0))
    return geometry


def facade_projection(patch: dict):
    vertices = xyz_vertices(patch)
    if not vertices:
        return None, 0.0, 0.0
    z_values = [v[2] for v in vertices]
    xy = list(dict.fromkeys((round(v[0], 3), round(v[1], 3)) for v in vertices))
    if len(xy) < 2:
        return None, 0.0, max(z_values) - min(z_values)
    hull = MultiPoint(xy).convex_hull
    if hull.geom_type == "LineString":
        projected = hull
    elif hull.geom_type == "Polygon":
        minx, miny, maxx, maxy = hull.bounds
        width, height = maxx - minx, maxy - miny
        if min(width, height) <= 0.50:
            rectangle = hull.minimum_rotated_rectangle
            corners = list(rectangle.exterior.coords)[:-1]
            edges = []
            for i in range(4):
                a, b = corners[i], corners[(i + 1) % 4]
                length = math.dist(a, b)
                midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                edges.append((length, midpoint))
            edges.sort(reverse=True, key=lambda item: item[0])
            projected = LineString([edges[0][1], edges[1][1]])
        else:
            projected = hull.boundary
    else:
        return None, 0.0, max(z_values) - min(z_values)
    return projected, projected.length, max(z_values) - min(z_values)


def choose_facade_footprint(projected, boundary_tree, footprints):
    candidates = boundary_tree.query(projected)
    scored = []
    for raw_index in candidates:
        index = int(raw_index)
        boundary = footprints[index]["polygon"].boundary
        score = projected.intersection(
            boundary.buffer(FACADE_BOUNDARY_TOLERANCE_M)
        ).length / max(projected.length, 1e-9)
        distance = projected.distance(boundary)
        scored.append((score, distance, index))
    scored.sort(key=lambda row: (row[0], -row[1]), reverse=True)
    if not scored:
        return None, "no_spatial_candidate", 0.0, math.inf
    best = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0.0
    if best[0] < FACADE_MIN_SCORE:
        return None, "below_boundary_coverage", best[0], best[1]
    if best[1] > FACADE_BOUNDARY_TOLERANCE_M:
        return None, "outside_boundary_tolerance", best[0], best[1]
    if best[0] - second_score < FACADE_MIN_SCORE_MARGIN:
        return None, "ambiguous_adjacent_footprints", best[0], best[1]
    return best[2], "matched", best[0], best[1]


def choose_roof_footprint(roof_polygon, footprint_tree, footprints):
    candidates = footprint_tree.query(roof_polygon)
    scored = []
    for raw_index in candidates:
        index = int(raw_index)
        footprint = footprints[index]["polygon"]
        overlap = roof_polygon.intersection(footprint).area
        score = overlap / max(roof_polygon.area, 1e-9)
        distance = roof_polygon.distance(footprint)
        scored.append((score, distance, index))
    scored.sort(key=lambda row: (row[0], -row[1]), reverse=True)
    if not scored:
        return None, "no_spatial_candidate", 0.0, math.inf
    best = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0.0
    if best[0] < ROOF_MIN_OVERLAP:
        return None, "below_roof_overlap", best[0], best[1]
    if best[0] - second_score < ROOF_MIN_OVERLAP_MARGIN:
        return None, "ambiguous_adjacent_footprints", best[0], best[1]
    return best[2], "matched", best[0], best[1]


def load_json(path: pathlib.Path) -> dict:
    if not path.is_file():
        raise FileNotFoundError(f"Required source mesh artifact is missing: {path}")
    return json.loads(path.read_text())


def match() -> None:
    footprint_data = load_json(FOOTPRINT_PATH)
    roof_data = load_json(ROOF_PATH)
    facade_data = load_json(FACADE_PATH)
    source_hash = footprint_data["source3dmSha256"]
    if roof_data.get("source3dmSha256") != source_hash:
        raise ValueError("Footprint and roof mesh source SHA mismatch")
    if facade_data.get("source3dmSha256") != source_hash:
        raise ValueError("Footprint and facade mesh source SHA mismatch")

    footprints = []
    invalid_footprints = 0
    for patch in footprint_data["sourceFootprintMeshPatches"]:
        polygon = mesh_polygon(patch)
        if polygon.is_empty or polygon.area < 1.0:
            invalid_footprints += 1
            continue
        vertices = xyz_vertices(patch)
        z_values = [v[2] for v in vertices]
        footprints.append({
            "sourceObjectUUID": patch["sourceObjectUUID"],
            "brepFaceIndex": patch["brepFaceIndex"],
            "polygon": polygon,
            "areaM2": polygon.area,
            "perimeterM": polygon.length,
            "baseZFt": sorted(z_values)[len(z_values) // 2],
        })
    if len(footprints) < 100:
        raise ValueError("Too few valid original 2014 footprint surfaces for spatial join")

    boundary_bands = [
        item["polygon"].boundary.buffer(FACADE_BOUNDARY_TOLERANCE_M)
        for item in footprints
    ]
    boundary_tree = STRtree(boundary_bands)
    footprint_tree = STRtree([item["polygon"] for item in footprints])

    facade_stats = collections.Counter()
    facade_assignments = []
    facade_lines_by_footprint = collections.defaultdict(list)
    facade_uuids_by_footprint = collections.defaultdict(set)
    for patch in facade_data["sourceFacade3dMeshPatches"]:
        facade_stats["total"] += 1
        projected, length, z_span = facade_projection(patch)
        if projected is None or length < FACADE_MIN_LINE_LENGTH_M or z_span < 0.50:
            facade_stats["invalid_or_nonvertical"] += 1
            continue
        index, reason, score, distance = choose_facade_footprint(
            projected, boundary_tree, footprints)
        facade_stats[reason] += 1
        if index is None:
            continue
        item = footprints[index]
        facade_lines_by_footprint[index].append(projected)
        facade_uuids_by_footprint[index].add(patch["sourceObjectUUID"])
        facade_assignments.append({
            "sourceObjectUUID": patch["sourceObjectUUID"],
            "brepFaceIndex": patch["brepFaceIndex"],
            "footprintSourceObjectUUID": item["sourceObjectUUID"],
            "boundaryCoverageScore": round(score, 5),
            "boundaryDistanceM": round(distance, 4),
            "projectedWallLengthM": round(length, 3),
            "rawZRangeFt": [
                round(min(v[2] for v in xyz_vertices(patch)), 3),
                round(max(v[2] for v in xyz_vertices(patch)), 3),
            ],
        })

    roof_stats = collections.Counter()
    roof_assignments = []
    roof_polygons_by_footprint = collections.defaultdict(list)
    roof_uuids_by_footprint = collections.defaultdict(set)
    roof_top_z_by_footprint = collections.defaultdict(list)
    for patch in roof_data["sourceRooftop3dMeshPatches"]:
        roof_stats["total"] += 1
        polygon = mesh_polygon(patch)
        if polygon.is_empty or polygon.area < 0.5:
            roof_stats["invalid_or_too_small"] += 1
            continue
        index, reason, score, distance = choose_roof_footprint(
            polygon, footprint_tree, footprints)
        roof_stats[reason] += 1
        if index is None:
            continue
        item = footprints[index]
        roof_polygons_by_footprint[index].append(polygon)
        roof_uuids_by_footprint[index].add(patch["sourceObjectUUID"])
        z_values = [v[2] for v in xyz_vertices(patch)]
        roof_top_z_by_footprint[index].append(max(z_values))
        roof_assignments.append({
            "sourceObjectUUID": patch["sourceObjectUUID"],
            "brepFaceIndex": patch["brepFaceIndex"],
            "footprintSourceObjectUUID": item["sourceObjectUUID"],
            "roofOverlapScore": round(score, 5),
            "footprintDistanceM": round(distance, 4),
            "roofPatchAreaM2": round(polygon.area, 3),
            "rawRoofTopZFt": round(max(z_values), 3),
        })

    buildings = []
    for index, item in enumerate(footprints):
        facade_union = unary_union(facade_lines_by_footprint[index]) if facade_lines_by_footprint[index] else LineString()
        roof_union = unary_union(roof_polygons_by_footprint[index]) if roof_polygons_by_footprint[index] else Polygon()
        facade_length = facade_union.length
        roof_area = roof_union.intersection(item["polygon"]).area if not roof_union.is_empty else 0.0
        roof_top = max(roof_top_z_by_footprint[index]) if roof_top_z_by_footprint[index] else None
        raw_height = roof_top - item["baseZFt"] if roof_top is not None else None
        buildings.append({
            "footprintSourceObjectUUID": item["sourceObjectUUID"],
            "footprintAreaM2": round(item["areaM2"], 3),
            "footprintPerimeterM": round(item["perimeterM"], 3),
            "rawBaseZFt": round(item["baseZFt"], 3),
            "rawRoofTopZFt": round(roof_top, 3) if roof_top is not None else None,
            "rawRoofMinusBaseHeightFt": round(raw_height, 3) if raw_height is not None else None,
            "facadePatchCount": sum(
                1 for a in facade_assignments
                if a["footprintSourceObjectUUID"] == item["sourceObjectUUID"]),
            "facadeSourceObjectCount": len(facade_uuids_by_footprint[index]),
            "facadeWallLengthM": round(facade_length, 3),
            "facadeBoundaryCoverageRatio": round(
                min(1.0, facade_length / max(item["perimeterM"], 1e-9)), 5),
            "roofPatchCount": sum(
                1 for a in roof_assignments
                if a["footprintSourceObjectUUID"] == item["sourceObjectUUID"]),
            "roofSourceObjectCount": len(roof_uuids_by_footprint[index]),
            "roofCoverageRatio": round(
                min(1.0, roof_area / max(item["areaM2"], 1e-9)), 5),
        })

    matched_facade = len(facade_assignments)
    matched_roof = len(roof_assignments)
    report = {
        "schema": "nyc-mn05-2014-component-spatial-join-v1",
        "role": "SOURCE_ONLY_2014_SPATIAL_LINKAGE_NOT_2026_FID_ASSIGNMENT",
        "source3dmSha256": source_hash,
        "sourceVintage": "2014 NYC DCP MN05 3D model",
        "sourceVerticalDatumEvidence": (
            "2014 NYC planimetric capture rules document NAVD88; direct numeric "
            "mapping of raw Rhino Z to NAVD88 remains unverified"),
        "rawZMappingVerified": False,
        "thresholds": {
            "facadeBoundaryToleranceM": FACADE_BOUNDARY_TOLERANCE_M,
            "facadeMinLineLengthM": FACADE_MIN_LINE_LENGTH_M,
            "facadeMinScore": FACADE_MIN_SCORE,
            "facadeMinScoreMargin": FACADE_MIN_SCORE_MARGIN,
            "roofMinOverlap": ROOF_MIN_OVERLAP,
            "roofMinOverlapMargin": ROOF_MIN_OVERLAP_MARGIN,
        },
        "counts": {
            "validFootprintSurfaces": len(footprints),
            "invalidFootprintSurfaces": invalid_footprints,
            "totalFacadePatches": facade_stats["total"],
            "matchedFacadePatches": matched_facade,
            "unmatchedOrRejectedFacadePatches": facade_stats["total"] - matched_facade,
            "facadeMatchReasons": dict(facade_stats),
            "totalRoofPatches": roof_stats["total"],
            "matchedRoofPatches": matched_roof,
            "unmatchedOrRejectedRoofPatches": roof_stats["total"] - matched_roof,
            "roofMatchReasons": dict(roof_stats),
            "footprintsWithFacade": sum(bool(facade_uuids_by_footprint[i]) for i in range(len(footprints))),
            "footprintsWithRoof": sum(bool(roof_uuids_by_footprint[i]) for i in range(len(footprints))),
            "footprintsWithBoth": sum(
                bool(facade_uuids_by_footprint[i]) and bool(roof_uuids_by_footprint[i])
                for i in range(len(footprints))),
        },
        "buildings": buildings,
        "facadeAssignments": facade_assignments,
        "roofAssignments": roof_assignments,
        "spatialJoinAccepted": len(footprints) >= 100 and matched_facade > 0 and matched_roof > 0,
        "nextGate": (
            "Map only well-covered 2014 source footprints to modern OTI FIDs using "
            "polygon overlap and a separate height-change gate. Do not infer 2026 "
            "facade reality from the 2014 model."
        ),
    }
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({
        "counts": report["counts"],
        "spatialJoinAccepted": report["spatialJoinAccepted"],
        "outputBytes": OUTPUT.stat().st_size,
    }, ensure_ascii=False, indent=2))
    if not report["spatialJoinAccepted"]:
        raise SystemExit(1)


if __name__ == "__main__":
    match()
