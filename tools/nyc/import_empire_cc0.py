#!/usr/bin/env python3
"""Fetch, audit and vendor the CC0 Empire State GLB into PATROL's scenario pipeline."""
from __future__ import annotations
import hashlib, json, math, struct, urllib.request
from pathlib import Path

SOURCE_PAGE = "https://www.innerscene.com/tools/library/3d-parts/empire-state-building-approximate-model-eb5f8e14"
DIRECT_URL = "https://files.innerscene.com/library/empire-state-building-approximate-model-eb5f8e14/4adfa147c0946b573cb2/empire-state-building-approximate-model.glb"
API_URL = "https://www.innerscene.com/api/library/empire-state-building-approximate-model-eb5f8e14/download"
DEST = Path("assets/nyc/scenario/empire-state-cc0.glb")
MANIFEST = Path("assets/nyc/scenario-manifest.json")
NOTICES = Path("assets/nyc/THIRD_PARTY_NOTICES.md")
DOC = Path("docs/NYC_EMPIRE_STATE_CC0_IMPORT.md")
REPORT = Path("artifacts/empire-cc0-import-audit.json")
MAX_BYTES, MAX_TRIANGLES, MIN_TRIANGLES = 8 * 1024 * 1024, 25_000, 700
COMPONENTS = {5126: ("f", 4), 5125: ("I", 4), 5123: ("H", 2), 5121: ("B", 1)}
TYPE_COUNTS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

def fail(message):
    raise RuntimeError(message)

def fetch_source():
    errors = []
    for url in (DIRECT_URL, API_URL):
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "PATROL-Open-Asset-Audit/1.0",
                "Accept": "application/octet-stream,*/*",
            })
            with urllib.request.urlopen(req, timeout=90) as response:
                data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                fail("Source exceeds PATROL's 8 MiB GLB limit")
            if len(data) < 64 or data[:4] != b"glTF":
                fail("Download was not a binary glTF")
            return data
        except Exception as exc:
            errors.append(f"{url}: {type(exc).__name__}: {exc}")
    fail("Could not download the public CC0 model:\n" + "\n".join(errors))

def parse_glb(data):
    if len(data) > MAX_BYTES or len(data) < 20:
        fail("GLB size is outside supported bounds")
    magic, version, total = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2 or total != len(data):
        fail("Expected a complete GLB 2.0 binary")
    offset, document, binary = 12, None, None
    while offset + 8 <= len(data):
        length, kind = struct.unpack_from("<II", data, offset)
        start, end = offset + 8, offset + 8 + length
        if end > len(data):
            fail("GLB chunk extends past file boundary")
        chunk = data[start:end]
        if kind == 0x4E4F534A:
            document = json.loads(chunk.decode("utf-8").rstrip("\x00 \t\r\n"))
        elif kind == 0x004E4942:
            binary = chunk
        offset = end
    if document is None or binary is None or document.get("asset", {}).get("version") != "2.0":
        fail("GLB must contain glTF 2.0 JSON and embedded BIN chunks")
    buffers = document.get("buffers", [])
    if len(buffers) != 1 or buffers[0].get("uri") is not None or buffers[0].get("byteLength", 0) > len(binary):
        fail("Only one self-contained GLB buffer is supported")
    if document.get("extensionsRequired"):
        fail("Required glTF extensions are unsupported: " + ", ".join(document["extensionsRequired"]))
    if any(image.get("uri") is not None for image in document.get("images", [])):
        fail("External/data-URI images are not accepted; embed images in GLB")
    return document, binary

def read_accessor(document, binary, index):
    try:
        acc = document["accessors"][index]
        view = document["bufferViews"][acc["bufferView"]]
    except (KeyError, IndexError, TypeError):
        fail(f"Invalid accessor/bufferView reference: {index}")
    if acc.get("sparse") is not None or view.get("buffer") != 0:
        fail(f"Accessor {index} is sparse or not in the embedded buffer")
    ctype = acc.get("componentType")
    if ctype not in COMPONENTS or acc.get("type") not in TYPE_COUNTS:
        fail(f"Accessor {index} uses an unsupported format")
    fmt, size = COMPONENTS[ctype]
    components = TYPE_COUNTS[acc["type"]]
    element_size = size * components
    stride = view.get("byteStride", element_size)
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc.get("count", 0)
    if not isinstance(count, int) or count <= 0 or stride < element_size:
        fail(f"Accessor {index} has invalid count/stride")
    end = start + (count - 1) * stride + element_size
    if start < view.get("byteOffset", 0) or end > view.get("byteOffset", 0) + view.get("byteLength", 0) or end > len(binary):
        fail(f"Accessor {index} exceeds its bufferView")
    values = []
    row_fmt = "<" + fmt * components
    for i in range(count):
        row = struct.unpack_from(row_fmt, binary, start + i * stride)
        if acc.get("normalized") and ctype != 5126:
            divisor = {5121: 255.0, 5123: 65535.0, 5125: 4294967295.0}[ctype]
            row = tuple(v / divisor for v in row)
        values.append(row)
    return acc, values

