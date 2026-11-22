#!/usr/bin/env python3
"""Audit actual open-source Brooklyn Bridge GLB and existing PATROL NYC models.
No game runtime or public scene changes, archive is QA-only.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import struct
import urllib.parse
import urllib.request

OUT=Path("nyc-asset-audit/bridge-and-bundled")
OUT.mkdir(parents=True,exist_ok=True)
SRC="https://raw.githubusercontent.com/Ethical-Tech-CoLab/brooklyn-bridge-3d/main/"
LICENCE=SRC+"LICENSE.md"
GLB=SRC+"mesh/glb/control_skeleton.glb"

def get(url,limit):
    parsed=urllib.parse.urlsplit(url)
    if parsed.scheme!="https" or parsed.hostname!="raw.githubusercontent.com":
        raise ValueError("Unexpected remote host")
    with urllib.request.urlopen(urllib.request.Request(url,headers={
            "User-Agent":"PATROL-NYC-licensed-asset-QA/1.0"}),timeout=60) as r:
        final=urllib.parse.urlsplit(r.geturl())
        if final.scheme!="https" or final.hostname!="raw.githubusercontent.com":
            raise ValueError("Unexpected redirect")
        b=r.read(limit+1)
        if len(b)>limit:raise ValueError("Source larger than QA cap")
        return b

def inspect(name,blob):
    if len(blob)<28 or blob[:4]!=b'glTF' or struct.unpack_from('<II',blob,4)!=(2,len(blob)):
        raise ValueError("Not GLB2: "+name)
    n,t=struct.unpack_from('<II',blob,12)
    if t!=0x4e4f534a:raise ValueError("No JSON chunk")
    j=json.loads(blob[20:20+n])
    tris=0;not_tri=0
    for mesh in j.get('meshes',[]):
        for p in mesh.get('primitives',[]):
            if p.get('mode',4)!=4:
                not_tri+=1
                continue
            accessor=p.get('indices',p['attributes'].get('POSITION'))
            tris+=j['accessors'][accessor]['count']//3
    return {"name":name,"sha256":hashlib.sha256(blob).hexdigest(),
            "bytes":len(blob),"triangles":tris,"nontriangle_primitives":not_tri,
            "nodes":len(j.get('nodes',[])),"meshes":len(j.get('meshes',[])),
            "materials":len(j.get('materials',[])),
            "images":[{"mime":im.get('mimeType'),"embedded":im.get('bufferView') is not None,
                       "uri":im.get('uri')} for im in j.get('images',[])],
            "extensionsUsed":j.get('extensionsUsed',[]),
            "extensionsRequired":j.get('extensionsRequired',[])}

report={
    "asset_scope":"licensed source inventory, not replacement in PATROL game",
    "bridge":{"origin":SRC,"license_url":LICENCE,
              "expected_cc":"CC BY 4.0 for mesh/glb/*; attribution and modification notice mandatory"},
    "existing_models":[],
}
try:
    lic=get(LICENCE,200_000).decode("utf8")
    if "CC BY 4.0" not in lic or "mesh/glb/*" not in lic:
        raise ValueError("Source license does not explicitly cover GLB")
    original=get(GLB,22_000_000)
    report['bridge']['source_file']="mesh/glb/control_skeleton.glb"
    report['bridge']['license_sha256']=hashlib.sha256(lic.encode()).hexdigest()
    report['bridge']['measured']=inspect("Ethical Tech CoLab Brooklyn Bridge digital twin",original)
    (OUT/"brooklyn-bridge-control-skeleton-source.glb").write_bytes(original)
    (OUT/"brooklyn-bridge-source-LICENSE.md").write_text(lic)
    report['bridge']['status']="VERIFIED_CC_BY_4_GLTF_ONLY_NOT_SURVEY_COMPLETE"
except Exception as exc:
    report['bridge']['status']="FAILED"
    report['bridge']['error']=str(type(exc).__name__)+": "+str(exc)[:400]
for path in [
    "assets/nyc/statue-of-liberty.glb",
    "assets/nyc/empire-state.glb",
    "assets/nyc/scenario/trade.glb",
    "assets/nyc/scenario/empire.glb",
    "assets/nyc/scenario/chrysler.glb",
]:
    p=Path(path)
    try:
        blob=p.read_bytes()
        item=inspect(path,blob)
        if path == "assets/nyc/statue-of-liberty.glb":
            (OUT/"patrol-current-liberty-source-mit.glb").write_bytes(blob)
        if path == "assets/nyc/scenario/empire.glb":
            (OUT/"patrol-current-empire-original.glb").write_bytes(blob)
    except Exception as exc:
        item={"name":path,"error":type(exc).__name__+": "+str(exc)[:150]}
    report["existing_models"].append(item)
(OUT/"asset-measurements.json").write_text(json.dumps(report,indent=2)+"\n")
print("bridge",report["bridge"].get("status"),json.dumps(report["bridge"].get("measured",{}))[:500])
for item in report["existing_models"]:
    print("PATROL",json.dumps(item)[:400])
if report["bridge"]["status"]!="VERIFIED_CC_BY_4_GLTF_ONLY_NOT_SURVEY_COMPLETE":
    raise SystemExit("Bridge source license or download could not be verified")
