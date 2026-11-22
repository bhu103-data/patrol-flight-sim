#!/usr/bin/env python3
"""Rebuild PATROL's tiny PUBLIC-DOMAIN LF2025 EVC class-11 water mask.

The source must be the exact 256x256 Tracy Arm official LF2025 EVC export.
Default behavior only CHECKS the already committed file; --write requires
explicit local invocation. No runtime downloads, network requests or game edits.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
from pathlib import Path

BBOX = (-133.265, 57.851, -133.135, 57.923)
SOURCE_SHA = "8b944c3691523848d6708ae744077d9e137df21ac1c08cc4ed60e4dd6ec736e2"
OUT = Path("assets/alaska/landfire-evc-water-preview.json")


def encode_mask(tiff_path: Path):
    import numpy as np
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.transform import from_bounds
    from rasterio.warp import reproject

    src = tiff_path.read_bytes()
    sha = hashlib.sha256(src).hexdigest()
    if sha != SOURCE_SHA:
        raise ValueError("Official LF2025 EVC AOI TIFF SHA differs; refuse silent dataset update")
    with rasterio.MemoryFile(src) as mem, mem.open() as source:
        if source.crs is None or source.crs.to_epsg() != 3338:
            raise ValueError("Expected official Alaska EVC EPSG:3338")
        if source.count != 1 or source.dtypes[0] != "int16":
            raise ValueError("Expected one signed 16-bit EVC category band")
        dest = np.zeros((256, 256), dtype=np.int16)
        reproject(
            source=rasterio.band(source, 1), destination=dest,
            src_transform=source.transform, src_crs=source.crs,
            src_nodata=source.nodata,
            dst_transform=from_bounds(*BBOX, 256, 256),
            dst_crs="EPSG:4326", dst_nodata=0,
            resampling=Resampling.nearest
        )
        aligned = np.flipud(dest).copy()
    if np.count_nonzero(aligned == 0):
        raise ValueError("EVC AOI leaves unmapped pixels, refusing incomplete mask")
    water = (aligned == 11).astype(np.uint8).ravel()
    edges = np.r_[0, np.where(water[1:] != water[:-1])[0]+1,water.size]
    lengths = np.diff(edges)
    if water[0] != 0 or len(lengths) != 807 or int(water.sum()) != 13658:
        raise ValueError("Unexpected mask class count or run structure")
    encoded = bytearray()
    for value in lengths:
        run = int(value)
        while run >= 128:
            encoded.append((run & 127) | 128)
            run >>= 7
        encoded.append(run)
    payload = {
        "format": "patrol-landfire-water-rle-v1",
        "source": "USGS LANDFIRE LF2025 Alaska Existing Vegetation Cover (EVC), code 11 (water)",
        "sourceUrl": "https://lfps.usgs.gov/arcgis/rest/services/Landfire_LF2025/LF2025_EVC_AK/ImageServer",
        "license": "U.S. government public domain (LANDFIRE); source provenance retained",
        "originalTiffSha256": sha,
        "bbox": list(BBOX),
        "crs": "EPSG:4326",
        "sourceCrs": "EPSG:3338",
        "axis": "south-first; game north corresponds geographic east",
        "width": 256, "height": 256, "waterCode": 11,
        "waterCount": int(water.sum()), "firstRunValue": 0,
        "encoding": "base64 of unsigned LEB128 run lengths, alternating zeros and ones",
        "rleBase64": base64.b64encode(encoded).decode("ascii"),
        "usage": "EXPERIMENTAL OPT-IN ONLY: shoreline preview, not authoritative coast or survey-grade bathymetry",
    }
    return payload, water


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--source", required=True, type=Path,
                   help="Local official LANDFIRE_EVC_AOI.tif; no network requests")
    p.add_argument("--write", action="store_true", help="Replace asset explicitly")
    args = p.parse_args()
    payload, water = encode_mask(args.source)
    text = json.dumps(payload, indent=2) + "\n"
    if args.write:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(text, encoding="utf-8")
    else:
        existing = json.loads(OUT.read_text(encoding="utf-8"))
        if existing != payload:
            raise SystemExit("Derived water mask does not match the committed asset")
    print(json.dumps({
        "status": "written" if args.write else "verified",
        "source_sha256": payload["originalTiffSha256"],
        "water_cells": payload["waterCount"],
        "mask_sha256": hashlib.sha256(water.tobytes()).hexdigest(),
        "encoded_run_bytes": len(base64.b64decode(payload["rleBase64"])),
        "asset_bytes": len(text.encode("utf-8")),
    }, indent=2))


if __name__ == "__main__":
    main()
