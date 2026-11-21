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
    for x,chord,lead,y in ((root,1.72,0.69,0.91),(2.6,1.48,0.60,0.99),(tip,1.02,0.29,1.12)):
        for z,dy in ((lead,0.04),(lead-chord*0.28,0.11),(lead-chord,0.025),
                     (lead-chord,-0.055),(lead-chord*0.28,-0.074),(lead,-0.055)):
            vertices.append((sign*x,y+dy,z))
    faces=[]
    for i in range(2):
        for j in range(6):
            a=i*6+j;b=i*6+(j+1)%6
            faces.append((a,b,b+6,a+6))
    faces.extend([tuple(reversed(range(6))),tuple(range(12,18))])
    return mesh(name,vertices,faces,mat)

def float_hull(name,sign,mat):
    verts=[]
    cx=sign*1.27
    stations=[(-2.83,.03,-1.13),(-2.48,.42,-1.10),(-1.55,.51,-1.06),
              (-0.35,.51,-1.03),(0.15,.48,-1.00),(1.40,.43,-1.02),
              (2.42,.32,-1.01),(3.02,.03,-0.96)]
    for z,w,cy in stations:
        for px,py in ((-1,-.04),(-.72,-.37),(0,-.48),(.72,-.37),(1,-.04),(.82,.42),(-.82,.42)):
            verts.append((cx+w*px,cy+py,z))
    faces=[]
    for k in range(len(stations)-1):
        for j in range(7):
            a=k*7+j;b=k*7+(j+1)%7
            faces.append((a,b,b+7,a+7))
    faces.extend([tuple(reversed(range(7))),tuple(range((len(stations)-1)*7,len(stations)*7))])
    return mesh(name,verts,faces,mat)

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
    loft("Skywagon elliptical riveted fuselage",[
        (-3.69,.065,.075,.09),(-2.82,.37,.35,.04),(-1.35,.65,.71,.12),
        (.48,.72,.72,.13),(1.65,.58,.58,.10),(2.75,.40,.39,.07),
        (3.68,.11,.12,.035),(4.1205,.035,.045,.02)],white,16)
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
        box("red wingtip marking "+str(side),(side*5.34,1.13,-.19),(.19,.07,.85),red)
    # Straight fixed vertical fin, rudder, and glazing panels.
    box("vertical stabilizer",(0,1.11,-3.23),(.10,1.85,1.05),silver)
    box("rudder accent",(0,1.47,-3.60),(.12,.77,.18),navy)
    box("windscreen",(0,.53,1.31),(1.08,.59,.065),glass)
    box("front cowling stripe",(0,.19,2.94),(1.03,.115,.58),navy)
    for side in (-1,1):
        box("fuselage side blue stripe "+str(side),(side*.66,.03,-.38),(.052,.10,3.9),navy)
        beam("float cross brace "+str(side),(side*.48,-.70,0),(side*1.27,-.63,0),.055,silver)
    beam("propeller vertical blade",(0,.07,4.12),(0,1.15,4.12),.09,black)
    beam("propeller opposing blade",(0,.07,4.12),(0,-1.01,4.12),.09,black)
    box("propeller spinner",(0,.07,4.24),(.30,.30,.27),float_mat)
    bpy.context.scene.unit_settings.system="METRIC"
    bpy.context.scene.unit_settings.scale_length=1
    out=Path(output).resolve()
    out.parent.mkdir(parents=True,exist_ok=True)
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
