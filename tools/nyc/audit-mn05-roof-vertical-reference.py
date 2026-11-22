#!/usr/bin/env python3
"""Read-only cross-source audit of 2014 MN05 roof Z against current NYC OTI heights.

This is an evidence gate, not a vertical-datum declaration or runtime importer.
It spatially associates genuine cached 2014 roof meshes with the pinned Times
Square footprint subset, then compares only eligible OTI ground/roof attributes.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import pathlib
import statistics
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
MESH_PATH = ROOT / "artifacts/nyc-official-mn05/times-square-original-roof-mesh.json"
PROBE_PATH = ROOT / "artifacts/nyc-official-mn05/mn05-probe.json"
FOOTPRINT_PATH = ROOT / "assets/nyc/times-square-footprints.json"
OUT_PATH = ROOT / "artifacts/nyc-official-mn05/roof-vertical-reference-audit.json"
FEATURE_QUERY = (
    "https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/"
    "NYC_Building_Footprint/FeatureServer/0/query"
)
ORIGIN = (-73.9864883, 40.756421)
RAD = math.pi / 180.0
LAT = ORIGIN[1] * RAD
METERS_PER_DEG_LON = (
    111412.84 * math.cos(LAT)
    - 93.5 * math.cos(3 * LAT)
    + 0.118 * math.cos(5 * LAT)
)
METERS_PER_DEG_LAT = (
    111132.92 - 559.82 * math.cos(2 * LAT)
    + 1.175 * math.cos(4 * LAT)
)
DCP_SOURCE_URL = "https://data.cityofnewyork.us/d/u5j4-zxpn"
DCP_METADATA_URL = (
    "https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/"
    "Metadata/Metadata_3DBuildingModel.md"
)
OTI_FOOTPRINT_METADATA_URL = (
    "https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/"
    "Metadata/Metadata_BuildingFootprints.md"
)
VERTICAL_TOLERANCE_FT = 1.6


def wgs84_to_local_meters(lon: float, lat: float) -> tuple[float, float]:
    if not all(math.isfinite(v) for v in (lon, lat)):
        raise ValueError("Non-finite WGS84 footprint coordinate")
    return (
        (lon - ORIGIN[0]) * RAD * METERS_PER_DEG_LON,
        (lat - ORIGIN[1]) * RAD * METERS_PER_DEG_LAT,
    )


def _point_on_segment(x: float, y: float, a: tuple[float, float],
                      b: tuple[float, float], tolerance: float = 0.12) -> bool:
    dx, dy = b[0] - a[0], b[1] - a[1]
    length2 = dx * dx + dy * dy
    if length2 <= tolerance * tolerance:
        return math.hypot(x - a[0], y - a[1]) <= tolerance
    t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / length2))
    px, py = a[0] + t * dx, a[1] + t * dy
    return math.hypot(x - px, y - py) <= tolerance


def point_in_ring(x: float, y: float,
                  ring: list[tuple[float, float]]) -> bool:
    """Boundary-inclusive ray casting in local metres."""
    inside = False
    if len(ring) < 3:
        return False
    j = len(ring) - 1
    for i, a in enumerate(ring):
        b = ring[j]
        if _point_on_segment(x, y, a, b):
            return True
        if (a[1] > y) != (b[1] > y):
            crossing_x = (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]
            if x < crossing_x:
                inside = not inside
        j = i
    return inside


def _normalise_ring(coords: list[list[float]]) -> list[tuple[float, float]]:
    points = [wgs84_to_local_meters(float(p[0]), float(p[1])) for p in coords]
    if len(points) > 1 and math.dist(points[0], points[-1]) <= 0.12:
        points.pop()
    if len(points) < 3:
        raise ValueError("Footprint outer ring has fewer than three vertices")
    return points


def load_footprints(path: pathlib.Path = FOOTPRINT_PATH) -> tuple[list[dict], dict]:
    source = json.loads(path.read_text(encoding="utf-8"))
    if "NYC Building Footprints" not in source.get("source", ""):
        raise ValueError("Unexpected Times Square footprint source")
    if source.get("coordinateSystem") != "WGS84 lon,lat; heights HEIGHTROOF in feet":
        raise ValueError("Unexpected footprint coordinate or height units")
    accepted, skipped = [], []
    seen = set()
    for record in source.get("features", []):
        fid = record.get("fid")
        if not isinstance(fid, int) or fid in seen:
            raise ValueError("Invalid or duplicate official footprint FID")
        seen.add(fid)
        rings = record.get("rings")
        # The 1:1 massing pilot deliberately excludes holes/multipolygons.
        # Reuse that exact 118-feature eligibility rule; do not fill courtyards.
        if not isinstance(rings, list) or len(rings) != 1:
            skipped.append({"fid": fid, "reason": "holes-or-multiple-rings"})
            continue
        try:
            ring = _normalise_ring(rings[0])
        except (TypeError, ValueError, IndexError) as exc:
            skipped.append({"fid": fid, "reason": str(exc)})
            continue
        accepted.append({
            "fid": fid,
            "ring": ring,
            "snapshotHeightFt": _finite_number(record.get("heightFt")),
        })
    if len(accepted) < 50:
        raise ValueError("Too few valid official footprint polygons for roof matching")
    return accepted, {
        "source": source.get("source"),
        "retrieved": source.get("retrieved"),
        "snapshotSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "snapshotFeatureCount": len(source.get("features", [])),
        "eligibleOuterRingCount": len(accepted),
        "skippedRingCount": len(skipped),
        "skipped": skipped,
    }


def _finite_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def fetch_current_oti_attributes(fids: list[int]) -> dict[int, dict]:
    if not fids:
        raise ValueError("No official FIDs supplied for OTI attribute query")
    where = "FID IN (" + ",".join(str(int(fid)) for fid in sorted(fids)) + ")"
    params = urllib.parse.urlencode({
        "where": where,
        "outFields": (
            "FID,BIN,DOITT_ID,HEIGHTROOF,GROUNDELEV,CNSTRCT_YR,"
            "LSTMODDATE,GEOMSOURCE,FEAT_CODE"
        ),
        "returnGeometry": "false",
        "f": "json",
    })
    request = urllib.request.Request(
        FEATURE_QUERY + "?" + params,
        headers={"User-Agent": "PATROL-NYC-Open-Data-Vertical-Audit/1.0",
                 "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=75) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("error"):
        raise RuntimeError("NYC OTI FeatureServer query failed: " +
                           json.dumps(payload["error"], ensure_ascii=False))
    records = {}
    for feature in payload.get("features", []):
        attributes = feature.get("attributes", {})
        fid = attributes.get("FID")
        if not isinstance(fid, int) or fid in records:
            raise ValueError("NYC OTI query returned invalid/duplicate FID")
        records[fid] = attributes
    if len(records) != len(fids):
        missing = sorted(set(fids) - set(records))
        raise ValueError(
            f"NYC OTI returned {len(records)}/{len(fids)} requested FIDs; "
            f"missing={missing[:20]}"
        )
    return records


def _mesh_groups(mesh: dict) -> dict[str, list[tuple[float, float, float]]]:
    groups: dict[str, list[tuple[float, float, float]]] = {}
    for patch in mesh.get("sourceRooftop3dMeshPatches", []):
        object_id = patch.get("sourceObjectUUID")
        flat = patch.get("vertices")
        count = patch.get("vertexCount")
        if not isinstance(object_id, str) or not isinstance(flat, list) or \
                not isinstance(count, int) or len(flat) != count * 3:
            raise ValueError("Malformed original MN05 roof mesh patch")
        vertices = groups.setdefault(object_id, [])
        for i in range(0, len(flat), 3):
            xyz = tuple(float(v) for v in flat[i:i + 3])
            if not all(math.isfinite(v) for v in xyz):
                raise ValueError("Non-finite source roof mesh vertex")
            vertices.append(xyz)
    return groups


def match_roof_objects(groups: dict[str, list[tuple[float, float, float]]],
                       footprints: list[dict]) -> tuple[dict[int, dict], dict]:
    matched: dict[int, dict] = {}
    unique_count = ambiguous_count = partial_count = unmatched_count = 0
    for object_id, raw_vertices in groups.items():
        # Remove duplicated vertices contributed by adjacent cached faces.
        vertices = list(dict.fromkeys(
            (round(x, 3), round(y, 3), round(z, 3))
            for x, y, z in raw_vertices
        ))
        if not vertices:
            unmatched_count += 1
            continue
        cx = sum(v[0] for v in vertices) / len(vertices)
        cy = sum(v[1] for v in vertices) / len(vertices)
        candidates = []
        for footprint in footprints:
            ring = footprint["ring"]
            fraction = sum(
                point_in_ring(v[0], v[1], ring) for v in vertices
            ) / len(vertices)
            center_inside = point_in_ring(cx, cy, ring)
            score = fraction + (0.20 if center_inside else 0.0)
            if fraction >= 0.35 or (center_inside and fraction >= 0.20):
                candidates.append({
                    "fid": footprint["fid"],
                    "fractionInside": round(fraction, 4),
                    "centerInside": center_inside,
                    "score": round(score, 4),
                })
        candidates.sort(key=lambda item: item["score"], reverse=True)
        if not candidates:
            unmatched_count += 1
            continue
        if len(candidates) > 1 and \
                candidates[0]["score"] - candidates[1]["score"] < 0.15:
            ambiguous_count += 1
            continue
        best = candidates[0]
        if best["fractionInside"] < 0.55 and not best["centerInside"]:
            partial_count += 1
            continue
        unique_count += 1
        fid = best["fid"]
        entry = matched.setdefault(fid, {
            "fid": fid, "roofObjectCount": 0, "roofVertexCount": 0,
            "roofZMinRaw": None, "roofZMaxRaw": None,
            "matchedObjectIds": [],
        })
        zs = [v[2] for v in vertices]
        entry["roofObjectCount"] += 1
        entry["roofVertexCount"] += len(vertices)
        entry["roofZMinRaw"] = min(
            min(zs), entry["roofZMinRaw"]
            if entry["roofZMinRaw"] is not None else min(zs)
        )
        entry["roofZMaxRaw"] = max(
            max(zs), entry["roofZMaxRaw"]
            if entry["roofZMaxRaw"] is not None else max(zs)
        )
        entry["matchedObjectIds"].append(object_id)
    return matched, {
        "sourceRoofObjectCount": len(groups),
        "uniquelyMatchedObjectCount": unique_count,
        "ambiguousObjectCount": ambiguous_count,
        "partialObjectCount": partial_count,
        "unmatchedObjectCount": unmatched_count,
        "uniqueMatchedBuildingCount": len(matched),
    }


def _date_from_arcgis(value):
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return dt.datetime.fromtimestamp(
                float(value) / 1000.0, tz=dt.timezone.utc
            ).date()
        return dt.date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError, OverflowError, OSError):
        return None


def _z_unit_to_feet(model_unit_system: str | None):
    unit = (model_unit_system or "").strip().lower().replace("_", " ")
    if "us survey" in unit and ("foot" in unit or "feet" in unit):
        return 1200.0 / 3937.0, "US_SURVEY_FEET"
    if "foot" in unit or "feet" in unit:
        return 1.0, "FEET"
    if "meter" in unit or "metre" in unit:
        return 1.0 / 0.3048, "METRES"
    if "millimeter" in unit or "millimetre" in unit:
        return 1.0 / 304.8, "MILLIMETRES"
    return None, "UNKNOWN"


def _percentile(values: list[float], fraction: float):
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, math.ceil(fraction * len(ordered)) - 1))
    return ordered[index]


def _summarise_deltas(records: list[dict]) -> dict:
    deltas = [r["deltaFt"] for r in records if r.get("deltaFt") is not None]
    abs_deltas = [abs(v) for v in deltas]
    return {
        "sampleCount": len(deltas),
        "medianSignedDeltaFt": round(statistics.median(deltas), 3) if deltas else None,
        "medianAbsoluteDeltaFt": round(statistics.median(abs_deltas), 3) if abs_deltas else None,
        "p95AbsoluteDeltaFt": round(_percentile(abs_deltas, 0.95), 3) if abs_deltas else None,
        "withinDcp95AccuracyBandCount": sum(v <= VERTICAL_TOLERANCE_FT for v in abs_deltas),
        "withinDcp95AccuracyBandFraction": (
            round(sum(v <= VERTICAL_TOLERANCE_FT for v in abs_deltas) / len(abs_deltas), 4)
            if abs_deltas else None
        ),
        "minSignedDeltaFt": round(min(deltas), 3) if deltas else None,
        "maxSignedDeltaFt": round(max(deltas), 3) if deltas else None,
    }


def build_audit(mesh: dict, probe: dict, footprints: list[dict],
                footprint_info: dict, current: dict[int, dict]) -> dict:
    unit_name = probe.get("modelUnitSystem")
    unit_factor, z_unit_label = _z_unit_to_feet(unit_name)
    groups = _mesh_groups(mesh)
    matched, match_stats = match_roof_objects(groups, footprints)
    footprint_by_id = {item["fid"]: item for item in footprints}
    comparisons, stable_comparisons, per_building = [], [], []
    for fid, roof in sorted(matched.items()):
        attributes = current.get(fid, {})
        ground = _finite_number(attributes.get("GROUNDELEV"))
        height = _finite_number(attributes.get("HEIGHTROOF"))
        source_z_ft = (
            roof["roofZMaxRaw"] * unit_factor
            if unit_factor is not None else None
        )
        top_ft = ground + height if ground is not None and height is not None else None
        geometry_source = str(attributes.get("GEOMSOURCE") or "").strip()
        construction_year = _finite_number(attributes.get("CNSTRCT_YR"))
        last_modified = _date_from_arcgis(attributes.get("LSTMODDATE"))
        feature_code = attributes.get("FEAT_CODE")
        is_photogrammetric = geometry_source.lower().startswith("photogram")
        eligible = (
            source_z_ft is not None and top_ft is not None
            and is_photogrammetric
        )
        delta = source_z_ft - top_ft if eligible else None
        record = {
            "fid": fid,
            "bin": attributes.get("BIN"),
            "doittId": attributes.get("DOITT_ID"),
            "roofObjectCount": roof["roofObjectCount"],
            "roofVertexCount": roof["roofVertexCount"],
            "sourceRoofTopZFt": round(source_z_ft, 3) if source_z_ft is not None else None,
            "otiGroundElevationFt": ground,
            "otiRoofHeightAboveGroundFt": height,
            "otiAbsoluteRoofTopFt": round(top_ft, 3) if top_ft is not None else None,
            "deltaSourceMinusOtiFt": round(delta, 3) if delta is not None else None,
            "geometrySource": geometry_source or None,
            "constructionYear": int(construction_year) if construction_year is not None else None,
            "lastModifiedDate": last_modified.isoformat() if last_modified else None,
            "featureCode": feature_code,
            "photogrammetricGroundDatumCandidate": is_photogrammetric,
            "verticalComparisonEligible": eligible,
            "stableSince2014Candidate": bool(
                eligible and construction_year is not None and construction_year <= 2014
                and last_modified is not None and last_modified <= dt.date(2014, 12, 31)
                and feature_code == 2100
            ),
            "snapshotHeightFt": footprint_by_id[fid].get("snapshotHeightFt"),
            "matchedObjectIds": roof["matchedObjectIds"],
        }
        per_building.append(record)
        if delta is not None:
            comparisons.append({"fid": fid, "deltaFt": delta})
            if record["stableSince2014Candidate"]:
                stable_comparisons.append({"fid": fid, "deltaFt": delta})
    return {
        "schema": "patrol-nyc-mn05-roof-vertical-reference-audit-v1",
        "sourceRole": "READ_ONLY_2014_SOURCE_TO_CURRENT_OTI_COMPARISON_NOT_RUNTIME",
        "sourceModel": {
            "dataset": "NYC DCP NYC 3D Model by Community District, Manhattan MN05",
            "vintage": "2014 aerial survey; 2018 dataset metadata",
            "source3dmSha256": mesh.get("source3dmSHA256"),
            "sourceCrs": mesh.get("sourceCRS"),
            "modelUnitSystem": unit_name,
            "zUnitInterpretation": z_unit_label,
            "zUnitConversionToFeet": unit_factor,
            "verticalDatumDeclaredIn3dModelMetadata": False,
            "publishedDcpVerticalAccuracy95PctFt": VERTICAL_TOLERANCE_FT,
            "metadataUrl": DCP_METADATA_URL,
        },
        "footprintSnapshot": footprint_info,
        "currentOtiAttributes": {
            "service": FEATURE_QUERY,
            "queriedFidCount": len(current),
            "fields": [
                "FID", "BIN", "DOITT_ID", "HEIGHTROOF", "GROUNDELEV",
                "CNSTRCT_YR", "LSTMODDATE", "GEOMSOURCE", "FEAT_CODE",
            ],
            "metadataUrl": OTI_FOOTPRINT_METADATA_URL,
            "groundElevationDatumRule": (
                "OTI metadata says GROUNDELEV is NAVD88 for photogrammetric "
                "or modern-source records; HEIGHTROOF is above ground."
            ),
        },
        "matching": match_stats,
        "verticalComparison": {
            "photogrammetricMatches": _summarise_deltas(comparisons),
            "stableSince2014Candidates": _summarise_deltas(stable_comparisons),
            "stableCandidateRule": (
                "GEOMSOURCE starts Photogrammetric, FEAT_CODE=2100, "
                "CNSTRCT_YR<=2014, and LSTMODDATE<=2014-12-31"
            ),
            "interpretation": (
                "Agreement is supporting evidence only. Current OTI records may "
                "have changed since 2014; the 3D model metadata does not explicitly "
                "declare a vertical datum. Do not mark NAVD88 verified from this audit."
            ),
        },
        "verticalDatumStatus": "NOT_CERTIFIED",
        "runtimeImportAllowed": False,
        "perBuilding": per_building,
    }


def main():
    mesh = json.loads(MESH_PATH.read_text(encoding="utf-8"))
    probe = json.loads(PROBE_PATH.read_text(encoding="utf-8"))
    if mesh.get("source3dmSHA256") != \
            "b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57":
        raise ValueError("MN05 source Rhino model hash changed")
    if probe.get("source3dmSha256") != mesh.get("source3dmSHA256"):
        raise ValueError("MN05 probe and extracted roof mesh refer to different source bytes")
    footprints, footprint_info = load_footprints()
    current = fetch_current_oti_attributes([f["fid"] for f in footprints])
    report = build_audit(mesh, probe, footprints, footprint_info, current)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    summary = {
        "verticalDatumStatus": report["verticalDatumStatus"],
        "runtimeImportAllowed": report["runtimeImportAllowed"],
        "modelUnitSystem": report["sourceModel"]["modelUnitSystem"],
        "matching": report["matching"],
        "photogrammetricComparison": report["verticalComparison"]["photogrammetricMatches"],
        "stableSince2014": report["verticalComparison"]["stableSince2014Candidates"],
        "output": str(OUT_PATH),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
