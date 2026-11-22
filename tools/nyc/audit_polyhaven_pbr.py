#!/usr/bin/env python3
"""Official Poly Haven CC0 facade PBR evidence, bounded public downloads only."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request

ASSET="brick_wall_001"
ROOT="https://api.polyhaven.com/"
OUT=Path("nyc-asset-audit/polyhaven-pbr")
OUT.mkdir(parents=True,exist_ok=True)
LIMIT=2_800_000
def request(url,limit):
    req=urllib.request.Request(url,headers={"User-Agent":"PATROL-NYC-cc0-material-audit/1.0"})
    with urllib.request.urlopen(req,timeout=45) as r:
        p=urllib.parse.urlsplit(r.geturl())
        if p.scheme!="https" or p.hostname not in {"api.polyhaven.com","dl.polyhaven.org"}:
            raise ValueError("Not Poly Haven official delivery host")
        data=r.read(limit+1)
        if len(data)>limit:raise ValueError("Response larger than cap")
        return data
report={"source":"https://polyhaven.com/a/brick_wall_001",
        "license":"CC0-1.0","legal":"https://polyhaven.com/license",
        "download_kind":"official API map-specific 1k PBR files"}
try:
    info_bytes=request(ROOT+"info/"+ASSET,300_000)
    files_bytes=request(ROOT+"files/"+ASSET,1_000_000)
    info=json.loads(info_bytes);files=json.loads(files_bytes)
    report["publisher_info"]=info
    report["available_maps"]=sorted(files)
    (OUT/"brick_wall_001-info.json").write_bytes(info_bytes)
    (OUT/"brick_wall_001-files-catalog.json").write_bytes(files_bytes)
    report["downloads"]={}
    preferred=("Diffuse","nor_gl","arm")
    for maptype in preferred:
        candidates=[]
        for name,obj in files.items():
            if name.lower()!=maptype.lower() and not (maptype=="Diffuse" and name=="Diffuse"):
                continue
            for res,formats in obj.items():
                if res.lower()!="1k":continue
                if isinstance(formats,dict):
                    for fmt,choice in formats.items():
                        if isinstance(choice,dict) and isinstance(choice.get("url"),str):
                            candidates.append((fmt,choice["url"]))
        choice=next(((fmt,url) for fmt,url in candidates if fmt.lower() in ("jpg","jpeg")),None)
        if choice is None:choice=next(((fmt,url) for fmt,url in candidates if fmt.lower()=="png"),None)
        if choice is None:
            report["downloads"][maptype]={"status":"NOT_AVAILABLE_AT_1K","choices":candidates[:7]}
            continue
        fmt,url=choice
        p=urllib.parse.urlsplit(url)
        if p.scheme!="https" or p.hostname!="dl.polyhaven.org":raise ValueError("Untrusted Poly Haven URL")
        data=request(url,LIMIT)
        if data[:2]!=b"\xff\xd8" and data[:8]!=b"\x89PNG\r\n\x1a\n":
            raise ValueError("Not JPG/PNG data")
        name=ASSET+"_"+maptype+"_1k."+fmt.lower()
        (OUT/name).write_bytes(data)
        report["downloads"][maptype]={"status":"OK","url":url,"filename":name,
            "bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),
            "magic":data[:8].hex()}
        print("PBR",maptype,len(data),"bytes",fmt)
except Exception as exc:
    report["error"]=type(exc).__name__+": "+str(exc)[:500]
(OUT/"pbr-audit-report.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
print("Poly Haven",report.get("error","pass"),"maps",list(report.get("downloads",{})))
if "error" in report:raise SystemExit("Official Poly Haven API/texture probe failed")
