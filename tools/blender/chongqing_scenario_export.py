"""PATROL Chongqing: validate and export a *reviewed* Scenario for Blender mesh.

This is a Blender bpy script, not an implementation of the Scenario extension.
Run from an authorised local Blender scene after creating art in the official
Scenario plugin. It performs NO cloud API calls and spends NO Scenario credits.
"""
import argparse
import json
import struct
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
ASSETS = {"hongyadong", "qiansimen", "raffles", "liziba"}
GLB_LIMIT = 8 * 1024 * 1024
TRIANGLE_LIMIT = 25000


def parse_args():
    extra = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser(description="Export reviewed PATROL Chongqing GLB")
    p.add_argument("--asset", required=True, choices=sorted(ASSETS))
    p.add_argument("--collection", default="PATROL_CQ_EXPORT")
    p.add_argument("--license", default="", help="Actual commercial redistribution license")
    p.add_argument("--reviewed", action="store_true")
    p.add_argument("--activate", action="store_true", help="Enable the PREVIEW slot only")
    return p.parse_args(extra)


def collection_meshes(name):
    collection = bpy.data.collections.get(name)
    if not collection:
        raise RuntimeError(f"Collection {name!r} is missing in the open Blender scene")
    meshes = [o for o in collection.all_objects if o.type == "MESH"]
    if not meshes:
        raise RuntimeError("PATROL_CQ_EXPORT must contain mesh geometry")
    return meshes


def validate_glb(path):
    with path.open("rb") as f:
        header = f.read(12)
    if len(header) != 12:
        raise RuntimeError("GLB header truncated")
    magic, version, declared = struct.unpack("<4sII", header)
    if magic != b"glTF" or version != 2 or declared != path.stat().st_size:
        raise RuntimeError("Invalid GLB 2.0 header, version or length")
    if declared > GLB_LIMIT:
        raise RuntimeError("GLB exceeds 8 MiB GPU/download budget")
    return declared


def run():
    args = parse_args()
    if args.activate and (not args.reviewed or not args.license.strip()):
        raise SystemExit("Activating preview requires --reviewed and --license")
    collection = collection_meshes(args.collection)
    triangle_count = sum(max(0, len(face.vertices) - 2)
                         for obj in collection for face in obj.data.polygons)
    if not 200 <= triangle_count <= TRIANGLE_LIMIT:
        raise RuntimeError(
            f"Mesh triangles must be within 200..{TRIANGLE_LIMIT}; got {triangle_count}")
    # Production export must be centered and Y-up. Blender->GLB converter
    # changes Z-up into glTF Y-up; do not rotate the scene again at runtime.
    for obj in collection:
        if any(abs(v) > 3000 for v in obj.location):
            raise RuntimeError(f"Unbounded local mesh transform: {obj.name}")
        if any(v <= 0 for v in obj.scale):
            raise RuntimeError(f"Negative/mirrored scale: {obj.name}")
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = collection[0]
    folder = ROOT / "assets" / "chongqing" / "scenario"
    folder.mkdir(parents=True, exist_ok=True)
    output = folder / (args.asset + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=str(output), export_format="GLB", export_yup=True,
        use_selection=True, export_texcoords=True, export_normals=True,
        export_materials="EXPORT", export_animations=False)
    size = validate_glb(output)
    manifest_file = ROOT / "assets" / "chongqing" / "scenario-manifest.json"
    manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    entry = next(x for x in manifest["entries"] if x["id"] == args.asset)
    if args.activate:
        # This only enables ?scenarioPreview=1. The original landmark geometry
        # and collisions remain untouched until separately replaced/tested.
        entry["enabled"] = True
        entry["license"] = args.license.strip()
        manifest_file.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8")
    print(json.dumps({
        "asset": args.asset, "path": str(output.relative_to(ROOT)),
        "triangles": triangle_count, "bytes": size,
        "preview_enabled": bool(args.activate),
        "production_replacement": False,
        "licensed": bool(entry.get("license")),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    run()
