#!/usr/bin/env python3
"""Probe official NOAA CUSP index vector tiles around Tracy Arm and download small indexed ZIPs.

Read-only QA: tile index, archive provenance and ZIP integrity only; NOT a
replacement for the NGS AK1803-CM-T project or current game shoreline.
"""
from __future__ import annotations
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import urllib.parse
import urllib.request
import zipfile
import io

import mapbox_vector_tile

AOI = [-133.265, 57.851, -133.135, 57.923]
BASE = "https://nsde.ngs.noaa.gov"
OUT = Path("alaska-official-aoi-results/noaa-cusp-index")
OUT.mkdir(parents=True, exist_ok=True)
MAX_INDEX_BYTES = 1_000_000
MAX_ARCHIVE_BYTES = 32 * 1024 * 1024
MAX_TOTAL_BYTES = 60 * 1024 * 1024
report = {
  "source": "NOAA Shoreline Data Explorer, /cusp/cuspidx/{z}/{x}/{y}.pbf",
  "source_url": BASE,
  "aoi_wgs84": AOI,
  "scope": "Index discovery and bounded individual ZIP QA; NOT runtime shoreline",
  "tiles": [], "names": [], "downloads": [], "warnings": [],
}

def get_bytes(url, max_size, method="GET"):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "PATROL-Alaska-public-shoreline-audit/1.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        p = urllib.parse.urlparse(r.geturl())
        if p.scheme != "https" or p.hostname != "nsde.ngs.noaa.gov":
            raise ValueError("Unexpected NOAA redirect")
        if method == "HEAD":
            return b"", dict(r.headers), r.status
        declared = r.headers.get("Content-Length")
        if declared and int(declared) > max_size:
            raise ValueError("Response larger than safety limit")
        data = r.read(max_size + 1)
        if len(data) > max_size:
            raise ValueError("Response exceeded safety limit")
        return data, dict(r.headers), r.status

def tile_at(lon,lat,z):
    scale = 2**z
    x = int(math.floor((lon+180)/360*scale))
    y = int(math.floor((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*scale))
    return x, y

names = set()
for zoom in (9, 10):
    x0,y0=tile_at(AOI[0], AOI[3], zoom)
    x1,y1=tile_at(AOI[2], AOI[1], zoom)
    for x in range(min(x0,x1)-1,max(x0,x1)+2):
        for y in range(min(y0,y1)-1,max(y0,y1)+2):
            url = f"{BASE}/cusp/cuspidx/{zoom}/{x}/{y}.pbf"
            item = {"z":zoom,"x":x,"y":y,"url":url}
            try:
                raw,headers,status=get_bytes(url,MAX_INDEX_BYTES)
                if raw.startswith(b"\x1f\x8b"):
                    raw=gzip.decompress(raw)
                if len(raw)>MAX_INDEX_BYTES:
                    raise ValueError("Decompressed tile too large")
                decoded=mapbox_vector_tile.decode(raw)
                row=[]
                for lname,layer in decoded.items():
                    for feature in layer.get("features",[]):
                        value=feature.get("properties",{}).get("name")
                        if isinstance(value,str) and re.fullmatch(r"[A-Za-z0-9_.-]{3,80}",value):
                            row.append(value)
                            names.add(value)
                item.update({"status":status,"length":len(raw),"layers":list(decoded),"names":sorted(set(row))})
                print("tile",zoom,x,y,len(raw),"names",len(row))
            except Exception as exc:
                item["error"]=f"{type(exc).__name__}: {str(exc)[:300]}"
            report["tiles"].append(item)
report["names"]=sorted(names)
print("CUSP index distinct archive names:", report["names"][:40])

total=0
for name in report["names"][:30]:
    if len(report["downloads"])>=6 or total>=MAX_TOTAL_BYTES:
        break
    url=f"{BASE}/downloads/{urllib.parse.quote(name)}.zip"
    item={"name":name,"url":url}
    try:
        _,headers,status=get_bytes(url,MAX_ARCHIVE_BYTES,method="HEAD")
        declared=headers.get("Content-Length")
        item["head_status"]=status
        item["declared_bytes"]=int(declared) if declared and declared.isdigit() else None
        if item["declared_bytes"] is None:
            item["reason"]="Unknown Content-Length; not downloading unbounded archive"
        elif item["declared_bytes"]>MAX_ARCHIVE_BYTES or item["declared_bytes"]+total>MAX_TOTAL_BYTES:
            item["reason"]="Archive larger than per-file or overall size cap"
        else:
            raw,_,status=get_bytes(url,MAX_ARCHIVE_BYTES)
            if not zipfile.is_zipfile(io.BytesIO(raw)):
                raise ValueError("NOAA result is not valid ZIP")
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                if zf.testzip() is not None:
                    raise ValueError("ZIP integrity test failed")
                item["entry_count"]=len(zf.namelist())
                item["entry_sample"]=zf.namelist()[:18]
            path=OUT / f"{name}.zip"
            path.write_bytes(raw)
            total+=len(raw)
            item.update({"download_bytes":len(raw),
                         "sha256":hashlib.sha256(raw).hexdigest(),
                         "status":"VERIFIED_ZIP_QA_ONLY"})
            print("downloaded NOAA index ZIP",name,len(raw))
    except Exception as exc:
        item["error"]=f"{type(exc).__name__}: {str(exc)[:350]}"
    report["downloads"].append(item)

(OUT/"index-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
