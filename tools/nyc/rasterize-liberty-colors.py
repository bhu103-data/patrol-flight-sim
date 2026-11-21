#!/usr/bin/env python3
"""CPU-only texture baker: sample official original GLB PNGs into one new UV atlas.

Read-only input GLB and UV mapping from Blender decimation. Does not need Cycles,
a GPU, network access or external 3D assets. Requires apt python3-numpy/pillow.
"""
import io
import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

if len(sys.argv) != 4:
    raise SystemExit("Usage: rasterize-liberty-colors.py original.glb uv-data.npz atlas.png")
source, coordinates, destination = map(Path, sys.argv[1:])
content = source.read_bytes()
length = struct.unpack_from("<I", content, 12)[0]
gltf = json.loads(content[20:20 + length])
bin_start = 20 + length + 8
views = gltf["bufferViews"]
textures = gltf["textures"]
images = gltf["images"]
mats = gltf["materials"]
baked = np.load(coordinates)
uv_src = baked["sourceUV"].astype(np.float64)
uv_atlas = baked["atlasUV"].astype(np.float64)
ids = baked["materialIds"].astype(np.int32)
blender_names = baked["materialNames"].tolist()
if uv_src.shape != uv_atlas.shape or uv_src.ndim != 3 or uv_src.shape[1:] != (3, 2):
    raise RuntimeError("Unexpected source/atlas triangle UV mapping")
if len(ids) != len(uv_src):
    raise RuntimeError("Face-material and UV count mismatch")

original_materials = {mat["name"]: i for i, mat in enumerate(mats)}
image_cache = {}
slot_images = {}
for slot, raw_name in enumerate(blender_names):
    name = str(raw_name)
    exact = original_materials.get(name)
    if exact is None:
        raise RuntimeError("Unknown imported Innerscene material: " + name)
    spec = mats[exact]["pbrMetallicRoughness"]["baseColorTexture"]
    image_id = textures[spec["index"]]["source"]
    if image_id not in image_cache:
        img = images[image_id]
        view = views[img["bufferView"]]
        offset = bin_start + view.get("byteOffset", 0)
        chunk = content[offset:offset + view["byteLength"]]
        image_cache[image_id] = np.asarray(Image.open(io.BytesIO(chunk)).convert("RGB"))
    slot_images[slot] = image_cache[image_id]

W = H = 1024
canvas = np.zeros((H, W, 3), dtype=np.uint8)
painted = np.zeros((H, W), dtype=np.bool_)
triangles_with_coverage = 0
for index, (src, dst, material_index) in enumerate(zip(uv_src, uv_atlas, ids)):
    texture = slot_images.get(int(material_index))
    if texture is None:
        raise RuntimeError("Unmapped material at triangle " + str(index))
    pts = dst * np.array([W - 1, -(H - 1)]) + np.array([0, H - 1])
    a, b, c = pts
    area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    if abs(area) < 1e-6:
        continue
    x0 = max(0, int(np.floor(pts[:, 0].min())))
    x1 = min(W - 1, int(np.ceil(pts[:, 0].max())))
    y0 = max(0, int(np.floor(pts[:, 1].min())))
    y1 = min(H - 1, int(np.ceil(pts[:, 1].max())))
    if x0 > x1 or y0 > y1:
        continue
    yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    x = xx + 0.5
    y = yy + 0.5
    v1 = ((x - a[0]) * (c[1] - a[1]) - (y - a[1]) * (c[0] - a[0])) / area
    v2 = ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])) / area
    v0 = 1 - v1 - v2
    inside = (v0 >= -0.000001) & (v1 >= -0.000001) & (v2 >= -0.000001)
    if not np.any(inside):
        # Smart-project produces thousands of sub-pixel UV islands. They still
        # appear on the rendered mesh, so at least the nearest atlas texel
        # must receive a source-colored sample rather than remaining black.
        at = np.mean(dst, axis=0)
        uv = np.mean(src, axis=0)
        tex_h, tex_w = texture.shape[:2]
        px = int(np.floor(np.mod(uv[0], 1) * (tex_w - 1)))
        py = int(np.floor((1 - np.mod(uv[1], 1)) * (tex_h - 1)))
        tx = int(np.clip(round(at[0] * (W - 1)), 0, W - 1))
        ty = int(np.clip(round((1 - at[1]) * (H - 1)), 0, H - 1))
        canvas[ty, tx] = texture[py, px]
        painted[ty, tx] = True
        triangles_with_coverage += 1
        continue
    triangles_with_coverage += 1
    source_u = v0[inside] * src[0, 0] + v1[inside] * src[1, 0] + v2[inside] * src[2, 0]
    source_v = v0[inside] * src[0, 1] + v1[inside] * src[1, 1] + v2[inside] * src[2, 1]
    tex_h, tex_w = texture.shape[:2]
    px = np.floor(np.mod(source_u, 1) * (tex_w - 1)).astype(np.int32)
    py = np.floor((1 - np.mod(source_v, 1)) * (tex_h - 1)).astype(np.int32)
    dst_x, dst_y = xx[inside], yy[inside]
    canvas[dst_y, dst_x] = texture[py, px]
    painted[dst_y, dst_x] = True

