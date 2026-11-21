"""Export an approved Scenario-for-Blender landmark into PATROL's optional GLB path.

Run inside Blender 5.0+: blender -b PATROL.blend --python tools/scenario_blender_export.py -- \
    --asset trade --collection PATROL_EXPORT --license "Original Scenario-generated asset"

Does not call the Scenario API or access credentials; paid generation takes place separately
through the official Blender extension with explicit user approval.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import struct
import sys

import bpy


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets" / "nyc" / "scenario-manifest.json"
ALLOWED = {"liberty", "trade", "empire", "chrysler", "flatiron", "times"}


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--asset", required=True, choices=sorted(ALLOWED))
    parser.add_argument("--collection", default="PATROL_EXPORT")
    parser.add_argument("--license", default="", help="Verified license or rights statement")
    parser.add_argument(
        "--activate", action="store_true",
        help="Only after visual and license review, enable this GLB in the public map"
    )
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def audit_glb(path: Path, max_bytes: int) -> int:
    """Verify the binary GLB container and indexed/non-indexed triangle budget."""
    size = path.stat().st_size
    if size > max_bytes or size < 40:
        raise ValueError(f"GLB must be between 40 and {max_bytes} bytes (got {size})")
    with path.open("rb") as file:
        header = file.read(20)
        magic, version, total, json_length, json_type = struct.unpack("<5I", header)
        if (magic, version, total, json_type) != (
            0x46546C67, 2, size, 0x4E4F534A
        ):
            raise ValueError("Invalid binary GLB 2.0 header")
        document = json.loads(file.read(json_length).decode("utf-8").rstrip(" \x00"))
    total_triangles = 0
    diffuse_images = set()
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4:
                raise ValueError("Only GLB triangle primitives can be imported")
            attrs = primitive["attributes"]
            accessor = primitive.get("indices", attrs.get("POSITION"))
            total_triangles += int(document["accessors"][accessor]["count"]) // 3
            material_id = primitive.get("material")
            material = (document.get("materials", [])[material_id]
                        if material_id is not None else {})
            diffuse = material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
            if diffuse is None:
                continue
            if diffuse.get("texCoord", 0) != 0 or diffuse.get("extensions", {}).get("KHR_texture_transform"):
                raise ValueError("Blender textures must use untransformed TEXCOORD_0")
            if "TEXCOORD_0" not in attrs:
                raise ValueError("Missing TEXCOORD_0 on a textured primitive")
            diffuse_images.add(diffuse["index"])
    if len(diffuse_images) > 1:
        raise ValueError("Bake all Base Color images into one texture atlas")
    if diffuse_images:
        texture_id = next(iter(diffuse_images))
        image_id = document["textures"][texture_id]["source"]
        image = document["images"][image_id]
        if image.get("mimeType") not in ("image/png", "image/jpeg") or "bufferView" not in image:
            raise ValueError("Base Color atlas must be an embedded PNG or JPEG")
        view = document["bufferViews"][image["bufferView"]]
        if view.get("buffer", 0) != 0 or view.get("byteLength", 0) > 4194304:
            raise ValueError("Embedded Base Color image exceeds 4 MiB")
    return total_triangles


def main() -> None:
    args = arguments()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    spec = manifest["landmarks"][args.asset]
    if args.activate and not args.license.strip():
        raise ValueError("--activate requires an explicit rights statement via --license")
    collection = bpy.data.collections.get(args.collection)
    if collection is None:
        raise ValueError(f"Create a Blender collection named {args.collection!r} first")
    objects = [obj for obj in collection.all_objects if obj.type == "MESH"]
    if not objects:
        raise ValueError("The export collection has no mesh objects")
    selected_names = {obj.name for obj in bpy.context.selected_objects}
    active_name = bpy.context.view_layer.objects.active.name if bpy.context.view_layer.objects.active else None
    target = ROOT / "assets" / "nyc" / spec["file"]
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            if bpy.context.view_layer.objects.get(obj.name) is None:
                raise ValueError(f"{obj.name} is outside the active View Layer")
            if obj.hide_get() or obj.hide_viewport:
                raise ValueError(f"Unhide {obj.name} before exporting")
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        # GLB is Y-up, as expected by PATROL. The native renderer supports
        # COLOR_0 plus ONE embedded Base Color PNG/JPEG atlas (TEXCOORD_0).
        # Bake all diffuse materials to one UV atlas before exporting.
        # Normal, metal and roughness textures are not yet imported.
        bpy.ops.export_scene.gltf(
            filepath=str(target), export_format="GLB",
            use_selection=True, export_apply=True, export_yup=True,
            export_materials="EXPORT", export_colors=True
        )
    finally:
        bpy.ops.object.select_all(action="DESELECT")
        for name in selected_names:
            obj = bpy.context.view_layer.objects.get(name)
            if obj is not None:
                obj.select_set(True)
        if active_name:
            bpy.context.view_layer.objects.active = bpy.context.view_layer.objects.get(active_name)

    triangles = audit_glb(target, int(manifest.get("max_glb_bytes", 8388608)))
    minimum = int(spec["min_triangles"])
    if triangles < minimum:
        raise ValueError(f"{triangles} triangles is below the {minimum} minimum")
    if triangles > 25000:
        raise ValueError(f"{triangles} triangles exceeds the browser runtime budget (25000)")
    if args.activate:
        spec["license"] = args.license.strip()
        spec["enabled"] = True
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({
        "asset": args.asset, "output": str(target.relative_to(ROOT)),
        "triangles": triangles, "bytes": target.stat().st_size,
        "activated": bool(args.activate),
        "note": "GLB must be checked in an actual browser before claiming visual fidelity",
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
