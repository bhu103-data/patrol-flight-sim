"""PATROL NYC — Scenario for Blender optional PBR authoring bridge.

Execute in Blender 5.0+: blender --background --python tools/blender/nyc_scenario_author.py --
    --source assets/nyc/times-square-footprints.json
    --output assets/nyc/generated/times-square-study.glb
    --materials tools/blender/scenario-material-inputs.json

The Scenario extension is not bundled or invoked automatically: generate
approved textures in its UI first, then place paths in the material map.
No API key is read by this script and no paid Scenario job is created.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon


PALETTES = {
    "limestone": (0.62, 0.59, 0.52, 1),
    "glass": (0.17, 0.30, 0.38, 1),
    "brick": (0.42, 0.29, 0.25, 1),
    "terracotta": (0.50, 0.35, 0.28, 1),
    "metal": (0.34, 0.38, 0.41, 1),
    "concrete": (0.47, 0.47, 0.45, 1),
}
LAYERS = tuple(PALETTES)


def parameters():
    user_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="assets/nyc/times-square-footprints.json")
    parser.add_argument("--output", default="assets/nyc/generated/times-square-study.glb")
    parser.add_argument("--materials", default="tools/blender/scenario-material-inputs.json")
    parser.add_argument("--height-scale", type=float, default=0.32)
    parser.add_argument("--limit", type=int, default=120)
    return parser.parse_args(user_args)


def geographic_to_game(lon, lat):
    # Two-point calibrated fictional map-space, *not* a survey transform.
    east = (lon + 73.9864883) * 84300.0
    north = (lat - 40.756421) * 110900.0
    game_x = 23.0 + 0.2611738439351339 * east - 0.1844443206835113 * north
    game_z = -47.5 + 0.1844443206835113 * east + 0.2611738439351339 * north
    return game_x, game_z


def make_material(name, settings, config_dir):
    mat = bpy.data.materials.new(name="PATROL_" + name.upper())
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = PALETTES[name]
    shader.inputs["Roughness"].default_value = 0.14 if name == "glass" else 0.70
    shader.inputs["Metallic"].default_value = 0.65 if name == "metal" else 0.0
    layer = settings.get(name, {})
    for channel, target in [("basecolor", "Base Color"), ("roughness", "Roughness"),
                            ("metallic", "Metallic"), ("normal", "Normal")]:
        path = layer.get(channel)
        if not path:
            continue
        filename = (config_dir / path).resolve()
        if not filename.is_file():
            raise FileNotFoundError("Scenario texture not found: " + str(filename))
        image = bpy.data.images.load(str(filename), check_existing=True)
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        node.label = f"Scenario {name} {channel}"
        if channel != "basecolor":
            image.colorspace_settings.name = "Non-Color"
        if channel == "normal":
            normal = mat.node_tree.nodes.new("ShaderNodeNormalMap")
            mat.node_tree.links.new(node.outputs["Color"], normal.inputs["Color"])
            mat.node_tree.links.new(normal.outputs["Normal"], shader.inputs["Normal"])
        else:
            mat.node_tree.links.new(node.outputs["Color"], shader.inputs[target])
    return mat


def create_footprint(record, material, height_scale, number):
    rings = record.get("rings", [])
    if len(rings) != 1:
        return None  # No accidental hole-filling of multi-ring polygons.
    src = rings[0]
    if not (4 <= len(src) <= 65):
        return None
    if abs(src[0][0] - src[-1][0]) + abs(src[0][1] - src[-1][1]) < 1e-8:
        src = src[:-1]
    # Blender is Z-up. PATROL uses X/Z horizontal, Y-up.
    # Positive winding in Blender XY gives outward wall normals.
    ring = [(x, -z) for x, z in (geographic_to_game(*p) for p in src)]
    area = sum(ring[i][0] * ring[(i + 1) % len(ring)][1] -
               ring[(i + 1) % len(ring)][0] * ring[i][1]
               for i in range(len(ring))) * 0.5
    if abs(area) < 0.015:
        return None
    if area < 0:
        ring.reverse()
    h = max(3.2, min(72.0, float(record["heightFt"]) * 0.3048 * height_scale))
    n = len(ring)
    vertices = [(x, y, 0) for x, y in ring] + [(x, y, h) for x, y in ring]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    triangle_sets = tessellate_polygon([[Vector((x, y, h)) for x, y in ring]])
    if not triangle_sets:
        return None
    for tri in triangle_sets:
        verts = [(p.x, p.y, p.z) for p in tri]
        a, b, c = verts
        winding = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
        base = len(vertices)
        vertices.extend(verts)
        faces.append(tuple(range(base, base + 3)) if winding >= 0
                     else (base, base + 2, base + 1))
    mesh = bpy.data.meshes.new(f"NYC_FID_{record['fid']}_LOD0")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(mesh.name, mesh)
    bpy.context.collection.objects.link(ob)
    mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="PATROL_Tile_UV")
    # Wall UV from world-space face perimeter; roof UV from x/y.
    for face in mesh.polygons:
        vert_ids = list(face.vertices)
        xyz = [mesh.vertices[i].co for i in vert_ids]
        if len(xyz) == 4:
            width = math.hypot(xyz[1].x - xyz[0].x, xyz[1].y - xyz[0].y) / 4.0
            for loop_id, uv in zip(face.loop_indices,
                                    [(0, 0), (width, 0), (width, h / 4), (0, h / 4)]):
                uv_layer.data[loop_id].uv = uv
        else:
            for loop_id in face.loop_indices:
                p = mesh.vertices[mesh.loops[loop_id].vertex_index].co
                uv_layer.data[loop_id].uv = (p.x / 4.0, p.y / 4.0)
    return ob


def run():
    args = parameters()
    if args.height_scale <= 0 or not 1 <= args.limit <= 200:
        raise ValueError("Unsafe LOD authoring scale or feature limit")
    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    material_config = Path(args.materials).resolve()
    data = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(data.get("features"), list):
        raise ValueError("Source must contain official NYC GIS features")
    settings = json.loads(material_config.read_text(encoding="utf-8"))
    if not isinstance(settings, dict):
        raise ValueError("Invalid Scenario material map")
    # Clean Blender's current empty authoring scene; no PATROL source touched.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    materials = {k: make_material(k, settings, material_config.parent)
                 for k in LAYERS}
    objects = []
    for row in data["features"][:args.limit]:
        fid = row.get("fid")
        if not isinstance(fid, int) or not 0 < row.get("heightFt", 0) < 2500:
            continue
        name = LAYERS[fid % len(LAYERS)]
        ob = create_footprint(row, materials[name], args.height_scale, len(objects))
        if ob:
            objects.append(ob)
    if not objects:
        raise RuntimeError("No valid official building footprints available")
    output.parent.mkdir(parents=True, exist_ok=True)
    # The GLB is an offline review/bake artifact until PATROL loader is upgraded
    # to ingest the custom mesh hierarchy and texture maps without duplicates.
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB",
                              export_yup=True, export_apply=True)
    print(f"PATROL Scenario-ready 3D study: {len(objects)} buildings => {output}")
    print("Review coordinates, legal provenance, roof normals and PBR before shipping.")


if __name__ == "__main__":
    run()
