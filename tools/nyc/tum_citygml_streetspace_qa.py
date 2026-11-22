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

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as transform_geometry

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
    return re.sub(r"\s+", " ", re.sub(r"[^A-Z0-9 ]+", " ", str(value).upper())).strip()


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


def current_cscl_comparison(roadbed_path: Path, cscl_path: Path, output_dir: Path) -> dict[str, Any]:
    roadbed = json.loads(roadbed_path.read_text(encoding="utf-8")).get("features", [])
    cscl_data = json.loads(cscl_path.read_text(encoding="utf-8"))
    cscl = cscl_data.get("features", [])
    if not cscl:
        raise RuntimeError("Current NYC CSCL query returned no Times Square features")

    lines = []
    cscl_codes: dict[str, int] = {}
    road_type_codes: dict[str, int] = {}
    cscl_names: dict[str, int] = {}
    cscl_by_physical_id: dict[str, dict[str, Any]] = {}
    for feature in cscl:
        geometry_data = feature.get("geometry")
        if not geometry_data:
            continue
        geometry = transform_geometry(WGS84_TO_NYLI.transform, shape(geometry_data))
        if geometry.is_empty:
            continue
        properties = feature.get("properties") or {}
        name = get_property(properties, "street", "street_name", "streetname", "stname", "st_name", "full_street_name", "name")
        direction = get_property(properties, "trafdir", "traffic_direction")
        road_type = get_property(properties, "rw_type", "rwtype", "roadway_type")
        physical_id = get_property(properties, "physicalid", "physical_id")
        if direction is not None:
            key = str(direction)
            cscl_codes[key] = cscl_codes.get(key, 0) + 1
        if road_type is not None:
            key = str(road_type)
            road_type_codes[key] = road_type_codes.get(key, 0) + 1
        normalized_name = normalize_name(name)
        if normalized_name:
            cscl_names[normalized_name] = cscl_names.get(normalized_name, 0) + 1
        if physical_id is not None:
            cscl_by_physical_id[str(physical_id)] = {
                "name": name, "direction": direction, "roadType": road_type,
                "properties": properties, "geometry": geometry,
            }
        lines.append({
            "name": name,
            "normalizedName": normalized_name,
            "direction": direction,
            "roadType": road_type,
            "physicalId": physical_id,
            "properties": properties,
            "geometry": geometry,
        })
    if not lines:
        raise RuntimeError("Current NYC CSCL query contained no usable line geometries")

    distances: list[float] = []
    matches: list[dict[str, Any]] = []
    same_name_count = physical_id_match_count = direction_agreement_count = 0
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
        same_name = [line for line in lines if normalized_source_name and line["normalizedName"] == normalized_source_name]
        candidates = same_name if same_name else lines
        nearest = min(candidates, key=lambda line: centroid.distance(line["geometry"]))
        distance_m = centroid.distance(nearest["geometry"])
        distances.append(distance_m)
        name_match = bool(same_name)
        physical_match = (
            source_physical_id is not None
            and str(source_physical_id) in cscl_by_physical_id
        )
        direction_match = (
            expected_direction is not None
            and str(nearest["direction"]).strip().upper() == expected_direction
        )
        same_name_count += int(name_match)
        physical_id_match_count += int(physical_match)
        direction_agreement_count += int(direction_match)
        matches.append({
            "tumName": source_name,
            "tumSegmentId": get_property(properties, "segment_id"),
            "tumPhysicalId": source_physical_id,
            "tumTrafficDirection2016": source_direction,
            "expectedCurrentTrafficDirectionCode": expected_direction,
            "currentCsclName": nearest["name"],
            "currentCsclPhysicalId": nearest["physicalId"],
            "currentCsclTrafficDirection": nearest["direction"],
            "currentCsclRoadType": nearest["roadType"],
            "centroidToCurrentCsclDistanceM": round(distance_m, 3),
            "sameStreetName": name_match,
            "physicalIdExistsInCurrentCscl": physical_match,
            "trafficDirectionCodeAgrees": direction_match,
        })

    sorted_distances = sorted(distances)
    def percentile(values: list[float], fraction: float) -> float | None:
        if not values:
            return None
        index = min(len(values) - 1, max(0, round((len(values) - 1) * fraction)))
        return round(values[index], 3)

    copied_cscl = output_dir / "geojson" / "current-cscl-2026-times-square.geojson"
    copied_cscl.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(cscl_path, copied_cscl)
    return {
        "source": "NYC Open Data CSCL / Centerline",
        "url": "https://data.cityofnewyork.us/City-Government/NYC-Street-Centerline-CSCL-/inkn-q76z",
        "apiUrl": "https://data.cityofnewyork.us/resource/inkn-q76z.geojson",
        "retrievedAtUtc": datetime.now(timezone.utc).isoformat(),
        "featureCount": len(cscl),
        "geometryTypes": sorted({feature.get("geometry", {}).get("type") for feature in cscl if feature.get("geometry")}),
        "propertyKeys": sorted({key for feature in cscl for key in (feature.get("properties") or {}).keys()}),
        "trafficDirectionCodes": cscl_codes,
        "roadTypeCodes": road_type_codes,
        "streetNameCount": len(cscl_names),
        "tumRoadbedToCurrentCscl": {
            "comparedRoadbedCount": len(matches),
            "sameStreetNameCount": same_name_count,
            "physicalIdExistsCount": physical_id_match_count,
            "trafficDirectionAgreementCount": direction_agreement_count,
            "centroidToNearestCurrentCsclDistanceM": {
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
            for layer in dataset["layers"] if layer["roiFeatureCount"] > 0
        )
        if not args.current_cscl.exists():
            raise RuntimeError(f"Missing current CSCL GeoJSON: {args.current_cscl}")
        report["currentCscl"] = current_cscl_comparison(roadbed_path, args.current_cscl, args.output_dir)
        if report["currentCscl"]["featureCount"] == 0:
            report["errors"].append("Current CSCL query returned zero ROI features")
    except Exception as error:
        report["errors"].append(f"current CSCL comparison: {error}")

    report["status"] = "pass" if not report["errors"] else "fail"
    report_path = args.output_dir / "report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
