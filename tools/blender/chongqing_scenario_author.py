"""Deterministic Hongyadong architectural study for PATROL's Scenario/Blender pipeline.

Run with Blender 5.0+ from the repository root:
  blender -b --python tools/blender/chongqing_scenario_author.py -- \
    --output assets/chongqing/generated/hongyadong-study.glb

This is a LOCAL, review-only Blender model, not an accurate city scan and not
automatically loaded into the game. Optional Scenario PBR images are read from
a locally edited JSON material map. No Scenario API calls or paid generation.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import struct
import sys

import bpy

ROOT = Path(__file__).resolve().parents[2]
MAX_BYTES = 8 * 1024 * 1024
MAX_TRIANGLES = 25000
COLLECTION = "PATROL_EXPORT_CHONGQING"

# Linear RGB color choices are restrained and remain distinct without textures.
PALETTE = {
    "concrete": ((.43, .41, .38, 1), .94, 0),
    "brick": ((.30, .23, .20, 1), .89, 0),
    "terracotta": ((.24, .24, .25, 1), .78, 0),
    "metal": ((.35, .37, .39, 1), .39, .68),
    "glass": ((.09, .13, .16, 1), .21, .18),
    "timber": ((.21, .12, .085, 1), .77, 0),
    "window_warm": ((.77, .49, .22, 1), .32, 0),
    "window_dark": ((.075, .09, .12, 1), .22, 0),
    "lantern": ((.58, .065, .032, 1), .42, 0),
}


def args_from_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="assets/chongqing/generated/hongyadong-study.glb")
    parser.add_argument("--materials", default="tools/blender/scenario-material-inputs.json")
    parser.add_argument("--floors", type=int, default=11)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def material(name, color, roughness, metallic, settings, base_path):
    m = bpy.data.materials.new("PATROL_" + name)
    m.use_nodes = True
    principled = m.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if name in ("window_warm", "lantern"):
        principled.inputs["Emission Color"].default_value = color
        principled.inputs["Emission Strength"].default_value = .8 if name == "window_warm" else .45
    layer = settings.get(name, {})
    if not isinstance(layer, dict):
        raise ValueError("Material config entry must be an object: " + name)
    for channel, input_name in (("basecolor", "Base Color"), ("roughness", "Roughness"),
                                ("metallic", "Metallic"), ("normal", "Normal")):
        filename = layer.get(channel)
        if not filename:
            continue
        texture_path = (base_path / filename).resolve()
        if not texture_path.is_file():
            raise FileNotFoundError("Missing reviewed Scenario texture: " + str(texture_path))
        image = bpy.data.images.load(str(texture_path), check_existing=True)
        image.pack()
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.label = "Scenario " + channel
        if channel != "basecolor":
            image.colorspace_settings.name = "Non-Color"
        if channel == "normal":
            normal = m.node_tree.nodes.new("ShaderNodeNormalMap")
            m.node_tree.links.new(tex.outputs["Color"], normal.inputs["Color"])
            m.node_tree.links.new(normal.outputs["Normal"], principled.inputs["Normal"])
        else:
            m.node_tree.links.new(tex.outputs["Color"], principled.inputs[input_name])
    return m


class Architecture:
    """Single batched mesh with per-face UVs: no thousands of draw-call objects."""

    def __init__(self):
        self.verts = []
        self.faces = []
        self.ids = []
        self.uv_faces = []

    def block(self, x, y, z, width, depth, height, material_id, tile=4):
        if min(width, depth, height) <= 0:
            raise ValueError("Positive dimensions required")
        x0, x1 = x - width / 2, x + width / 2
        y0, y1 = y - depth / 2, y + depth / 2
        z0, z1 = z - height / 2, z + height / 2
        v = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),
             (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
        faces = [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),
                 (2,3,7,6),(3,0,4,7)]
        span = [(width,depth),(width,depth),(width,height),(depth,height),
                (width,height),(depth,height)]
        self.add(v,faces,material_id,
                 [[(0,0),(a/tile,0),(a/tile,b/tile),(0,b/tile)]
                  for a,b in span])

    def roof(self, x, y, z, width, depth, rise, material_id):
        # Two physically sloping ceramic planes (not a flat colored cube).
        v = [(x-width/2,y-depth/2,z),(x+width/2,y-depth/2,z),
             (x-width/2,y+depth/2,z),(x+width/2,y+depth/2,z),
             (x-width/2,y,z+rise),(x+width/2,y,z+rise)]
        self.add(v,[(0,1,5,4),(4,5,3,2)],material_id,
                 [[(0,0),(width/3,0),(width/3,depth/6),(0,depth/6)]]*2)

    def add(self, vertices, faces, material_id, uv):
        offset = len(self.verts)
        self.verts.extend(vertices)
        for face, coords in zip(faces, uv):
            self.faces.append(tuple(offset + index for index in face))
            self.ids.append(material_id)
            self.uv_faces.append(coords)

    def to_object(self, materials, collection):
        mesh = bpy.data.meshes.new("Hongyadong_Facade_GameScale_LOD0")
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.update(calc_edges=True)
        ob = bpy.data.objects.new(mesh.name, mesh)
        collection.objects.link(ob)
        for mat in materials:
            mesh.materials.append(mat)
        uv = mesh.uv_layers.new(name="UVMap")
        for polygon, mid, coords in zip(mesh.polygons, self.ids, self.uv_faces):
            polygon.material_index = mid
            for loop, coord in zip(polygon.loop_indices, coords):
                uv.data[loop].uv = coord
        return ob


def construct(floors):
    # GLB local X/Y/Z aligns with game X/Y/Z after Blender Y-up export:
    # blender X=game X, blender Z=game Y, blender Y=-game Z.
    # The manifest anchors this local mesh at game-space (155,13,112).
    # All dimensions are from the existing compressed PATROL corridor,
    # not surveyed metres or authoritative Chongqing coordinates.
    a = Architecture()
    labels = list(PALETTE)
    mid = {name: labels.index(name) for name in labels}
    level_height = 10.25
    for floor in range(floors):
        height = floor * level_height
        center_depth = -floor * 8.3  # inland: positive game Z
        width = 128 - floor * 4.1
        depth = 22.5
        a.block(0, center_depth, height+level_height/2, width, depth, level_height-.2, mid["brick"])
        # Continuous white masonry plinth/floor slab and cantilevered gallery.
        a.block(0, center_depth+depth/2+2.15, height+.30, width+3, 5.2, .48, mid["concrete"])
        a.block(0, center_depth+depth/2+2.6, height+level_height-.48, width+4, 4.7, .38, mid["timber"])
        # Regular timber posts, window bays, recesses and varied warm occupancy.
        number_bays = 18
        bay = (width-5)/number_bays
        for n in range(number_bays):
            bx = -width/2+2.5+(n+.5)*bay
            front = center_depth+depth/2+.11
            color = "window_warm" if (n*7+floor*11)%9 < 4 else "window_dark"
            a.block(bx,front+.04,height+3.3,bay-.7,.17,3.55,mid[color],3)
            a.block(bx,front+.15,height+8.12,bay-.36,.24,.22,mid["timber"])
            if n % 3 == 0:
                a.block(bx-bay/2,front+2.4,height+5.1,.31,4.3,9.2,mid["timber"])
                a.block(bx,front+4.48,height+1.19,bay*2.5,.14,.23,mid["metal"])
        # Articulated railings: thin separate horizontals and short metal balusters.
        front = center_depth+depth/2+4.6
        a.block(0,front,height+1.35,width+2,.17,.16,mid["metal"])
        for n in range(52):
            x = -width/2+n*(width/51)
            a.block(x,front,height+.87,.105,.13,1.00,mid["metal"])
        # Each level has a real sloped multi-bay roof section.
        if floor in (2,5,8,floors-1):
            for lane in range(4):
                xx = -width/2+(lane+.5)*width/4
                a.roof(xx,center_depth,height+level_height,width/4+.85,depth+4,2.3,mid["terracotta"])
    # Rooftop stepped silhouette rather than an isolated low-poly block.
    top = floors*level_height
    upper_center = -(floors-1)*8.3
    a.block(0,upper_center-5,top+1.15,35,17,2.3,mid["timber"])
    a.roof(0,upper_center-5,top+2.3,38,20,4.0,mid["terracotta"])
    return a


def run():
    options = args_from_cli()
    if not 8 <= options.floors <= 15:
        raise ValueError("Floor count must be 8–15")
    config = (ROOT / options.materials).resolve()
    output = (ROOT / options.output).resolve()
    if not config.is_file():
        raise FileNotFoundError(config)
    if not output.is_relative_to(ROOT / "assets" / "chongqing"):
        raise ValueError("Output must be under assets/chongqing/")
    settings = json.loads(config.read_text(encoding="utf-8"))
    if not isinstance(settings, dict):
        raise ValueError("Material input map must be an object")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    collection = bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(collection)
    mats = [material(name,*values,settings,config.parent)
            for name,values in PALETTE.items()]
    author = construct(options.floors)
    triangle_count = sum(len(face)-2 for face in author.faces)
    if triangle_count > MAX_TRIANGLES:
        raise ValueError(f"Triangle budget exceeded: {triangle_count}")
    model = author.to_object(mats,collection)
    bpy.ops.object.select_all(action="DESELECT")
    model.select_set(True)
    bpy.context.view_layer.objects.active = model
    output.parent.mkdir(parents=True,exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB",
                              use_selection=True, export_yup=True,
                              export_materials="EXPORT")
    with output.open("rb") as fh:
        magic, version, size = struct.unpack("<III", fh.read(12))
    if magic != 0x46546c67 or version != 2 or size != output.stat().st_size:
        raise ValueError("Export is not a valid GLB 2.0 container")
    if output.stat().st_size > MAX_BYTES:
        raise ValueError("Export exceeds 8 MiB budget")
    print(json.dumps({"study_only":True,"triangles":triangle_count,
                      "bytes":output.stat().st_size,
                      "asset":str(output.relative_to(ROOT)),
                      "collection":COLLECTION,
                      "note":"Not loaded in public game until rights, placement and GPU review."}))


if __name__ == "__main__":
    run()
