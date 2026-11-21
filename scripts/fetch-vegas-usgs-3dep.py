#!/usr/bin/env python3
"""Fetch raw USGS 3DEP *elevation* GeoTIFF and derive a Vegas ridge profile.

No fake values: an unreachable service, RGB hillshade, missing CRS, implausible
elevations or weak spatial variation fails closed. The raw GeoTIFF + SHA256
remain in Actions artifact; only a small georeferenced profile is committed.
"""
from __future__ import annotations
import datetime as dt
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import urllib.parse
import urllib.request

import numpy as np
import rasterio
from rasterio.io import MemoryFile

SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
BBOX = (-115.395, 36.035, -114.965, 36.245)  # lon/lat WGS84, covers valley and eastern/western uplands
WIDTH, HEIGHT = 256, 128
PARAMS = {
    "bbox": ",".join(map(str, BBOX)),
    "bboxSR": "4326",
    "imageSR": "4326",
    "size": f"{WIDTH},{HEIGHT}",
    "format": "tiff",
    "pixelType": "F32",
    "interpolation": "RSP_BilinearInterpolation",
    "f": "image",
}
OUTPUT = Path("artifacts/vegas-dem")


def lon_to_col(lon: float) -> int:
    return max(0, min(WIDTH - 1, int(round((lon - BBOX[0]) / (BBOX[2] - BBOX[0]) * (WIDTH - 1)))))


def lat_to_row(lat: float) -> int:
    return max(0, min(HEIGHT - 1, int(round((BBOX[3] - lat) / (BBOX[3] - BBOX[1]) * (HEIGHT - 1)))))


def query() -> bytes:
    url = SERVICE + "?" + urllib.parse.urlencode(PARAMS)
    request = urllib.request.Request(url, headers={"User-Agent": "PATROL-USGS-3DEP-elevation-provenance/1.0"})
    with urllib.request.urlopen(request, timeout=100) as response:
        if response.status != 200 or "image" not in response.headers.get("Content-Type", "").lower():
            raise RuntimeError(f"Not raw elevation imagery: HTTP {response.status} / {response.headers.get('Content-Type')}")
        data = response.read(3_000_000)
    if len(data) < 1024 or len(data) >= 3_000_000 or data[:4] not in (b"II*\x00", b"MM\x00*"):
        raise RuntimeError("Invalid or unexpectedly large GeoTIFF response")
    return data


def convert(raw: bytes) -> dict:
    with MemoryFile(raw) as mem, mem.open() as dataset:
        if dataset.count != 1 or dataset.width != WIDTH or dataset.height != HEIGHT:
            raise RuntimeError(f"Expected 1-band {WIDTH}x{HEIGHT}, got {dataset.count} {dataset.width}x{dataset.height}")
        if dataset.crs is None or dataset.crs.to_epsg() != 4326:
            raise RuntimeError(f"USGS output CRS is missing/incorrect: {dataset.crs}")
        if dataset.dtypes[0] != "float32":
            raise RuntimeError(f"Expected raw elevation float32, received {dataset.dtypes[0]} (possibly hillshade)")
        arr = dataset.read(1, masked=True).filled(np.nan).astype("float64")
        bounds = dataset.bounds
        if max(abs(bounds.left - BBOX[0]), abs(bounds.right - BBOX[2]),
               abs(bounds.bottom - BBOX[1]), abs(bounds.top - BBOX[3])) > 0.002:
            raise RuntimeError(f"Unexpected raster extent {bounds}")
        valid = arr[np.isfinite(arr)]
        if valid.size < arr.size * 0.98 or not np.all((valid > 100) & (valid < 4500)):
            raise RuntimeError("Missing data or impossible Las Vegas elevations")
        if np.ptp(valid) < 70:
            raise RuntimeError("Raster is too flat to represent surrounding measured hills")
        def col_range(lo: float, hi: float) -> slice:
            return slice(lon_to_col(lo), lon_to_col(hi) + 1)
        west = col_range(-115.385, -115.305)
        center = col_range(-115.182, -115.162)
        east = col_range(-115.045, -114.976)
        latitudes = [round(BBOX[1] + (BBOX[3] - BBOX[1]) * i / 48, 7) for i in range(49)]
        samples = {"west": [], "center": [], "east": []}
        for lat in latitudes:
            row = lat_to_row(lat)
            band = arr[max(0, row - 1):min(HEIGHT, row + 2)]
            samples["west"].append(round(float(np.nanmax(band[:, west])), 2))
            samples["center"].append(round(float(np.nanmedian(band[:, center])), 2))
            samples["east"].append(round(float(np.nanmax(band[:, east])), 2))
        for side in ("west", "east"):
            diff = np.array(samples[side]) - np.array(samples["center"])
            if not np.isfinite(diff).all() or np.ptp(samples[side]) < 6:
                raise RuntimeError(f"Invalid or too-flat {side} ridge profile")
        return {
            "schema": "patrol-vegas-usgs-3dep-ridges-v1",
            "source": {"agency": "USGS", "dataset": "3DEP Bare Earth Dynamic ImageServer",
                       "serviceUrl": SERVICE, "request": PARAMS,
                       "rawGeoTiffSHA256": hashlib.sha256(raw).hexdigest(),
                       "retrievedUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
                       "license": "United States Government public domain",
                       "crs": "EPSG:4326", "verticalUnits": "meters"},
            "boundsWgs84": list(BBOX),
            "sampleLatitudesNorthing": latitudes,
            "elevationMeters": samples,
            "gameInterpretation": {
                "x": "west/east background ridge only, not ground plane",
                "z": "south to north in 49 samples across the bounded extent",
                "height": "relative to valley center in meters; non-1:1 display scale"
            },
        }


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    raw = query()
    payload = convert(raw)
    (OUTPUT / "usgs-3dep-raw.tif").write_bytes(raw)
    (OUTPUT / "strip-ridges-3dep.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    vals = payload["elevationMeters"]
    print(json.dumps({"source_sha256": payload["source"]["rawGeoTiffSHA256"],
                      "sample_count": len(vals["west"]), "westRange": [min(vals["west"]), max(vals["west"])],
                      "eastRange": [min(vals["east"]), max(vals["east"])],
                      "centerRange": [min(vals["center"]), max(vals["center"])]}, indent=2))


if __name__ == "__main__":
    main()
