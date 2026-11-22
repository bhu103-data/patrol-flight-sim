#!/usr/bin/env python3
"""Bounded full-archive NPS Sawyer GeoTIFF metadata audit. Never uploads rasters.

Run only as a one-off source QA job. Survey footprints and vertical datum
must be verified before any PATROL terrain import.
"""
import argparse
import hashlib
import json
import pathlib
import re
import sys
import tempfile
import time
import zipfile
from urllib.request import Request, urlopen

from probe_nps_sawyer_surveys import SOURCES, USER_AGENT, download_url

AOI_GAME = (-133.265, 57.851, -133.135, 57.923)
AOI_NOAA = (-133.2893, 57.7280, -132.9704, 58.0102)
MAX_SOURCE_BYTES = 350 * 1024 * 1024
MAX_TOTAL_UNZIPPED = 10 * 1024 * 1024 * 1024
MAX_ENTRIES = 500


def overlap(a, b):
    return (a[0] < b[2] and a[2] > b[0]
            and a[1] < b[3] and a[3] > b[1])


def has_study_bbox_candidate(tiffs):
    return any(item.get("intersects_noaa_study_bbox") is True
               for item in tiffs)


def sample_valid_study_pixels(raster, bbox, max_axis=512):
    """Limited nearest-neighbour samples of true non-NoData pixel locations.

    Positive hits prove *some* valid source values in the NOAA WGS84 study
    rectangle, not continuous glacier coverage or surface elevations at the
    terminus. Zero hits are inconclusive for sparse flight strips.
    """
    import math
    import numpy as np
    from rasterio.enums import Resampling
    from rasterio.warp import transform as reproject, transform_bounds
    from rasterio.windows import Window, from_bounds
    if raster.crs is None:
        return {"status": "UNKNOWN_SOURCE_CRS", "valid_inside_bbox": 0}
    bounds=transform_bounds("EPSG:4326", raster.crs, *bbox, densify_pts=21)
    win=from_bounds(*bounds, transform=raster.transform)
    x0=max(0, math.floor(win.col_off))
    y0=max(0, math.floor(win.row_off))
    x1=min(raster.width, math.ceil(win.col_off+win.width))
    y1=min(raster.height, math.ceil(win.row_off+win.height))
    if x1<=x0 or y1<=y0:
        return {"status": "NO_SOURCE_WINDOW_OVERLAP",
                "valid_inside_bbox": 0, "sampled_pixels": 0}
    window=Window(x0, y0, x1-x0, y1-y0)
    height=min(max_axis,y1-y0)
    width=min(max_axis,x1-x0)
    samples=raster.read(1,window=window,out_shape=(height,width),
                        masked=True,resampling=Resampling.nearest)
    mask=(~np.ma.getmaskarray(samples)) & np.isfinite(np.asarray(samples))
    rows,cols=np.nonzero(mask)
    if rows.size==0:
        return {"status": "NO_VALID_PIXELS_IN_SAMPLED_GRID",
                "valid_inside_bbox": 0,
                "sampled_pixels": int(height*width),
                "sample_grid": [int(width),int(height)]}
    # Map each sampled pixel centre back to source CRS and then WGS84:
    # a projected AOI bounding rectangle alone would include points outside
    # the WGS84 study rectangle at corners.
    affine=raster.window_transform(window) * raster.transform.scale(
        window.width/width,window.height/height)
    xs=(affine.a*(cols+.5)+affine.b*(rows+.5)+affine.c).tolist()
    ys=(affine.d*(cols+.5)+affine.e*(rows+.5)+affine.f).tolist()
    lon,lat=reproject(raster.crs,"EPSG:4326",xs,ys)
    lon=np.asarray(lon)
    lat=np.asarray(lat)
    within=((lon>=bbox[0])&(lon<=bbox[2])&
            (lat>=bbox[1])&(lat<=bbox[3]))
    count=int(np.count_nonzero(within))
    return {
        "status": "POSITIVE_VALID_PIXEL_SAMPLES_IN_NOAA_BBOX"
                  if count else "NO_VALID_PIXEL_SAMPLE_INSIDE_STUDY_BBOX",
        "valid_inside_bbox": count,
        "valid_projected_window": int(rows.size),
        "sampled_pixels": int(height*width),
        "sample_grid": [int(width),int(height)],
        "window_source_pixels": [int(window.width),int(window.height)],
        "method": "nearest subsampled source values; valid mask; actual WGS84 pixel-centre filter",
        "not_inferred": "area coverage, continuous glacier mask, current-year terminus",
    }