def multiply(a, b):
    return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
            for c in range(4) for r in range(4)]

def node_matrix(node):
    if "matrix" in node:
        if len(node["matrix"]) != 16:
            fail("Node matrix must contain 16 values")
        return [float(v) for v in node["matrix"]]
    tx, ty, tz = node.get("translation", [0, 0, 0])
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    sx, sy, sz = node.get("scale", [1, 1, 1])
    return [
        (1-2*(y*y+z*z))*sx, 2*(x*y+z*w)*sx, 2*(x*z-y*w)*sx, 0,
        2*(x*y-z*w)*sy, (1-2*(x*x+z*z))*sy, 2*(y*z+x*w)*sy, 0,
        2*(x*z+y*w)*sz, 2*(y*z-x*w)*sz, (1-2*(x*x+y*y))*sz, 0,
        tx, ty, tz, 1,
    ]

def transform(m, p):
    x, y, z = p
    q = (m[0]*x+m[4]*y+m[8]*z+m[12],
         m[1]*x+m[5]*y+m[9]*z+m[13],
         m[2]*x+m[6]*y+m[10]*z+m[14],
         m[3]*x+m[7]*y+m[11]*z+m[15])
    if abs(q[3]) < 1e-12:
        fail("Node transform produced zero homogeneous coordinate")
    return tuple(v / q[3] for v in q[:3])

