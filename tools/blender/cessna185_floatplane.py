"""Original Cessna 185 floatplane study, metric-scale Blender GLB for PATROL.

Geometry is authored in metres. Source reference (AOPA):
https://www.aopa.org/news-and-media/all-news/2015/june/pilot/f_185
Dimensions: 7.8105 m length, 10.922 m wingspan, 2.362 m landplane height.
Floats are a modeled approximation (not a surveyed or manufacturer CAD mesh).
Blender is Z-up; exported glTF is Y-up, with +Z forward in PATROL.
No Cessna logos, copyrighted plans, or commercial proprietary assets.
"""
import argparse
import math
import sys
from pathlib import Path
import bpy

LENGTH=7.8105
SPAN=10.922
FLOAT_LENGTH=5.85
BODY_LENGTH=LENGTH

def material(name, rgb, metallic=0.0, roughness=0.55):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    bsdf=m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(*rgb,1)
    bsdf.inputs["Metallic"].default_value=metallic
    bsdf.inputs["Roughness"].default_value=roughness
    return m

def mesh(name,verts,faces,mat):
    obm=bpy.data.meshes.new(name)
    # game (x,y up,z forward) to Blender (x,-z, y up)
    obm.from_pydata([(x,-z,y) for x,y,z in verts],[],faces)
    obm.update()
    ob=bpy.data.objects.new(name,obm)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    for polygon in ob.data.polygons:
        polygon.use_smooth=len(polygon.vertices)>=3
    return ob

def loft(name,stations,mat,sides=12):
    # Each station: forward z, right radius, up radius, vertical center
    verts=[]
    for z,rx,ry,cy in stations:
        for n in range(sides):
            a=2*math.pi*n/sides
            verts.append((rx*math.cos(a),cy+ry*math.sin(a),z))
    faces=[]
    for j in range(len(stations)-1):
        for i in range(sides):
            a=j*sides+i;b=j*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple((len(stations)-1)*sides+i for i in range(sides))])
    return mesh(name,verts,faces,mat)

def box(name,c,size,mat):
    x,y,z=c;w,h,d=size
    verts=[(x+sx*w/2,y+sy*h/2,z+sz*d/2)
           for sz in (-1,1) for sy in (-1,1) for sx in (-1,1)]
    faces=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
    return mesh(name,verts,faces,mat)

