#!/usr/bin/env python3
"""Bake tiny CC0 Poly Haven snow/rock photo-PBR atlases for PATROL Alaska.

Source: https://polyhaven.com/license (CC0). 1K source Diffuse, nor_gl,
Rough from Poly Haven API. Output two 512x256 WebP atlases (~hundreds KB).
Image column 0 = rock_01, column 1 = snow_02. A second RGBA image stores
OpenGL tangent-space normal RGB and linear roughness A.

No network requests occur in the game: the resulting atlases are checked in.
Only the build job calls Poly Haven. Each host is allowlisted.
"""
from __future__ import annotations
import argparse
import io
import json
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from PIL import Image

ASSETS = (("rock_01", "rock"), ("snow_02", "snow"))
OUT = Path("assets/alaska")
SIZE = 256
MAX_BLOB = 6_000_000
AGENT = "PATROL-Alaska-CC0-PBR-Asset-Baker/1.0"

def fetch_bytes(url, limit=MAX_BLOB):
    host = urlparse(url).hostname
    if not url.startswith("https://") or host not in ("api.polyhaven.com", "dl.polyhaven.org"):
        raise ValueError("Unexpected external asset URL: " + str(host))
    req = Request(url, headers={"User-Agent":AGENT, "Accept":"*/*"})
    with urlopen(req, timeout=35) as response:
        payload = response.read(limit + 1)
    if len(payload) > limit:
        raise ValueError("Asset exceeds bounded source download: " + url)
    return payload

def get_source_map(meta, key):
    if key not in meta:
        raise ValueError(f"Missing required Poly Haven PBR channel {key}")
    maps = meta[key]
    variants = maps.get("1k", {})
    for ext in ("jpg", "png"):
        info = variants.get(ext)
        if isinstance(info, dict) and info.get("url"):
            return info["url"]
    raise ValueError(f"No 1k JPG/PNG for PBR channel: {key}")

def fetch_tile(asset):
    raw = fetch_bytes(f"https://api.polyhaven.com/files/{asset}", limit=200_000)
    meta = json.loads(raw)
    result = {}
    for key in ("Diffuse", "nor_gl", "Rough"):
        url = get_source_map(meta, key)
        blob = fetch_bytes(url)
        with Image.open(io.BytesIO(blob)) as im:
            im.load()
            if min(im.size) < 256:
                raise ValueError("PBR source image is too small")
            kind = "RGB" if key != "Rough" else "L"
            result[key] = im.convert(kind).resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    return result

def atlas():
    OUT.mkdir(parents=True, exist_ok=True)
    albedo=Image.new("RGB", (SIZE*2,SIZE))
    normal_rough=Image.new("RGBA", (SIZE*2,SIZE))
    for idx,(slug, _) in enumerate(ASSETS):
        data=fetch_tile(slug)
        albedo.paste(data["Diffuse"],(SIZE*idx,0))
        packed=Image.merge("RGBA",(*data["nor_gl"].split(),data["Rough"]))
        normal_rough.paste(packed,(SIZE*idx,0))
    # WebP outputs remain power-of-two, mobile friendly and mipmap compatible.
    albedo.save(OUT/"alaska-photo-albedo.webp", "WEBP", quality=84, method=6)
    normal_rough.save(OUT/"alaska-photo-nrm-rough.webp", "WEBP", lossless=True, method=6)
    for name in ("alaska-photo-albedo.webp", "alaska-photo-nrm-rough.webp"):
        path=OUT/name
        with Image.open(path) as im:
            im.verify()
        if path.stat().st_size>950_000:
            raise ValueError("Photographic atlas budget exceeded: "+name)
        print(f"{name}: {path.stat().st_size:,} bytes")
    manifest={
        "format":"patrol-alaska-pbr-atlas-v1",
        "width":SIZE*2,"height":SIZE,
        "columns": ["rock_01","snow_02"],
        "maps": {"albedo":"alaska-photo-albedo.webp",
                 "normalRough":"alaska-photo-nrm-rough.webp"},
        "normalConvention":"OpenGL",
        "roughnessChannel":"A",
        "license":"CC0",
        "source":"https://polyhaven.com/license",
        "assetUrls":["https://polyhaven.com/a/rock_01","https://polyhaven.com/a/snow_02"],
    }
    (OUT/"alaska-photo-manifest.json").write_text(
        json.dumps(manifest,indent=2)+"\n",encoding="utf-8")

def check():
    m=json.loads((OUT/"alaska-photo-manifest.json").read_text(encoding="utf-8"))
    assert m["columns"]==["rock_01","snow_02"] and m["license"]=="CC0"
    for file in m["maps"].values():
        p=OUT/file
        assert p.exists() and 5_000<p.stat().st_size<950_000
        with Image.open(p) as im:
            im.load()
            assert im.size==(SIZE*2,SIZE)
    print("Photo atlas valid: two CC0 materials, normal/roughness packed")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--check",action="store_true")
    args=parser.parse_args()
    check() if args.check else atlas()
