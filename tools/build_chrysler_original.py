"""Original Chrysler Building inspired GLB. No Scenario API, scans or paid generation."""
import json,math,struct
from pathlib import Path
import numpy as np
from PIL import Image
import trimesh
from trimesh.visual import TextureVisuals,ColorVisuals
from trimesh.visual.material import PBRMaterial
root=Path(__file__).resolve().parents[1]/"assets/nyc/scenario"
root.mkdir(parents=True,exist_ok=True)
atlas=Image.new("RGB",(512,512))
px=atlas.load()
for yy in range(512):
 for xx in range(512):
  u,v=xx%64,yy%64;tile=(xx//64)*19+(yy//64)*37
  noise=math.sin(u*.27+tile)*9+math.cos(v*.31+tile)*8
  border=u<4 or u>59 or v<4 or v>59 or 31<=u<=33
  lit=(tile%9==0 and 12<u<53 and 15<v<47)
  base=(180,173,156) if border else ((173,150,94) if lit else (34,63,81))
  px[xx,yy]=tuple(max(0,min(255,int(c+noise))) for c in base)
class Part:
 def __init__(self,name,textured=False):
  self.name=name;self.textured=textured;self.v=[];self.f=[];self.c=[];self.uv=[]
 def quad(self,a,b,c,d,color=(186,182,165,255),tile=(0,0)):
  k=len(self.v);self.v.extend([a,b,c,d]);self.f.extend([(k,k+1,k+2),(k,k+2,k+3)])
  self.c.extend([color]*4)
  if self.textured:
   x,y=tile;self.uv.extend([((x+.01)/8,(y+.01)/8),((x+.99)/8,(y+.01)/8),
                             ((x+.99)/8,(y+.99)/8),((x+.01)/8,(y+.99)/8)])
 def box(self,x,y,z,w,h,d,color=(186,182,165,255)):
  X=[x-w/2,x+w/2];Y=[y-h/2,y+h/2];Z=[z-d/2,z+d/2]
  verts=[(X[i],Y[j],Z[k]) for i,j,k in [(0,0,0),(1,0,0),(1,1,0),(0,1,0),
                                          (0,0,1),(1,0,1),(1,1,1),(0,1,1)]]
  for a,b,c,d in [(4,5,6,7),(1,0,3,2),(0,4,7,3),(5,1,2,6),(7,6,2,3),(0,1,5,4)]:
   self.quad(verts[a],verts[b],verts[c],verts[d],color)
 def mesh(self,material=None):
  m=trimesh.Trimesh(vertices=np.asarray(self.v,np.float32),
                   faces=np.asarray(self.f,np.int32),process=False)
  if self.textured:m.visual=TextureVisuals(uv=np.asarray(self.uv,np.float32),material=material)
  else:m.visual=ColorVisuals(mesh=m,vertex_colors=np.asarray(self.c,np.uint8))
  normal=np.nan_to_num(np.asarray(m.vertex_normals,np.float64),nan=0,posinf=0,neginf=0)
  length=np.linalg.norm(normal,axis=1);invalid=length<1.e-9
  normal[invalid]=(0,1,0);length[invalid]=1;m.vertex_normals=normal/length[:,None]
  return m
stone=Part("Chrysler_masonry")
windows=Part("Chrysler_blue_green_window_atlas",True)
ribs=Part("Chrysler_stainless_steel_ribs")
crown=Part("Chrysler_stainless_sunburst")
# Landmark proportions are a compressed visual interpretation of the
# Chrysler Building, not proprietary photogrammetry or survey-quality geometry.
stages=[(0,25,37,35,8),(25,75,32,31,8),(75,137,27.5,27,7),
        (137,201,23,22.5,7),(201,236,19,18.5,6)]
for si,(lo,hi,w,d,count) in enumerate(stages):
 stone.box(0,(lo+hi)/2,0,w,hi-lo,d,
           (165,159,149,255) if si%2 else (182,176,160,255))
 for face in range(4):
  width=w if face%2==0 else d
  for col in range(count):
   a=(col+.18)/count-.5;b=(col+.82)/count-.5
   for row in range(max(1,int((hi-lo)/3.25))):
    y0=lo+1.7+row*3.25;y1=y0+1.72
    if y1>hi-.36:continue
    if face==0:p=(a*width,y0,d/2+.045);q=(b*width,y0,d/2+.045)
    elif face==1:p=(w/2+.045,y0,a*width);q=(w/2+.045,y0,b*width)
    elif face==2:p=(b*width,y0,-d/2-.045);q=(a*width,y0,-d/2-.045)
    else:p=(-w/2-.045,y0,b*width);q=(-w/2-.045,y0,a*width)
    windows.quad(p,q,(q[0],y1,q[2]),(p[0],y1,p[2]),
                 tile=((row*5+col*11+si+face)%8,(row*9+si*3+face*2)%8))
  for j in range(count+1):
   u=(j/count-.5)*width
   if face==0:x,z=u,d/2+.11;bw,bd=.42,.38
   elif face==1:x,z=w/2+.11,u;bw,bd=.38,.42
   elif face==2:x,z=u,-d/2-.11;bw,bd=.42,.38
   else:x,z=-w/2-.11,u;bw,bd=.38,.42
   ribs.box(x,(hi+lo)/2,z,bw,hi-lo-.12,bd,(142,155,157,255))
  if si<4:
   if face%2==0:ribs.box(0,hi-.18,(1 if face==0 else -1)*(d/2+.17),
                          w+.36,.31,.42,(193,198,197,255))
   else:ribs.box((1 if face==1 else -1)*(w/2+.17),hi-.18,0,
                  .42,.31,d+.36,(193,198,197,255))
# Concentric Art Deco stainless-steel stepped crowns and pointed finials.
# Triangulated faces and radial fins create actual shading relief rather than
# flat grey striping on a cuboid.
silver=(183,197,202,255);pale=(223,224,218,255)
roofR=[(236,12.3),(242,11.7),(249,10.4),(256,9.0),
       (263,7.4),(270,5.5),(277,3.8),(283,2.6)]
N=20
for j in range(len(roofR)-1):
 y0,r0=roofR[j];y1,r1=roofR[j+1]
 for k in range(N):
  a=2*math.pi*k/N;b=2*math.pi*(k+1)/N
  crown.quad((r0*math.cos(a),y0,r0*math.sin(a)),
             (r0*math.cos(b),y0,r0*math.sin(b)),
             (r1*math.cos(b),y1,r1*math.sin(b)),
             (r1*math.cos(a),y1,r1*math.sin(a)),
             silver if j%2 else pale)
 for k in range(0,N,2):
  angle=2*math.pi*k/N
  cx=math.cos(angle);cz=math.sin(angle)
  q0=(r0*cx,y0,r0*cz);q1=((r1+.08)*cx,y1,(r1+.08)*cz)
  for d in (-.075,.075):
   crown.quad((q0[0]+d,y0,q0[2]),(q0[0]+d+.08,y0,q0[2]+.08),
              (q1[0]+d+.04,y1,q1[2]+.04),(q1[0]+d,y1,q1[2]),
              (104,118,125,255))
for y,r in roofR:
 for k in range(N):
  a=2*math.pi*k/N;b=2*math.pi*(k+1)/N
  crown.quad((r*math.cos(a),y,r*math.sin(a)),
             (r*math.cos(b),y,r*math.sin(b)),
             (r*math.cos(b),y+.28,r*math.sin(b)),
             (r*math.cos(a),y+.28,r*math.sin(a)),(119,138,145,255))
# Characteristic metal ornament fins on the upper shaft.
for side in (-1,1):
 for level in (179,195,211,224):
  ribs.box(side*11.5,level,0,.48,.62,6.2,(201,206,200,255))
  ribs.box(0,level,side*11.5,6.2,.62,.48,(201,206,200,255))
for low,high,r0,r1 in [(283,294,2.6,1.8),(294,308,1.8,.75),
                        (308,317,.75,.20),(317,319,.20,.015)]:
 for k in range(N):
  a=2*math.pi*k/N;b=2*math.pi*(k+1)/N
  crown.quad((r0*math.cos(a),low,r0*math.sin(a)),
             (r0*math.cos(b),low,r0*math.sin(b)),
             (r1*math.cos(b),high,r1*math.sin(b)),
             (r1*math.cos(a),high,r1*math.sin(a)),pale)
material=PBRMaterial(name="PATROL_original_Chrysler_glass_atlas",
 baseColorFactor=[255]*4,baseColorTexture=atlas,
 metallicFactor=.11,roughnessFactor=.40,doubleSided=True)
scene=trimesh.Scene()
parts=(stone,windows,ribs,crown)
for part in parts:
 scene.add_geometry(part.mesh(material if part.textured else None),
                    node_name=part.name,geom_name=part.name)
raw=trimesh.exchange.gltf.export_glb(scene,include_normals=True)
jl=struct.unpack_from("<I",raw,12)[0]
json.loads(raw[20:20+jl],parse_constant=lambda value:(_ for _ in ()).throw(ValueError(value)))
tris=sum(len(p.f) for p in parts)
assert 600<=tris<=25000,tris
assert 20000<len(raw)<8388608,len(raw)
assert abs(scene.bounds[1,1]-319)<.25
(root/"chrysler.glb").write_bytes(raw)
(root/"chrysler-provenance.json").write_text(json.dumps({
 "asset":"chrysler","file":"chrysler.glb",
 "generation":"Original authored geometric mesh and glass atlas (not Scenario AI)",
 "triangles":tris,"bytes":len(raw),"height_meters":319,
 "design":"Masonry shaft, inset windows, steel friezes, concentric Art Deco crown and spire",
 "license":"Original artwork authored for PATROL; redistribution permitted",
 "limits":"Game-scale interpretation, not surveyed or photogrammetric 1:1 reconstruction"
},indent=2)+"\n")
print("Chrysler",tris,"triangles",len(raw),"bytes")