coverage = float(np.mean(painted))
if coverage < 0.08 or triangles_with_coverage < 1000:
    raise RuntimeError(f"Insufficient UV atlas coverage: {coverage:.3%}; triangles {triangles_with_coverage}")
# Enforce MATERIAL-AWARE fill: each source material has its own half-size
# quadrant. Never let stone, copper and flame colors bleed across quadrants.
# Near-to-far nearest-neighbor expansion gives subpixel UV islands coverage.
quadrant_rgb = {}
for slot in range(len(blender_names)):
    if slot >= 4:
        raise RuntimeError("Unexpected extra Innerscene material")
    # glTF UV V is bottom-up but Pillow scanlines are top-down.
    x0, y0 = (slot % 2) * (W // 2), (1 - slot // 2) * (H // 2)
    patch = canvas[y0:y0 + H // 2, x0:x0 + W // 2]
    occupied = painted[y0:y0 + H // 2, x0:x0 + W // 2]
    if not np.any(occupied):
        raise RuntimeError(f"Source material {slot} got no UV samples")
    pw, ph = W // 2, H // 2
    for radius in (1, 1, 1, 2, 4, 8, 16, 32, 64, 128, 256):
        for dy, dx in ((0, -radius), (0, radius), (-radius, 0), (radius, 0)):
            sy0, sy1 = max(0, -dy), min(ph, ph - dy)
            sx0, sx1 = max(0, -dx), min(pw, pw - dx)
            dy0, dy1 = sy0 + dy, sy1 + dy
            dx0, dx1 = sx0 + dx, sx1 + dx
            update = ~occupied[dy0:dy1, dx0:dx1] & occupied[sy0:sy1, sx0:sx1]
            patch[dy0:dy1, dx0:dx1][update] = patch[sy0:sy1, sx0:sx1][update]
            occupied[dy0:dy1, dx0:dx1][update] = True
    if not np.all(occupied):
        raise RuntimeError(f"Material {slot} atlas padding remains black")
    quadrant_rgb[str(blender_names[slot])] = patch.mean(axis=(0, 1)).tolist()

if float(np.mean(painted)) < 0.999:
    raise RuntimeError("CPU color extension left uncovered texels")

destination.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(canvas).save(destination, "PNG", optimize=True)
mean = canvas[painted].mean(axis=0).tolist()
report = {"uvTriangles":len(uv_src),"coloredTriangles":triangles_with_coverage,
          "atlasCoverageBeforePadding":coverage,
          "atlasCoverageAfterPadding":float(np.mean(painted)),
          "meanPaintedRGB":mean, "materialQuadrantMeanRGB":quadrant_rgb,
          "atlasBytes":destination.stat().st_size}
print("PATROL_LIBERTY_CPU_ATLAS " + json.dumps(report))
if destination.stat().st_size > 4194304 or max(mean) < 20:
    raise RuntimeError("Atlas failed embedded-byte or brightness gate")
