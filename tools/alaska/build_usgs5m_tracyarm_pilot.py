#!/usr/bin/env python3
"""Download and validate a strict ~5 m Tracy Arm *pilot sample* from USGS 3DEP.

This is a controlled source research artifact, not yet a production map asset.
A 256x256 south-first raster spans source-cell centres c150..190, r85..125,
so it can eventually stitch to existing 30 m terrain on four exact edges.
Actual returned raster resolution and source provenance are recorded; a
nominal 5m export request is NEVER called proof of the underlying pixel source.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import math
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import numpy as np
import tifffile

ROOT = pathlib.Path(__file__).resolve().parents[2]
OLD = ROOT / "assets/alaska/tracy-arm-3dep.json"
ARTIFACTS = ROOT / "artifacts"
OUTPUT = ARTIFACTS / "alaska-tracyarm-five-metre-tile.json"
REPORT = ARTIFACTS / "alaska-tracyarm-five-metre-report.json"
SIZE = 256
COL0, COL1, ROW0, ROW1 = 150, 190, 85, 125
SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage"
INDEX = "https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/20/query"


def fetch(url: str, max_bytes: int = 9_000_000) -> bytes:
    for attempt in range(3):
        try:
            request = urllib.request.Request(
                url, headers={
                    "User-Agent": "PATROL-alaska-research-5m-public-data/1.0",
                    "Accept": "image/tiff,application/json,application/octet-stream",
                })
            with urllib.request.urlopen(request, timeout=70) as response:
                raw = response.read(max_bytes + 1)
                if len(raw) > max_bytes:
                    raise ValueError("USGS response exceeded size limit")
                return raw
        except (TimeoutError, urllib.error.URLError) as error:
            if attempt == 2:
                raise RuntimeError("Official USGS endpoint failed after retries") from error
            print(f"USGS retry {attempt + 1}/3: {error}", flush=True)
            time.sleep(2 ** attempt)


def main() -> None:
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    source = json.loads(OLD.read_text())
    assert source["crs"] == "EPSG:4326" and source["width"] == source["height"] == 256
    assert source["bbox"] == [-133.265, 57.851, -133.135, 57.923]
    packed = base64.b64decode(source["heightsBase64"], validate=True)
    original = np.frombuffer(packed, dtype="<u2").reshape((256, 256))
    west, south, east, north = source["bbox"]
    old_lons = [west + (i + 0.5) * (east - west) / 256 for i in (COL0, COL1)]
    old_lats = [south + (i + 0.5) * (north - south) / 256 for i in (ROW0, ROW1)]
    d_lon = (old_lons[1] - old_lons[0]) / (SIZE - 1)
    d_lat = (old_lats[1] - old_lats[0]) / (SIZE - 1)
    bbox = [old_lons[0] - d_lon / 2, old_lats[0] - d_lat / 2,
            old_lons[1] + d_lon / 2, old_lats[1] + d_lat / 2]
    mean_lat = (bbox[1] + bbox[3]) / 2
    spacing = [(bbox[2] - bbox[0]) * 111320 * math.cos(math.radians(mean_lat)) / SIZE,
               (bbox[3] - bbox[1]) * 111320 / SIZE]
    if not (4.4 < spacing[0] < 5.3 and 4.4 < spacing[1] < 5.3):
        raise RuntimeError("Requested source subregion is not a ~5 m grid")
    indexparams = {
        "f": "json", "where": "1=1",
        "geometry": ",".join(str(x) for x in bbox),
        "geometryType": "esriGeometryEnvelope", "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "returnGeometry": "false",
        "outFields": "workunit,project,dem_gsd_meters,vert_crs,geoid,collect_start,collect_end,sourcedem_link",
    }
    index_url = INDEX + "?" + urllib.parse.urlencode(indexparams)
    index = json.loads(fetch(index_url, max_bytes=200_000))
    if "error" in index:
        raise RuntimeError("Official 5 m project metadata refused: " + str(index["error"]))
    projects = [x["attributes"] for x in index.get("features", [])]
    projects = [p for p in projects if p.get("dem_gsd_meters") == 5]
    if not projects:
        raise RuntimeError("No 5 m project metadata matches the pilot area")
    project = next((p for p in projects
                    if p.get("workunit") == "AK_IFSAR_Sum_L4_C353_2010"), projects[0])
    if str(project.get("vert_crs")) != "5703":
        raise RuntimeError("Expected NAVD88 project index CRS (5703), found "
                           + str(project.get("vert_crs")))
    args = {
        "bbox": ",".join(str(x) for x in bbox), "bboxSR": "4326",
        "imageSR": "4326", "size": f"{SIZE},{SIZE}",
        "format": "tiff", "pixelType": "F32",
        "interpolation": "RSP_BilinearInterpolation",
        # Mandatory: ArcGIS otherwise EXPANDS a rectangular WGS84 bbox to a
        # square in degree-space for 256x256 output, silently misregistering
        # source elevations by hundreds of metres. Verified in actual USGS
        # exportImage f=json on 2026-11-22 (see provenance file).
        "adjustAspectRatio": "false", "f": "image",
    }
    metadata_args = {**args,"f":"json"}
    metadata_url = SERVICE + "?" + urllib.parse.urlencode(metadata_args)
    response = json.loads(fetch(metadata_url,max_bytes=200_000))
    if "error" in response:
        raise RuntimeError("USGS adjusted extent metadata refused: " + str(response["error"]))
    envelope=response.get("extent") or {}
    actual=[envelope.get(k) for k in ("xmin","ymin","xmax","ymax")]
    if not all(isinstance(x,(int,float)) and math.isfinite(x) for x in actual):
        raise RuntimeError("USGS did not provide actual WGS84 export extent")
    if (envelope.get("spatialReference") or {}).get("wkid")!=4326:
        raise RuntimeError("USGS export is not WGS84 EPSG4326")
    if max(abs(a-b) for a,b in zip(actual,bbox))>1e-8:
        raise RuntimeError("USGS ignored adjustAspectRatio=false; output bbox drifted "+str(actual))
    if response.get("width")!=256 or response.get("height")!=256:
        raise RuntimeError("USGS output resolution mismatch")
    url = SERVICE + "?" + urllib.parse.urlencode(args)
    raw = fetch(url, max_bytes=4_000_000)
    if raw[:4] not in (b"II*\0", b"MM\0*"):
        raise RuntimeError("USGS response was not a TIFF")
    with tifffile.TiffFile(io.BytesIO(raw)) as tif:
        raster=tif.asarray()
        page=tif.pages[0]
        tiff_geo_tags={}
        for name in ("ModelPixelScaleTag","ModelTiepointTag",
                     "ModelTransformationTag","GeoKeyDirectoryTag",
                     "GeoAsciiParamsTag"):
            tag=page.tags.get(name)
            if tag is not None:
                val=tag.value
                tiff_geo_tags[name]=val.tolist() if hasattr(val,"tolist") else (
                    list(val) if isinstance(val,tuple) else val)
    if raster.shape != (SIZE, SIZE) or raster.dtype.kind != "f":
        raise RuntimeError(f"Wrong USGS export shape/dtype {raster.shape} {raster.dtype}")
    # TIFF top row is north; our existing geodesy expects row zero SOUTH.
    fine = raster[::-1].astype(np.float64)
    valid = np.isfinite(fine) & (fine > -250) & (fine < 3000)
    valid_fraction = float(valid.mean())
    if valid_fraction < 0.97:
        raise RuntimeError(f"USGS 5m extraction has {100*(1-valid_fraction):.2f}% missing/out-of-range pixels")
    # Compare against bilinear interpolation from the existing coarse 30m tile.
    coarse = np.empty_like(fine)
    for row in range(SIZE):
        rf = ROW0 + row * (ROW1 - ROW0) / (SIZE - 1)
        r0 = int(rf)
        r1 = min(255, r0 + 1)
        rt = rf - r0
        for col in range(SIZE):
            cf = COL0 + col * (COL1 - COL0) / (SIZE - 1)
            c0 = int(cf)
            c1 = min(255, c0 + 1)
            ct = cf - c0
            coarse[row, col] = (
                (original[r0, c0] * (1-ct) + original[r0, c1] * ct) * (1-rt)
                + (original[r1, c0] * (1-ct) + original[r1, c1] * ct) * rt
            )
    rmse = float(np.sqrt(np.mean((fine[valid] - coarse[valid]) ** 2)))
    p95diff = float(np.percentile(np.abs(fine[valid] - coarse[valid]), 95))
    if rmse < 0.25:
        raise RuntimeError("Returned 5 m grid looks like coarse-source interpolation; refusing resolution upgrade")
    # 0.1 m storage, signed so seawater/below-zero elevations are not fabricated as zero.
    scaled = np.where(valid, np.rint(np.clip(fine, -300, 3000) * 10), -32768)
    q = scaled.astype("<i2")
    assert q.shape == (SIZE, SIZE)
    data = q.tobytes(order="C")
    payload = {
        "format": "usgs-3dep-i16dm-southfirst-v1",
        "source": "USGS 3DEP Bare Earth ImageServer (public domain)",
        "sourceUrl": SERVICE, "sourceQuery": url,
        "sourceRawTiffSha256": hashlib.sha256(raw).hexdigest(),
        "adjustAspectRatio": False, "actualBboxVerifiedFromServer": actual,
        "serverExtentRequest": metadata_url,
        "tiffGeoTags": tiff_geo_tags,
        "bbox": bbox, "crs": "EPSG:4326",
        "axis": "x=east, z=north, south-first raster rows",
        "width": SIZE, "height": SIZE,
        "metresPerInteger": 0.1, "noDataInt16": -32768,
        "sampleSpacingApproxMeters": [round(x, 3) for x in spacing],
        "parentCoarseCellCentres": [COL0, COL1, ROW0, ROW1],
        "parentAnchorWarning": "These indices refer to the old stored REQUEST bbox, NOT actual old-raster source pixel centres. 30m source has an ArcGIS-expanded latitude extent.",
        "originalBbox": source["bbox"],
        "projectIndexEvidence": {
            "workunit": project.get("workunit"),
            "project": project.get("project"),
            "dem_gsd_meters": project.get("dem_gsd_meters"),
            "vert_crs": project.get("vert_crs"),
            "geoid": project.get("geoid"),
            "collect_start": project.get("collect_start"),
            "collect_end": project.get("collect_end"),
        },
        "datumWarning": "Index vertical CRS NAVD88 does not prove this dynamic export applies an EPSG:5703 conversion; verify original delivered raster metadata.",
        "derivedResolutionWarning": "5 m spacing requested from ImageServer and QL5 index coverage; full source-resolution lineage is not yet independently confirmed.",
        "heightsBase64": base64.b64encode(data).decode("ascii"),
    }
    OUTPUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    report = {
        "pass": True,
        "rawTiffBytes": len(raw),
        "rawTiffSha256": payload["sourceRawTiffSha256"],
        "sourceQuery": url, "projectQuery": index_url,
        "actualBboxVerifiedFromServer": actual,
        "serverExtentRequest": metadata_url, "tiffGeoTags": tiff_geo_tags,
        "bbox": bbox, "grid": [SIZE, SIZE],
        "spacingMeters": payload["sampleSpacingApproxMeters"],
        "validFraction": round(valid_fraction, 6),
        "finiteMinMeters": float(fine[valid].min()),
        "finiteMaxMeters": float(fine[valid].max()),
        "fineVsBilinearCoarseRmseMeters": round(rmse, 4),
        "fineVsBilinearCoarseP95AbsDiffMeters": round(p95diff, 4),
        "projectIndex": payload["projectIndexEvidence"],
        "outputBytes": OUTPUT.stat().st_size,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "warnings": [payload["datumWarning"], payload["derivedResolutionWarning"],
                     "2010-2012 source may not reflect August 2025 Tracy Arm landslide changes.",
                     "Must not be merged into runtime without border seam handling and collision parity."],
    }
    REPORT.write_text(json.dumps(report, indent=2) + "\n")
    print("PASS official USGS Tracy Arm ~5 m source sample: " + json.dumps(
        {k: report[k] for k in ("grid", "spacingMeters", "validFraction",
         "finiteMaxMeters", "fineVsBilinearCoarseRmseMeters", "projectIndex",
         "outputBytes")}), flush=True)


if __name__ == "__main__":
    main()
