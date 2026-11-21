"""Original Empire State Building inspired GLB. No Scenario API, scans or paid generation."""
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
stone=Part("Empire_limestone");window=Part("Empire_mullioned_glass",True)
piers=Part("Empire_Art_Deco_ribs");crown=Part("Empire_mast")
stages=[(0,16,57,55,8),(16,52,51,49,8),(52,78,43,39,7),
        (78,112,34,32,7),(112,195,26.5,26,8),
        (195,287,21.5,20.5,7),(287,322,15,15,5),
        (322,353,10,11,4),(353,379,7.1,8.2,3)]
for si,(low,high,w,d,n) in enumerate(stages):
 stone.box(0,(low+high)/2,0,w,high-low,d)
 for face in range(4):
  width=w if face%2==0 else d
  for col in range(n):
   a=(col+.18)/n-.5;b=(col+.82)/n-.5
   for row in range(max(1,int((high-low)/3.68))):
    bottom=low+1.9+row*3.68;top=bottom+1.72
    if top>high-.4:continue
    if face==0:p=(a*width,bottom,d/2+.05);q=(b*width,bottom,d/2+.05)
    elif face==1:p=(w/2+.05,bottom,a*width);q=(w/2+.05,bottom,b*width)
    elif face==2:p=(b*width,bottom,-d/2-.05);q=(a*width,bottom,-d/2-.05)
    else:p=(-w/2-.05,bottom,b*width);q=(-w/2-.05,bottom,a*width)
    window.quad(p,q,(q[0],top,q[2]),(p[0],top,p[2]),
                tile=((si*3+row*5+col*11+face)%8,(si*7+row*13+col*3+face)%8))
  for col in range(n+1):
   u=(col/n-.5)*width
   if face==0:x,z=u,d/2+.12;bw,bd=.43,.36
   elif face==1:x,z=w/2+.12,u;bw,bd=.36,.43
   elif face==2:x,z=u,-d/2-.12;bw,bd=.43,.36
   else:x,z=-w/2-.12,u;bw,bd=.36,.43
   piers.box(x,(high+low)/2,z,bw,high-low-.12,bd)
  if si<7:
   if face%2==0:piers.box(0,high-.13,(1 if face==0 else -1)*(d/2+.13),w+.38,.25,.40)
   else:piers.box((1 if face==1 else -1)*(w/2+.13),high-.13,0,.40,.25,d+.38)
for low,high,r0,r1 in [(379,390,4.1,3.7),(390,408,3.7,2.3),(408,423,2.3,1.35),
                       (423,431,1.35,.69),(431,441,.69,.19),(441,443.2,.19,.02)]:
 for i in range(16):
  a=2*math.pi*i/16;b=2*math.pi*(i+1)/16
  crown.quad((r0*math.cos(a),low,r0*math.sin(a)),
             (r0*math.cos(b),low,r0*math.sin(b)),
             (r1*math.cos(b),high,r1*math.sin(b)),
             (r1*math.cos(a),high,r1*math.sin(a)),(202,203,191,255))
texture=PBRMaterial(name="PATROL_original_Empire_diffuse",
 baseColorFactor=[255]*4,baseColorTexture=atlas,
 metallicFactor=.05,roughnessFactor=.48,doubleSided=True)
scene=trimesh.Scene()
for part in (stone,window,piers,crown):
 scene.add_geometry(part.mesh(texture if part.textured else None),
                    node_name=part.name,geom_name=part.name)
binary=trimesh.exchange.gltf.export_glb(scene,include_normals=True)
jl=struct.unpack_from("<I",binary,12)[0]
json.loads(binary[20:20+jl],parse_constant=lambda s:(_ for _ in ()).throw(ValueError(s)))
triangles=sum(len(p.f) for p in (stone,window,piers,crown))
assert 700<=triangles<=25000,triangles
assert len(binary)<8388608,len(binary)
assert abs(scene.bounds[1,1]-443.2)<.2
(root/"empire.glb").write_bytes(binary)
(root/"empire-provenance.json").write_text(json.dumps({
 "asset":"empire","file":"empire.glb",
 "generation":"Original authored geometric model and Base Color atlas (not Scenario AI)",
 "triangles":triangles,"bytes":len(binary),"height_meters":443.2,
 "design":"Art Deco limestone setbacks, mullioned window bays, mooring mast and spire",
 "license":"Original geometry and texture authored for PATROL; redistribution permitted",
 "limits":"Game-scale visual interpretation, not photogrammetry or verified 1:1 geometry"
},indent=2)+"\n")
print("Empire",triangles,"triangles",len(binary),"GLB bytes")
