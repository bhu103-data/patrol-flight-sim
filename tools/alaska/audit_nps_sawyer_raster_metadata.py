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


def inspect_archive(name, file_id, directory, timeout):
    import rasterio
    from rasterio.warp import transform_bounds

    record = {
        "name": name, "resource_id": file_id, "url": download_url(file_id),
        "status": "BLOCKED", "downloaded_bytes": 0, "zip_sha256": None,
        "zip_entries": [], "tiffs": [], "error": None,
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
                    })
        if not record["tiffs"]:
            raise RuntimeError("ZIP did not contain a parseable GeoTIFF")
        record["status"] = "METADATA_READ"
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
    args = parser.parse_args()
    if args.timeout < 10 or args.timeout > 180:
        parser.error("timeout must be 10..180 seconds")
    report = {
        "scope": "historical public NPS glacier survey metadata, not a 2026 map",
        "original_game_bbox_wgs84": AOI_GAME,
        "noaa_study_bbox_wgs84": AOI_NOAA,
        "source_public_catalog": "https://irma.nps.gov/DataStore/Reference/Profile/2314560",
        "assumptions": [
            "bounding boxes may overstate actual valid survey pixels",
            "UTM projected CRS does not itself establish elevation vertical datum",
            "2000-era survey strips must not be presented as 2026 Sawyer terminus",
            "no raw raster archives or derived terrain were added to the repo",
        ],
        "results": [], "status": "BLOCKED",
    }
    output = pathlib.Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix="patrol-nps-survey-") as tmp:
            for glacier, file_id in SOURCES:
                result = inspect_archive(glacier, file_id, tmp, args.timeout)
                report["results"].append(result)
                output.write_text(json.dumps(report, indent=2) + "\n",
                                  encoding="utf-8")
        report["status"] = ("METADATA_VERIFIED" if len(report["results"]) == 2 and all(
            item["status"] == "METADATA_READ" for item in report["results"])
            else "BLOCKED")
    finally:
        output.write_text(json.dumps(report, indent=2) + "\n",
                          encoding="utf-8")
        print(json.dumps({
            "status": report["status"],
            "results": [{
                "name": x["name"], "status": x["status"],
                "zip_sha256": x["zip_sha256"],
                "downloaded_bytes": x["downloaded_bytes"],
                "tiffs": len(x["tiffs"]), "error": x["error"]
            } for x in report["results"]],
            "output": str(output),
        }, indent=2))
    return 0 if report["status"] == "METADATA_VERIFIED" else 2


if __name__ == "__main__":
    sys.exit(main())
