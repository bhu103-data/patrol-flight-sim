#!/usr/bin/env python3
"""Strict compatibility and budget audit for 3 uncompressed PATROL ferry GLBs."""
from __future__ import annotations
from io import BytesIO
import hashlib
import json
from pathlib import Path
import struct
from PIL import Image

ROOT=Path("nyc-harbor-audit/staged")
SOURCE=Path("nyc-harbor-audit/official-tevy")
ROOT.mkdir(parents=True,exist_ok=True)
EXPECTED=[52069,19775,5478]
LIMIT=8*1024*1024
out={"licence":"CC0 1.0; https://tevy.dev/models/car-ferry",
     "description":"Generic ro-ro ferry, not survey of NYC Ferry vessel",
     "note":"Uncompressed vertices/PNG to match PATROL custom WebGL2 GLB decoder",
     "staged":{}}
for lod in range(3):
    p=ROOT/f"tevy-ro-ro-lod{lod}.glb"
    data=p.read_bytes()
    if not (28<len(data)<=LIMIT) or data[:4]!=b"glTF" or struct.unpack_from("<II",data,4)!=(2,len(data)):
        raise ValueError(f"Bad GLB2 or byte budget for LOD{lod}")
    n,kind=struct.unpack_from("<II",data,12)
    if kind!=0x4e4f534a:raise ValueError("No JSON chunk")
    model=json.loads(data[20:20+n])
    extensions=model.get("extensionsRequired",[])
    if extensions:raise ValueError(f"Unsupported required extensions: {extensions}")
    tri=0
    for mesh in model.get("meshes",[]):
        for prim in mesh.get("primitives",[]):
            if prim.get("mode",4)!=4:
                continue
            p_idx=prim["attributes"]["POSITION"]
            pa=model["accessors"][p_idx]
            if pa["componentType"]!=5126 or pa["type"]!="VEC3":
                raise ValueError("POSITION must be float VEC3 after dequantize")
            if "extensions" in prim:raise ValueError("Still compressed primitive")
            n_idx=model["accessors"][prim["indices"]]["count"] if "indices" in prim else pa["count"]
            tri+=n_idx//3
    if tri!=EXPECTED[lod]:
        raise ValueError(f"LOD{lod} triangle count changed {tri} from source {EXPECTED[lod]}")
    # Current renderer supports exactly ONE embedded Base Color texture
    ids=set()
    for mat in model.get("materials",[]):
        pbr=mat.get("pbrMetallicRoughness",{})
        tex=pbr.get("baseColorTexture")
        if tex:
            if tex.get("texCoord",0)!=0 or tex.get("extensions",{}):
                raise ValueError("Only UV0 without transform supported")
            ids.add(tex["index"])
    if len(ids)>1:raise ValueError("Multiple diffuse textures need atlas")
    for index in ids:
        tex=model["textures"][index]
        if "extensions" in tex:raise ValueError("KTX2 basis texture extension still present")
        image=model["images"][tex["source"]]
        if image.get("mimeType") not in ("image/png","image/jpeg") or "bufferView" not in image:
            raise ValueError("Diffuse must be embedded PNG/JPEG")
        view=model["bufferViews"][image["bufferView"]]
        bin_start=20+n+8
        img=data[bin_start+view.get("byteOffset",0):bin_start+view.get("byteOffset",0)+view["byteLength"]]
        im=Image.open(BytesIO(img))
        if max(im.size)>2048:raise ValueError(f"Diffuse >2k budget: {im.size}")
    out["staged"][f"lod{lod}"]={"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest(),
        "triangles":tri,"textures":len(ids),"images":len(model.get("images",[])),
        "required_extensions":extensions,"nodes":len(model.get("nodes",[])),
        "meshes":len(model.get("meshes",[])),
    }
    print("WEBGL2_READY",lod,len(data),"bytes",tri,"triangles",
          len(ids),"diffuse",len(model.get("images",[])),"image(s)")
(ROOT/"webgl2-lod-audit.json").write_text(json.dumps(out,indent=2)+"\n")
