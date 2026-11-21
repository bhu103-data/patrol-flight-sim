// Rotate only the staged Innerscene Liberty GLB into PATROL's harbor-facing -Z.
// This tool changes POSITION/NORMAL byte streams, not PATROL's shared shader,
// map transform, textures, asset permissions, controls, or production manifest.
// Run after Blender CPU atlas export and before check-liberty-glb.mjs.
// Usage: node tools/nyc/orient-liberty-to-harbor.mjs source.glb [output.glb]
import {readFile,writeFile,mkdir} from 'node:fs/promises';

const input=process.argv[2],out=process.argv[3]||input;
if(!input)throw Error('Expected optimized candidate GLB');
const data=Buffer.from(await readFile(input));
const fail=m=>{throw Error('LIBERTY_ORIENTATION: '+m)};
if(data.length<200||data.readUInt32LE(0)!==0x46546c67||
   data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length)
  fail('Not complete GLB 2.0');
const jsonBytes=data.readUInt32LE(12);
if(data.readUInt32LE(16)!==0x4e4f534a)fail('No JSON chunk');
const gltf=JSON.parse(data.subarray(20,20+jsonBytes));
const binHeader=20+jsonBytes,binOffset=binHeader+8;
if(binHeader+8>data.length||data.readUInt32LE(binHeader+4)!==0x004e4942)
  fail('No BIN chunk');
const binLen=data.readUInt32LE(binHeader),views=gltf.bufferViews||[],accessors=gltf.accessors||[];
if(binOffset+binLen>data.length)fail('BIN chunk overrun');
if(gltf.nodes?.length!==1||gltf.nodes[0].mesh!==0||
  gltf.nodes[0].matrix||gltf.nodes[0].rotation||gltf.nodes[0].translation||
  gltf.nodes[0].scale||gltf.meshes?.length!==1||
  gltf.meshes[0].primitives?.length!==1)
  fail('Unexpected authored transform; refuse to rotate an unrelated model');
const prim=gltf.meshes[0].primitives[0];
function dataInfo(attribute) {
  const index=prim.attributes?.[attribute],a=accessors[index],v=views[a?.bufferView];
  if(!a||!v||a.type!=='VEC3'||a.componentType!==5126||a.sparse||v.buffer!==0)
    fail(attribute+' must be an embedded non-sparse float VEC3');
  const stride=v.byteStride||12;
  if(stride<12||stride%4)fail(attribute+' invalid stride');
  const pos=binOffset+(v.byteOffset||0)+(a.byteOffset||0);
  if(pos<binOffset||pos+(a.count-1)*stride+12>binOffset+binLen)
    fail(attribute+' accessor outside BIN');
  return {offset:pos,stride,count:a.count,accessor:a};
}
const positions=dataInfo('POSITION'),normals=dataInfo('NORMAL');
if(positions.count!==normals.count)fail('Normal count differs from position count');
const coords=[];
let topY=-Infinity,minY=Infinity,minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
for(let i=0;i<positions.count;i++){
 const at=positions.offset+i*positions.stride;
 const x=data.readFloatLE(at),y=data.readFloatLE(at+4),z=data.readFloatLE(at+8);
 if(![x,y,z].every(Number.isFinite))fail('Nonfinite positions');
 coords.push([x,y,z]);topY=Math.max(topY,y);minY=Math.min(minY,y);
 minX=Math.min(minX,x);maxX=Math.max(maxX,x);
 minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
}
const above=coords.filter(v=>v[1]>=topY-2.3);
const xBefore=above.reduce((a,v)=>a+v[0],0)/above.length;
if(above.length<100||!(topY>92&&topY<94)||!(minY>=-.01&&minY<=.1))
  fail('Unexpected Statue of Liberty geometry or height');
if(!(xBefore<-3.0))fail('Original flame not on -X: source may already be rotated');
const sourceScale=31.3/(topY-minY),halfX=Math.max(Math.abs(minX),Math.abs(maxX))*sourceScale,
 halfZ=Math.max(Math.abs(minZ),Math.abs(maxZ))*sourceScale;
const footprintRadius=Math.hypot(halfX,halfZ);
if(footprintRadius>=9.5)fail('Foundation may encroach on Fort Wood 10-unit walkway');
for(const info of [positions,normals]){
 for(let i=0;i<info.count;i++){
  const at=info.offset+i*info.stride;
  data.writeFloatLE(-data.readFloatLE(at),at);
  data.writeFloatLE(-data.readFloatLE(at+8),at+8);
 }
}
const rotatedMin=[-maxX,minY,-maxZ],rotatedMax=[-minX,topY,-minZ];
const positionA=positions.accessor;
if(positionA.min&&positionA.max){
 // This GLB has symmetric foundation X/Z bounds. No JSON rewrite is needed.
 // Reject asymmetric bounds instead of leaving stale metadata after rotation.
 const oldMin=positionA.min,oldMax=positionA.max;
 if(Math.abs(oldMin[0]+oldMax[0])>.02 ||
    Math.abs(oldMin[2]+oldMax[2])>.02)fail('Source bounds asymmetric; JSON bounds rewrite required');
}
await writeFile(out,data);
const report={
 originalTorchCentroidX:xBefore,afterTorchCentroidX:-xBefore,
 transform:'180 degrees around glTF +Y; harbor-facing game -Z',
 sourceNominalHeight:topY-minY,gameHeight:31.3,
 gameBaseHalfWidth:halfX,gameBaseHalfDepth:halfZ,
 boundingCircleRadius:footprintRadius,fortWoodWalkwayInnerRadius:10,
 minimumRadialClearanceBound:10-footprintRadius,
 groundCheck:'Horizontal clearance bound only, not verified collision or visual overlap',
 metadataBoundsAfter: {min:rotatedMin,max:rotatedMax},
 originalModelKept:false,manifestEnabled:false
};
await mkdir('artifacts/nyc-liberty',{recursive:true});
await writeFile('artifacts/nyc-liberty/orientation-clearance.json',
 JSON.stringify(report,null,2)+'\n');
console.log('LIBERTY_HARBOR_ORIENTATION_PASS '+JSON.stringify(report));
