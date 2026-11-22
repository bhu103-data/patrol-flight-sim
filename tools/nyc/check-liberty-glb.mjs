// Strict, dependency-free preflight for PATROL's existing one-atlas WebGL2 decoder.
// Usage: node tools/nyc/check-liberty-glb.mjs assets/nyc/scenario/liberty.glb
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file=process.argv[2];
if(!file)throw Error('Required GLB file path');
const data=await readFile(file);
const fail=m=>{throw Error('NYC Liberty gate: '+m)};
const size=data.length, max=8388608, dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
if(size<1024||size>max)fail('GLB exceeds 8 MiB or empty');
const uint=at=>dv.getUint32(at,true);
if(uint(0)!==0x46546c67||uint(4)!==2||uint(8)!==size)fail('Invalid GLB header');
let offset=12,document=null,bin=null,binStart=0;
while(offset+8<=size){
 const n=uint(offset),type=uint(offset+4);
 if(n%4!==0||offset+8+n>size)fail('Invalid chunk');
 if(type===0x4e4f534a)document=JSON.parse(data.subarray(offset+8,offset+8+n));
 if(type===0x004e4942){binStart=offset+8;bin=n;}
 offset+=8+n;
}
if(offset!==size||!document||!bin||document.asset?.version!=='2.0')fail('Incomplete GLB');
if(document.extensionsRequired?.length)fail('Unsupported required glTF extensions');
const accessors=document.accessors||[], views=document.bufferViews||[];
const textures=document.textures||[], images=document.images||[];
const materials=document.materials||[];
const usedTextures=new Set(), bounds=[];
let triangles=0,primitives=0,textured=0,withUV=0;
for(const mesh of document.meshes||[]){
 for(const prim of mesh.primitives||[]){
  if((prim.mode??4)!==4)fail('Non-triangle primitive');
  const accessor=accessors[prim.indices??prim.attributes?.POSITION];
  const position=accessors[prim.attributes?.POSITION];
  if(!position||position.type!=='VEC3'||!accessor||
    !Number.isInteger(accessor.count)||accessor.count%3)fail('Invalid triangles');
  primitives++;triangles+=accessor.count/3;
  if(position.min?.length===3&&position.max?.length===3)bounds.push(position);
  const mat=prim.material===undefined?null:materials[prim.material];
  const diffuse=mat?.pbrMetallicRoughness?.baseColorTexture;
  if(diffuse){
   if((diffuse.texCoord??0)!==0||diffuse.extensions?.KHR_texture_transform)
    fail('Unsupported UV transform');
   if(!prim.attributes||prim.attributes.TEXCOORD_0===undefined)fail('Missing UV0');
   usedTextures.add(diffuse.index);textured++;withUV++;
  }
 }
}
if(triangles<1500||triangles>25000)fail('Triangle budget '+triangles);
if(usedTextures.size!==1||textured<1||withUV!==textured)
 fail('Exactly one supported Base Color atlas required');
const index=[...usedTextures][0],texture=textures[index],img=images[texture?.source];
const view=views[img?.bufferView];
if(!view||view.buffer!==0||!['image/png','image/jpeg'].includes(img.mimeType)||
 view.byteLength<64||view.byteLength>4194304||view.byteOffset+view.byteLength>bin)
 fail('Atlas must be embedded PNG/JPEG <=4 MiB');
if(images.some(i=>i.uri))fail('External images not allowed');
const boundsMin=[Infinity,Infinity,Infinity],boundsMax=[-Infinity,-Infinity,-Infinity];
for(const a of bounds)for(let i=0;i<3;i++){
 boundsMin[i]=Math.min(boundsMin[i],a.min[i]);boundsMax[i]=Math.max(boundsMax[i],a.max[i]);
}
if(!bounds.length)fail('Missing POSITION bounds');
const axes=boundsMin.map((lo,i)=>+(boundsMax[i]-lo).toFixed(2));
if(axes.some(v=>!Number.isFinite(v)||v<=0))fail('Invalid mesh extents');
const result={
 sha256:createHash('sha256').update(data).digest('hex'),
 bytes:size,triangles,primitives,images:images.length,
 distinctBaseColorTextures:usedTextures.size,atlasBytes:view.byteLength,
 sourceLicense:'Innerscene original CC0; https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f',
 authoredNotSurvey:true,
 localGameTargetHeight:31.3,gameWidthEstimateMetersNotSurvey:axes,
 verdict:'STRUCTURAL_GATE_PASS_ONLY; orientation/pedestal and same-camera WebGL still required',
 productionEnabled:false
};
await mkdir('artifacts/nyc-liberty',{recursive:true});
await writeFile('artifacts/nyc-liberty/glb-audit.json',JSON.stringify(result,null,2)+'\n');
console.log('LIBERTY_STRUCTURE_PASS '+JSON.stringify(result));
