"""PATROL cinematic scene builder for Blender 4.2 LTS.

Offline, reproducible authoring pass for the two supported aircraft:
the existing Cessna 185 floatplane and one procedural patrol jet.  It builds
two selectable presets: NYC rain at sunset and Alaska fjord aurora.  The
script never downloads assets and never enables an unverified third-party
model; local GLBs are imported only when they already exist in the repo.

Usage:
  blender-4.2 --background --python tools/blender/patrol_cinematic_scene.py -- \
    --preset nyc --output artifacts/patrol-nyc.blend --render
  blender-4.2 --background --python tools/blender/patrol_cinematic_scene.py -- \
    --preset alaska --output artifacts/patrol-alaska.blend --render
"""
from __future__ import annotations
import argparse, math, random, sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
AIRCRAFT = ROOT / "assets" / "aircraft" / "cessna185-floats.glb"
OUT = ROOT / "artifacts" / "blender"

def mat(name, color, metallic=0.0, rough=0.5, emission=None, strength=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value = (*color, 1)
    bs.inputs["Metallic"].default_value = metallic
    bs.inputs["Roughness"].default_value = rough
    if emission:
        bs.inputs["Emission Color"].default_value = (*emission, 1)
        bs.inputs["Emission Strength"].default_value = strength
    return m

def cube(name, loc, scale, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=loc); o = bpy.context.object; o.name = name
    o.scale = scale; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        mod = o.modifiers.new("micro edge wear", "BEVEL"); mod.width = bevel; mod.segments = 2
    return o

def cyl(name, loc, radius, depth, material, vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.object; o.name = name; o.data.materials.append(material); return o

def look_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def clean():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.curves, bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for block in list(datablocks):
            if block.users == 0: datablocks.remove(block)

def setup_cycles():
    s = bpy.context.scene; s.render.engine = 'CYCLES'
    s.cycles.samples = 96; s.cycles.use_denoising = True; s.cycles.max_bounces = 6
    s.render.resolution_x = 1280; s.render.resolution_y = 720; s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'FFMPEG'; s.render.ffmpeg.format = 'MPEG4'
    s.render.ffmpeg.codec = 'H264'; s.render.ffmpeg.constant_rate_factor = 'MEDIUM'
    s.render.fps = 24; s.frame_start = 1; s.frame_end = 240
    # Prefer CUDA/OptiX/HIP when Blender exposes one; CPU remains a valid fallback.
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for device_type in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI'):
            try:
                prefs.compute_device_type = device_type
                devices = prefs.get_devices()
                if any(getattr(d, 'use', False) for d in devices):
                    s.cycles.device = 'GPU'; return device_type
            except Exception: pass
    except Exception: pass
    s.cycles.device = 'CPU'; return 'CPU'

def setup_world(kind):
    w = bpy.context.scene.world or bpy.data.worlds.new('PATROL World'); bpy.context.scene.world = w
    w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground')
    if kind == 'nyc': bg.inputs['Color'].default_value = (0.055, 0.075, 0.13, 1); bg.inputs['Strength'].default_value = 0.22
    else: bg.inputs['Color'].default_value = (0.008, 0.018, 0.045, 1); bg.inputs['Strength'].default_value = 0.18
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    # Filmic-compatible high contrast is available in Blender 4.2.
    bpy.context.scene.view_settings.look = 'AgX - Medium High Contrast'

def add_sun(kind):
    bpy.ops.object.light_add(type='SUN', location=(-40, 80, 40)); sun = bpy.context.object
    sun.name = 'warm sunset key' if kind == 'nyc' else 'cold moon key'; sun.data.energy = 3.0 if kind == 'nyc' else 0.9
    sun.data.angle = math.radians(8); sun.rotation_euler = (math.radians(28), math.radians(-32), math.radians(-35 if kind == 'nyc' else 120))
    sun.data.color = (1.0, .34, .12) if kind == 'nyc' else (.25, .38, 1.0)
    bpy.ops.object.light_add(type='AREA', location=(0, 38, -24)); fill = bpy.context.object
    fill.data.energy = 1200 if kind == 'nyc' else 500; fill.data.shape='DISK'; fill.data.size=30
    fill.data.color = (1.0, .16, .07) if kind == 'nyc' else (.10, .30, 1.0); look_at(fill, (0, 0, 0))

def add_water(kind):
    water = mat('rain-dark water' if kind == 'nyc' else 'fjord black water', (.025,.055,.075) if kind=='nyc' else (.008,.025,.055), .65, .12)
    cube('water surface', (0,-1.0,0), (120,.08,120), water)
    # Wide shallow ripples; keep them lightweight for Cycles.
    ripple = mat('wet highlights', (.08,.16,.19), .35, .2)
    for i in range(40):
        a = i * 0.77; r = 8 + (i % 10) * 7
        o = cyl('water ripple', (math.sin(a)*r,-.87,math.cos(a)*r), .18+(i%4)*.04, .025, ripple, 16)
        o.scale.x = 5 + (i%3); o.scale.y = .3

def add_skyline():
    concrete = mat('wet concrete', (.11,.13,.16), 0.05, .42)
    glass = mat('rainy blue glass', (.04,.14,.22), .35, .12)
    rooftop = mat('roof tar', (.035,.04,.045), .0, .82)
    random.seed(17)
    for i in range(46):
        x = (i%12-5.5)*10 + random.uniform(-2,2); z = (i//12-1.5)*12 + random.uniform(-2,2)
        h = random.uniform(5, 25) if i != 8 else 48
        cube('NYC facade %02d'%i, (x,h/2,z), (random.uniform(2.5,4.5),h/2,random.uniform(2.5,4.5)), concrete, .18)
        for row in range(max(1,int(h/3))):
            cube('window band', (x, 2.2+row*3.0, z-4.05), (1.3,.28,.035), glass)
        cube('roof', (x,h+.1,z), (3.6,.12,3.6), rooftop)

def add_fjord():
    rock = mat('fjord rock', (.10,.13,.17), .0, .92)
    snow = mat('snow caps', (.52,.65,.78), .0, .68)
    for side in (-1,1):
        for i in range(10):
            x = side*(26+i*8); z = (i%5-2)*18
            h = 13 + (i%4)*6
            c = cube('fjord cliff', (x,h/2,z), (5+1.5*(i%3),h/2,7+2*(i%2)), rock, .8)
            c.rotation_euler[1] = math.radians((i%3-1)*8)
            cube('snow shelf', (x, h+.5, z), (max(2,4-i*.1), .7, max(2,6-i*.1)), snow, .35)

def add_rain():
    rain = mat('rain streaks', (.42,.68,1.0), .05, .05, (.20,.38,1.0), .6)
    random.seed(3)
    for i in range(700):
        x=random.uniform(-75,75); y=random.uniform(0,70); z=random.uniform(-75,75)
        bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=.012, depth=random.uniform(.25,.65), location=(x,y,z))
        o=bpy.context.object; o.name='rain'; o.data.materials.append(rain); o.rotation_euler[0]=math.radians(10)

def add_aurora():
    aur = mat('aurora emission', (.01,.2,.12), .0, .2, (.04,1.0,.28), 5.0)
    for band in range(5):
        cu=bpy.data.curves.new('aurora curtain','CURVE'); cu.dimensions='3D'; cu.bevel_depth=.10; cu.bevel_resolution=2
        sp=cu.splines.new('POLY'); sp.points.add(24)
        for i,p in enumerate(sp.points):
            x=-85+i*7; p.co=(x, 28+band*2+6*math.sin(i*.55+band), -38+band*18, 1)
        ob=bpy.data.objects.new('aurora ribbon',cu); bpy.context.collection.objects.link(ob); ob.data.materials.append(aur)

def add_aircraft():
    if AIRCRAFT.exists():
        try:
            bpy.ops.import_scene.gltf(filepath=str(AIRCRAFT))
            root = bpy.context.selected_objects[0] if bpy.context.selected_objects else bpy.context.object
            if root: root.name = 'AIRCRAFT_01_Cessna185_Floatplane'; root.location=(0,4,0); root.rotation_euler=(0,0,math.radians(90))
        except Exception as e: print('WARN: floatplane import failed:', e)
    aluminum=mat('patrol jet paint',(.16,.19,.24),.65,.22); canopy=mat('jet canopy',(.015,.045,.08),.5,.08)
    fus=cube('AIRCRAFT_02_PatrolJet',(18,8,-8),(5.5,.7,1.0),aluminum,.35); fus.rotation_euler[1]=math.radians(5)
    for s in (-1,1):
        wing=cube('jet wing',(18+s*2.7,7.95,-8),(2.7,.12,.45),aluminum,.12); wing.rotation_euler[1]=math.radians(s*16)
    cube('jet canopy',(18,8.65,-7.3),(1.25,.32,.65),canopy,.3)
    # Cinematic aircraft motion: hover/bank only; no destructive physics.
    for o in [fus]:
        o.keyframe_insert('location',frame=1,index=1); o.location.y+=.6; o.keyframe_insert('location',frame=120,index=1)
        o.location.y-=.6; o.keyframe_insert('location',frame=240,index=1)

def add_camera(kind):
    bpy.ops.object.camera_add(location=(52,24,58) if kind=='nyc' else (62,26,72))
    cam=bpy.context.object; cam.name='Cinematic camera'; cam.data.lens=48 if kind=='nyc' else 42
    look_at(cam,(0,10,0)); bpy.context.scene.camera=cam

def add_compositor():
    s=bpy.context.scene; s.use_nodes=True; n=s.node_tree.nodes; n.clear()
    rl=n.new('CompositorNodeRLayers'); glare=n.new('CompositorNodeGlare'); glare.glare_type='FOG_GLOW'; glare.quality='HIGH'; glare.threshold=.7; glare.size=7
    glare.mix=.0; comp=n.new('CompositorNodeComposite'); s.node_tree.links.new(rl.outputs['Image'],glare.inputs['Image']); s.node_tree.links.new(glare.outputs['Image'],comp.inputs['Image'])

def build(preset):
    clean(); setup_world(preset); engine=setup_cycles(); add_sun(preset); add_water(preset)
    if preset=='nyc': add_skyline(); add_rain()
    else: add_fjord(); add_aurora()
    add_aircraft(); add_camera(preset); add_compositor()
    s=bpy.context.scene; s.render.filepath=str(OUT / (preset+'_rain_aurora.mp4' if preset=='alaska' else preset+'_rain_sunset.mp4'))
    s['PATROL_aircraft_count']=2; s['PATROL_preset']=preset; s['PATROL_cycles_device']=engine
    return engine

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--preset',choices=['nyc','alaska'],default='nyc'); ap.add_argument('--output',default='artifacts/blender/patrol-cinematic.blend'); ap.add_argument('--render',action='store_true'); a=ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    OUT.mkdir(parents=True,exist_ok=True); engine=build(a.preset)
    output=Path(a.output).resolve(); output.parent.mkdir(parents=True,exist_ok=True); bpy.ops.wm.save_as_mainfile(filepath=str(output))
    if a.render: bpy.ops.render.render(animation=True)
    print(f'PATROL cinematic scene ready: {output} preset={a.preset} cycles_device={engine} aircraft=2 render={a.render}')

if __name__=='__main__': main()