def beam(name,start,end,r,mat,sides=10):
    ax,ay,az=start; bx,by,bz=end
    dx=bx-ax;dy=by-ay;dz=bz-az
    length=math.sqrt(dx*dx+dy*dy+dz*dz)
    if length<1e-5: return
    direction=(dx/length,dy/length,dz/length)
    cross=(0,1,0) if abs(direction[1])<0.94 else (1,0,0)
    u=(cross[1]*direction[2]-cross[2]*direction[1],
       cross[2]*direction[0]-cross[0]*direction[2],
       cross[0]*direction[1]-cross[1]*direction[0])
    norm=math.sqrt(sum(v*v for v in u))
    u=tuple(v/norm for v in u)
    v=(direction[1]*u[2]-direction[2]*u[1],
       direction[2]*u[0]-direction[0]*u[2],
       direction[0]*u[1]-direction[1]*u[0])
    verts=[]
    for p in (start,end):
        for i in range(sides):
            a=i*2*math.pi/sides
            verts.append(tuple(p[k]+r*(u[k]*math.cos(a)+v[k]*math.sin(a)) for k in range(3)))
    faces=[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    faces += [tuple(reversed(range(sides))),tuple(range(sides,2*sides))]
    return mesh(name,verts,faces,mat)

def wing(name,sign,mat):
    # High-wing Skywagon: actual half-span reaches 5.461m.
    root=0.54;tip=SPAN/2
    vertices=[]
    # Profiled ten-point airfoil and four-span stations keep the outboard
    # aileron taper readable close-up instead of a flat triangular wing.
    stations=((root,1.72,.69,.91),(2.00,1.59,.65,.96),
              (3.68,1.31,.44,1.045),(tip,1.02,.29,1.12))
    section=((0,.020),(.12,.073),(.37,.095),(.67,.073),(1,.011),
             (1,-.034),(.67,-.068),(.37,-.063),(.12,-.042),(0,-.019))
    n=len(section)
    for x,chord,lead,y in stations:
        for u,dy in section:
            vertices.append((sign*x,y+dy,lead-chord*u))
    faces=[]
    for i in range(len(stations)-1):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n
            faces.append((a,b,b+n,a+n))
    faces.extend([tuple(reversed(range(n))),
                  tuple(range((len(stations)-1)*n,len(stations)*n))])
    return mesh(name,vertices,faces,mat)

def float_hull(name,sign,mat):
    verts=[]
    cx=sign*1.27
    stations=[(-2.83,.03,-1.13),(-2.48,.42,-1.10),(-1.55,.51,-1.06),
              (-0.35,.51,-1.03),(0.15,.48,-1.00),(1.40,.43,-1.02),
              (2.42,.32,-1.01),(3.02,.03,-0.96)]
    # Fourteen-sided hydrodynamic section: curved bow cheeks, a true keel,
    # rounded gunwales and cambered deck. Flat seven-sided hulls looked boxy.
    section=((-0.88,.35),(-1.00,.17),(-1.00,-.05),(-.94,-.21),
             (-.75,-.38),(-.39,-.47),(0,-.50),(.39,-.47),
             (.75,-.38),(.94,-.21),(1.00,-.05),(1.00,.17),
             (.88,.35),(0,.44))
    n=len(section)
    for z,w,cy in stations:
        for px,py in section:
            verts.append((cx+w*px,cy+py,z))
    faces=[]
    for k in range(len(stations)-1):
        for j in range(n):
            a=k*n+j;b=k*n+(j+1)%n
            faces.append((a,b,b+n,a+n))
    faces.extend([tuple(reversed(range(n))),
                  tuple(range((len(stations)-1)*n,len(stations)*n))])
    return mesh(name,verts,faces,mat)


def propeller_blade(name,sign,mat,tip_mat):
    """Original tapered and pitched propeller blade, 1.08m radius each."""
    stations=((.13,.13,.005),(.30,.22,.016),(.50,.25,.023),
              (.72,.205,.015),(.91,.135,.002),(1.08,.045,-.010))
    verts=[]
    for radius,chord,pitch in stations:
        y=.07+sign*radius
        for x,z in ((-chord*.5,3.945+pitch), (chord*.5,3.945-pitch),
                    (-chord*.5,3.921+pitch),(chord*.5,3.921-pitch)):
            verts.append((x,y,z))
    faces=[]
    for i in range(len(stations)-1):
        a=i*4;b=(i+1)*4
        faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),
                      (a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    faces.extend([(0,1,3,2),
                  tuple((len(stations)-1)*4+i for i in (0,2,3,1))])
    mesh(name,verts,faces,mat)
    # Yellow tip stripe is embedded within the measured spinner envelope.
    box(name+" high visibility tip",(0,.07+sign*.993,3.947),
        (.091,.063,.045),tip_mat)

def run(output):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    white=material("warm white fuselage",(.82,.84,.81),.10,.48)
    silver=material("painted wing aluminum",(.67,.73,.76),.35,.33)
    navy=material("blue body stripe",(.075,.19,.31),.16,.39)
    glass=material("smoked cockpit glazing",(.095,.21,.28),.15,.13)
    float_mat=material("anodized float skin",(.48,.55,.59),.65,.31)
    black=material("propeller and rubber",(.075,.085,.10),.22,.46)
    red=material("safety marking",(.77,.24,.17),.09,.48)
    green=material("starboard position light",(.12,.66,.32),.08,.28)
    marker=material("etched seals and access panels",(.22,.28,.31),.12,.43)
    loft("Skywagon elliptical riveted fuselage",[
        (-3.69,.065,.075,.09),(-2.82,.37,.35,.04),(-1.35,.65,.71,.12),
        (.48,.72,.72,.13),(1.65,.58,.58,.10),(2.75,.40,.39,.07),
        (3.68,.11,.12,.035),(3.98,.035,.045,.02)],white,24)
    for side in (-1,1):
        wing("High wing 35ft10in "+str(side),side,silver)
        float_hull("Edo-style float "+str(side),side,float_mat)
        for z in (-1.45,1.45):
            beam("float strut "+str(side)+" "+str(z),(side*.95,-.16,z),
                 (side*1.27,-.68,z),.068,silver)
        beam("wing lift strut "+str(side),(side*.49,-.09,-.52),
             (side*3.30,1.02,-.20),.073,silver)
        box("float longitudinal chine "+str(side),(side*1.27,-1.37,.2),(.03,.035,4.35),silver)
        box("empennage "+str(side),(side*1.17,.38,-3.02),(1.98,.082,.74),silver)
        box("cockpit glazing "+str(side),(side*.67,.32,.46),(.045,.55,1.72),glass)
        box("wingtip enamel "+str(side),(side*5.34,1.13,-.19),(.19,.07,.85),green if side>0 else red)
        box("navigation lamp "+str(side),(side*5.435,1.155,.12),(.045,.075,.12),green if side>0 else red)
        # Separate thin flaps and aileron hinge breaks remain within the
        # manufacturer wingspan, and avoid huge featureless wing rectangles.
        box("inboard flap hinge "+str(side),(side*2.03,.959,-.77),(2.12,.030,.15),marker)
        box("outboard aileron hinge "+str(side),(side*4.21,1.11,-.47),(2.06,.025,.16),marker)
    # Skywagon shaped swept fin, not an architectural box. The extreme
    # aft point is the measured -3.755m length envelope.
    mesh("Skywagon shaped swept fin",[
        (-.055,.42,-2.70),(.055,.42,-2.70),
        (-.055,.45,-3.755),(.055,.45,-3.755),
        (-.050,2.035,-3.37),(.050,2.035,-3.37),
        (-.050,1.84,-3.755),(.050,1.84,-3.755)
    ],[(0,4,6,2),(1,3,7,5),(0,1,5,4),
       (2,6,7,3),(4,5,7,6),(0,2,3,1)],silver)
    box("rudder trailing edge",(0,1.18,-3.725),(.10,1.21,.051),navy)
    box("windscreen",(0,.53,1.31),(1.08,.59,.065),glass)
    box("front cowling stripe",(0,.19,2.94),(1.03,.115,.58),navy)
    for side in (-1,1):
        box("fuselage side blue stripe "+str(side),(side*.66,.03,-.38),(.052,.10,3.9),navy)
        beam("float cross brace "+str(side),(side*.48,-.70,0),(side*1.27,-.63,0),.055,silver)
        # Flush body glazing and slim rubber-frame door seals. The game
        # renderer currently uses solid shading, not real refractive glass.
        box("rear side glazing "+str(side),(side*.62,.36,-.82),(.055,.40,.70),glass)
        box("rear quarter glazing "+str(side),(side*.52,.30,-1.58),(.05,.30,.39),glass)
        box("cockpit door lower seal "+str(side),(side*.714,-.20,.45),(.022,.026,1.55),marker)
        box("cockpit door aft seal "+str(side),(side*.675,.06,-.40),(.026,.94,.032),marker)
        box("flush door latch "+str(side),(side*.725,-.21,.91),(.033,.065,.16),black)
        # Continuous float skins, individual access plates and aft water
        # rudders read clearly during a slow taxi without new textures.
        for station in (-1.75,-.15,1.35):
            box("float upper inspection hatch "+str(side)+" "+str(station),
                (side*1.27,-.585,station),(.43,.015,.53),marker)
        box("aft float water rudder "+str(side),
            (side*1.27,-1.47,-2.54),(.055,.18,.27),marker)
        beam("forward float reinforcement "+str(side),
             (side*.89,-.16,1.13),(side*1.27,-.70,1.73),.047,silver)
        # Close-range float fastener lines and deck perimeter seams. Only
        # small original opaque geometry is added, never image decals.
        for index in range(28):
            z=-2.28+index*.17
            box("float lower rivet "+str(side)+" "+str(index),
                (side*1.67,-1.10,z),(.022,.018,.021),silver)
            box("float upper rivet "+str(side)+" "+str(index),
                (side*1.60,-.66,z),(.017,.015,.017),marker)
        for index in range(20):
            z=-1.75+index*.16
            box("cabin sill fastener "+str(side)+" "+str(index),
                (side*.73,-.37,z),(.015,.020,.022),marker)
    # Aerodynamic propeller replaces two round pole blades. The spinner is
    # still the forward-most real dimension gate at +4.055m.
    yellow=material("propeller high visibility tip",(.93,.71,.19),.16,.44)
    propeller_blade("starboard propeller blade",1,black,yellow)
    propeller_blade("port propeller blade",-1,black,yellow)
    box("propeller spinner",(0,.07,3.925),(.30,.30,.26),float_mat)
    bpy.context.scene.unit_settings.system="METRIC"
    bpy.context.scene.unit_settings.scale_length=1
    out=Path(output).resolve()
    out.parent.mkdir(parents=True,exist_ok=True)
    # Keep a native editable Blender project as a short-lived Actions artifact.
    # GLB remains the sole published runtime asset, so the game stays small.
    editable=out.with_suffix(".blend")
    bpy.ops.wm.save_as_mainfile(filepath=str(editable),compress=True)
    if not editable.is_file() or editable.stat().st_size>8_000_000:
        raise RuntimeError("Editable Blender source is empty or exceeds 8 MB")
    print(f"PATROL editable C185 Blender scene: {editable.stat().st_size} bytes")
    bpy.ops.export_scene.gltf(filepath=str(out),export_format="GLB",
                              export_yup=True,export_apply=True)
    if out.stat().st_size>2_000_000:
        raise RuntimeError("Baked floatplane exceeded 2 MB budget")
    print(f"PATROL Blender C185 floatplane: {out.stat().st_size} bytes; wingspan {SPAN:.3f} m; fuselage {LENGTH:.3f} m")

if __name__=="__main__":
    arg=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="assets/aircraft/cessna185-floats.glb")
    run(parser.parse_args(arg).output)
