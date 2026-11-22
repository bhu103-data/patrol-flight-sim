#!/usr/bin/env python3
"""Independently re-request public USGS 3DEP source and audit PATROL baked DEM.

This script is QA only and does not overwrite assets, geometry, water collision,
aircraft, or map materials. The source request exactly matches the metadata
stored in the existing game asset, with an official HTTPS host allowlist.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import pathlib
import urllib.parse
import urllib.request

import numpy as np
import tifffile

BBOX=(-133.265,57.851,-133.135,57.923)
GRID=256

def audit(dem_path: pathlib.Path, noaa_geojson: pathlib.Path, out: pathlib.Path):
    from rasterio.features import rasterize
    from rasterio.transform import from_bounds

    packaged=json.loads(dem_path.read_text())
    if packaged.get("format")!="usgs-3dep-u16le-v1" or packaged.get("bbox")!=list(BBOX):
        raise ValueError("Unexpected baked USGS DEM metadata")
    url=packaged.get("sourceQuery")
    parts=urllib.parse.urlsplit(url)
    if parts.scheme!="https" or parts.hostname!="elevation.nationalmap.gov" or parts.path!="/arcgis/rest/services/3DEPElevation/ImageServer/exportImage":
        raise ValueError("Unexpected DEM source-query endpoint")
    params=urllib.parse.parse_qs(parts.query)
    if params.get("size")!=["256,256"] or params.get("bboxSR")!=["4326"] or params.get("pixelType")!=["F32"]:
        raise ValueError("Unexpected DEM source-query parameters")
    packed=base64.b64decode(packaged["heightsBase64"],validate=True)
    if len(packed)!=GRID*GRID*2: raise ValueError("Unexpected baked DEM size")
    baked=np.frombuffer(packed,dtype="<u2").reshape((GRID,GRID))
    req=urllib.request.Request(url,headers={"User-Agent":"PATROL-Alaska-3DEP-source-QA/1.0"})
    with urllib.request.urlopen(req,timeout=70) as response:
        if urllib.parse.urlsplit(response.geturl()).hostname!="elevation.nationalmap.gov":
            raise ValueError("Unexpected USGS redirect")
        original=response.read(8_000_001)
        if len(original)>8_000_000:
            raise ValueError("USGS TIFF response too large")
    if original[:4] not in (b"II*\x00",b"MM\x00*"):
        raise ValueError("Source response not TIFF")
    source=tifffile.imread(io.BytesIO(original))
    if source.shape!=(GRID,GRID) or source.dtype.kind!="f":
        raise ValueError(f"Unexpected live source shape/type: {source.shape}, {source.dtype}")
    south_first=source[::-1].astype(np.float64)
    valid=np.isfinite(south_first)&(south_first>-100)&(south_first<9000)
    quantized=np.rint(np.where(valid,np.maximum(0,south_first),0)).clip(0,8000).astype("<u2")
    difference=np.abs(quantized.astype(np.int32)-baked.astype(np.int32))
    points=json.loads(noaa_geojson.read_text())["features"]
    from shapely.geometry import shape
    north_first_lines=rasterize(
        ((shape(f["geometry"]),1) for f in points),
        out_shape=(GRID,GRID),transform=from_bounds(*BBOX,GRID,GRID),
        all_touched=True,dtype=np.uint8
    ).astype(bool)
    line_mask=np.flipud(north_first_lines)
    if line_mask.sum()<50:raise ValueError("NOAA QA shoreline coverage unexpectedly small")
    out.mkdir(parents=True,exist_ok=True)
    result={
        "status":"QA_ONLY_NEVER_REPLACE_RUNTIME_MAP",
        "official_usgs_service":parts.scheme+"://"+parts.hostname+parts.path,
        "bbox":list(BBOX),
        "raw_tiff_bytes":len(original),
        "raw_tiff_sha256":hashlib.sha256(original).hexdigest(),
        "baked_dem_sha256":hashlib.sha256(dem_path.read_bytes()).hexdigest(),
        "live_height_valid_cells":int(valid.sum()),
        "source_height_max_m":float(np.nanmax(source)),
        "quantized_max_m":int(quantized.max()),
        "baked_max_m":int(baked.max()),
        "baked_versus_live_different_pixels":int(np.count_nonzero(difference)),
        "baked_versus_live_max_absolute_delta_m":int(difference.max()),
        "baked_versus_live_mean_absolute_delta_m":round(float(difference.mean()),3),
        "baked_water_le3m_cells":int((baked<=3).sum()),
        "live_source_water_le3m_cells":int((quantized<=3).sum()),
        "noaa_cusp_rasterized_line_cells":int(line_mask.sum()),
        "noaa_line_on_baked_terrain_above3m_cells":int(((baked>3)&line_mask).sum()),
        "noaa_line_on_live_terrain_above3m_cells":int(((quantized>3)&line_mask).sum()),
        "caveats":[
            "NOAA CUSP is mean high water and has 1991/2015/2017 source lines; this is NOT a 2026 real-time shore.",
            "DEM low altitude <=3m is only a diagnostic proxy for water, not proof of actual game physics.",
            "Source service can update over time; pixel comparison is to the current live USGS 3DEP response.",
            "No world, shoreline or collision changes are authorized by these QA metrics."
        ]
    }
    (out/"usgs-3dep-live-vs-baked.json").write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))
    return result

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--dem",type=pathlib.Path,default=pathlib.Path("assets/alaska/tracy-arm-3dep.json"))
    p.add_argument("--noaa",type=pathlib.Path,default=pathlib.Path("alaska-official-aoi-results/noaa-cusp-tracy-arm-qa/tracy-arm-cusp-qa-only.geojson"))
    p.add_argument("--out",type=pathlib.Path,default=pathlib.Path("alaska-official-aoi-results/3dep-live-qa"))
    a=p.parse_args()
    audit(a.dem,a.noaa,a.out)
