#!/usr/bin/env python3
"""Offline CPU-only staged conversion. Requires Blender 4.x; never activates PATROL."""
import bpy
import json
import sys
import tempfile
import subprocess
from pathlib import Path

import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) != 2:
    raise SystemExit("Usage: blender -b --python tools/nyc/bake-liberty-cc0.py -- source.glb output.glb")
src, dst = (Path(p).resolve() for p in argv)
if not src.is_file():
    raise SystemExit("Missing authorized source GLB")
dst.parent.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
parts = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.data.polygons]
if not parts:
    raise RuntimeError("Original GLB contains no mesh")

bpy.ops.object.select_all(action='DESELECT')
for part in parts:
    part.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
obj = bpy.context.object
obj.name = "PATROL_LIBERTY_CC0_ATLAS"
source_triangles = sum(max(0, len(p.vertices) - 2) for p in obj.data.polygons)
if not 50000 <= source_triangles <= 70000:
    raise RuntimeError("Unexpected original topology: " + str(source_triangles))

# Ensure source image nodes keep the ORIGINAL UVs when bake atlas UV becomes active.
original_uv = obj.data.uv_layers.active
if original_uv is None:
    raise RuntimeError("Original has no source UVs; refusing to discard its textures")
for mat in obj.data.materials:
    if not mat:
        continue
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    for tex in [n for n in nodes if n.type == 'TEX_IMAGE' and n.image]:
        if not tex.inputs['Vector'].is_linked:
            uv = nodes.new('ShaderNodeUVMap')
            uv.uv_map = original_uv.name
            links.new(uv.outputs['UV'], tex.inputs['Vector'])

# Collapse geometry before baking, so UV seams follow the final LOD.
modifier = obj.modifiers.new("PATROL_CPU_DECIMATE", "DECIMATE")
modifier.ratio = min(0.98, 24400 / source_triangles)
modifier.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=modifier.name)
triangles = sum(max(0, len(p.vertices) - 2) for p in obj.data.polygons)
if not (1000 <= triangles <= 25000):
    raise RuntimeError("Decimation missed 25k budget: " + str(triangles))

atlas_uv = obj.data.uv_layers.new(name="PATROL_BASECOLOR_ATLAS")
obj.data.uv_layers.active = atlas_uv
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(island_margin=0.012)
bpy.ops.object.mode_set(mode='OBJECT')
obj.data.uv_layers.active = atlas_uv
atlas_uv.active_render = True

# Sample the original tiled UVs and the newly packed UVs on the actual
# decimated triangles. Cycles DIFFUSE baking returned a black 1024px image in
# earlier CI runs, so software-rasterize the *source* PNGs instead.
source_layer = obj.data.uv_layers.get(original_uv.name)
atlas_layer = obj.data.uv_layers.get("PATROL_BASECOLOR_ATLAS")
if not source_layer or not atlas_layer:
    raise RuntimeError("Source or target UV layer disappeared after decimation")
obj.data.calc_loop_triangles()
face_tris = obj.data.loop_triangles
source_coords = np.array([
    [tuple(source_layer.data[loop].uv) for loop in tri.loops]
    for tri in face_tris], dtype=np.float32)
atlas_coords = np.array([
    [tuple(atlas_layer.data[loop].uv) for loop in tri.loops]
    for tri in face_tris], dtype=np.float32)
material_indices = np.array([
    obj.data.polygons[tri.polygon_index].material_index
    for tri in face_tris], dtype=np.int32)
material_names = np.array([m.name for m in obj.data.materials])
atlas_file = dst.with_suffix(".atlas.png")
with tempfile.TemporaryDirectory(prefix="patrol-liberty-uv-") as temp:
    mapping = Path(temp) / "liberty-uv-mapping.npz"
    np.savez_compressed(mapping, sourceUV=source_coords, atlasUV=atlas_coords,
        materialIds=material_indices, materialNames=material_names)
    subprocess.run([
        "/usr/bin/python3",
        str(Path(__file__).with_name("rasterize-liberty-colors.py")),
        str(src), str(mapping), str(atlas_file)
    ], check=True)
image = bpy.data.images.load(str(atlas_file), check_existing=False)
if atlas_file.stat().st_size > 4194304:
    raise RuntimeError("Embedded atlas exceeds PATROL's 4 MiB texture limit")

# One supported Base Color atlas only: no per-material bitmap multiplexing.
material = bpy.data.materials.new("Innerscene_CC0_Patrol_Baked_Color")
material.use_nodes = True
bsdf = material.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Metallic"].default_value = 0.0
bsdf.inputs["Roughness"].default_value = 0.88
color = material.node_tree.nodes.new("ShaderNodeTexImage")
color.image = image
material.node_tree.links.new(color.outputs["Color"], bsdf.inputs["Base Color"])
obj.data.materials.clear()
obj.data.materials.append(material)
for poly in obj.data.polygons:
    poly.material_index = 0

# The original UV survives the bake only to sample source textures. Blender's
# glTF exporter otherwise writes the new atlas as TEXCOORD_1. PATROL's
# native WebGL2 loader intentionally permits only TEXCOORD_0.
for layer in list(obj.data.uv_layers):
    if layer.name != "PATROL_BASECOLOR_ATLAS":
        obj.data.uv_layers.remove(layer)
obj.data.uv_layers.active = obj.data.uv_layers.get("PATROL_BASECOLOR_ATLAS")
obj.data.uv_layers.active.active_render = True

bpy.ops.export_scene.gltf(
    filepath=str(dst), export_format='GLB', use_selection=True,
    export_texcoords=True, export_normals=True, export_yup=True)
bytes_out = dst.stat().st_size
if bytes_out > 8388608:
    raise RuntimeError("GLB exceeds PATROL's 8 MiB limit: " + str(bytes_out))
report = {
    "input": src.name, "sourceTriangles": source_triangles,
    "outputTrianglesBeforeGLTFExport": triangles,
    "outputBytes": bytes_out, "atlasBytes": atlas_file.stat().st_size,
    "output": str(dst),
    "bakedCPUOnly": True, "productionManifestActivated": False,
    "note": "Original authored CC0 reconstruction; not a scan or surveyed exact model."
}
(dst.parent.parent.parent.parent / "artifacts/nyc-liberty").mkdir(parents=True, exist_ok=True)
reportfile = dst.parent.parent.parent.parent / "artifacts/nyc-liberty/blender-report.json"
reportfile.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print("PATROL_LIBERTY_BAKE " + json.dumps(report))
