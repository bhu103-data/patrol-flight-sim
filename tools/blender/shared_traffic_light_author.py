"""Optional Blender staging/export for the shared Kenney traffic light.

Run in Blender 3.6+ or 4.x from the repository root:
  blender --background --python tools/blender/shared_traffic_light_author.py

The checked-in GLB is already a small, Blender-compatible CC0 source asset;
this script provides the reproducible Blender import/export path without
requiring Blender in CI or changing a live city loader.
"""
import bpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
src = ROOT / "assets/shared/kenney-traffic-light.glb"
dst = ROOT / "assets/shared/kenney-traffic-light-blender.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
for obj in bpy.context.scene.objects:
    if obj.type == "MESH":
        obj.select_set(True)
        obj.scale = (5.83, 5.83, 5.83)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.ops.export_scene.gltf(filepath=str(dst), export_format="GLB", export_apply=True)
print(f"Wrote {dst}")