def audit(data):
    doc, binary = parse_glb(data)
    textures, images = doc.get("textures", []), doc.get("images", [])
    texture_indices = set()
    for material in doc.get("materials", []):
        if material.get("alphaMode", "OPAQUE") != "OPAQUE":
            fail("Transparent alpha modes are not supported by PATROL's current GLB path")
        tex = material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if tex:
            if tex.get("texCoord", 0) != 0 or tex.get("extensions", {}).get("KHR_texture_transform"):
                fail("Only untransformed TEXCOORD_0 Base Color textures are supported")
            texture_indices.add(tex.get("index"))
    if len(texture_indices) > 1:
        fail("PATROL's current GLB path accepts one shared Base Color atlas")
    texture_report, image_bytes = "Material colors", 0
    if texture_indices:
        ti = next(iter(texture_indices))
        if not isinstance(ti, int) or ti >= len(textures):
            fail("Invalid Base Color texture index")
        ii = textures[ti].get("source")
        if not isinstance(ii, int) or ii >= len(images):
            fail("Invalid Base Color image index")
        image = images[ii]
        if image.get("mimeType") not in ("image/png", "image/jpeg") or not isinstance(image.get("bufferView"), int):
            fail("Base Color image must be embedded PNG/JPEG")
        view = doc["bufferViews"][image["bufferView"]]
        image_bytes = view.get("byteLength", 0)
        if view.get("buffer") != 0 or image_bytes < 64 or image_bytes > 4 * 1024 * 1024:
            fail("Embedded Base Color atlas exceeds supported range")
        texture_report = "Embedded PNG/JPEG"

    scenes, nodes, meshes = doc.get("scenes", []), doc.get("nodes", []), doc.get("meshes", [])
    scene_id = doc.get("scene", 0)
    if not scenes or not nodes or not meshes or not isinstance(scene_id, int) or scene_id >= len(scenes):
        fail("GLB has no valid active scene/nodes/meshes")
    low, high = [math.inf]*3, [-math.inf]*3
    triangles, used_meshes, instances, stack = 0, set(), 0, set()

    def visit(node_id, parent):
        nonlocal triangles, instances
        if node_id in stack or node_id < 0 or node_id >= len(nodes):
            fail("Invalid/cyclic glTF node graph")
        stack.add(node_id)
        node = nodes[node_id]
        world = multiply(parent, node_matrix(node))
        if "mesh" in node:
            mesh_id = node["mesh"]
            if mesh_id < 0 or mesh_id >= len(meshes):
                fail("Invalid mesh index")
            used_meshes.add(mesh_id)
            instances += 1
            mesh = meshes[mesh_id]
            if mesh.get("weights") or any(p.get("targets") for p in mesh.get("primitives", [])):
                fail("Morph targets/weights are unsupported by the static landmark renderer")
            for primitive in mesh.get("primitives", []):
                if primitive.get("mode", 4) != 4:
                    fail("Only triangle-list primitives are supported")
                attrs = primitive.get("attributes", {})
                if "POSITION" not in attrs:
                    fail("Every primitive must contain POSITION")
                pos_acc, positions = read_accessor(doc, binary, attrs["POSITION"])
                if pos_acc.get("type") != "VEC3" or pos_acc.get("componentType") != 5126:
                    fail("POSITION must be FLOAT VEC3")
                for name, allowed in (("NORMAL", ("VEC3",)), ("COLOR_0", ("VEC3", "VEC4")), ("TEXCOORD_0", ("VEC2",))):
                    if name in attrs:
                        a = doc["accessors"][attrs[name]]
                        if a.get("type") not in allowed or a.get("componentType") not in COMPONENTS:
                            fail(f"Unsupported {name} attribute format")
                if texture_indices and "TEXCOORD_0" not in attrs:
                    fail("Textured primitives must provide TEXCOORD_0")
                if "indices" in primitive:
                    idx = doc["accessors"][primitive["indices"]]
                    if idx.get("type") != "SCALAR" or idx.get("componentType") not in (5121, 5123, 5125):
                        fail("Indices must be unsigned SCALAR")
                    count = idx.get("count", 0)
                else:
                    count = pos_acc.get("count", 0)
                if count <= 0 or count % 3:
                    fail("Triangle-list count must be divisible by three")
                triangles += count // 3
                for p in positions:
                    xyz = transform(world, p)
                    for axis, value in enumerate(xyz):
                        low[axis] = min(low[axis], value)
                        high[axis] = max(high[axis], value)
        for child in node.get("children", []):
            visit(child, world)
        stack.remove(node_id)

    identity = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
    for root in scenes[scene_id].get("nodes", []):
        visit(root, identity)
    if not used_meshes or not MIN_TRIANGLES <= triangles <= MAX_TRIANGLES:
        fail(f"Expanded triangle count {triangles} is outside {MIN_TRIANGLES}..{MAX_TRIANGLES}")
    width, height, depth = (high[i]-low[i] for i in range(3))
    if not all(math.isfinite(v) and v > 0 for v in (width, height, depth)) or not 400 <= height <= 460:
        fail(f"Expected a Y-up full-size Empire model near 443.3m high; bounds are {width:.3f} x {height:.3f} x {depth:.3f}")
    return {
        "glb_version": 2, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        "triangles": triangles, "mesh_count": len(used_meshes), "mesh_instances": instances,
        "material_count": len(doc.get("materials", [])), "image_count": len(images),
        "base_color_mode": texture_report, "base_color_image_bytes": image_bytes,
        "dimensions_m": {"width": round(width,3), "height": round(height,3), "depth": round(depth,3)},
        "mesh_names": [meshes[i].get("name", f"mesh-{i}") for i in sorted(used_meshes)],
        "node_names": [n.get("name", f"node-{i}") for i,n in enumerate(nodes) if "mesh" in n],
        "source_page": SOURCE_PAGE, "source_url": DIRECT_URL,
        "license": "CC0 1.0 Universal (publisher-declared)",
        "model_claim": "Approximate independent model; not photogrammetry or exact reproduction",
    }

