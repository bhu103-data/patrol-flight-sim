#!/usr/bin/env python3
"""Match 2014 MN05 source building components to the current NYC FID snapshot.

Uses 2014 footprint-surface overlap to join the historical source building to
the current official footprint FID, then applies a height-delta and source
facade/roof coverage gate. No 2014 geometry is promoted to the game here.
"""
from __future__ import annotations

import collections
import importlib.util
import json
import pathlib

from pyproj import Transformer
from shapely.geometry import Polygon
from shapely.strtree import STRtree

from official_mn05_projection import (
    US_SURVEY_FOOT_IN_METRES,
    mn05_stateplane_to_metric,
)

ROOT = pathlib.Path("artifacts/nyc-official-mn05")
FOOTPRINT_MESH_PATH = ROOT / "times-square-original-footprint-mesh.json"
COMPONENT_JOIN_PATH = ROOT / "mn05-component-spatial-join.json"
CURRENT_FOOTPRINT_PATH = pathlib.Path("assets/nyc/times-square-footprints.json")
OUTPUT = ROOT / "mn05-2014-to-current-fid-height-gate.json"

MIN_FOOTPRINT_OVERLAP = 0.60
MIN_FOOTPRINT_MARGIN = 0.15
HEIGHT_ABSOLUTE_TOLERANCE_M = 3.0
HEIGHT_RELATIVE_TOLERANCE = 0.05
MIN_FACADE_COVERAGE = 0.60
MIN_ROOF_COVERAGE = 0.60
MIN_FACADE_OBJECTS = 3

MESH_HELPER_PATH = pathlib.Path("tools/nyc/match-mn05-components-via-footprints.py")
MESH_HELPER_SPEC = importlib.util.spec_from_file_location("mn05_component_spatial_join", MESH_HELPER_PATH)
MESH_HELPER = importlib.util.module_from_spec(MESH_HELPER_SPEC)
MESH_HELPER_SPEC.loader.exec_module(MESH_HELPER)
mesh_polygon = MESH_HELPER.mesh_polygon
polygonal_only = MESH_HELPER.polygonal_only


def load_current_footprints():
    data = json.loads(CURRENT_FOOTPRINT_PATH.read_text())
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:2263", always_xy=True)
    buildings = []
    for feature in data["features"]:
        rings = []
        for ring in feature["rings"]:
            points = []
            for lon, lat in ring:
                x_ft, y_ft = transformer.transform(float(lon), float(lat))
                east, north = mn05_stateplane_to_metric(x_ft, y_ft)
                points.append((east, north))
            rings.append(points)
        if not rings or len(rings[0]) < 4:
            continue
        polygon = Polygon(rings[0], rings[1:])
        if not polygon.is_valid:
            polygon = polygonal_only(polygon.buffer(0))
        if polygon.is_empty or polygon.area < 1.0:
            continue
        buildings.append({
            "fid": int(feature["fid"]),
            "heightFt": float(feature["heightFt"]),
            "heightMetres": float(feature["heightFt"]) * US_SURVEY_FOOT_IN_METRES,
            "polygon": polygon,
        })
    if len(buildings) < 80:
        raise ValueError("Too few valid current NYC FID footprints after projection")
    return data, buildings


def classify_height_delta(source_height_m, current_height_m):
    if source_height_m is None or current_height_m <= 0:
        return "unknown", None, None
    delta = source_height_m - current_height_m
    relative = abs(delta) / current_height_m
    if (abs(delta) <= HEIGHT_ABSOLUTE_TOLERANCE_M or
            relative <= HEIGHT_RELATIVE_TOLERANCE):
        return "close", delta, relative
    if abs(delta) >= 10.0 and relative >= 0.15:
        return "changed", delta, relative
    return "review", delta, relative


