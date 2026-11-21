// Offline admission gate for third-party GLB candidates; no network, renderer or game mutation.
// Usage: node scripts/audit-external-glb.mjs FILE.glb PROVIDER-manifest.json REPORT.json
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';

const [input,sourceManifest,output]=process.argv.slice(2);
if(!input||!sourceManifest||!output){
  console.error('Usage: node scripts/audit-external-glb.mjs FILE.glb SOURCE-manifest.json REPORT.json');
  process.exit(2);
}
function check(condition,message){
  if(!condition)throw new Error(message);
}
function getChunk(u8,pos,magic){
  check(pos+8<=u8.length,'Missing GLB chunk header');
  const view=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  const length=view.getUint32(pos,true);
  check(view.getUint32(pos+4,true)===magic,'Wrong GLB chunk type');
  check(length%4===0&&pos+8+length<=u8.length,'GLB chunk exceeds bounds');
  return {length,offset:pos+8,next:pos+8+length};
}
const bytes=await readFile(input);
const manifest=JSON.parse(await readFile(sourceManifest,'utf8'));
check(bytes.byteLength<=1024*1024,'Streetlamp GLB exceeds 1 MiB network budget');
check(bytes.byteLength>=100,'Empty or truncated GLB');
const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
check(view.getUint32(0,true)===0x46546c67,'Invalid glTF binary magic');
check(view.getUint32(4,true)===2,'GLB must be version 2');
check(view.getUint32(8,true)===bytes.length,'GLB declared size does not match');
const jsonChunk=getChunk(bytes,12,0x4e4f534a);
const json=JSON.parse(bytes.subarray(jsonChunk.offset,jsonChunk.next).toString('utf8'));
const binary=getChunk(bytes,jsonChunk.next,0x004e4942);
check(binary.next===bytes.length,'No trailing unreviewed bytes or additional chunks allowed');
check(json.asset?.version==='2.0','Not glTF 2.0');
check((json.extensionsRequired||[]).length===0,'Unsupported runtime extension required: '+(json.extensionsRequired||[]).join(','));
check(json.buffers?.length===1&&!json.buffers[0].uri,'Must embed its only BIN buffer');
check(json.buffers[0].byteLength<=binary.length,'glTF buffer size exceeds BIN');
check((json.meshes||[]).length>0,'No actual mesh');
check((json.nodes||[]).length<=256,'Node count exceeds small streetlight budget');
check((json.materials||[]).length<=32,'Too many streetlight materials');
const bufferViews=json.bufferViews||[];
for(const v of bufferViews){
  check(v.buffer===0&&Number.isSafeInteger(v.byteLength),'Invalid bufferView');
  check((v.byteOffset||0)+v.byteLength<=binary.length,'bufferView out of bounds');
}
const accessors=json.accessors||[];
let triangles=0,primitives=0;
for(const mesh of json.meshes){
  for(const part of mesh.primitives||[]){
    check((part.mode??4)===4,'Only triangle primitive mode is supported');
    const pos=accessors[part.attributes?.POSITION];
    const idx=part.indices!==undefined?accessors[part.indices]:pos;
    check(pos&&idx&&Number.isSafeInteger(idx.count)&&idx.count%3===0,'Invalid triangle accessor');
    triangles+=idx.count/3;primitives++;
  }
}
check(triangles>0&&triangles<=6500,'Candidate triangle count exceeds trial budget');
const images=json.images||[];
check(images.length<=8,'Too many material textures');
const imageBytes=[];
for(const img of images){
  check(!img.uri,'External texture URL is prohibited');
  check(['image/png','image/jpeg','image/webp'].includes(img.mimeType),'Unknown texture codec');
  const v=bufferViews[img.bufferView];
  check(v&&v.byteLength<=2*1024*1024,'Missing or oversized embedded texture');
  imageBytes.push({type:img.mimeType,bytes:v.byteLength});
}
check(manifest.extras?.license==='CC0-1.0','Missing direct-source CC0 license record');
check(manifest.origin?.method==='procedural','Source origin must be disclosed');
check(manifest.origin?.ai_content===false,'Unexpected undetermined origin');
check(Number(manifest.files?.glb?.bytes)===bytes.length,'Producer file byte count differs');
check(Number(manifest.triangles)===triangles,
  'Producer triangles differ from actual decoded index count: '+manifest.triangles+' vs '+triangles);
const result={
  source:'https://grab3d.com/models/city/street-light/',
  directGlb:'https://grab3d.com/dl/street-light/street-light.glb',
  sourceManifest:'https://grab3d.com/dl/street-light/manifest.json',
  auditedAt:new Date().toISOString(),
  sha256:createHash('sha256').update(bytes).digest('hex'),
  bytes:bytes.length,triangles,meshCount:json.meshes.length,primitives,
  nodes:(json.nodes||[]).length,materials:(json.materials||[]).length,
  images:imageBytes,requiredExtensions:json.extensionsRequired||[],
  licenseClaim:manifest.extras.license,origin:manifest.origin,
  originalFileAndTexturePackagingAudited:true,
  webglStreetCameraCompared:false,
  lowAltitudeFrameTimingMeasured:false,
  runtimeIntegrationApproved:false
};
await mkdir(dirname(output),{recursive:true});
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
