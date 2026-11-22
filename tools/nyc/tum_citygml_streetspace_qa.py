#!/usr/bin/env python3
"""Inspect and clip the public TUM/NYC CityGML street-space sources for a Times Square QA pilot.

This tool intentionally creates research artifacts only. It never writes into PATROL runtime assets.
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
from pathlib import Path
from typing import Any

DATASETS = {
    "roadbed": {
        "label": "NYC CityGML LoD2 Roadbed",
        "url": "https://www.3dcitydb.net/3dcitydb/fileadmin/public/datasets/NYC/NYC_street_space_CityGML_LoD2/NYC_CityGML_LoD2_Roadbed.zip",
        "required": True,
    },
    "intersection": {
        "label": "NYC CityGML LoD2 Intersection",
        "url": "https://www.3dcitydb.net/3dcitydb/fileadmin/public/datasets/NYC/NYC_street_space_CityGML_LoD2/NYC_CityGML_LoD2_Intersection.zip",
        "required": True,
    },
    "road_marking": {
        "label": "NYC CityGML LoD2 Median Painted / Road Markings",
        "url": "https://www.3dcitydb.net/3dcitydb/fileadmin/public/datasets/NYC/NYC_street_space_CityGML_LoD2/NYC_CityGML_LoD2_Median_Painted.zip",
        "required": False,
    },
}


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


def summarize_geojson(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    features = data.get("features", [])
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    vertex_count = 0
    geometry_types: dict[str, int] = {}
    for feature in features:
        geometry = feature.get("geometry") or {}
        geometry_type = geometry.get("type", "null")
        geometry_types[geometry_type] = geometry_types.get(geometry_type, 0) + 1
        for position in geometry_positions(geometry.get("coordinates")):
            vertex_count += 1
            min_x = min(min_x, float(position[0]))
            max_x = max(max_x, float(position[0]))
            min_y = min(min_y, float(position[1]))
            max_y = max(max_y, float(position[1]))
    bounds = None
    if vertex_count:
        bounds = [min_x, min_y, max_x, max_y]
    return {
        "featureCount": len(features),
        "vertexCount": vertex_count,
        "geometryTypes": geometry_types,
        "boundsWgs84": bounds,
        "bytes": path.stat().st_size,
    }


def ogrinfo_json(source_path: Path) -> dict[str, Any]:
    result = run_command(["ogrinfo", "-json", "-ro", "-so", str(source_path)])
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
    extracted_dir = output_dir / "_extracted" / dataset_key
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
            source_feature_count = layer.get("featureCount")
            output_name = f"{dataset_key}-{source_index:02d}-{layer_index:02d}-{slug(layer_name)}.geojson"
            output_path = geojson_dir / output_name
            command = [
                "ogr2ogr", "-f", "GeoJSON", str(output_path), str(source_path), layer_name,
                "-t_srs", "EPSG:4326",
                "-spat", str(bbox[0]), str(bbox[1]), str(bbox[2]), str(bbox[3]),
                "-spat_srs", "EPSG:4326",
                "-lco", "RFC7946=YES",
            ]
            run_command(command)
            summary = summarize_geojson(output_path) if output_path.exists() else {
                "featureCount": 0, "vertexCount": 0, "geometryTypes": {},
                "boundsWgs84": None, "bytes": 0,
            }
            layer_result = {
                "name": layer_name,
                "sourceFeatureCount": source_feature_count,
                "sourceGeometryType": geometry_fields[0].get("type"),
                "sourceSrsWkt": layer_srs(layer),
                "sourceExtent": layer.get("geometryFields", [{}])[0].get("extent"),
                "roiGeoJson": output_name,
                **summary,
            }
            dataset_result["layers"].append(layer_result)
            dataset_result["roiFeatureCount"] += summary["featureCount"]
            dataset_result["roiVertexCount"] += summary["vertexCount"]
            dataset_result["roiBytes"] += summary["bytes"]

    return dataset_result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
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
            "vintage": "2015-2017-era model generation; not a 2026 as-built survey",
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
    for key in DATASETS:
        archive = args.input_dir / {
            "roadbed": "NYC_CityGML_LoD2_Roadbed.zip",
            "intersection": "NYC_CityGML_LoD2_Intersection.zip",
            "road_marking": "NYC_CityGML_LoD2_Median_Painted.zip",
        }[key]
        if not archive.exists():
            message = f"Missing archive: {archive}"
            if DATASETS[key]["required"]:
                report["errors"].append(message)
            else:
                report["warnings"].append(message)
            continue
        try:
            result = process_dataset(key, archive, bbox, args.output_dir)
            report["datasets"].append(result)
            if key in required_keys_with_features and result["roiFeatureCount"] == 0:
                report["errors"].append(f"{key} dataset produced no features in the Times Square ROI")
            if key == "road_marking" and result["roiFeatureCount"] == 0:
                report["warnings"].append("No road-marking features intersected the Times Square ROI")
        except Exception as error:
            report["errors"].append(f"{key}: {error}")

    report["status"] = "pass" if not report["errors"] else "fail"
    report_path = args.output_dir / "report.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
