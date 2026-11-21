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
    # Muted limestone, sooty gray tile, weathered timber: less saturated than
    # the previous orange slabs. Photographic albedo still supplies grain.
    "concrete": ((.36, .34, .32, 1), .91, 0),
    "brick": ((.27, .27, .26, 1), .87, 0),
    "terracotta": ((.25, .27, .29, 1), .86, 0),
    "metal": ((.29, .32, .33, 1), .42, .58),
    "glass": ((.064, .089, .11, 1), .20, .15),
    "timber": ((.26, .18, .13, 1), .80, 0),
    "carving": ((.33, .22, .16, 1), .76, 0),
    "window_warm": ((.57, .38, .21, 1), .30, 0),
    "window_soft": ((.29, .21, .14, 1), .31, 0),
    "window_dark": ((.04, .065, .08, 1), .19, 0),
    "lantern": ((.62, .20, .085, 1), .55, 0),
    "eave_light": ((.78, .46, .22, 1), .43, 0),
}


def args_from_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="assets/chongqing/generated/hongyadong-study.glb")
    parser.add_argument("--materials", default="tools/blender/chongqing-material-inputs.json")
    parser.add_argument("--require-materials", action="store_true", help="Fail if approved PBR images are missing")
    parser.add_argument("--floors", type=int, default=11)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def material(name, color, roughness, metallic, settings, base_path, require_materials=False):
    m = bpy.data.materials.new("PATROL_" + name)
    m.use_nodes = True
    principled = m.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = color
    principled.inputs["Roughness"].default_value = roughness
    principled.inputs["Metallic"].default_value = metallic
    if name in ("window_warm", "window_soft", "lantern", "eave_light"):
        principled.inputs["Emission Color"].default_value = color
        principled.inputs["Emission Strength"].default_value = {
            "window_warm": .62, "window_soft": .20,
            "lantern": .65, "eave_light": .75
        }[name]
    layer = settings.get(name, {})
    if not isinstance(layer, dict):
        raise ValueError("Material config entry must be an object: " + name)
    for channel, input_name in (("basecolor", "Base Color"), ("roughness", "Roughness"),
                                ("metallic", "Metallic"), ("normal", "Normal")):
        filename = layer.get(channel)
        if not filename:
            continue
        texture_path = (base_path / filename).resolve()
        if texture_path.suffix.lower() not in (".jpg", ".jpeg", ".png", ".webp"):
            raise ValueError("Unapproved photo texture extension: " + str(texture_path))
        if not texture_path.is_file():
            if require_materials:
                raise FileNotFoundError("Missing approved PBR image: " + str(texture_path))
            print("CC0/Scenario photo absent; using offline fallback:", texture_path)
            continue
        if texture_path.stat().st_size > 4 * 1024 * 1024:
            raise ValueError("PBR photo exceeds 4 MiB: " + str(texture_path))
        image = bpy.data.images.load(str(texture_path), check_existing=True)
        image.pack()
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        tex.label = "Approved PBR " + channel
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
        """Curved, upward-cornered ceramic roof with realistic photo UV repeats.

        The ridge runs along X; six cross-slope subdivisions break the
        rigid two-plane appearance while staying under the GLB triangle budget.
        """
        cols, rows = 4, 6
        vertices, faces, uv_faces = [], [], []
        for row in range(rows + 1):
            v = row / rows
            cross = abs(2 * v - 1)
            # Gentle ceramic curvature, raised corners at the eaves.
            roofline = rise * (1 - cross**1.42)
            for col in range(cols + 1):
                u = col / cols
                corner = (abs(2*u-1)**6) * (cross**7) * rise * .23
                sag = (1 - (abs(2*u-1)**2)) * (1-cross**2) * rise * .05
                vertices.append((
                    x + (u-.5) * width,
                    y + (v-.5) * depth,
                    z + roofline + corner + sag
                ))
        for row in range(rows):
            for col in range(cols):
                a = row*(cols+1)+col
                b = a+1
                c = a+cols+1
                d = c+1
                faces.append((a,b,d,c))
                uv_faces.append([
                    (col/cols*width/3,row/rows*depth/3),
                    ((col+1)/cols*width/3,row/rows*depth/3),
                    ((col+1)/cols*width/3,(row+1)/rows*depth/3),
                    (col/cols*width/3,(row+1)/rows*depth/3)
                ])
        self.add(vertices, faces, material_id, uv_faces)

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
    """Compressed game-space, architecturally varied *study*, not a survey.

    Keep the 11 levels and the established X=155/Y=13/Z=112 game anchor.
    The river faces +Blender-Y, corresponding to -Three-Z after GLB export.
    The uninterrupted slab/copy-pasted roof stack has deliberately been
    replaced with irregular pavilion clusters and lighter carved galleries.
    """
    a = Architecture()
    mid = {name: index for index, name in enumerate(PALETTE)}
    level_height = 10.25

    # Asymmetrical X massing and stepped terraces: a cluster rather than one
    # uniformly tapering office block. Retreats remain within original
    # Hongyadong collision volumes at this study's scale.
    widths = [128, 125, 119, 122, 115, 112, 108, 102, 104, 93, 90]
    center_xs = [0, -1.4, -3, 0, 2.8, 2, 0, -2.4, -1.6, 1, 0]
    offsets = [0, -.3, 1, -.8, .9, .2, -1.1, .7, -.8, 0, 1.2]
    roof_levels = {0, 2, 3, 5, 7, 8, 10}

    # Each floor is actually three staggered stilt-house pavilions.
    # This breaks up the previous continuous 128 m-long, identical facades.
    wing_depth_offsets = (-2.25, 1.15, -.65)
    covered_wings = {
        0:(0,1,2), 2:(0,2), 3:(1,), 5:(0,1,2),
        7:(0,2), 8:(1,2), 10:(0,1,2)
    }

    for floor in range(floors):
        height = floor * level_height
        cx, width = center_xs[floor % 11], widths[floor % 11]
        center_depth = -floor * 8.3 + offsets[floor % 11]
        depth = 22.5
        wing_span = width / 3
        wing_width = wing_span - 1.75
        wings = []

        for wing in range(3):
            wx = cx + (wing-1)*wing_span
            wy = center_depth + wing_depth_offsets[wing]
            front = wy + depth/2 + .11
            wings.append((wx,wy,front))

            # Small genuine separation between neighboring masonry volumes;
            # photographic stone grain keeps the core from looking painted.
            a.block(wx,wy,height+level_height/2,wing_width,depth,
                    level_height-.15,mid["brick"])
            a.block(wx,front+1.0,height+.28,wing_width+1.1,2.1,.46,
                    mid["concrete"])
            a.block(wx,front+.75,height+level_height-.52,
                    wing_width+.5,1.25,.25,mid["carving"])

            # Independent room bays, with real setbacks and timber mullions.
            bay_count = 4 + ((wing+floor)%2)
            bay = (wing_width-2.8)/bay_count
            for n in range(bay_count):
                bx = wx-wing_width/2+1.4+(n+.5)*bay
                lit = (n*7+floor*11+wing*3)%13
                mat_window = (
                    "window_warm" if lit in (0,2,5,7) else
                    "window_soft" if lit in (3,9,11) else "window_dark"
                )
                a.block(bx,front+.035,height+4.55,bay-1.05,
                        .13,4.4,mid[mat_window],2.7)
                a.block(bx,front+.21,height+4.55,.13,.23,4.65,mid["timber"])
                a.block(bx,front+.24,height+2.27,bay-.73,.27,.16,
                        mid["carving"])
                a.block(bx,front+.20,height+6.81,bay-.70,.28,.20,
                        mid["timber"])
                if n==0 or (n+floor+wing)%4==0:
                    a.block(bx-bay/2-.10,front+1.35,height+4.85,
                            .42,2.9,9.5,mid["timber"])
                if (n+floor+wing)%5==0 and floor in (0,2,5,8,10):
                    a.block(bx,front+1.75,height+7.50,
                            .30,.35,.70,mid["lantern"])

            # Separate balcony rails: no full-width ribbon connecting the
            # pavilion gaps and no opaque 3 m-thick toy balcony slab.
            rail_y = front+2.52
            a.block(wx,rail_y,height+1.64,wing_width+1.0,
                    .15,.15,mid["metal"])
            for j in range(9):
                rx=wx-wing_width/2+j*wing_width/8
                a.block(rx,rail_y,height+1.13,.10,.13,1.0,mid["carving"])

            # Real load path of stilt-house galleries, including support piers.
            for post in (-.34,.34):
                a.block(wx+post*wing_width,front+1.75,height+3.0,
                        .60,.65,5.7,mid["timber"])

        for wing in covered_wings.get(floor,()):
            wx,wy,front=wings[wing]
            roof_z=height+level_height-.22+(wing%2)*.38
            roof_w=wing_width+3.1
            a.roof(wx,wy+1.55,roof_z,roof_w,depth+2.4,
                   2.30+((wing+floor)%3)*.35,mid["terracotta"])
            # Fine lower carved eave, warm cove lighting, bracket supports.
            a.block(wx,front+1.35,roof_z-.12,
                    roof_w+.2,.28,.16,mid["timber"])
            a.block(wx,front+1.43,roof_z-.27,
                    roof_w*.72,.14,.09,mid["eave_light"])
            for brace in (-.34,.34):
                a.block(wx+brace*roof_w,front+.80,roof_z-.92,
                        .35,1.35,1.50,mid["carving"])

        # Uncovered floors remain stepped, open-air decks with a few
        # asymmetrical shops instead of another full-size rooftop lid.
        if floor not in covered_wings:
            wing=(floor//2)%3
            wx,wy,front=wings[wing]
            roof_z=height+level_height+.08
            a.roof(wx,front-1.0,roof_z,wing_width*.67,11.5,1.76,
                   mid["terracotta"])
            a.block(wx,front+4.62,roof_z-.04,wing_width*.68,.30,.15,
                    mid["timber"])

    # Stone lower promenade ties this traditional facade to the embankment,
    # avoiding the appearance of a floating, low-poly cube.
    for bay in range(7):
        bx=-58+bay*19.3
        for side in (-1,1):
            a.block(bx+side*7.2,15.6,4.7,1.75,2.0,9.3,mid["concrete"])
        a.block(bx,15.6,9.52,16.3,2.2,.48,mid["concrete"])

    # Distinct rooftop pavilion, below an actual curved black tile canopy.
    height = floors*level_height
    top_center_depth = -(floors-1)*8.3
    a.block(-2.4,top_center_depth-3.4,height+1.1,29,16,2.2,
            mid["carving"])
    a.roof(-2.4,top_center_depth-3.4,height+2.2,
           33,20,3.25,mid["terracotta"])
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
    mats = [material(name,*values,settings,config.parent,options.require_materials)
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
