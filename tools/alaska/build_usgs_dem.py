#!/usr/bin/env python3
"""Bake a bounded, *real* Alaska DEM from the public-domain USGS 3DEP service.

Output is a ~175 KB base64-packed 256×256 uint16 grid in metre units.
Image row 0 is SOUTH (consistent with PATROL's heightfield indexing).
Source service: USGS 3DEP Bare Earth ImageServer, float32 GeoTIFF.
No OAuth, commercial terrain service or scraped satellite imagery is used.
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import math
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

import numpy as np
import tifffile

SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
# ~7.7 km east-west × 8.0 km north-south, Tracy Arm / North Sawyer Glacier.
BBOX = (-133.265, 57.851, -133.135, 57.923)
SIZE = 256
OUTPUT = pathlib.Path("assets/alaska/tracy-arm-3dep.json")

def fetch_tiff():
    args = {
        "bbox": ",".join(str(value) for value in BBOX),
        "bboxSR": "4326", "imageSR": "4326",
        "size": f"{SIZE},{SIZE}", "format": "tiff",
        "pixelType": "F32",
        "interpolation": "RSP_BilinearInterpolation", "f": "image",
    }
    url = SERVICE + "?" + urllib.parse.urlencode(args)
    headers = {
        "User-Agent": "PATROL-FlightSim-Alaska-DEM/1.0 (public-domain 3DEP)",
        "Accept": "image/tiff,application/octet-stream",
    }
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=90) as response:
                data = response.read(8_000_001)
                if len(data) > 8_000_000:
                    raise RuntimeError("USGS response too large for 256² DEM")
                if not data[:4] in (b"II*\x00", b"MM\x00*"):
                    raise RuntimeError("USGS did not return a TIFF; check service/bounds")
                return data, url
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == 3:
                raise RuntimeError("USGS DEM unavailable after retries") from exc
            print(f"USGS transient error ({attempt+1}/4): {exc}", flush=True)
            time.sleep(2 ** attempt)

def bake(source_bytes, source_url):
    img = tifffile.imread(io.BytesIO(source_bytes))
    if img.shape != (SIZE, SIZE) or img.dtype.kind != "f":
        raise ValueError(f"Expected 256x256 float32 USGS elevation grid; got {img.shape} {img.dtype}")
    # USGS: north-up GeoTIFF. PATROL: row 0 maps to negative Z/south.
    south_first = img[::-1].astype(np.float64)
    valid = np.isfinite(south_first) & (south_first > -100) & (south_first < 9000)
    # Sea and nodata have 0 metre elevation (below the game water surface).
    elevations = np.where(valid, np.maximum(0, south_first), 0)
    if np.nanmax(elevations) < 300 or np.mean(elevations > 3) < .20:
        raise RuntimeError("Unexpectedly flat/empty DEM; refusing to publish synthetic elevations")
    q = np.rint(elevations).clip(0, 8000).astype("<u2")
    elevation_data = q.tobytes(order="C")
    payload = {
        "format": "usgs-3dep-u16le-v1",
        "source": "USGS 3DEP Bare Earth Elevation ImageServer (public domain)",
        "sourceUrl": SERVICE,
        "bbox": list(BBOX),
        "crs": "EPSG:4326",
        "axis": "x=east, z=north, south-first raster rows",
        "width": SIZE, "height": SIZE,
        "verticalUnit": "meters",
        "sampleSpacingApproxMeters": [round((BBOX[2]-BBOX[0])*111320*math.cos(math.radians(sum(BBOX[1::2])/2))/SIZE,1),
                                     round((BBOX[3]-BBOX[1])*111320/SIZE,1)],
        "maxElevationMeters": int(q.max()),
        "landCoverageFraction": round(float(np.mean(q > 3)),3),
        "heightsBase64": base64.b64encode(elevation_data).decode("ascii"),
        "sourceQuery": source_url,
    }
    OUTPUT.parent.mkdir(exist_ok=True, parents=True)
    OUTPUT.write_text(json.dumps(payload, separators=(",", ":"))+"\n", encoding="utf8")
    print(f"Baked {OUTPUT} ({OUTPUT.stat().st_size} bytes), max={payload['maxElevationMeters']}m, land={payload['landCoverageFraction']:.1%}", flush=True)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate baked file only, without web access")
    args = parser.parse_args()
    if args.check:
        data = json.loads(OUTPUT.read_text(encoding="utf8"))
        raw = base64.b64decode(data["heightsBase64"], validate=True)
        assert len(raw) == SIZE * SIZE * 2 and data["format"] == "usgs-3dep-u16le-v1"
        arr = np.frombuffer(raw, dtype="<u2")
        assert arr.max() > 300 and np.mean(arr>3) > .2
        print(f"USGS Alaska DEM verified ({int(arr.max())}m maximum)")
        return
    source, url = fetch_tiff()
    bake(source,url)

if __name__ == "__main__":
    main()