def build_candidate(source_polygon, tree, current_buildings):
    candidates = []
    for raw_index in tree.query(source_polygon):
        index = int(raw_index)
        current = current_buildings[index]
        overlap_area = source_polygon.intersection(current["polygon"]).area
        ratio = overlap_area / max(source_polygon.area, 1e-9)
        candidates.append({
            "index": index,
            "fid": current["fid"],
            "overlapAreaM2": overlap_area,
            "overlapRatio": ratio,
        })
    candidates.sort(key=lambda item: (item["overlapRatio"], item["overlapAreaM2"]), reverse=True)
    if not candidates:
        return None, "no_current_footprint_intersection", 0.0, 0.0
    best = candidates[0]
    second_ratio = candidates[1]["overlapRatio"] if len(candidates) > 1 else 0.0
    margin = best["overlapRatio"] - second_ratio
    if best["overlapRatio"] < MIN_FOOTPRINT_OVERLAP:
        return None, "below_footprint_overlap", best["overlapRatio"], margin
    if margin < MIN_FOOTPRINT_MARGIN:
        return None, "ambiguous_current_fid", best["overlapRatio"], margin
    return best, "matched", best["overlapRatio"], margin


def match() -> None:
    footprint_data = json.loads(FOOTPRINT_MESH_PATH.read_text())
    component_data = json.loads(COMPONENT_JOIN_PATH.read_text())
    current_data, current_buildings = load_current_footprints()
    if footprint_data["source3dmSha256"] != component_data["source3dmSha256"]:
        raise ValueError("2014 footprint mesh and component join source SHA mismatch")

    current_tree = STRtree([item["polygon"] for item in current_buildings])
    component_by_uuid = {
        item["footprintSourceObjectUUID"]: item
        for item in component_data["buildings"]
    }

    candidates = []
    rejected = collections.Counter()
    for patch in footprint_data["sourceFootprintMeshPatches"]:
        source_uuid = patch["sourceObjectUUID"]
        source_polygon = mesh_polygon(patch)
        if source_polygon.is_empty or source_polygon.area < 1.0:
            rejected["invalid_2014_footprint"] += 1
            continue
        best, reason, ratio, margin = build_candidate(
            source_polygon, current_tree, current_buildings)
        rejected[reason] += 1
        if best is None:
            continue
        current = current_buildings[best["index"]]
        component = component_by_uuid.get(source_uuid)
        if component is None:
            rejected["missing_component_join_record"] += 1
            continue
        source_height_ft = component["rawRoofMinusBaseHeightFt"]
        source_height_m = (
            float(source_height_ft) * US_SURVEY_FOOT_IN_METRES
            if source_height_ft is not None else None
        )
        height_status, height_delta_m, height_delta_relative = classify_height_delta(
            source_height_m, current["heightMetres"])
        candidates.append({
            "sourceFootprintUUID": source_uuid,
            "currentFid": current["fid"],
            "footprintOverlapRatio": round(ratio, 5),
            "footprintMatchMargin": round(margin, 5),
            "sourceFootprintAreaM2": round(source_polygon.area, 3),
            "currentFootprintAreaM2": round(current["polygon"].area, 3),
            "source2014HeightMetres": round(source_height_m, 3) if source_height_m is not None else None,
            "currentHeightMetres": round(current["heightMetres"], 3),
            "heightDeltaMetres": round(height_delta_m, 3) if height_delta_m is not None else None,
            "heightDeltaRelative": round(height_delta_relative, 5) if height_delta_relative is not None else None,
            "heightStatus": height_status,
            "facadePatchCount": component["facadePatchCount"],
            "facadeSourceObjectCount": component["facadeSourceObjectCount"],
            "facadeBoundaryCoverageRatio": component["facadeBoundaryCoverageRatio"],
            "roofPatchCount": component["roofPatchCount"],
            "roofSourceObjectCount": component["roofSourceObjectCount"],
            "roofCoverageRatio": component["roofCoverageRatio"],
        })

    # A current FID cannot silently absorb two different 2014 source buildings.
    by_fid = collections.defaultdict(list)
    for candidate in candidates:
        by_fid[candidate["currentFid"]].append(candidate)
    fid_conflicts = set()
    for fid, rows in by_fid.items():
        if len(rows) > 1:
            fid_conflicts.add(fid)
    for candidate in candidates:
        candidate["currentFidConflict"] = candidate["currentFid"] in fid_conflicts
        candidate["eligibleForFacadePreview"] = (
            not candidate["currentFidConflict"]
            and candidate["heightStatus"] == "close"
            and candidate["facadeBoundaryCoverageRatio"] >= MIN_FACADE_COVERAGE
            and candidate["roofCoverageRatio"] >= MIN_ROOF_COVERAGE
            and candidate["facadeSourceObjectCount"] >= MIN_FACADE_OBJECTS
        )
        reasons = []
        if candidate["currentFidConflict"]:
            reasons.append("multiple_2014_footprints_claim_same_current_fid")
        if candidate["heightStatus"] != "close":
            reasons.append("height_delta_not_within_gate")
        if candidate["facadeBoundaryCoverageRatio"] < MIN_FACADE_COVERAGE:
            reasons.append("incomplete_facade_boundary_coverage")
        if candidate["roofCoverageRatio"] < MIN_ROOF_COVERAGE:
            reasons.append("incomplete_roof_coverage")
        if candidate["facadeSourceObjectCount"] < MIN_FACADE_OBJECTS:
            reasons.append("too_few_facade_source_objects")
        candidate["rejectionReasons"] = reasons

    candidates.sort(key=lambda item: (
        item["eligibleForFacadePreview"],
        item["facadeBoundaryCoverageRatio"],
        item["footprintOverlapRatio"],
    ), reverse=True)

    eligible = [item for item in candidates if item["eligibleForFacadePreview"]]
    counts = {
        "source2014FootprintSurfaces": len(footprint_data["sourceFootprintMeshPatches"]),
        "currentFootprintFeatures": len(current_data["features"]),
        "validCurrentFootprints": len(current_buildings),
        "matched2014FootprintsToCurrentFids": len(candidates),
        "uniqueCurrentFidsMatched": len({item["currentFid"] for item in candidates}),
        "currentFidConflictGroups": len(fid_conflicts),
        "heightClose": sum(item["heightStatus"] == "close" for item in candidates),
        "heightReview": sum(item["heightStatus"] == "review" for item in candidates),
        "heightChanged": sum(item["heightStatus"] == "changed" for item in candidates),
        "highFacadeCoverage": sum(
            item["facadeBoundaryCoverageRatio"] >= MIN_FACADE_COVERAGE
            for item in candidates),
        "highRoofCoverage": sum(
            item["roofCoverageRatio"] >= MIN_ROOF_COVERAGE
            for item in candidates),
        "eligibleForFacadePreview": len(eligible),
        "rejectedFootprintCandidates": dict(rejected),
    }
    report = {
        "schema": "nyc-mn05-2014-to-current-fid-height-gate-v1",
        "role": "SOURCE_2014_TO_CURRENT_FID_SCREENING_ONLY_NOT_RUNTIME",
        "source3dmSha256": footprint_data["source3dmSha256"],
        "currentFootprintSource": current_data["source"],
        "currentFootprintRetrieved": current_data["retrieved"],
        "currentFootprintFileSha256": __import__("hashlib").sha256(
            CURRENT_FOOTPRINT_PATH.read_bytes()).hexdigest(),
        "currentFootprintHeightField": "HEIGHTROOF feet",
        "sourceVerticalDatumEvidence": (
            "2014 planimetric rules document NAVD88; raw Rhino Z absolute mapping "
            "remains unverified. Height gate compares relative roof-minus-base relief only."),
        "rawZMappingVerified": False,
        "thresholds": {
            "footprintOverlap": MIN_FOOTPRINT_OVERLAP,
            "footprintMargin": MIN_FOOTPRINT_MARGIN,
            "heightAbsoluteToleranceMetres": HEIGHT_ABSOLUTE_TOLERANCE_M,
            "heightRelativeTolerance": HEIGHT_RELATIVE_TOLERANCE,
            "facadeBoundaryCoverage": MIN_FACADE_COVERAGE,
            "roofCoverage": MIN_ROOF_COVERAGE,
            "minimumFacadeSourceObjects": MIN_FACADE_OBJECTS,
        },
        "counts": counts,
        "buildings": candidates,
        "eligibleForFacadePreview": eligible,
        "nextGate": (
            "Only the eligible list may be considered for an opt-in preview overlay. "
            "Keep unmatched, height-changed, ambiguous, and low-facade-coverage buildings "
            "on their existing massing. Do not call the 2014 geometry a 2026 survey."
        ),
    }
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")))
    print(json.dumps({
        "counts": counts,
        "outputBytes": OUTPUT.stat().st_size,
        "eligibleFids": [item["currentFid"] for item in eligible],
    }, ensure_ascii=False, indent=2))
    if len(candidates) == 0 or len(eligible) == 0:
        raise SystemExit(1)


if __name__ == "__main__":
    match()