def inspect_archive(name, file_id, directory, timeout, sample_valid_pixels=False):
    import rasterio
    from rasterio.warp import transform_bounds

    record = {
        "name": name, "resource_id": file_id, "url": download_url(file_id),
        "status": "BLOCKED", "downloaded_bytes": 0, "zip_sha256": None,
        "zip_entries": [], "tiffs": [], "error": None,
        "geographic_target_match": None, "valid_pixel_overlap_tested": False,
        "license": "NPS government-data public-domain catalog (verify per file)",
    }
    archive_path = pathlib.Path(directory) / (name + "_2p5m.zip")
    try:
        started = time.monotonic()
        request = Request(record["url"], headers={
            "User-Agent": USER_AGENT, "Accept-Encoding": "identity",
            "Accept": "application/zip,application/octet-stream",
        })
        digest = hashlib.sha256()
        with urlopen(request, timeout=timeout) as response:
            if response.status not in (200, 206):
                raise RuntimeError("Unexpected HTTP " + str(response.status))
            reported = response.headers.get("Content-Length")
            if reported and int(reported) > MAX_SOURCE_BYTES:
                raise RuntimeError("Archive exceeds 350 MiB download budget")
            with archive_path.open("wb") as target:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    record["downloaded_bytes"] += len(chunk)
                    if record["downloaded_bytes"] > MAX_SOURCE_BYTES:
                        raise RuntimeError("Stream exceeded 350 MiB cap")
                    digest.update(chunk)
                    target.write(chunk)
        if not record["downloaded_bytes"]:
            raise RuntimeError("Empty archive")
        if reported and record["downloaded_bytes"] != int(reported):
            raise RuntimeError("Truncated transfer or unexpected length")
        record["zip_sha256"] = digest.hexdigest()
        record["download_seconds"] = round(time.monotonic() - started, 1)

        with zipfile.ZipFile(archive_path) as archive:
            members = [entry for entry in archive.infolist() if not entry.is_dir()]
            if not members or len(members) > MAX_ENTRIES:
                raise RuntimeError("Unexpected ZIP entry count")
            total_unzipped = sum(item.file_size for item in members)
            if total_unzipped > MAX_TOTAL_UNZIPPED:
                raise RuntimeError("Archive uncompressed size exceeds cap")
            record["uncompressed_bytes_catalog"] = total_unzipped
            for member in members:
                path = pathlib.PurePosixPath(member.filename.replace("\\", "/"))
                if path.is_absolute() or ".." in path.parts:
                    raise RuntimeError("Unsafe ZIP member name: " + member.filename)
                record["zip_entries"].append({
                    "name": member.filename, "compressed_bytes": member.compress_size,
                    "uncompressed_bytes": member.file_size, "crc32": hex(member.CRC),
                })
                if path.suffix.lower() not in (".tif", ".tiff"):
                    continue
                with rasterio.open("/vsizip/" + archive_path.as_posix() + "/" + member.filename) as raster:
                    crs = raster.crs
                    bbox_wgs84 = None
                    if crs:
                        bbox_wgs84 = [round(float(v), 7) for v in
                            transform_bounds(crs, "EPSG:4326", *raster.bounds,
                                             densify_pts=21)]
                    filename = path.name
                    match = re.match(
                        r"^" + re.escape(name) + r"\.(\d{4})\.(\d{3})\.2p5m\.tiff?$",
                        filename, re.IGNORECASE)
                    record["tiffs"].append({
                        "name": member.filename,
                        "survey_year_from_filename": int(match.group(1)) if match else None,
                        "survey_day_of_year": int(match.group(2)) if match else None,
                        "width": raster.width, "height": raster.height,
                        "pixel_size_crs_units": [float(abs(raster.res[0])),
                                                 float(abs(raster.res[1]))],
                        "crs": crs.to_string() if crs else None,
                        "crs_wkt_excerpt": crs.to_wkt()[:900] if crs else None,
                        "dtype": list(raster.dtypes),
                        "nodata": raster.nodata,
                        "bounds_source_crs": [float(v) for v in raster.bounds],
                        "bounds_wgs84": bbox_wgs84,
                        "intersects_original_game_bbox": overlap(bbox_wgs84, AOI_GAME)
                        if bbox_wgs84 else None,
                        "intersects_noaa_study_bbox": overlap(bbox_wgs84, AOI_NOAA)
                        if bbox_wgs84 else None,
                        "tiff_tag_keys": sorted(raster.tags().keys())[:80],
                        "units": raster.units,
                        "study_valid_sample": (
                            sample_valid_study_pixels(raster, AOI_NOAA)
                            if sample_valid_pixels else None
                        ),
                    })
        if not record["tiffs"]:
            raise RuntimeError("ZIP did not contain a parseable GeoTIFF")
        # A mere zip filename match is NOT geographic identity. The NPS
        # published aggregate bbox even stops west of the intended fjord.
        # Individual TIFF envelopes, not archive names, decide candidacy.
        record["geographic_target_match"] = has_study_bbox_candidate(record["tiffs"])
        record["sampled_valid_study_pixels"] = sum(
            item["study_valid_sample"]["valid_inside_bbox"]
            for item in record["tiffs"]
            if item["study_valid_sample"] is not None
        )
        if sample_valid_pixels:
            record["status"] = (
                "GEO_VALID_PIXEL_SAMPLES_PRESENT" if
                record["sampled_valid_study_pixels"] > 0 else
                "BLOCKED_NO_VALID_STUDY_PIXEL_SAMPLES"
            )
        else:
            record["status"] = ("GEO_CANDIDATE_METADATA_ONLY" if
                record["geographic_target_match"] else
                "REJECT_OUTSIDE_TRACY_ARM_STUDY_BBOX")
    except Exception as exc:
        record["error"] = (type(exc).__name__ + ": " + str(exc))[:800]
    finally:
        try:
            archive_path.unlink(missing_ok=True)
        except OSError:
            pass
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",
                        default="artifacts/alaska-nps-sawyer-geotiff-metadata.json")
    parser.add_argument("--timeout", type=int, default=90)
    parser.add_argument("--sample-valid-pixels", action="store_true",
                        help="read at most 512x512 geolocated mask samples per TIFF")
    args = parser.parse_args()
    if args.timeout < 10 or args.timeout > 180:
        parser.error("timeout must be 10..180 seconds")
    report = {
        "scope": "historical public NPS glacier survey metadata, not a 2026 map",
        "original_game_bbox_wgs84": AOI_GAME,
        "noaa_study_bbox_wgs84": AOI_NOAA,
        "source_public_catalog": "https://irma.nps.gov/DataStore/Reference/Profile/2314560",
        "publisher_readme": "https://irma.nps.gov/DataStore/DownloadFile/747319?Reference=2314560",
        "publisher_readme_elevation_reference": "WGS84 ellipsoidal height, Float32; declared NoData -9999",
        "catalog_aggregate_bbox_wgs84": [-158.342865, 56.6082, -135.094727, 68.43901],
        "assumptions": [
            "bounding boxes may overstate actual valid survey pixels",
            "UTM projected CRS does not itself establish elevation vertical datum",
            "2000-era survey strips must not be presented as 2026 Sawyer terminus",
            "no raw raster archives or derived terrain were added to the repo",
            "NPS README lists SawyerCanada/SawyerEast/SawyerWest in Sawyer ZIP; naming is not evidence of Tracy Arm location",
            "catalog aggregate east bound -135.094727 conflicts with Tracy Arm target ~-133; trust actual TIFF georeferencing, not archive labels",
        ],
        "results": [], "status": "BLOCKED",
    }
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix="patrol-nps-survey-") as tmp:
            for glacier, file_id in SOURCES:
                result = inspect_archive(glacier, file_id, tmp, args.timeout,
                                         sample_valid_pixels=args.sample_valid_pixels)
                report["results"].append(result)
                output.write_text(json.dumps(report, indent=2) + "\n",
                                  encoding="utf-8")
        if args.sample_valid_pixels:
            success = "GEO_VALID_PIXEL_SAMPLES_PRESENT"
            passed = "BOTH_HAVE_GEOLOCATED_VALID_SAMPLE_PIXELS"
        else:
            success = "GEO_CANDIDATE_METADATA_ONLY"
            passed = "BOTH_GEOGRAPHIC_CANDIDATES_METADATA_ONLY"
        report["status"] = (
            passed if len(report["results"]) == 2 and all(
                item["status"] == success for item in report["results"])
            else "BLOCKED_GEOGRAPHIC_IDENTITY")
    finally:
        output.write_text(json.dumps(report, indent=2) + "\n",
                          encoding="utf-8")
        print(json.dumps({
            "status": report["status"],
            "results": [{
                "name": x["name"], "status": x["status"],
                "zip_sha256": x["zip_sha256"],
                "downloaded_bytes": x["downloaded_bytes"],
                "tiffs": len(x["tiffs"]),
                "geographic_target_match": x["geographic_target_match"],
                "sampled_valid_study_pixels": x.get("sampled_valid_study_pixels"),
                "error": x["error"]
            } for x in report["results"]],
            "output": str(output),
        }, indent=2))
    return 0 if report["status"] in (
        "BOTH_GEOGRAPHIC_CANDIDATES_METADATA_ONLY",
        "BOTH_HAVE_GEOLOCATED_VALID_SAMPLE_PIXELS") else 2


if __name__ == "__main__":
    sys.exit(main())
