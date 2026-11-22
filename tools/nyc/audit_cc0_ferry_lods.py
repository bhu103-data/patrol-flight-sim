#!/usr/bin/env python3
"""Source/licence/GLB structure check for tevy CC0 car ferry LOD0/1/2.

Only original publisher v1 URLs, no Sketchfab or marketplace mirror.
This is a QA download; no runtime integration and no assumption of NYC Ferry identity.
"""
from __future__ import annotations
import hashlib
import json
import pathlib
import struct
import urllib.request
from urllib.parse import urlsplit

BASE = "https://tevy.dev/models/car-ferry"
DEST = pathlib.Path("nyc-harbor-audit/official-tevy")
DEST.mkdir(parents=True,exist_ok=True)
# Freeze the publisher's v1 binaries. A later changed source needs a NEW audit
# and explicit rights/geometry reapproval before any runtime import.
PINNED_SHA256={
  0:"c6afaae8bb66da747e3059d5dc17df56a221a94e6a13c8e9a199ddeb9154e0d5",
  1:"1013a80e4fc662e46ebbfe78bf1771f41a0fef6a46655a83705d746b123ab2b5",
  2:"619acc4a52c9405c521fc6ea5443f186231fe9fe6dc0d2f6e5d3735a98217db2"
}
REPORT={"source_page":BASE,"publisher":"tevy.dev / tevy","source_version":"v1 2026-10-27",
        "license":"CC0 1.0 Universal, publisher model-page dedication",
        "license_text_url":"https://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "commercial":True,"modify":True,"redistribute":True,
        "caveat":"Generic ro-ro car ferry, NOT measured NYC Ferry, Staten Island Ferry or a brand-approved design",
        "assets":{}}
def fetch(url,limit):
    with urllib.request.urlopen(urllib.request.Request(url,headers={
            "User-Agent":"PATROL-NYC-ferry-legal-and-binary-QA/1.0"
        }),timeout=45) as r:
        link=urlsplit(r.geturl())
        if link.scheme!="https" or link.hostname!="tevy.dev":
            raise ValueError("Unexpected ferry publisher redirect host")
        body=r.read(limit+1)
        if len(body)>limit:raise ValueError("Download exceeds size cap")
        return body
page=fetch(BASE,300_000).decode("utf8")
if "CC0 1.0" not in page or "Car Ferry" not in page or "lod0.glb" not in page:
    raise ValueError("The official car ferry page no longer states CC0 or published LODs")
REPORT["source_page_sha256"]=hashlib.sha256(page.encode()).hexdigest()
(DEST/"source-page.html").write_text(page)
for lod in range(3):
    url=f"{BASE}/v1/lod{lod}.glb"
    entry={"url":url,"lod":lod}
    try:
        data=fetch(url,7_000_000)
        if hashlib.sha256(data).hexdigest()!=PINNED_SHA256[lod]:
            raise ValueError("Pinned official v1 GLB SHA-256 changed")
        if len(data)<28 or data[:4]!=b"glTF" or struct.unpack_from("<II",data,4)!=(2,len(data)):
            raise ValueError("Not valid GLB2 header/length")
        json_len,chunk_type=struct.unpack_from("<II",data,12)
        if chunk_type!=0x4e4f534a: raise ValueError("GLB missing JSON chunk")
        gltf=json.loads(data[20:20+json_len])
        required=gltf.get("extensionsRequired",[])
        images=gltf.get("images",[])
        textures=gltf.get("textures",[])
        materials=gltf.get("materials",[])
        tris=0
        pbr_tex=set()
        for m in materials:
            pbr=m.get("pbrMetallicRoughness") or {}
            tex=pbr.get("baseColorTexture")
            if tex:pbr_tex.add(tex.get("index"))
        for mesh in gltf.get("meshes",[]):
            for prim in mesh.get("primitives",[]):
                if prim.get("mode",4)!=4:continue
                ids=prim.get("indices",prim["attributes"].get("POSITION"))
                tris+=gltf["accessors"][ids]["count"]//3
        entry.update({"status":"OK","bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),
            "triangles":tris,"nodes":len(gltf.get("nodes",[])),
            "meshes":len(gltf.get("meshes",[])),
            "materials":len(materials),"textures":len(textures),
            "base_color_texture_indices":sorted(pbr_tex),
            "images":[{"mimeType":i.get("mimeType"),"embedded":i.get("bufferView") is not None,
                "uri":i.get("uri")} for i in images],
            "extensionsUsed":gltf.get("extensionsUsed",[]),
            "extensionsRequired":required,
            "has_scale_tracks":bool(gltf.get("animations",[])),
        })
        name=f"tevy-car-ferry-lod{lod}-source.glb"
        (DEST/name).write_bytes(data)
        print("VERIFIED",lod,len(data),"bytes",tris,"tris",len(pbr_tex),"diffuse maps",required)
    except Exception as e:
        entry.update({"status":"REJECTED_OR_UNAVAILABLE","reason":type(e).__name__+": "+str(e)[:300]})
        print("REJECTED",lod,entry["reason"])
    REPORT["assets"][f"lod{lod}"]=entry
(DEST/"license-binary-audit.json").write_text(json.dumps(REPORT,indent=2)+"\n")
if not any(v["status"]=="OK" for v in REPORT["assets"].values()):
    raise SystemExit("No verified CC0 ferry GLB downloaded; no runtime import permitted")
