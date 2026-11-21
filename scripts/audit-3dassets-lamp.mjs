// Third-party 3DAssets.dev GLB SOURCE audit, not a runtime importer.
// Run against source-hosted model and public API metadata in free GitHub Actions.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
const [glbFile,apiFile,reportFile]=process.argv.slice(2);
if(!glbFile||!apiFile||!reportFile){
  console.error('Usage: node scripts/audit-3dassets-lamp.mjs source.glb source.json report.json');
  process.exit(2);
}
const claim=JSON.parse(await readFile(apiFile,'utf8')).data;
const bin=await readFile(glbFile);
function check(value,message){if(!value)throw Error(message);}
check(claim?.id==='28261'&&claim?.slug==='battle-royale-town-and-airfield-street-lamp-d6bcc658',
  'Unexpected asset record');
check(claim.cdnUrl==='https://cdn.3dassets.dev/assets/28261/v1/model.glb',
  'Original pinned source URL differs');
check(claim.license?.slug==='cc0-1.0'&&claim.license?.attributionRequired===false,
  'Publisher does not confirm CC0 redistributability');
check(claim.aiGenerated===true&&typeof claim.aiModel==='string',
  'Original model creation disclosure must remain visible');
check(bin.byteLength<=300000 && bin.byteLength===claim.stats.fileSize,
  'Original asset bytes differ from publisher metadata or budget');
const v=new DataView(bin.buffer,bin.byteOffset,bin.byteLength);
const u32=i=>v.getUint32(i,true);
check(u32(0)===0x46546c67&&u32(4)===2&&u32(8)===bin.length,
  'Invalid glTF 2.0 header');
let offset=12, g;
while(offset+8<=bin.length){
  const size=u32(offset),magic=u32(offset+4);
  check(size%4===0 && offset+8+size<=bin.length,'Invalid GLB chunk');
  if(magic===0x4e4f534a){
    check(!g,'More than one glTF JSON chunk');
    g=JSON.parse(bin.subarray(offset+8,offset+8+size).toString('utf8'));
  }
  offset+=8+size;
}
check(offset===bin.length&&g?.asset?.version==='2.0','No complete glTF JSON');
const required=g.extensionsRequired||[];
check(required.every(e=>['KHR_mesh_quantization','EXT_texture_webp'].includes(e)),
  'Unreviewed required decoder: '+required.join(','));
check(g.buffers?.length===1&&!g.buffers[0].uri,'Unexpected external binary');
check((g.images||[]).length<=2,'Texture budget exceeded');
for(const image of g.images||[]){
  check(!image.uri,'External texture URL not allowed');
  check((image.mimeType==='image/webp'||image.mimeType==='image/png'||image.mimeType==='image/jpeg')&&
    Number.isInteger(image.bufferView),'Unknown embedded texture packaging');
}
const accessors=g.accessors||[];
let triangles=0;
for(const mesh of g.meshes||[])for(const p of mesh.primitives||[]){
  check((p.mode??4)===4,'Non-triangle primitive');
  const count=accessors[p.indices??p.attributes?.POSITION]?.count;
  check(Number.isSafeInteger(count)&&count%3===0,'Unexpected accessor topology');
  triangles+=count/3;
}
check(triangles===828 && triangles===claim.stats.triangles,
  'Actual triangle count does not match 828-triangle listing');
check((g.materials||[]).length===claim.stats.materials,'Material count differs');
check((g.images||[]).length===claim.stats.textures,'Texture count differs');
check((g.meshes||[]).length===claim.stats.meshes,'Mesh count differs');
const result={
  passed:true,source:claim.url,asset:claim.slug,sourceGlb:claim.cdnUrl,
  sha256:createHash('sha256').update(bin).digest('hex'),
  bytes:bin.length,triangles,meshes:g.meshes.length,materials:g.materials.length,
  images:g.images.length,requiredExtensions:required,
  allExtensions:g.extensionsUsed||[],
  declaredSizeMeters:claim.stats.sizeMeters,
  license:claim.license,contributor:claim.contributor,
  aiGenerated:claim.aiGenerated,aiModel:claim.aiModel,
  sourceAuditedAt:new Date().toISOString(),
  productionActive:false,
  webglScreenshotsVerified:false,
  visualImprovementVerified:false,
  hardwareFrameTimeVerified:false
};
await mkdir(dirname(reportFile),{recursive:true});
await writeFile(reportFile,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
