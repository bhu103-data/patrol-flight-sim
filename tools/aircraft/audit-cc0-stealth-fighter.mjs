// Independent GLB original-source inspection for one CC0 jet candidate.
// This deliberately does NOT place third-party assets in PATROL runtime.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const OUTPUT='artifacts/aircraft-two-choice-review';
await mkdir(OUTPUT,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=(why)=>{throw Error('CC0 fighter source gate: '+why)};
const assert=(ok,why)=>{if(!ok)fail(why)};
const catalog=JSON.parse(await readFile('/tmp/tevy-models.json','utf8'));
const model=catalog.models?.find(x=>x.slug==='stealth-fighter');
assert(model,'Official source metadata has no stealth-fighter');
assert(model.license==='CC0-1.0'&&model.units==='meters'&&model.up==='+Y'&&
  model.version===1,'Unexpected license, coordinate frame, or version');
const page=await readFile('/tmp/tevy-stealth-fighter.html','utf8');
assert(page.includes('Stealth Fighter')&&page.includes('CC0 1.0'),
  'Official publisher license page is missing');
function glb(data){
  assert(data.length>20000&&data.length<2500000,'Original source exceeds 2.5MB bound');
  const dv=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const u32=i=>dv.getUint32(i,true);
  assert(u32(0)===0x46546c67&&u32(4)===2&&u32(8)===data.length,
    'Invalid glTF 2.0 header');
  let off=12,json=null,binBegin=null,binSize=0;
  while(off+8<=data.length){
    const n=u32(off),t=u32(off+4);
    assert(n%4===0&&off+8+n<=data.length,'Invalid GLB chunk bounds');
    if(t===0x4e4f534a){
      assert(!json,'Duplicate JSON chunk');
      json=JSON.parse(data.subarray(off+8,off+8+n).toString('utf8'));
    }
    if(t===0x004e4942){binBegin=off+8;binSize=n;}
    off+=8+n;
  }
  assert(off===data.length&&json?.asset?.version==='2.0'&&binBegin!==null,
    'Missing GLB scene and geometry');
  const accessors=json.accessors||[],views=json.bufferViews||[];
  let triangles=0,primitives=0;
  for(const m of json.meshes||[])for(const p of m.primitives||[]){
    assert((p.mode??4)===4,'Nontriangle GLB mesh primitive');
    const position=accessors[p.attributes?.POSITION],indices=accessors[p.indices];
    assert(position?.count>0,'Missing vertex data');
    const count=indices?.count??position.count;
    assert(Number.isInteger(count)&&count%3===0,'Invalid triangle vertex count');
    triangles+=count/3;primitives++;
  }
  const images=(json.images||[]).map((v,i)=>{
    const b=views[v.bufferView];
    assert(b?.buffer===0&&b.byteLength>0&&
      (b.byteOffset||0)+b.byteLength<=binSize,'Not an embedded image');
    const chunk=data.subarray(binBegin+(b.byteOffset||0),
      binBegin+(b.byteOffset||0)+b.byteLength);
    const ktx2=v.mimeType==='image/ktx2';
    const header=Buffer.from('ab4b5458203230bb0d0a1a0a','hex');
    if(ktx2)assert(chunk.subarray(0,12).equals(header),'Invalid KTX2 identifier');
    return {index:i,mime:v.mimeType,bytes:chunk.length,
      width:ktx2?chunk.readUInt32LE(20):null,
      height:ktx2?chunk.readUInt32LE(24):null};
  });
  assert(triangles>=2000&&triangles<=50000,'Out-of-budget model triangles');
  assert(images.length>0&&images.every(x=>x.mime==='image/ktx2'),
    'Missing compressed texture images');
  assert((json.extensionsRequired||[]).every(x=>
    ['EXT_meshopt_compression','KHR_mesh_quantization','KHR_texture_basisu'].includes(x)),
    'Source requires unsupported/unknown extension');
  return {
    bytes:data.length,sha256:sha(data),triangles,primitives,
    meshes:(json.meshes||[]).length,nodes:(json.nodes||[]).length,
    materials:(json.materials||[]).length,images,
    textureBytes:images.reduce((v,x)=>v+x.bytes,0),
    extensionsRequired:json.extensionsRequired||[],
    animations:(json.animations||[]).length,skins:(json.skins||[]).length,
    materialChannels:(json.materials||[]).map(x=>({
      name:x.name||null,color:!!x.pbrMetallicRoughness?.baseColorTexture,
      normal:!!x.normalTexture,orm:!!x.pbrMetallicRoughness?.metallicRoughnessTexture
    })),
    nodeNames:(json.nodes||[]).map(n=>n.name||null).filter(Boolean).slice(0,45)
  };
}
const outputs=[];
for(const lod of [0,1,2]){
  const rec=model.files?.find(x=>x.lod===lod);
  assert(rec?.path==='/models/stealth-fighter/v1/lod'+lod+'.glb',
    'Official source file is not pinned to tested version');
  const data=await readFile('/tmp/stealth-fighter-lod'+lod+'.glb');
  const report=glb(data);
  assert(report.bytes===rec.bytes&&report.sha256===rec.sha256&&
    report.triangles===rec.triangles,
    'Published SHA/bytes/triangles mismatch for LOD '+lod);
  outputs.push({lod,source:'https://tevy.dev'+rec.path,...report});
}
assert(outputs[0].triangles>outputs[1].triangles&&
  outputs[1].triangles>outputs[2].triangles,'LOD topology not decreasing');
const summary={
  source:'https://tevy.dev/models/stealth-fighter',
  author:'tevy publisher (individual artist not disclosed)',
  license:'CC0 1.0 (publisher metadata and website; no separate author attribution)',
  redistributionAllowedByPublisher:true,
  exactRealAircraft:false,
  candidateFor:'Viper Jet visual asset comparison ONLY; no production replacement',
  originalViper:'index.html::buildFighterMesh, original fictional twin-tail jet',
  actualOriginalGLBs:outputs,
  nextStep:'standalone Chromium GLTFLoader+MeshoptDecoder+KTX2Loader screenshot, no runtime loader modification',
  runtimeCompatible:false,
  reason:'PATROL uses its custom baked-color aircraft mesh uploader, not Three.js GLTFLoader/meshopt/KTX2',
  auditAt:new Date().toISOString()
};
await writeFile(OUTPUT+'/stealth-fighter-source-audit.json',
  JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({license:summary.license,model:outputs.map(x=>({
  lod:x.lod,bytes:x.bytes,sha256:x.sha256,triangles:x.triangles,
  materialCount:x.materials,images:x.images,required:x.extensionsRequired
}))},null,2));
