#!/usr/bin/env python3
"""Bounded NYC 2017 one-foot DEM ground-reference QA; never imports runtime assets."""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import geometry_mask, geometry_window
from rasterio.transform import from_origin
from rasterio.windows import Window
from shapely.geometry import box, mapping, shape
from shapely.ops import transform as transform_geometry, unary_union

from tools.nyc.tum_citygml_streetspace_qa import fetch_oti_roadbed_features

DEM_INDEX_LAYER = (
    "https://elevation.its.ny.gov/arcgis/rest/services/"
    "Dem_Indexes/FeatureServer/0"
)
DEFAULT_BBOX = (-73.991040, 40.753539, -73.981483, 40.761460)
US_SURVEY_FOOT_TO_METERS = 1200.0 / 3937.0
EXPECTED_EPSG = 2263
EXPECTED_RESOLUTION_US_FT = 1.0
VERTICAL_DATUM = "NAVD88, Geoid 12B"
CAPTURE_WINDOW = "2017-05-03 to 2017-05-17 (topographic capture)"


def fetch_dem_tile_index(
    bbox: tuple[float, float, float, float],
    fetcher=None,
) -> list[dict[str, Any]]:
    """Query the official NYS ITS tile index for NYC's 2017 one-foot DEM."""
    params = {
        "where": "1=1",
        "geometry": ",".join(str(value) for value in bbox),
        "geometryType": "esriGeometryEnvelope",
        "inSR": "4326",
        "outSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "OBJECTID,FILENAME,SIZE_,DIRECT_DL,FTP_PATH,COLLECTION,YEAR,PARTIAL,DEM_COLLEC,TILE_DATE,NOTES",
        "returnGeometry": "true",
        "f": "geojson",
    }
    url = DEM_INDEX_LAYER + "/query?" + urlencode(params)
    if fetcher is None:
        with urlopen(url, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
    else:
        payload = fetcher(url)
    if payload.get("error"):
        raise RuntimeError("NYS DEM tile-index error: " + json.dumps(payload["error"]))
    if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
        raise RuntimeError("NYS DEM tile index did not return a GeoJSON FeatureCollection")
    tiles = []
    seen = set()
    for feature in payload["features"]:
        props = feature.get("properties") or {}
        filename = str(props.get("FILENAME") or "")
        direct_url = str(props.get("DIRECT_DL") or "")
        object_id = props.get("OBJECTID")
        if not filename.lower().endswith(".tif") or not direct_url.startswith("https://"):
            continue
        if not isinstance(object_id, int) or object_id in seen:
            continue
        if not feature.get("geometry"):
            raise RuntimeError(f"DEM tile {filename} is missing its index footprint")
        seen.add(object_id)
        tiles.append(feature)
    if not tiles:
        raise RuntimeError("No public NYC 2017 one-foot DEM tile intersects the requested ROI")
    return tiles


def select_single_covering_tile(
    tiles: list[dict[str, Any]],
    bbox: tuple[float, float, float, float],
) -> dict[str, Any]:
    """Require exactly one indexed tile footprint to cover the full ROI."""
    roi = box(*bbox)
    covering = []
    for feature in tiles:
        geometry = shape(feature["geometry"])
        if geometry.is_empty or not geometry.is_valid:
            raise RuntimeError("DEM tile-index footprint is empty or invalid")
        if geometry.covers(roi):
            covering.append(feature)
    if len(covering) != 1:
        details = [
            {
                "objectId": (item.get("properties") or {}).get("OBJECTID"),
                "filename": (item.get("properties") or {}).get("FILENAME"),
                "coversRoi": shape(item["geometry"]).covers(roi),
            }
            for item in tiles
        ]
        raise RuntimeError(
            "Expected exactly one DEM tile to cover the full ROI; "
            + json.dumps(details)
        )
    return covering[0]


def validate_range_probe(
    status: int,
    content_range: str | None,
    expected_size: int,
) -> dict[str, Any]:
    """Reject servers that would force an unbounded 674MB whole-tile download."""
    expected_suffix = f"/{expected_size}"
    if status != 206 or not content_range or not content_range.endswith(expected_suffix):
        raise RuntimeError(
            "DEM server did not confirm HTTP byte-range support for the indexed file; "
            f"status={status}, Content-Range={content_range!r}, expectedSize={expected_size}"
        )
    return {
        "status": status,
        "contentRange": content_range,
        "expectedSizeBytes": expected_size,
        "rangeSupported": True,
    }


def probe_http_range(url: str, expected_size: int) -> dict[str, Any]:
    request = Request(url, headers={"Range": "bytes=0-0"})
    with urlopen(request, timeout=45) as response:
        status = int(getattr(response, "status", response.getcode()))
        content_range = response.headers.get("Content-Range")
        first_byte = response.read(1)
    if len(first_byte) != 1:
        raise RuntimeError("DEM HTTP range probe returned no byte")
    return validate_range_probe(status, content_range, expected_size)


def percentile(values: np.ndarray, fraction: float) -> float | None:
    if values.size == 0:
        return None
    return round(float(np.percentile(values, fraction * 100.0)), 4)


def summarize_values_us_survey_feet(values: np.ndarray) -> dict[str, Any]:
    values = np.asarray(values, dtype="float64")
    values = values[np.isfinite(values)]
    if values.size == 0:
        return {"pixelCount": 0}
    meters = values * US_SURVEY_FOOT_TO_METERS
    return {
        "pixelCount": int(values.size),
        "minUsSurveyFeet": round(float(np.min(values)), 4),
        "p05UsSurveyFeet": percentile(values, 0.05),
        "p50UsSurveyFeet": percentile(values, 0.50),
        "p95UsSurveyFeet": percentile(values, 0.95),
        "maxUsSurveyFeet": round(float(np.max(values)), 4),
        "minMetersNavd88": round(float(np.min(meters)), 4),
        "p05MetersNavd88": percentile(meters, 0.05),
        "p50MetersNavd88": percentile(meters, 0.50),
        "p95MetersNavd88": percentile(meters, 0.95),
        "maxMetersNavd88": round(float(np.max(meters)), 4),
    }


def aggregate_feature_samples(records: list[dict[str, Any]]) -> dict[str, Any]:
    sampled = [record for record in records if record["elevation"]["pixelCount"] > 0]
    medians = np.asarray(
        [record["elevation"]["p50MetersNavd88"] for record in sampled],
        dtype="float64",
    )
    return {
        "featureCount": len(records),
        "sampledFeatureCount": len(sampled),
        "noDataFeatureCount": len(records) - len(sampled),
        "validPixelSamples": sum(record["elevation"]["pixelCount"] for record in sampled),
        "medianOfFeatureMediansMetersNavd88": {
            "p05": percentile(medians, 0.05),
            "p50": percentile(medians, 0.50),
            "p95": percentile(medians, 0.95),
        },
        "minimumFeatureMinimumMetersNavd88": (
            min(record["elevation"]["minMetersNavd88"] for record in sampled)
            if sampled else None
        ),
        "maximumFeatureMaximumMetersNavd88": (
            max(record["elevation"]["maxMetersNavd88"] for record in sampled)
            if sampled else None
        ),
    }


def sample_polygon_features(
    raster: rasterio.io.DatasetReader,
    features: list[dict[str, Any]],
    subtype: int,
) -> list[dict[str, Any]]:
    transformer = Transformer.from_crs("EPSG:4326", raster.crs, always_xy=True)
    records = []
    for feature in features:
        properties = feature.get("properties") or {}
        try:
            feature_subtype = int(properties.get("SUB_FEATURE_CODE", -1))
        except (TypeError, ValueError):
            continue
        if feature_subtype != subtype:
            continue
        geometry = shape(feature.get("geometry") or {})
        if geometry.is_empty or not geometry.is_valid:
            raise RuntimeError(
                f"Invalid OTI polygon OBJECTID={properties.get('OBJECTID')} during DEM sampling"
            )
        projected = transform_geometry(transformer.transform, geometry)
        try:
            window = geometry_window(raster, [mapping(projected)]).round_offsets().round_lengths()
        except Exception as error:
            records.append({
                "objectId": properties.get("OBJECTID"),
                "sourceId": properties.get("SOURCE_ID"),
                "subtype": subtype,
                "elevation": {"pixelCount": 0},
                "sampleError": str(error),
            })
            continue
        data = raster.read(1, window=window, masked=True)
        inside = geometry_mask(
            [mapping(projected)],
            out_shape=data.shape,
            transform=raster.window_transform(window),
            invert=True,
            all_touched=False,
        )
        valid = inside & ~np.ma.getmaskarray(data) & np.isfinite(data.data)
        values = np.asarray(data.data[valid], dtype="float64")
        records.append({
            "objectId": properties.get("OBJECTID"),
            "sourceId": properties.get("SOURCE_ID"),
            "subtype": subtype,
            "elevation": summarize_values_us_survey_feet(values),
        })
    return records


def crop_and_sample_dem(
    tile_url: str,
    bbox: tuple[float, float, float, float],
    oti_features: list[dict[str, Any]],
    crop_path: Path,
    range_probe: dict[str, Any],
) -> dict[str, Any]:
    remote_path = "/vsicurl/" + tile_url
    env_options = {
        "CPL_VSIL_CURL_USE_HEAD": "NO",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": ".tif",
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "GDAL_HTTP_MULTIRANGE": "YES",
    }
    with rasterio.Env(**env_options):
        with rasterio.open(remote_path) as source:
            epsg = source.crs.to_epsg() if source.crs else None
            if epsg != EXPECTED_EPSG:
                raise RuntimeError(f"Expected DEM EPSG:{EXPECTED_EPSG}; received {source.crs}")
            if source.count != 1:
                raise RuntimeError(f"Expected one DEM band; received {source.count}")
            if (
                abs(abs(source.res[0]) - EXPECTED_RESOLUTION_US_FT) > 0.01
                or abs(abs(source.res[1]) - EXPECTED_RESOLUTION_US_FT) > 0.01
            ):
                raise RuntimeError(f"Expected 1 US-survey-foot cells; received {source.res}")
            transformer = Transformer.from_crs("EPSG:4326", source.crs, always_xy=True)
            roi = transform_geometry(transformer.transform, box(*bbox))
            raster_bounds = box(*source.bounds)
            if not raster_bounds.covers(roi):
                raise RuntimeError("The DEM raster bounds do not cover the requested ROI")
            window = geometry_window(source, [mapping(roi)]).round_offsets().round_lengths()
            if window.width <= 0 or window.height <= 0:
                raise RuntimeError("DEM ROI crop resolved to an empty pixel window")
            data = source.read(1, window=window, masked=True)
            crop_transform = source.window_transform(window)
            crop_path.parent.mkdir(parents=True, exist_ok=True)
            profile = source.profile.copy()
            profile.update(
                driver="GTiff",
                width=data.shape[1],
                height=data.shape[0],
                transform=crop_transform,
                compress="DEFLATE",
                predictor=2,
                tiled=True,
                blockxsize=256,
                blockysize=256,
            )
            with rasterio.open(crop_path, "w", **profile) as destination:
                destination.write(data.filled(0), 1)
                destination.write_mask((~np.ma.getmaskarray(data)).astype("uint8") * 255)
            raster_metadata = {
                "crs": source.crs.to_string(),
                "epsg": epsg,
                "resolutionUsSurveyFeet": [abs(float(source.res[0])), abs(float(source.res[1]))],
                "bandCount": source.count,
                "dtype": source.dtypes[0],
                "nodata": source.nodata,
                "fullTileWidthPixels": source.width,
                "fullTileHeightPixels": source.height,
                "fullTileBounds": list(source.bounds),
                "roiWindow": {
                    "columnOffset": int(window.col_off),
                    "rowOffset": int(window.row_off),
                    "width": int(window.width),
                    "height": int(window.height),
                },
                "roiWidthPixels": int(data.shape[1]),
                "roiHeightPixels": int(data.shape[0]),
                "roiPixelCount": int(data.shape[0] * data.shape[1]),
                "validRoiPixels": int(np.count_nonzero(~np.ma.getmaskarray(data))),
                "nodataRoiPixels": int(np.count_nonzero(np.ma.getmaskarray(data))),
                "sourceTags": source.tags(),
                "httpRangeProbe": range_probe,
            }
    with rasterio.open(crop_path) as cropped:
        roadbed_records = sample_polygon_features(cropped, oti_features, 350000)
        intersection_records = sample_polygon_features(cropped, oti_features, 350010)
    return {
        "raster": raster_metadata,
        "roadbedGroundSamples": aggregate_feature_samples(roadbed_records),
        "intersectionGroundSamples": aggregate_feature_samples(intersection_records),
        "roadbedSamples": roadbed_records,
        "intersectionSamples": intersection_records,
    }


def run_ground_reference(
    bbox: tuple[float, float, float, float],
    output_dir: Path,
    tile_fetcher=None,
) -> dict[str, Any]:
    tiles = fetch_dem_tile_index(bbox, fetcher=tile_fetcher)
    tile = select_single_covering_tile(tiles, bbox)
    properties = tile["properties"]
    tile_url = str(properties["DIRECT_DL"])
    expected_size = int(properties["SIZE_"])
    range_probe = probe_http_range(tile_url, expected_size)
    oti_features = fetch_oti_roadbed_features(bbox)
    crop_path = output_dir / "nyc-times-square-2017-dem-roi.tif"
    sampled = crop_and_sample_dem(tile_url, bbox, oti_features, crop_path, range_probe)
    warnings = [
        "2017 LiDAR is historical ground reference, not a 2026 as-built survey.",
        "Bare-earth elevations are ground terrain, not bridge deck or elevated-road deck elevations.",
        "OTI 2022 roadbed polygons are planimetric; road surface thickness, curb height and ramp grade are not supplied.",
        "Vertical values remain NAVD88 Geoid 12B; do not mix with an unverified local/game Y datum.",
    ]
    if sampled["roadbedGroundSamples"]["noDataFeatureCount"]:
        warnings.append(
            "Some OTI roadbed polygons had no valid DEM pixel samples; review those source IDs before terrain draping."
        )
    if sampled["intersectionGroundSamples"]["noDataFeatureCount"]:
        warnings.append(
            "Some OTI intersection polygons had no valid DEM pixel samples; review those source IDs before terrain draping."
        )
    return {
        "schema": "patrol-nyc-2017-dem-ground-reference-v1",
        "status": "pass",
        "roiBboxWgs84": list(bbox),
        "demSource": {
            "tileIndex": DEM_INDEX_LAYER + "/0",
            "tileObjectId": properties.get("OBJECTID"),
            "filename": properties.get("FILENAME"),
            "directDownloadUrl": tile_url,
            "indexedSizeBytes": expected_size,
            "collection": properties.get("COLLECTION"),
            "year": properties.get("YEAR"),
            "partialFlag": properties.get("PARTIAL"),
            "tileDate": properties.get("TILE_DATE"),
            "horizontalCrs": "EPSG:2263 — NAD83 / New York Long Island, US survey feet",
            "verticalDatum": VERTICAL_DATUM,
            "cellSize": "1 US survey foot",
            "captureWindow": CAPTURE_WINDOW,
            "publisher": "City of New York OTI / Quantum Spatial Inc.",
            "accessRights": "Public",
            "useLimitations": "NYC Open Data reuse terms; preserve source attribution and version",
            "termsUrl": "https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje",
            "metadataUrl": "https://github.com/CityOfNewYork/nyc-geo-metadata/blob/main/Metadata/Metadata_BareEarthDigitalElevationModel.md",
        },
        "verticalConversion": {
            "sourceUnit": "US survey foot",
            "targetUnit": "metre",
            "metresPerUsSurveyFoot": US_SURVEY_FOOT_TO_METERS,
            "verticalDatum": VERTICAL_DATUM,
        },
        "tileFootprintCoversRoi": True,
        "tileQueryFeatureCount": len(tiles),
        "raster": sampled["raster"],
        "roadbedGroundSamples": sampled["roadbedGroundSamples"],
        "intersectionGroundSamples": sampled["intersectionGroundSamples"],
        "roadbedSamples": sampled["roadbedSamples"],
        "intersectionSamples": sampled["intersectionSamples"],
        "warnings": warnings,
        "runtimeImportAllowed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", type=Path, default=Path("artifacts/nyc-dem-ground-reference"))
    parser.add_argument("--bbox", nargs=4, type=float, default=DEFAULT_BBOX)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    report_path = args.out_dir / "report.json"
    try:
        report = run_ground_reference(tuple(args.bbox), args.out_dir)
        report["errors"] = []
    except Exception as error:
        report = {
            "schema": "patrol-nyc-2017-dem-ground-reference-v1",
            "status": "fail",
            "roiBboxWgs84": list(args.bbox),
            "errors": [str(error)],
            "runtimeImportAllowed": False,
        }
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))
        return 1
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "tile": report["demSource"]["filename"],
        "raster": report["raster"],
        "roadbed": report["roadbedGroundSamples"],
        "intersections": report["intersectionGroundSamples"],
        "warnings": report["warnings"],
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
