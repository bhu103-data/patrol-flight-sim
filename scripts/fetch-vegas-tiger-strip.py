#!/usr/bin/env python3
"""Build a source-backed Las Vegas Blvd pilot from U.S. Census 2026 TIGER roads.

Only the Harmon-Flamingo core. This asset is a georeferenced **centerline
trace**; no roadway width, signal timing, parcel or lane direction is inferred.
No external base-map screenshots or proprietary model assets are used.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import io
import json
import math
from pathlib import Path
import re
import urllib.request
import zipfile

import shapefile

SOURCE = "https://www2.census.gov/geo/tiger/TIGER2026/ROADS/tl_2026_32003_roads.zip"
OUTPUT = Path("artifacts/vegas-tiger")
# Centre section only. Limits are a bounded approximate search window,
# not claimed survey positions of named intersections.
LAT_MIN, LAT_MAX = 36.1073, 36.1151
LON_MIN, LON_MAX = -115.181, -115.167
SAMPLES = 25
TRIM = re.compile(r"LAS VEGAS\s+(?:BOULEVARD|BLVD)", re.I)


def download() -> bytes:
    request = urllib.request.Request(SOURCE, headers={"User-Agent": "PATROL-2026-Census-TIGER-Public-Road-Pilot/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        if response.status != 200:
            raise RuntimeError(f"Census TIGER HTTP {response.status}")
        data = response.read(20_000_001)
    if not data.startswith(b"PK") or len(data) < 1000 or len(data) > 20_000_000:
        raise RuntimeError("Invalid or oversize Census road shapefile ZIP")
    return data


def candidate_segments(raw: bytes):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        names = archive.namelist()
        basename = next((name[:-4] for name in names if name.lower().endswith(".shp")), None)
        if not basename:
            raise RuntimeError("No TIGER shapefile in official Census ZIP")
        for ext in (".shp", ".shx", ".dbf"):
            if basename + ext not in names:
                raise RuntimeError("TIGER road geometry is missing " + ext)
        reader = shapefile.Reader(shp=io.BytesIO(archive.read(basename + ".shp")),
                                  shx=io.BytesIO(archive.read(basename + ".shx")),
                                  dbf=io.BytesIO(archive.read(basename + ".dbf")))
        fields = [f[0] for f in reader.fields[1:]]
        if "FULLNAME" not in fields:
            raise RuntimeError("Census TIGER road-name attribute missing")
        index = fields.index("FULLNAME")
        segments = []
        ids = set()
        for sr in reader.iterShapeRecords():
            name = str(sr.record[index] or "").strip()
            if not TRIM.search(name):
                continue
            shape = sr.shape
            points = shape.points
            boundaries = list(shape.parts) + [len(points)]
            used = False
            for lo, hi in zip(boundaries[:-1], boundaries[1:]):
                part = points[lo:hi]
                for (x1,y1), (x2,y2) in zip(part,part[1:]):
                    if not (LAT_MIN-.004 <= max(y1,y2) and min(y1,y2) <= LAT_MAX+.004):
                        continue
                    if not (LON_MIN-.004 <= max(x1,x2) and min(x1,x2) <= LON_MAX+.004):
                        continue
                    if any(not math.isfinite(x) for x in (x1,y1,x2,y2)):
                        continue
                    segments.append(((x1,y1),(x2,y2)))
                    used = True
            if used:
                # LINEARID is a stable TIGER identifier; it is source metadata,
                # not a claim about this road's lane geometry.
                try:
                    ids.add(str(sr.record[fields.index("LINEARID")]))
                except ValueError:
                    pass
        if not segments:
            raise RuntimeError("No Las Vegas Boulevard TIGER lines in pilot extent")
        return segments, sorted(ids)


def interpolate(segments, lat: float) -> float:
    hits = []
    for (x1,y1),(x2,y2) in segments:
        if abs(y2-y1) < 1e-10:
            continue
        if min(y1,y2)-1e-8 <= lat <= max(y1,y2)+1e-8:
            t = (lat-y1)/(y2-y1)
            x=x1+(x2-x1)*t
            if LON_MIN <= x <= LON_MAX:
                hits.append(x)
    if not hits:
        raise RuntimeError(f"No road line crossing near latitude {lat:.7f}")
    # Duplicate TIGER edges may overlap; the closest to median road longitude
    # is a robust deterministic choice, not fabricated map coordinates.
    hits.sort()
    return hits[len(hits)//2]


def build(raw: bytes) -> dict:
    segments, ids = candidate_segments(raw)
    samples = []
    for i in range(SAMPLES):
        lat = LAT_MIN+(LAT_MAX-LAT_MIN)*i/(SAMPLES-1)
        lon = interpolate(segments,lat)
        samples.append([round(lon,8),round(lat,8)])
    if not all(LON_MIN < p[0] < LON_MAX for p in samples):
        raise RuntimeError("Out-of-extent Census road data")
    if not all(samples[i+1][1]>samples[i][1] for i in range(SAMPLES-1)):
        raise RuntimeError("TIGER road direction is not south-to-north")
    if max(p[0] for p in samples)-min(p[0] for p in samples) > .008:
        raise RuntimeError("TIGER Las Vegas Blvd trace has implausible curvature")
    # Normalize trend, preserving only measured local lateral deviations.
    # This avoids moving original cars/traffic across urban parcels and
    # clearly distinguishes road geometry from its rescaled game rendering.
    first,last=samples[0][0],samples[-1][0]
    offsets=[]
    for i,(lon,lat) in enumerate(samples):
        trend=first+(last-first)*i/(SAMPLES-1)
        # scale based on WGS84 longitude at the strip latitude (~25m/unit)
        offsets.append(round((lon-trend)*90000/25,4))
    if max(map(abs,offsets))>3:
        raise RuntimeError("Measured centreline diverges too far from gameplay road")
    return {
        "schema": "patrol-vegas-census-tiger-strip-v1",
        "source": {
            "agency": "U.S. Census Bureau",
            "dataset": "TIGER/Line 2026 Clark County (NV) All Roads",
            "archiveUrl": SOURCE,
            "archiveSHA256": hashlib.sha256(raw).hexdigest(),
            "retrievedUtc": dt.datetime.now(dt.timezone.utc).isoformat(),
            "license": "U.S. federal government public-domain geodata",
            "crs": "EPSG:4326",
            "linearIDs": ids
        },
        "scope": "Las Vegas Blvd core sample, approximately Harmon to Flamingo",
        "samplesWgs84": samples,
        "gameReference": {
            "startZ": -210,"endZ": -122,"baseCenterX": -35,
            "sampledLateralOffsets":offsets,
            "roadWidthGameUnits": None,
            "trafficDirections": "not encoded in TIGER centreline"
        }
    }


def main() -> None:
    OUTPUT.mkdir(parents=True,exist_ok=True)
    raw=download()
    result=build(raw)
    (OUTPUT/"census-tiger-raw.zip").write_bytes(raw)
    (OUTPUT/"vegas-strip-tiger.json").write_text(
        json.dumps(result,separators=(",",":"))+"\n",encoding="utf-8")
    print(json.dumps({
        "sha":result["source"]["archiveSHA256"],
        "sourceFeatures":len(result["source"]["linearIDs"]),
        "samples":len(result["samplesWgs84"]),
        "longitudeRange":[min(p[0] for p in result["samplesWgs84"]),
                          max(p[0] for p in result["samplesWgs84"])],
        "maxGameLateralDeviation":max(map(abs,result["gameReference"]["sampledLateralOffsets"]))
    },indent=2))


if __name__=="__main__":
    main()
