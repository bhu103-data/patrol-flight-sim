#!/usr/bin/env python3
"""Bounded official NOAA CUSP Alaska archive audit; outputs only Tracy Arm QA vectors.

CUSP is NOT the project-specific AK1803-CM-T NGS shoreline. No runtime
integration or claims of authoritative 2026 shoreline are made.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import tempfile
import urllib.parse
import urllib.request
import zipfile

URL = "https://geodesy.noaa.gov/dist_shoreline/Alaska.zip"
BBOX = (-133.265, 57.851, -133.135, 57.923)
MAX_ZIP_BYTES = 160 * 1024 * 1024
MAX_UNPACKED = 1_500 * 1024 * 1024
MAX_GEOJSON_BYTES = 5_000_000
OUT = Path("alaska-official-aoi-results/noaa-cusp-qa")
OUT.mkdir(parents=True, exist_ok=True)
report = {
    "source": URL, "source_kind": "NOAA CUSP multi-source Alaska composite",
    "not_same_as": "NOAA NGS AK1803-CM-T individual shoreline survey",
    "license_note": "Official NOAA public distribution; check third-party attribution/source attributes before redistributing derivative",
    "tracy_arm_bbox_wgs84": list(BBOX),
    "status": "NOT_YET_PROCESSED",
    "layer_reports": [],
}

def save():
    (OUT / "noaa-cusp-tracy-arm-report.json").write_text(
        json.dumps(report, indent=2, default=str) + "\n", encoding="utf-8")

def stream_zip(path: Path):
    req = urllib.request.Request(URL, headers={
        "User-Agent": "PATROL-Alaska-public-NOAA-audit/1.0"})
    digest = hashlib.sha256()
    total = 0
    with urllib.request.urlopen(req, timeout=180) as response:
        final_url = response.geturl()
        dest = urllib.parse.urlparse(final_url)
        if dest.scheme != "https" or dest.hostname not in {
            "geodesy.noaa.gov", "www.ngs.noaa.gov"}:
            raise ValueError(f"Unexpected source redirect to {dest.hostname}")
        size = response.headers.get("Content-Length")
        if size and int(size) > MAX_ZIP_BYTES:
            raise ValueError("NOAA ZIP exceeds 160 MiB download safety cap")
        with path.open("wb") as dst:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_ZIP_BYTES:
                    raise ValueError("NOAA ZIP streamed bytes exceed safety cap")
                digest.update(chunk)
                dst.write(chunk)
    report["download"] = {"bytes": total, "sha256": digest.hexdigest()}
    print("NOAA CUSP Alaska ZIP:", total, "bytes", digest.hexdigest()[:12])

def safe_extract(zf: zipfile.ZipFile, root: Path):
    members = zf.infolist()
    report["zip_entries"] = len(members)
    report["zip_filenames_sample"] = [m.filename for m in members[:40]]
    selected = [m for m in members if
                m.filename.lower().endswith((".shp", ".shx", ".dbf", ".prj",
                                            ".cpg", ".gpkg"))]
    if not any(m.filename.lower().endswith((".shp", ".gpkg")) for m in selected):
        report["archive_format_not_supported"] = (
            "No direct Shapefile or GeoPackage found; "
            "GeoDatabase folders must be inspected separately.")
        return []
    selected_names = {m.filename for m in selected}
    report["selected_entries"] = len(selected)
    written = 0
    files = []
    for item in selected:
        parts = PurePosixPath(item.filename).parts
        if item.is_dir() or not parts or any(p in (".", "..") for p in parts) or \
                item.filename.startswith("/") or any(":" in p for p in parts):
            raise ValueError("Unsafe ZIP path")
        written += item.file_size
        if written > MAX_UNPACKED:
            raise ValueError("Extracted GIS data exceed 1.5 GiB safety limit")
        target = root.joinpath(*parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with zf.open(item, "r") as src, target.open("wb") as dst:
            shutil.copyfileobj(src, dst)
        files.append(target)
    return [p for p in files if p.suffix.lower() in (".shp", ".gpkg")]

def clip_layers(inputs: list[Path]):
    import fiona
    import pyproj
    from shapely.geometry import box, mapping, shape
    from shapely.ops import transform
    target_box = box(*BBOX)
    output = {"type": "FeatureCollection",
              "name": "NOAA_CUSP_Alaska_Tracy_Arm_QA_Not_Game",
              "features": []}
    for path in inputs[:30]:
        status = {"path": path.name}
        report["layer_reports"].append(status)
        try:
            with fiona.open(path) as source:
                status["driver"] = source.driver
                status["crs"] = str(source.crs)
                if not source.crs:
                    raise ValueError("No layer CRS; cannot safely clip")
                crs = pyproj.CRS.from_user_input(source.crs)
                to_wgs = pyproj.Transformer.from_crs(crs, 4326, always_xy=True)
                from_wgs = pyproj.Transformer.from_crs(4326, crs, always_xy=True)
                corners = [
                    from_wgs.transform(lon, lat)
                    for lon in (BBOX[0], BBOX[2])
                    for lat in (BBOX[1], BBOX[3])
                ]
                xs, ys = zip(*corners)
                source_bbox = (min(xs), min(ys), max(xs), max(ys))
                matched = 0
                for feature in source.filter(bbox=source_bbox):
                    if feature.get("geometry") is None:
                        continue
                    geom = transform(to_wgs.transform, shape(feature["geometry"]))
                    if geom.is_empty or not geom.intersects(target_box):
                        continue
                    geom = geom.intersection(target_box)
                    if geom.is_empty:
                        continue
                    props = dict(feature.get("properties", {}))
                    keep = {k: props[k] for k in (
                        "FEATURE", "FEATURE_ID", "CLASS", "SOURCE_ID", "SRC_DATE",
                        "DATA_SOURC", "ATTRIBUTE", "SURVEY", "Source") if k in props}
                    output["features"].append({"type": "Feature",
                                                "geometry": mapping(geom),
                                                "properties": keep})
                    matched += 1
                    if len(output["features"]) > 30000:
                        raise ValueError("Too many clipped features")
                status["matches"] = matched
                status["source_feature_count"] = len(source)
        except Exception as exc:
            status["error"] = f"{type(exc).__name__}: {str(exc)[:400]}"
    geojson = json.dumps(output, ensure_ascii=False, separators=(",", ":")).encode()
    report["tracy_arm_clipped_features"] = len(output["features"])
    report["tracy_arm_geojson_bytes"] = len(geojson)
    if len(geojson) > MAX_GEOJSON_BYTES:
        raise ValueError("Clipped GeoJSON exceeds 5MB cap")
    (OUT / "noaa-cusp-tracy-arm-qa.geojson").write_bytes(geojson)
    print("Tracy Arm NOAA CUSP clipped features:", len(output["features"]))

with tempfile.TemporaryDirectory(prefix="patrol-noaa-cusp-") as tmp:
    try:
        archive = Path(tmp) / "Alaska.zip"
        stream_zip(archive)
        with zipfile.ZipFile(archive) as zf:
            if zf.testzip() is not None:
                raise ValueError("NOAA CUSP ZIP contains a corrupt entry")
            inputs = safe_extract(zf, Path(tmp) / "gis")
            report["gis_source_files"] = [p.name for p in inputs[:40]]
        if inputs:
            clip_layers(inputs)
        report["status"] = (
            "NOAA_CUSP_CLIPPED_QA_ONLY" if report.get("tracy_arm_clipped_features", 0)
            else "NO_TRACY_ARM_CLIPPED_FEATURES")
    except Exception as exc:
        report["status"] = "NOT_READY"
        report["error"] = f"{type(exc).__name__}: {str(exc)[:800]}"
        print("NOAA CUSP QA could not complete:", report["error"])
    finally:
        save()
print("NOAA CUSP report:", OUT / "noaa-cusp-tracy-arm-report.json")
