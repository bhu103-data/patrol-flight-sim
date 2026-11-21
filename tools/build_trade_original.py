"""Reproducibly generate an ORIGINAL One World Trade Center GLB for PATROL.
This is procedural architecture modeled from published SOM design dimensions:
61m square base, eight twisted/triangular planes, rotated-square crown,
417m parapet, 541m total height. Not Scenario cloud-generated or a 1:1 scan.

Usage: python tools/build_trade_original.py
Dependencies: numpy, pillow, trimesh
Output: assets/nyc/scenario/trade.glb and trade-provenance.json
No paid service, remote texture or private credential is used.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals, ColorVisuals

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets"/"nyc"/"scenario"
OUT.mkdir(parents=True,exist_ok=True)
GLB=OUT/"trade.glb"
ATLAS_SIZE=512
GRID=8
atlas=Image.new("RGB",(ATLAS_SIZE,ATLAS_SIZE))
pixels=atlas.load()
for ty in range(GRID):
    for tx in range(GRID):
        k=(ty*37+tx*19)%31
        base=.66+.12*math.sin(k*1.1)
        for v in range(64):
            for u in range(64):
                edge=min(u,63-u,v,63-v)
                wave=math.sin((u+tx*11)*.17+math.cos((v+ty*13)*.09))*.13
                haze=math.sin((u*.045+v*.055+k)*1.8)*.085
                cloud=math.sin(u*.065+v*.049+k*1.6)*.075
                grain=((u*17+v*33+k*71)%23)/23-.5
                q=base+wave+haze+cloud+grain*.025
                if 18<u<36 and 23<v<44 and k%3==0:q*=.82
                if edge<2:q*=.39
                elif edge<4:q*=.68
                if 29<=u<=31:q*=.79
                if 50<=v<=52:q*=.88
                reflect=math.sin((u+v*.24)*.28+k)*.045
                pixels[tx*64+u,ty*64+v]=tuple(max(0,min(255,int(
                    c+g*q+30*reflect+10*(.6+.4*ty/7))))
                    for c,g in ((91,88),(112,95),(135,96)))

class Mesh:
    def __init__(self,name,textured=False):
        self.name=name;self.textured=textured
        self.positions=[];self.faces=[];self.colors=[];self.uv=[]
    def quad(self,p,q,r,s,color=(255,255,255,255),tile=(0,0)):
        offset=len(self.positions)
        self.positions.extend((p,q,r,s))
        self.faces.extend(((offset,offset+1,offset+2),(offset,offset+2,offset+3)))
        self.colors.extend([color]*4)
        if self.textured:
            x,y=tile;e=.006
            x0=(x+e)/GRID;x1=(x+1-e)/GRID
            y0=(y+e)/GRID;y1=(y+1-e)/GRID
            self.uv.extend(((x0,y0),(x1,y0),(x1,y1),(x0,y1)))
    def box(self,x,y,z,w,h,d,color):
        l=x-w/2;r=x+w/2;b=y-h/2;t=y+h/2;f=z+d/2;k=z-d/2
        a=(l,b,f);c=(r,b,f);e=(r,t,f);g=(l,t,f)
        i=(l,b,k);j=(r,b,k);m=(r,t,k);n=(l,t,k)
        for face in ((a,c,e,g),(j,i,n,m),(i,a,g,n),(c,j,m,e),(g,e,m,n),(i,j,c,a)):
            self.quad(*face,color=color)
    def beam(self,a,b,w,color,d=None):
        a=np.asarray(a,dtype=float);b=np.asarray(b,dtype=float)
        delta=b-a;length=float(np.linalg.norm(delta))
        if length<1e-8:return
        forward=delta/length
        up=np.array([0.,1.,0.])
        if abs(np.dot(forward,up))>.9:up=np.array([1.,0.,0.])
        right=np.cross(forward,up);right/=np.linalg.norm(right)
        up=np.cross(right,forward);up/=np.linalg.norm(up)
        rw=w/2;rh=(d if d is not None else w)/2
        ring0=[a+x*right*rw+y*up*rh for x,y in ((-1,-1),(1,-1),(1,1),(-1,1))]
        ring1=[b+x*right*rw+y*up*rh for x,y in ((-1,-1),(1,-1),(1,1),(-1,1))]
        for idx in range(4):
            nxt=(idx+1)%4
            self.quad(ring0[idx],ring0[nxt],ring1[nxt],ring1[idx],color=color)
    def cylinder(self,y0,y1,r0,r1,segments,color):
        for idx in range(segments):
            a=2*math.pi*idx/segments;b=2*math.pi*(idx+1)/segments
            self.quad((r0*math.cos(a),y0,r0*math.sin(a)),
                (r0*math.cos(b),y0,r0*math.sin(b)),
                (r1*math.cos(b),y1,r1*math.sin(b)),
                (r1*math.cos(a),y1,r1*math.sin(a)),color=color)
    def build(self,material=None):
        m=trimesh.Trimesh(vertices=np.array(self.positions,dtype="float32"),
            faces=np.array(self.faces,dtype="int32"),process=False)
        if material:
            m.visual=TextureVisuals(uv=np.array(self.uv,dtype="float32"),material=material)
        else:
            m.visual=ColorVisuals(mesh=m,vertex_colors=np.array(self.colors,dtype=np.uint8))
        if not np.isfinite(m.vertices).all():raise ValueError(self.name+" non-finite geometry")
        return m
    @property
    def triangles(self):return len(self.faces)

glass=Mesh("WTC_glass",True)
podium=Mesh("WTC_podium",True)
metal=Mesh("WTC_mullions")
dark=Mesh("WTC_shadow")
beacon=Mesh("WTC_beacon")
SILVER=(173,184,189,255);PALE=(209,221,220,255)
WHITE=(224,227,220,255);SHADOW=(46,58,66,255)
CHARCOAL=(67,78,83,255);STAINLESS=(157,168,176,255)
width=61.;half=width/2;podium_height=56.7;roof=417;total=541

for face in range(4):
    for column in range(18):
        a=width*column/18-half;b=width*(column+1)/18-half
        for row in range(13):
            y0=row*podium_height/13;y1=(row+1)*podium_height/13
            tile=((column*3+row*5+face)%8,(column+face*4+row*3)%8)
            p=(a,y0,-half) if face==0 else (half,y0,a) if face==1 else (-a,y0,half) if face==2 else (-half,y0,-a)
            q=(b,y0,-half) if face==0 else (half,y0,b) if face==1 else (-b,y0,half) if face==2 else (-half,y0,-b)
            podium.quad(p,q,(q[0],y1,q[2]),(p[0],y1,p[2]),tile=tile)
    for column in range(57):
        v=width*(column+.4)/57-half
        if face in (0,2):
            z=(-half-.18) if face==0 else (half+.18)
            metal.beam((v,1.2,z),(v,podium_height-1.1,z),.26,PALE,.13)
            for k in range(4):
                y=6.7+k*12.6
                metal.beam((v,y,z-.57 if face==0 else z+.57),
                    (v,y+9.4,z),.11,SILVER,.11)
        else:
            x=(half+.18) if face==1 else (-half-.18)
            metal.beam((x,1.2,v),(x,podium_height-1.1,v),.26,PALE,.13)
            for k in range(4):
                y=6.7+k*12.6
                metal.beam((x-.57 if face==3 else x+.57,y,v),
                    (x,y+9.4,v),.11,SILVER,.11)
    for y in (.3,12.8,25.9,39.5,55.7):
        if face in (0,2):
            z=-half-.23 if face==0 else half+.23
            metal.beam((-half,y,z),(half,y,z),.31,SILVER)
        else:
            x=half+.23 if face==1 else -half-.23
            metal.beam((x,y,-half),(x,y,half),.31,SILVER)
dark.box(0,8,-half-.20,13,15,.24,SHADOW)
for x in np.arange(-6,7,2.5):
    metal.box(float(x),8,-half-.28,.12,14.3,.45,PALE)
metal.box(0,16,-half-.3,15,.48,1.4,WHITE)

base=[(-half,-half),(0,-half),(half,-half),(half,0),
      (half,half),(0,half),(-half,half),(-half,0)]
top_radius=45.7/math.sqrt(2)
top=[(-top_radius/2,-top_radius/2),(0,-top_radius),
     (top_radius/2,-top_radius/2),(top_radius,0),
     (top_radius/2,top_radius/2),(0,top_radius),
     (-top_radius/2,top_radius/2),(-top_radius,0)]
def ring(idx,y,t):
    a=base[idx%8];b=top[idx%8]
    return ((1-t)*a[0]+t*b[0],y,(1-t)*a[1]+t*b[1])
def mix(a,b,t):return tuple((1-t)*a[k]+t*b[k] for k in range(3))

floors=82;cols=6
for row in range(floors):
    t0=row/floors;t1=(row+1)/floors
    y0=podium_height+(roof-podium_height)*t0
    y1=podium_height+(roof-podium_height)*t1
    for face in range(8):
        a=ring(face,y0,t0);b=ring(face+1,y0,t0)
        c=ring(face,y1,t1);d=ring(face+1,y1,t1)
        for col in range(cols):
            q=(row*73+face*29+col*17+row*col*7)&0xffffffff
            tile=((q>>2)%8,(q//41)%8)
            glass.quad(mix(a,b,col/cols),mix(a,b,(col+1)/cols),
                       mix(c,d,(col+1)/cols),mix(c,d,col/cols),tile=tile)
for face in range(8):
    for col in range(cols+1):
        s=col/cols
        a=mix(ring(face,podium_height,0),ring(face+1,podium_height,0),s)
        b=mix(ring(face,roof,1),ring(face+1,roof,1),s)
        metal.beam(a,b,.25 if col in (0,cols) else .105,
                   WHITE if col in (0,cols) else SILVER,.09)
    for row in range(0,floors+1,5):
        t=row/floors;y=podium_height+(roof-podium_height)*t
        metal.beam(ring(face,y,t),ring(face+1,y,t),.23,PALE,.10)
    for t in (0,.51,1):
        y=podium_height+(roof-podium_height)*t
        metal.beam(ring(face,y,t),ring(face+1,y,t),.45,WHITE,.24)
    a=ring(face,roof,1);b=ring(face+1,roof,1)
    dark.beam((a[0],roof-3,a[2]),(b[0],roof-3,b[2]),1.05,SHADOW,.75)
    metal.beam(a,b,1.18,WHITE,.7)
    for k in range(1,6):
        s=k/6;a=ring(face,roof-5.7,1);b=ring(face+1,roof-5.7,1)
        p=mix(a,b,s);dark.box(p[0],p[1],p[2],.20,.55,.20,CHARCOAL)
metal.cylinder(417,420,12.6,11.8,20,STAINLESS)
metal.cylinder(420,424,11.8,8.5,20,PALE)
for lo,hi,r0,r1 in ((424,429,8.5,6.4),(429,443,6.4,5.5),
  (443,466,5.5,3.5),(466,498,3.5,2),(498,529,2,.7),
  (529,539,.7,.32),(539,541,.32,.06)):
    metal.cylinder(lo,hi,r0,r1,12,PALE if lo<466 else STAINLESS)
for y,r in ((425,11.5),(433,7.2),(453,5.8),(470,5.1),(492,4.1),(513,3)):
    metal.cylinder(y,y+.65,r,r,16,SILVER)
for n in range(8):
    a=2*math.pi*n/8
    metal.beam((10.8*math.cos(a),435,10.8*math.sin(a)),
               (3.1*math.cos(a),477,3.1*math.sin(a)),.22,PALE)
for n in range(10):
    a=2*math.pi*n/10;b=2*math.pi*(n+1)/10
    beacon.beam((.82*math.cos(a),532,.82*math.sin(a)),
                (.82*math.cos(b),532,.82*math.sin(b)),.21,(229,219,177,255))
beacon.cylinder(540.4,541,.9,.18,12,(232,238,250,255))

material=PBRMaterial(name="PATROL_original_glass",baseColorFactor=[255]*4,
    baseColorTexture=atlas,metallicFactor=.11,roughnessFactor=.29,doubleSided=True)
scene=trimesh.Scene()
parts=(glass,podium,metal,dark,beacon)
for part in parts:
    scene.add_geometry(part.build(material if part.textured else None),
                       node_name=part.name,geom_name=part.name)
data=scene.export(file_type="glb")
GLB.write_bytes(data)
triangles=sum(part.triangles for part in parts)
if not 600<triangles<=25000:raise ValueError("Invalid triangle budget "+str(triangles))
if len(data)>8388608:raise ValueError("GLB exceeds 8 MiB")
if not np.isclose(scene.bounds[1,1]-scene.bounds[0,1],541,rtol=.001):
    raise ValueError("Model height does not match SOM design")
manifest={
    "asset":"trade","file":"trade.glb",
    "generation":"Original procedural mesh and Base Color atlas (not Scenario AI)",
    "triangles":triangles,"bytes":len(data),
    "height_meters":541,"roof_meters":417,
    "source_geometry":"https://www.som.com/projects/one-world-trade-center/",
    "license":"Original artwork authored for PATROL; redistribution permitted",
    "limits":"Visual interpretation only; not georeferenced/photogrammetric 1:1"
}
(OUT/"trade-provenance.json").write_text(
    json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
print(json.dumps(manifest,indent=2))
