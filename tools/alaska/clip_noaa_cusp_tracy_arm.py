#!/usr/bin/env python3
"""Clip official NOAA CUSP N55W135 source lines to PATROL Tracy Arm AOI.

Independent read-only QA: no changes to game runtime, collision, water,
aircraft, or DEM. Retain all per-feature NOAA source attribution. Never
interpret unclosed CUSP shorelines as land/water polygon boundaries.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import pathlib
import tempfile
import zipfile

BBOX = (-133.265, 57.851, -133.135, 57.923)
SOURCE_TILE = "N55W135"
SOURCE_URL = "https://nsde.ngs.noaa.gov/downloads/N55W135.zip"
META_URL = "https://www.fisheries.noaa.gov/inport/item/60812"

def execute(archive: pathlib.Path, out: pathlib.Path):
    import fiona
    from pyproj import Geod, Transformer
    from shapely.geometry import box, mapping, shape
    from shapely.ops import transform

    data = archive.read_bytes()
    if len(data) > 32 * 1024 * 1024:
        raise ValueError("Unexpectedly large source: max 32 MiB")
    source_hash = hashlib.sha256(data).hexdigest()
    out.mkdir(parents=True, exist_ok=True)
    clipped = []
    filtered_non_noaa = 0
    with zipfile.ZipFile(io.BytesIO(data)) as zipped:
        if zipped.testzip() is not None:
            raise ValueError("Source archive fails ZIP CRC")
        expected = {SOURCE_TILE + ext for ext in (".shp", ".shx", ".dbf", ".prj")}
        if not expected.issubset(set(zipped.namelist())):
            raise ValueError("NOAA CUSP source missing required Shapefile components")
        if sum(zipped.getinfo(n).file_size for n in expected) > 100 * 1024 * 1024:
            raise ValueError("Unexpectedly large shapefile")
        with tempfile.TemporaryDirectory(prefix="patrol-cusp-") as tmp:
            for name in expected:
                pathlib.Path(tmp, name).write_bytes(zipped.read(name))
            with fiona.open(str(pathlib.Path(tmp, SOURCE_TILE + ".shp"))) as features:
                if not features.crs:
                    raise ValueError("NOAA CUSP source has no CRS")
                src_crs = features.crs
                crs_to_wgs84 = Transformer.from_crs(src_crs, 4326, always_xy=True)
                crs_from_wgs84 = Transformer.from_crs(4326, src_crs, always_xy=True)
                corners = [crs_from_wgs84.transform(lon,lat)
                           for lon in (BBOX[0],BBOX[2])
                           for lat in (BBOX[1],BBOX[3])]
                sx = [p[0] for p in corners]
                sy = [p[1] for p in corners]
                clip_region = box(*BBOX)
                candidates = 0
                for feature in features.filter(bbox=(min(sx),min(sy),max(sx),max(sy))):
                    candidates += 1
                    if feature["geometry"] is None:
                        continue
                    properties = dict(feature["properties"])
                    if properties.get("DAT_SET_CR") != "NOAA":
                        # CUSP can incorporate contributed non-NOAA data.
                        filtered_non_noaa += 1
                        continue
                    geometry = transform(crs_to_wgs84.transform, shape(feature["geometry"]))
                    geom = geometry.intersection(clip_region)
                    if geom.is_empty:
                        continue
                    if geom.geom_type not in ("LineString", "MultiLineString"):
                        raise ValueError("Unexpected geometry type: " + geom.geom_type)
                    if len(clipped) >= 1_000:
                        raise ValueError("Too many shoreline segments in small AOI")
                    clipped.append({
                        "type": "Feature",
                        "geometry": mapping(geom),
                        "properties": {
                            **properties,
                            "_source_tile": SOURCE_TILE,
                            "_source_feature_id": str(feature["id"])
                        },
                    })
                source_count = len(features)
                source_crs = str(src_crs)
    if not clipped:
        raise RuntimeError("No NOAA-credited shoreline features in Tracy Arm")
    feature_collection = {
        "type": "FeatureCollection",
        "name": "PATROL_TRACY_ARM_NOAA_CUSP_QA_ONLY_NOT_GAME",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": clipped
    }
    geojson = (json.dumps(feature_collection,separators=(",",":"),ensure_ascii=False)+"\n").encode("utf-8")
    if len(geojson) > 5_000_000:
        raise ValueError("Unexpectedly large Tracy Arm clip")
    dest = out / "tracy-arm-cusp-qa-only.geojson"
    dest.write_bytes(geojson)

    from collections import Counter
    from shapely.geometry import shape
    geod = Geod(ellps="WGS84")
    lengths = [geod.geometry_length(shape(row["geometry"])) for row in clipped]
    vertices = 0
    for row in clipped:
        geom = row["geometry"]
        if geom["type"] == "LineString":
            vertices += len(geom["coordinates"])
        else:
            vertices += sum(len(v) for v in geom["coordinates"])
    report = {
        "status": "QA_ONLY_NOT_RUNTIME_ASSET",
        "source": SOURCE_URL,
        "metadata": META_URL,
        "download_sha256": source_hash,
        "source_crs": source_crs,
        "output_crs": "EPSG:4326",
        "bbox_wgs84": list(BBOX),
        "source_features_total": source_count,
        "source_features_candidate_bbox": candidates,
        "excluded_non_noaa_candidates": filtered_non_noaa,
        "clip_features": len(clipped),
        "clip_vertices": vertices,
        "clip_geodesic_length_m": round(sum(lengths),2),
        "data_set_credits": dict(Counter(row["properties"].get("DAT_SET_CR") for row in clipped)),
        "source_dates": dict(Counter(row["properties"].get("SRC_DATE") for row in clipped)),
        "shoreline_type": dict(Counter(row["properties"].get("ATTRIBUTE") for row in clipped)),
        "output_geojson_bytes": len(geojson),
        "output_geojson_sha256": hashlib.sha256(geojson).hexdigest(),
        "limitations": [
            "NOAA CUSP may have non-NOAA source contributions; this script includes NOAA-credited source segments only.",
            "Mean high water shoreline is not an automatically closed land/water polygon.",
            "Source dates may be historical; do not claim 2026 live shoreline.",
            "Not integrated into PATROL collision, water rendering, or tree placement.",
        ],
    }
    (out / "tracy-arm-cusp-clip-report.json").write_text(json.dumps(report,indent=2)+"\n")
    print(json.dumps(report,indent=2))
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=pathlib.Path,default=pathlib.Path("alaska-official-aoi-results/noaa-cusp-index/N55W135.zip"))
    parser.add_argument("--out", type=pathlib.Path,default=pathlib.Path("alaska-official-aoi-results/noaa-cusp-tracy-arm-qa"))
    args=parser.parse_args()
    execute(args.zip,args.out)
