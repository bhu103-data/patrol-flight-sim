// Read-only geometry / game-placement audit. Never modifies the GLB or manifest.
// View from harbor south: source model and existing procedural Liberty BOTH show
// torch on screen-left and tablet on screen-right; a 180-degree flip is wrong.
// The original Innerscene artwork is not surveyed or photogrammetric geometry.
// Usage: node tools/nyc/check-liberty-harbor-placement.mjs optimized.glb
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const path=process.argv[2];
if(!path)throw Error('Expected staged Liberty GLB');
const data=await readFile(path),u32=at=>data.readUInt32LE(at);
const fail=m=>{throw Error('LIBERTY_HARBOR_PLACEMENT: '+m)};
if(data.length<200||data.toString('ascii',0,4)!=='glTF'||
   u32(4)!==2||u32(8)!==data.length||u32(16)!==0x4e4f534a)
 fail('Invalid GLB');
const length=u32(12),doc=JSON.parse(data.subarray(20,20+length));
const bin=20+length+8;
if(u32(bin-4)!==0x004e4942||bin+u32(bin-8)>data.length)fail('Bad BIN');
if(doc.nodes?.length!==1||doc.nodes[0].mesh!==0||
 doc.meshes?.length!==1||doc.meshes[0].primitives?.length!==1)
 fail('Unexpected mesh hierarchy');
const prim=doc.meshes[0].primitives[0],a=doc.accessors[prim.attributes?.POSITION],
 v=doc.bufferViews[a?.bufferView];
if(!a||!v||a.type!=='VEC3'||a.componentType!==5126||v.buffer!==0||a.sparse)
 fail('Expected float3 unsparsed position stream');
const stride=v.byteStride||12,start=bin+(v.byteOffset||0)+(a.byteOffset||0);
if(start+(a.count-1)*stride+12>bin+u32(bin-8))fail('Stream outside GLB');
let ymin=Infinity,ymax=-Infinity,xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;
const points=[];
for(let i=0;i<a.count;i++){
 const at=start+stride*i,p=[data.readFloatLE(at),data.readFloatLE(at+4),data.readFloatLE(at+8)];
 if(!p.every(Number.isFinite))fail('Nonfinite vertex');
 points.push(p);ymin=Math.min(ymin,p[1]);ymax=Math.max(ymax,p[1]);
 xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);
 zmin=Math.min(zmin,p[2]);zmax=Math.max(zmax,p[2]);
}
if(!(ymax>92&&ymax<94&&Math.abs(ymin)<0.05))fail('Unexpected unit height');
const top=points.filter(p=>p[1]>=ymax-2.3);
if(top.length<100)fail('Torch flame not represented in top vertex cloud');
const torchTopCentroidX=top.reduce((s,p)=>s+p[0],0)/top.length;
// Camera screenshot evidence: torch on the left for the actual harbor-south
// PATROL camera on BOTH existing procedural and unrotated Innerscene GLB.
// This is a source-specific directional fingerprint, NOT an art-history survey.
if(!(torchTopCentroidX< -3))fail('Candidate is reversed relative to verified game silhouette');
const scale=31.3/(ymax-ymin),halfX=Math.max(Math.abs(xmin),Math.abs(xmax))*scale,
 halfZ=Math.max(Math.abs(zmin),Math.abs(zmax))*scale;
const footprintRadius=Math.hypot(halfX,halfZ),walkwayInnerRadius=10;
if(!(footprintRadius<walkwayInnerRadius))fail('Candidate may overlap Fort Wood inner walkway');
const report={
 position:'unchanged from authorized source (no rotation)',outputMeshNotModified:true,
 torchTopCentroidX, sourceNominalHeight:ymax-ymin,gameHeight:31.3,
 horizontalBoundingRadius:footprintRadius,
 fortWoodWalkwayInnerRadius:walkwayInnerRadius,
 conservativePlanarGap:walkwayInnerRadius-footprintRadius,
 factCheck:'Screen-left torch and screen-right tablet must be confirmed in real harbor-facing screenshot',
 limits:'This is a planar bounding test only, not a tested landing collision or a low-angle visual clearance guarantee',
 productionManifestChanged:false
};
await mkdir('artifacts/nyc-liberty',{recursive:true});
await writeFile('artifacts/nyc-liberty/harbor-placement.json',JSON.stringify(report,null,2)+'\n');
console.log('LIBERTY_HARBOR_PLACEMENT_PASS '+JSON.stringify(report));
