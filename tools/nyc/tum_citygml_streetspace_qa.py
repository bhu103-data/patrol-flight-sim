#!/usr/bin/env python3
"""Inspect TUM NYC CityGML street-space sources and compare them with current NYC CSCL.

This tool creates research artifacts only. It never writes into PATROL runtime assets.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import urlopen

from pyproj import Transformer
from shapely.geometry import box, shape
from shapely.ops import transform as transform_geometry, unary_union

DATASETS = {
    "roadbed": {
        "label": "NYC CityGML LoD2 Roadbed",
        "url": "https://www.3dcitydb.net/3dcitydb/fileadmin/public/datasets/NYC/NYC_street_space_CityGML_LoD2/NYC_CityGML_LoD2_Roadbed.zip",
        "required": True,
        "area_attribute": "street_area_3D_sqm",
    },
    "intersection": {
        "label": "NYC CityGML LoD2 Intersection",
        "url": "https://www.3dcitydb.net/3dcitydb/fileadmin/public/datasets/NYC/NYC_street_space_CityGML_LoD2/NYC_CityGML_LoD2_Intersection.zip",
        "required": True,
        "area_attribute": "intersection_area_sqm",
    },
    "road_marking": {
        "label": "NYC CityGML LoD2 Median Painted / Road Markings",
        "url": "https://www.3dcitydb.net/3dcitydb/fileadmin/public/datasets/NYC/NYC_street_space_CityGML_LoD2/NYC_CityGML_LoD2_Median_Painted.zip",
        "required": False,
        "area_attribute": "median_area_sqm",
    },
}

WGS84_TO_NYLI = Transformer.from_crs("EPSG:4326", "EPSG:32118", always_xy=True)
TUM_TO_CSCL_TRAFFIC_DIRECTION = {"W": "FT", "A": "TF", "T": "TW", "P": "NV"}


def run_command(args: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, check=False, text=True, capture_output=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"Command failed ({result.returncode}): {' '.join(args)}\n"
            f"stdout:\n{result.stdout[-4000:]}\nstderr:\n{result.stderr[-4000:]}"
        )
    return result


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_extract_zip(zip_path: Path, destination: Path) -> list[Path]:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    extracted: list[Path] = []
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            member = Path(info.filename)
            if member.is_absolute() or ".." in member.parts:
                raise ValueError(f"Unsafe archive path: {info.filename}")
            target = (destination / member).resolve()
            if not target.is_relative_to(root):
                raise ValueError(f"Archive path escapes destination: {info.filename}")
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)
            extracted.append(target)
    return extracted


def geometry_positions(node: Any):
    """Yield coordinate tuples from GeoJSON geometry coordinates."""
    if not isinstance(node, list):
        return
    if len(node) >= 2 and all(isinstance(value, (int, float)) for value in node):
        yield node
        return
    for child in node:
        yield from geometry_positions(child)


def normalize_name(value: Any) -> str:
    if value is None:
        return ""
    tokens = re.sub(r"[^A-Z0-9 ]+", " ", str(value).upper()).split()
    direction = {"W": "WEST", "E": "EAST", "N": "NORTH", "S": "SOUTH"}
    suffix = {
        "ST": "STREET", "AVE": "AVENUE", "AV": "AVENUE",
        "BLVD": "BOULEVARD", "RD": "ROAD", "DR": "DRIVE",
        "PL": "PLACE", "PKWY": "PARKWAY", "EXPY": "EXPRESSWAY",
        "TPKE": "TURNPIKE", "HWY": "HIGHWAY",
    }
    if tokens and tokens[0] in direction:
        tokens[0] = direction[tokens[0]]
    tokens = [suffix.get(token, token) for token in tokens]
    return " ".join(tokens)

def normalize_direction_code(value: Any) -> str | None:
    if value is None:
        return None
    return TUM_TO_CSCL_TRAFFIC_DIRECTION.get(str(value).strip().upper())


def get_property(properties: dict[str, Any], *candidates: str) -> Any:
    wanted = {candidate.lower() for candidate in candidates}
    for key, value in properties.items():
        if key.lower() in wanted and value not in (None, ""):
            return value
    return None


def summarize_geojson(path: Path, area_attribute: str | None = None) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    features = data.get("features", [])
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    min_z = float("inf")
    max_z = float("-inf")
    vertex_count = 0
    geometry_types: dict[str, int] = {}
    valid_count = invalid_count = empty_count = 0
    projected_area_m2 = 0.0
    area_ratios: list[float] = []

    for feature in features:
        geometry_data = feature.get("geometry")
        if not geometry_data:
            empty_count += 1
            continue
        geometry_type = geometry_data.get("type", "null")
        geometry_types[geometry_type] = geometry_types.get(geometry_type, 0) + 1
        geometry = shape(geometry_data)
        if geometry.is_empty:
            empty_count += 1
            continue
        if geometry.is_valid:
            valid_count += 1
        else:
            invalid_count += 1
        projected = transform_geometry(WGS84_TO_NYLI.transform, geometry)
        projected_area_m2 += projected.area
        properties = feature.get("properties") or {}
        if area_attribute:
            attribute_area = properties.get(area_attribute)
            if isinstance(attribute_area, (int, float)) and attribute_area > 0:
                area_ratios.append(projected.area / float(attribute_area))
        for position in geometry_positions(geometry_data.get("coordinates")):
            vertex_count += 1
            min_x = min(min_x, float(position[0]))
            max_x = max(max_x, float(position[0]))
            min_y = min(min_y, float(position[1]))
            max_y = max(max_y, float(position[1]))
            if len(position) >= 3:
                min_z = min(min_z, float(position[2]))
                max_z = max(max_z, float(position[2]))

    bounds = [min_x, min_y, max_x, max_y] if vertex_count else None
    z_range = [min_z, max_z] if min_z != float("inf") else None
    area_comparison = None
    if area_ratios:
        sorted_ratios = sorted(area_ratios)
        area_comparison = {
            "attribute": area_attribute,
            "comparedCount": len(area_ratios),
            "within5Percent": sum(abs(ratio - 1.0) <= 0.05 for ratio in area_ratios),
            "medianGeometryToAttributeRatio": sorted_ratios[len(sorted_ratios) // 2],
            "minRatio": min(area_ratios),
            "maxRatio": max(area_ratios),
        }
    return {
        "featureCount": len(features),
        "vertexCount": vertex_count,
        "geometryTypes": geometry_types,
        "boundsWgs84": bounds,
        "zRange": z_range,
        "geometryValidCount": valid_count,
        "geometryInvalidCount": invalid_count,
        "geometryEmptyCount": empty_count,
        "projectedAreaM2": projected_area_m2,
        "areaAttributeComparison": area_comparison,
        "bytes": path.stat().st_size,
    }


def ogrinfo_json(source_path: Path) -> dict[str, Any]:
    result = run_command([
        "ogrinfo", "-json", "-ro", "-so", "-al",
        "-oo", "EXPOSE_GML_ID=YES", str(source_path),
    ])
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"ogrinfo did not return JSON for {source_path}: {error}") from error


def layer_srs(layer: dict[str, Any]) -> str | None:
    geometry_fields = layer.get("geometryFields") or []
    if not geometry_fields:
        return None
    coordinate_system = geometry_fields[0].get("coordinateSystem")
    if not coordinate_system:
        return None
    return coordinate_system.get("wkt") or coordinate_system.get("projjson", {}).get("id", {}).get("code")


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:70] or "layer"


def process_dataset(
    dataset_key: str,
    zip_path: Path,
    bbox: tuple[float, float, float, float],
    output_dir: Path,
) -> dict[str, Any]:
    metadata = DATASETS[dataset_key]
    extracted_dir = (zip_path.parent / "_extracted" / dataset_key).resolve()
    extracted = safe_extract_zip(zip_path, extracted_dir)
    source_files = sorted(
        path for path in extracted
        if path.suffix.lower() in {".gml", ".xml"}
        and path.is_file()
        and path.stat().st_size > 0
    )
    if not source_files:
        raise RuntimeError(f"No non-empty GML/XML source files found in {zip_path.name}")

    dataset_result: dict[str, Any] = {
        "key": dataset_key,
        "label": metadata["label"],
        "url": metadata["url"],
        "archive": zip_path.name,
        "archiveBytes": zip_path.stat().st_size,
        "archiveSha256": sha256_file(zip_path),
        "sourceFiles": [],
        "layers": [],
        "roiFeatureCount": 0,
        "roiVertexCount": 0,
        "roiBytes": 0,
    }
    geojson_dir = output_dir / "geojson"
    geojson_dir.mkdir(parents=True, exist_ok=True)

    for source_index, source_path in enumerate(source_files):
        info = ogrinfo_json(source_path)
        source_layers = info.get("layers") or []
        file_record = {
            "path": source_path.relative_to(extracted_dir).as_posix(),
            "bytes": source_path.stat().st_size,
            "driver": info.get("driverShortName"),
            "layers": len(source_layers),
        }
        dataset_result["sourceFiles"].append(file_record)
        for layer_index, layer in enumerate(source_layers):
            layer_name = layer.get("name") or f"layer-{layer_index}"
            geometry_fields = layer.get("geometryFields") or []
            if not geometry_fields:
                continue
            output_name = f"{dataset_key}-{source_index:02d}-{layer_index:02d}-{slug(layer_name)}.geojson"
            output_path = geojson_dir / output_name
            command = [
                "ogr2ogr", "-f", "GeoJSON", str(output_path),
                "-oo", "EXPOSE_GML_ID=YES", str(source_path), layer_name,
                "-t_srs", "EPSG:4326",
                "-spat", str(bbox[0]), str(bbox[1]), str(bbox[2]), str(bbox[3]),
                "-spat_srs", "EPSG:4326",
                "-lco", "RFC7946=YES",
            ]
            run_command(command)
            summary = summarize_geojson(output_path, metadata["area_attribute"]) if output_path.exists() else {
                "featureCount": 0, "vertexCount": 0, "geometryTypes": {},
                "boundsWgs84": None, "zRange": None, "geometryValidCount": 0,
                "geometryInvalidCount": 0, "geometryEmptyCount": 0,
                "projectedAreaM2": 0, "areaAttributeComparison": None, "bytes": 0,
            }
            layer_result = {
                "name": layer_name,
                "sourceFeatureCount": layer.get("featureCount"),
                "sourceGeometryType": geometry_fields[0].get("type"),
                "sourceSrsWkt": layer_srs(layer),
                "sourceExtent": geometry_fields[0].get("extent"),
                "roiGeoJson": output_name,
                **summary,
            }
            dataset_result["layers"].append(layer_result)
            dataset_result["roiFeatureCount"] += summary["featureCount"]
            dataset_result["roiVertexCount"] += summary["vertexCount"]
            dataset_result["roiBytes"] += summary["bytes"]
    return dataset_result


def current_cscl_comparison(
    roadbed_path: Path,
    cscl_path: Path,
    output_dir: Path,
    roi_bbox: tuple[float, float, float, float],
    buffer_degrees: float,
) -> dict[str, Any]:
    roadbed = json.loads(roadbed_path.read_text(encoding="utf-8")).get("features", [])
    cscl_data = json.loads(cscl_path.read_text(encoding="utf-8"))
    cscl = cscl_data.get("features", [])
    if not cscl:
        raise RuntimeError("Current NYC CSCL query returned no Times Square features")

    roi = box(*roi_bbox)
    lines = []
    cscl_codes: dict[str, int] = {}
    road_type_codes: dict[str, int] = {}
    speed_codes: dict[str, int] = {}
    roi_feature_count = 0
    cscl_by_physical_id: dict[str, list[dict[str, Any]]] = {}
    for feature in cscl:
        geometry_data = feature.get("geometry")
        if not geometry_data:
            continue
        geometry_wgs84 = shape(geometry_data)
        if geometry_wgs84.is_empty:
            continue
        if geometry_wgs84.intersects(roi):
            roi_feature_count += 1
        geometry = transform_geometry(WGS84_TO_NYLI.transform, geometry_wgs84)
        properties = feature.get("properties") or {}
        name = get_property(
            properties, "stname_label", "full_street_name", "street_name",
            "street", "streetname", "stname", "st_name", "name",
        )
        direction = get_property(properties, "trafdir", "traffic_direction")
        road_type = get_property(properties, "rw_type", "rwtype", "roadway_type")
        physical_id = get_property(properties, "physicalid", "physical_id")
        if direction is not None:
            key = str(direction)
            cscl_codes[key] = cscl_codes.get(key, 0) + 1
        if road_type is not None:
            key = str(road_type)
            road_type_codes[key] = road_type_codes.get(key, 0) + 1
        speed = get_property(properties, "posted_speed", "speed_limit", "speedlimit")
        if speed is not None:
            key = str(speed)
            speed_codes[key] = speed_codes.get(key, 0) + 1
        line = {
            "name": name,
            "normalizedName": normalize_name(name),
            "direction": direction,
            "roadType": road_type,
            "physicalId": physical_id,
            "totalLanes": get_property(properties, "number_total_lanes"),
            "travelLanes": get_property(properties, "number_travel_lanes"),
            "parkingLanes": get_property(properties, "number_park_lanes", "number_parking_lanes"),
            "streetWidthFt": get_property(properties, "streetwidth", "street_width"),
            "postedSpeedMph": speed,
            "properties": properties,
            "geometry": geometry,
        }
        lines.append(line)
        if physical_id is not None:
            cscl_by_physical_id.setdefault(str(physical_id), []).append(line)
    if not lines:
        raise RuntimeError("Current NYC CSCL query contained no usable line geometries")

    distances: list[float] = []
    width_deltas: list[float] = []
    matches: list[dict[str, Any]] = []
    same_name_count = physical_id_match_count = direction_agreement_count = 0
    physical_id_spatial_mismatch_count = 0
    lane_count_compared = lane_count_agreement = 0
    for feature in roadbed:
        geometry_data = feature.get("geometry")
        if not geometry_data:
            continue
        polygon = transform_geometry(WGS84_TO_NYLI.transform, shape(geometry_data))
        if polygon.is_empty:
            continue
        properties = feature.get("properties") or {}
        source_name = get_property(properties, "name")
        normalized_source_name = normalize_name(source_name)
        source_physical_id = get_property(properties, "physical_id")
        source_direction = get_property(properties, "traffic_direction")
        expected_direction = normalize_direction_code(source_direction)
        centroid = polygon.centroid

        physical_candidates = cscl_by_physical_id.get(str(source_physical_id), []) if source_physical_id is not None else []
        same_name = [
            line for line in lines
            if normalized_source_name and line["normalizedName"] == normalized_source_name
        ]
        physical_id_nearest = (
            min(physical_candidates, key=lambda line: centroid.distance(line["geometry"]))
            if physical_candidates else None
        )
        physical_id_distance_m = (
            centroid.distance(physical_id_nearest["geometry"])
            if physical_id_nearest is not None else None
        )
        same_name_nearest = (
            min(same_name, key=lambda line: centroid.distance(line["geometry"]))
            if same_name else None
        )
        same_name_distance_m = (
            centroid.distance(same_name_nearest["geometry"])
            if same_name_nearest is not None else None
        )

        # TUM's older physical IDs can span a different segment split from
        # current CSCL. Keep the ID evidence, but do not force a distant line
        # when a same-name current segment is geometrically much closer.
        if physical_id_nearest is not None and (
            physical_id_distance_m <= 10.0
            or same_name_nearest is None
            or same_name_distance_m >= physical_id_distance_m
        ):
            nearest = physical_id_nearest
            match_method = "physical_id"
        elif same_name_nearest is not None:
            nearest = same_name_nearest
            match_method = "normalized_street_name_after_physical_id_spatial_mismatch"
        else:
            nearest = min(lines, key=lambda line: centroid.distance(line["geometry"]))
            match_method = "nearest_fallback"
        distance_m = centroid.distance(nearest["geometry"])
        distances.append(distance_m)
        name_match = bool(same_name)
        physical_match = bool(physical_candidates)
        physical_id_spatial_mismatch = (
            physical_id_distance_m is not None and physical_id_distance_m > 10.0
        )
        physical_id_spatial_mismatch_count += int(physical_id_spatial_mismatch)
        direction_match = (
            expected_direction is not None
            and str(nearest["direction"]).strip().upper() == expected_direction
        )
        same_name_count += int(name_match)
        physical_id_match_count += int(physical_match)
        direction_agreement_count += int(direction_match)

        tum_lanes = get_property(properties, "number_total_lanes")
        current_lanes = nearest["totalLanes"]
        lane_match = None
        try:
            if tum_lanes is not None and current_lanes is not None:
                lane_count_compared += 1
                lane_match = int(float(tum_lanes)) == int(float(current_lanes))
                lane_count_agreement += int(lane_match)
        except (TypeError, ValueError):
            lane_match = None

        tum_width_m = get_property(properties, "street_width_meter")
        current_width_ft = nearest["streetWidthFt"]
        width_delta_m = None
        try:
            if tum_width_m is not None and current_width_ft is not None:
                width_delta_m = float(tum_width_m) - float(current_width_ft) * 0.3048
                width_deltas.append(abs(width_delta_m))
        except (TypeError, ValueError):
            width_delta_m = None

        matches.append({
            "tumGmlId": properties.get("gml_id"),
            "tumName": source_name,
            "tumSegmentId": get_property(properties, "segment_id"),
            "tumPhysicalId": source_physical_id,
            "tumTrafficDirection2016": source_direction,
            "expectedCurrentTrafficDirectionCode": expected_direction,
            "currentCsclName": nearest["name"],
            "currentCsclPhysicalId": nearest["physicalId"],
            "currentCsclTrafficDirection": nearest["direction"],
            "currentCsclRoadType": nearest["roadType"],
            "currentCsclTotalLanes": nearest["totalLanes"],
            "currentCsclTravelLanes": nearest["travelLanes"],
            "currentCsclParkingLanes": nearest["parkingLanes"],
            "currentCsclStreetWidthFt": nearest["streetWidthFt"],
            "currentCsclPostedSpeedMph": nearest["postedSpeedMph"],
            "tumStreetWidthM": tum_width_m,
            "streetWidthDeltaTumMinusCurrentM": round(width_delta_m, 3) if width_delta_m is not None else None,
            "tumTotalLanes2016": tum_lanes,
            "totalLaneCountAgrees": lane_match,
            "centroidToCurrentCsclDistanceM": round(distance_m, 3),
            "matchMethod": match_method,
            "sameStreetName": name_match,
            "physicalIdExistsInCurrentCscl": physical_match,
            "physicalIdCandidateDistanceM": (
                round(physical_id_distance_m, 3)
                if physical_id_distance_m is not None else None
            ),
            "physicalIdCandidateSpatialMismatch": (
                physical_id_spatial_mismatch if physical_id_distance_m is not None else None
            ),
            "trafficDirectionCodeAgrees": direction_match,
        })

    sorted_distances = sorted(distances)
    def percentile(values: list[float], fraction: float) -> float | None:
        if not values:
            return None
        index = min(len(values) - 1, max(0, round((len(values) - 1) * fraction)))
        return round(values[index], 3)

    sorted_width_deltas = sorted(width_deltas)
    copied_cscl = output_dir / "geojson" / "current-cscl-2026-times-square-buffer.geojson"
    copied_cscl.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cscl_path, copied_cscl)
    buffered_bbox = [
        roi_bbox[0] - buffer_degrees, roi_bbox[1] - buffer_degrees,
        roi_bbox[2] + buffer_degrees, roi_bbox[3] + buffer_degrees,
    ]
    return {
        "source": "NYC Open Data CSCL / Centerline",
        "url": "https://data.cityofnewyork.us/City-Government/NYC-Street-Centerline-CSCL-/inkn-q76z",
        "apiUrl": "https://data.cityofnewyork.us/resource/inkn-q76z.geojson",
        "retrievedAtUtc": datetime.now(timezone.utc).isoformat(),
        "featureCountInMatchBuffer": len(cscl),
        "featureCountIntersectingExactRoi": roi_feature_count,
        "matchBufferDegrees": buffer_degrees,
        "matchBboxWgs84": buffered_bbox,
        "geometryTypes": sorted({feature.get("geometry", {}).get("type") for feature in cscl if feature.get("geometry")}),
        "propertyKeys": sorted({key for feature in cscl for key in (feature.get("properties") or {}).keys()}),
        "trafficDirectionCodes": cscl_codes,
        "roadTypeCodes": road_type_codes,
        "postedSpeedMphCodes": speed_codes,
        "tumRoadbedToCurrentCscl": {
            "comparedRoadbedCount": len(matches),
            "sameStreetNameCount": same_name_count,
            "physicalIdMatchCount": physical_id_match_count,
            "physicalIdSpatialMismatchCount": physical_id_spatial_mismatch_count,
            "trafficDirectionComparedCount": len([m for m in matches if m["expectedCurrentTrafficDirectionCode"] is not None]),
            "trafficDirectionAgreementCount": direction_agreement_count,
            "totalLaneCountComparedCount": lane_count_compared,
            "totalLaneCountAgreementCount": lane_count_agreement,
            "streetWidthComparedCount": len(width_deltas),
            "streetWidthAbsDeltaM": {
                "median": percentile(sorted_width_deltas, 0.50),
                "p95": percentile(sorted_width_deltas, 0.95),
                "max": round(max(width_deltas), 3) if width_deltas else None,
                "within2m": sum(delta <= 2 for delta in width_deltas),
            },
            "centroidToCurrentCsclDistanceM": {
                "p50": percentile(sorted_distances, 0.50),
                "p95": percentile(sorted_distances, 0.95),
                "max": round(max(sorted_distances), 3) if sorted_distances else None,
                "within3m": sum(distance <= 3 for distance in distances),
                "within5m": sum(distance <= 5 for distance in distances),
                "within10m": sum(distance <= 10 for distance in distances),
            },
            "directionMapping": {"W": "FT", "A": "TF", "T": "TW", "P": "NV"},
            "matches": matches,
        },
        "geojson": copied_cscl.name,
        "bytes": copied_cscl.stat().st_size,
    }

OTI_ROADBED_SOURCE = "https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20"
OTI_ROADBED_TERMS = "https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje"
OTI_ROADBED_CAPTURE_RULES = "https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md"


def fetch_oti_roadbed_features(
    bbox: tuple[float, float, float, float],
    fetcher=None,
) -> list[dict[str, Any]]:
    """Fetch bounded official 2022 OTI roadbed polygons with stable source IDs."""
    features: list[dict[str, Any]] = []
    seen: set[int] = set()
    for offset in range(0, 2000, 200):
        params = {
            "where": "1=1",
            "geometry": ",".join(str(value) for value in bbox),
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "outSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "OBJECTID,SOURCE_ID,SUB_FEATURE_CODE,STATUS",
            "orderByFields": "OBJECTID",
            "resultOffset": str(offset),
            "resultRecordCount": "200",
            "returnGeometry": "true",
            "f": "geojson",
        }
        url = OTI_ROADBED_SOURCE + "/query?" + urlencode(params)
        if fetcher is None:
            with urlopen(url, timeout=45) as response:
                page = json.loads(response.read().decode("utf-8"))
        else:
            page = fetcher(url)
        if page.get("error"):
            raise RuntimeError("Official OTI roadbed service error: " + json.dumps(page["error"]))
        if page.get("type") != "FeatureCollection" or not isinstance(page.get("features"), list):
            raise RuntimeError("Official OTI roadbed query did not return a GeoJSON FeatureCollection")
        page_features = page["features"]
        for feature in page_features:
            properties = feature.get("properties") or {}
            object_id = properties.get("OBJECTID")
            if isinstance(object_id, int) and not isinstance(object_id, bool) and object_id not in seen:
                seen.add(object_id)
                features.append(feature)
        if len(page_features) < 200:
            break
        if offset == 1800:
            raise RuntimeError("OTI roadbed query reached the conservative 2,000-feature cap")
    if not features:
        raise RuntimeError("Official OTI Roadbed_2022 query returned no source features")
    return features


def _metric_roi(bbox: tuple[float, float, float, float]):
    return transform_geometry(WGS84_TO_NYLI.transform, box(*bbox))


def _feature_identifier(feature: dict[str, Any], source: str) -> str:
    properties = feature.get("properties") or {}
    if source == "TUM":
        return str(properties.get("gml_id") or properties.get("id") or "unknown")
    return str(properties.get("OBJECTID") or "unknown")


def _percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * fraction)))
    return round(ordered[index], 3)


def summarize_polygon_crosswalk(
    tum_features: list[dict[str, Any]],
    oti_features: list[dict[str, Any]],
    bbox: tuple[float, float, float, float],
) -> dict[str, Any]:
    """Compare two WGS84 polygon sets in EPSG:32118, clipped to one shared ROI."""
    roi = _metric_roi(bbox)

    def prepare(features: list[dict[str, Any]], source: str):
        records = []
        invalid = empty = zero_area_after_clip = 0
        for feature in features:
            geometry_data = feature.get("geometry")
            if not geometry_data:
                empty += 1
                continue
            geometry = shape(geometry_data)
            if geometry.is_empty:
                empty += 1
                continue
            if not geometry.is_valid:
                invalid += 1
                continue
            projected = transform_geometry(WGS84_TO_NYLI.transform, geometry)
            clipped = projected.intersection(roi)
            if clipped.is_empty or clipped.area <= 1e-6:
                zero_area_after_clip += 1
                continue
            records.append((_feature_identifier(feature, source), clipped))
        return records, {"invalid": invalid, "empty": empty, "zeroAreaAfterClip": zero_area_after_clip}

    tum_records, tum_quality = prepare(tum_features, "TUM")
    oti_records, oti_quality = prepare(oti_features, "OTI")
    if not tum_records:
        raise RuntimeError("No positive-area TUM polygons remain in the shared ROI")
    if not oti_records:
        raise RuntimeError("No positive-area OTI polygons remain in the shared ROI")
    tum_union = unary_union([geometry for _, geometry in tum_records])
    oti_union = unary_union([geometry for _, geometry in oti_records])
    intersection_area = tum_union.intersection(oti_union).area
    union_area = tum_union.union(oti_union).area
    tum_area = tum_union.area
    oti_area = oti_union.area

    nearest_records = []
    centroid_distances = []
    polygon_distances = []
    for tum_id, tum_geometry in tum_records:
        nearest_id, nearest_geometry = min(
            oti_records,
            key=lambda item: tum_geometry.centroid.distance(item[1].centroid),
        )
        centroid_distance = tum_geometry.centroid.distance(nearest_geometry.centroid)
        polygon_distance = tum_geometry.distance(nearest_geometry)
        centroid_distances.append(centroid_distance)
        polygon_distances.append(polygon_distance)
        nearest_records.append({
            "tumGmlId": tum_id,
            "nearestOtiObjectId": nearest_id,
            "centroidDistanceM": round(centroid_distance, 3),
            "polygonDistanceM": round(polygon_distance, 3),
            "overlapAreaWithNearestM2": round(tum_geometry.intersection(nearest_geometry).area, 3),
        })

    return {
        "tumFeatureCountInRoi": len(tum_records),
        "otiFeatureCountInRoi": len(oti_records),
        "tumGeometryQuality": tum_quality,
        "otiGeometryQuality": oti_quality,
        "tumUnionAreaM2": round(tum_area, 3),
        "otiUnionAreaM2": round(oti_area, 3),
        "intersectionAreaM2": round(intersection_area, 3),
        "tumCoverageByOtiPercent": round(intersection_area / tum_area * 100, 3) if tum_area else 0.0,
        "otiCoverageByTumPercent": round(intersection_area / oti_area * 100, 3) if oti_area else 0.0,
        "intersectionOverUnionPercent": round(intersection_area / union_area * 100, 3) if union_area else 0.0,
        "tumFeaturesIntersectingOtiUnion": sum(geometry.intersects(oti_union) for _, geometry in tum_records),
        "otiFeaturesIntersectingTumUnion": sum(geometry.intersects(tum_union) for _, geometry in oti_records),
        "centroidDistanceM": {
            "p50": _percentile(centroid_distances, 0.50),
            "p95": _percentile(centroid_distances, 0.95),
            "max": round(max(centroid_distances), 3) if centroid_distances else None,
        },
        "polygonDistanceM": {
            "p50": _percentile(polygon_distances, 0.50),
            "p95": _percentile(polygon_distances, 0.95),
            "max": round(max(polygon_distances), 3) if polygon_distances else None,
        },
        "worstCentroidMatches": sorted(
            nearest_records, key=lambda item: item["centroidDistanceM"], reverse=True
        )[:5],
    }


def compare_tum_to_oti_2022(
    roadbed_path: Path,
    intersection_path: Path,
    oti_features: list[dict[str, Any]],
    bbox: tuple[float, float, float, float],
) -> dict[str, Any]:
    tum_roadbeds = json.loads(roadbed_path.read_text(encoding="utf-8")).get("features", [])
    tum_intersections = json.loads(intersection_path.read_text(encoding="utf-8")).get("features", [])
    oti_roadbeds = [
        feature for feature in oti_features
        if int((feature.get("properties") or {}).get("SUB_FEATURE_CODE", -1)) == 350000
    ]
    oti_intersections = [
        feature for feature in oti_features
        if int((feature.get("properties") or {}).get("SUB_FEATURE_CODE", -1)) == 350010
    ]
    if not oti_roadbeds or not oti_intersections:
        raise RuntimeError(
            "OTI Roadbed_2022 query must include both roadbed (350000) and intersection (350010) features"
        )
    return {
        "source": OTI_ROADBED_SOURCE,
        "terms": OTI_ROADBED_TERMS,
        "captureRules": OTI_ROADBED_CAPTURE_RULES,
        "referenceImageryYear": 2022,
        "projection": "EPSG:32118 — NAD83 / New York Long Island (metres)",
        "roiBboxWgs84": list(bbox),
        "otiFetchedFeatureCount": len(oti_features),
        "otiSubtypeCounts": {
            "roadbed350000": len(oti_roadbeds),
            "intersection350010": len(oti_intersections),
        },
        "roadbed": summarize_polygon_crosswalk(tum_roadbeds, oti_roadbeds, bbox),
        "intersection": summarize_polygon_crosswalk(tum_intersections, oti_intersections, bbox),
        "runtimeImportAllowed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--current-cscl", type=Path, required=True)
    parser.add_argument(
        "--bbox", nargs=4, type=float, required=True,
        metavar=("MIN_LON", "MIN_LAT", "MAX_LON", "MAX_LAT"),
        help="Times Square ROI in WGS84, EPSG:4326",
    )
    parser.add_argument("--cscl-buffer-degrees", type=float, default=0.005)
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    bbox = tuple(args.bbox)
    if bbox[0] >= bbox[2] or bbox[1] >= bbox[3]:
        parser.error("bbox must be minLon minLat maxLon maxLat")

    report: dict[str, Any] = {
        "status": "running",
        "bboxWgs84": list(bbox),
        "datasets": [],
        "currentCscl": None,
        "otiCrosswalk": None,
        "errors": [],
        "warnings": [],
        "sourceRights": {
            "provider": "Technical University of Munich (TUM), derived from NYC Open Data",
            "terms": "TUM states free usage; NYC Open Data terms apply; copyright remains with original NYC dataset providers",
            "spdxLicense": None,
            "cc0": False,
            "attributionRequired": True,
        },
        "knownLimits": {
            "vintage": "2015-2017-era TUM model generation; not a 2026 as-built survey",
            "streetVerticalDatum": "TUM documentation states street-space objects currently use a 0 m base height and are not adapted to terrain",
            "geometryQuality": "TUM warns that automatically generated street-space objects can contain faulty results in complex scenarios",
            "runtimeImportAllowed": False,
        },
        "toolVersions": {},
    }
    try:
        report["toolVersions"]["ogrinfo"] = run_command(["ogrinfo", "--version"]).stdout.strip()
        report["toolVersions"]["ogr2ogr"] = run_command(["ogr2ogr", "--version"]).stdout.strip()
    except Exception as error:
        report["errors"].append(str(error))
        report["status"] = "fail"
        (args.output_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        return 1

    required_keys_with_features = {"roadbed", "intersection"}
    archive_names = {
        "roadbed": "NYC_CityGML_LoD2_Roadbed.zip",
        "intersection": "NYC_CityGML_LoD2_Intersection.zip",
        "road_marking": "NYC_CityGML_LoD2_Median_Painted.zip",
    }
    for key, metadata in DATASETS.items():
        archive = args.input_dir / archive_names[key]
        if not archive.exists():
            message = f"Missing archive: {archive}"
            if metadata["required"]:
                report["errors"].append(message)
            else:
                report["warnings"].append(message)
            continue
        try:
            result = process_dataset(key, archive, bbox, args.output_dir)
            report["datasets"].append(result)
            if key in required_keys_with_features and result["roiFeatureCount"] == 0:
                report["errors"].append(f"{key} dataset produced no features in the Times Square ROI")
            if result["layers"] and any(layer["geometryInvalidCount"] for layer in result["layers"]):
                report["errors"].append(f"{key} dataset contains invalid ROI geometries")
            if key == "road_marking" and result["roiFeatureCount"] == 0:
                report["warnings"].append("No road-marking features intersected the Times Square ROI")
            for layer in result["layers"]:
                comparison = layer.get("areaAttributeComparison")
                if comparison and comparison["within5Percent"] < comparison["comparedCount"] * 0.8:
                    report["warnings"].append(
                        f"{key}/{layer['name']}: fewer than 80% of ROI geometries match the source area attribute within 5%; inspect split/duplicate source segments"
                    )
        except Exception as error:
            report["errors"].append(f"{key}: {error}")

    try:
        roadbed_path = next(
            args.output_dir / "geojson" / layer["roiGeoJson"]
            for dataset in report["datasets"] if dataset["key"] == "roadbed"
            for layer in dataset["layers"] if layer["featureCount"] > 0
        )
        if not args.current_cscl.exists():
            raise RuntimeError(f"Missing current CSCL GeoJSON: {args.current_cscl}")
        report["currentCscl"] = current_cscl_comparison(roadbed_path, args.current_cscl, args.output_dir, bbox, args.cscl_buffer_degrees)
        if report["currentCscl"]["featureCountIntersectingExactRoi"] == 0:
            report["errors"].append("Current CSCL query returned zero ROI features")
        else:
            match_summary = report["currentCscl"]["tumRoadbedToCurrentCscl"]
            spatial_mismatches = match_summary["physicalIdSpatialMismatchCount"]
            if spatial_mismatches:
                report["warnings"].append(
                    f"{spatial_mismatches} TUM physical-ID candidates are more than 10m from their roadbed centroid; "
                    "the report records the original ID distance and uses a nearer same-name CSCL segment only when it is closer"
                )
            lane_compared = match_summary["totalLaneCountComparedCount"]
            lane_agreed = match_summary["totalLaneCountAgreementCount"]
            if lane_compared and lane_agreed / lane_compared < 0.8:
                report["warnings"].append(
                    f"2016 TUM lane counts agree with current CSCL for {lane_agreed}/{lane_compared} matched roadbeds; "
                    "do not use TUM lane counts as current routing truth"
                )
    except Exception as error:
        report["errors"].append(f"current CSCL comparison: {error}")

    try:
        roadbed_path = next(
            args.output_dir / "geojson" / layer["roiGeoJson"]
            for dataset in report["datasets"] if dataset["key"] == "roadbed"
            for layer in dataset["layers"] if layer["featureCount"] > 0
        )
        intersection_path = next(
            args.output_dir / "geojson" / layer["roiGeoJson"]
            for dataset in report["datasets"] if dataset["key"] == "intersection"
            for layer in dataset["layers"] if layer["featureCount"] > 0
        )
        oti_features = fetch_oti_roadbed_features(bbox)
        report["otiCrosswalk"] = compare_tum_to_oti_2022(
            roadbed_path, intersection_path, oti_features, bbox
        )
        for category in ("roadbed", "intersection"):
            summary = report["otiCrosswalk"][category]
            if summary["tumGeometryQuality"]["invalid"] or summary["otiGeometryQuality"]["invalid"]:
                report["errors"].append(f"TUM/OTI {category} crosswalk contains invalid source polygons")
            if summary["intersectionOverUnionPercent"] < 80:
                report["warnings"].append(
                    f"TUM/OTI {category} geometry IoU is below 80%; inspect source-vintage or feature-boundary differences"
                )
            if summary["tumGeometryQuality"]["zeroAreaAfterClip"] or summary["otiGeometryQuality"]["zeroAreaAfterClip"]:
                report["warnings"].append(
                    f"TUM/OTI {category} has source features that only touch the ROI boundary and were excluded from area comparison"
                )
    except Exception as error:
        report["errors"].append(f"TUM/OTI 2022 geometry crosswalk: {error}")

    report["status"] = "pass" if not report["errors"] else "fail"
    report_path = args.output_dir / "report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