def main():
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    if DEST.exists():
        data = DEST.read_bytes()
        metrics = audit(data)
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        pinned = manifest.get("landmarks", {}).get("empire", {}).get("source_sha256")
        if pinned and pinned != metrics["sha256"]:
            fail("Existing vendored GLB hash differs from manifest; refusing overwrite")
    else:
        data = fetch_source()
        metrics = audit(data)
        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_bytes(data)
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    empire = manifest["landmarks"]["empire"]
    empire.update({
        "enabled": True, "file": "scenario/empire-state-cc0.glb",
        "target_height": 79, "min_triangles": MIN_TRIANGLES,
        "license": "CC0 1.0 Universal; Innerscene Free Parts Library; approximate model, not photogrammetry; see source_page; SHA-256 pinned.",
        "source_page": SOURCE_PAGE, "source_url": DIRECT_URL,
        "source_license": "CC0 1.0 Universal", "source_sha256": metrics["sha256"],
        "source_bytes": metrics["bytes"], "source_triangles": metrics["triangles"],
        "source_dimensions_m": metrics["dimensions_m"],
    })
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    begin, end = "<!-- BEGIN INNERSCENE EMPIRE STATE CC0 -->", "<!-- END INNERSCENE EMPIRE STATE CC0 -->"
    notice = f"""{begin}
## Innerscene Free Parts Library — CC0 1.0 Universal

- Model: Empire State Building (approximate model), original Innerscene contribution.
- Source page: {SOURCE_PAGE}
- Vendored file: assets/nyc/scenario/empire-state-cc0.glb ({metrics['bytes']:,} bytes).
- SHA-256: {metrics['sha256']}.
- License: CC0 1.0 Universal. The publisher's library terms state contributors dedicate submitted parts to CC0 and permit copying, modification, redistribution and commercial use without attribution: https://www.innerscene.com/tools/library/terms.
- The source page explicitly says this is an approximate independent model, not an exact reproduction; it has no signage/text. CC0 does not grant trademark or patent rights in depicted material.
- Audited geometry: {metrics['triangles']:,} triangles; {metrics['mesh_count']} meshes; {metrics['material_count']} materials; {metrics['base_color_mode']}.

{end}"""
    notices = NOTICES.read_text(encoding="utf-8") if NOTICES.exists() else "# NYC 3D and street photo asset notices\n"
    if begin in notices and end in notices:
        notices = notices.split(begin, 1)[0].rstrip() + "\n\n" + notice + notices.split(end, 1)[1]
    else:
        notices = notices.rstrip() + "\n\n" + notice + "\n"
    NOTICES.write_text(notices, encoding="utf-8")

    doc = f"""# Empire State Building — direct CC0 GLB import

Status: Imported and validated on the isolated NYC child branch; not merged into main or the shared #211 candidate.

## Source and rights
- Publisher model page: {SOURCE_PAGE}
- Direct GLB source: {DIRECT_URL}
- License: CC0 1.0 Universal, as declared on the model page and Innerscene library terms: https://www.innerscene.com/tools/library/terms
- The model page describes a full-size approximate reconstruction with limestone-colored setbacks, window bands, observation levels, mooring mast and antenna. It explicitly says it is not an exact reproduction and has no signage/text.
- CC0 permits copying, modification and redistribution; it does not grant trademark or patent rights in depicted material.

## Binary audit
- File: assets/nyc/scenario/empire-state-cc0.glb
- Size: {metrics['bytes']:,} bytes
- SHA-256: {metrics['sha256']}
- Format: glTF binary 2.0, one embedded buffer
- Triangles in active scene: {metrics['triangles']:,} (PATROL budget: {MIN_TRIANGLES:,}–{MAX_TRIANGLES:,})
- Meshes / instances: {metrics['mesh_count']} / {metrics['mesh_instances']}
- Materials / images: {metrics['material_count']} / {metrics['image_count']}
- Base Color: {metrics['base_color_mode']} ({metrics['base_color_image_bytes']:,} embedded image bytes)
- Bounds, Y-up/source units treated as metres: {metrics['dimensions_m']['width']} × {metrics['dimensions_m']['height']} × {metrics['dimensions_m']['depth']} m
- Mesh names: {', '.join(metrics['mesh_names'])}
- Node names: {', '.join(metrics['node_names'])}

The audit rejects unsupported required glTF extensions, external buffers/images, sparse accessors, unsupported attribute formats, multiple Base Color atlases, non-triangle primitives, transparent alpha modes and models outside the renderer's size/triangle limits.

## PATROL integration
- The empire manifest entry points to scenario/empire-state-cc0.glb.
- Existing target_height 79 game units is retained; the importer normalizes source Y-height to the established Empire State landmark height.
- The original authored scenario/empire.glb remains in the repository as a manual rollback asset.
- The renderer's procedural Empire mesh remains the runtime fallback if the imported GLB fails to load.
- No external model URL is fetched at runtime; the vendored GLB is same-origin.
- No roads, traffic, collision, aircraft, flight controls, map switching, water or other city logic is changed.

## Accuracy boundary
This is a publisher-declared CC0 approximate architectural model, not a current 2026 photogrammetric scan, surveyed as-built model, or georeferenced 1:1 Manhattan reconstruction. PATROL's existing compact Manhattan coordinates remain unchanged. Browser preview and game-scene QA must be reviewed before promotion beyond this isolated draft.
"""
    DOC.parent.mkdir(parents=True, exist_ok=True)
    DOC.write_text(doc, encoding="utf-8")
    REPORT.write_text(json.dumps(metrics, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(metrics, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
