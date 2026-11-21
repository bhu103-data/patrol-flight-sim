// Read-only bench source/geometry audit. No PATROL runtime or collision changes.
// Real publisher GLBs are downloaded to a free ephemeral CI runner only.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';

const DIR='artifacts/nyc-park-bench-review';
await mkdir(DIR,{recursive:true});
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const sha256=data=>createHash('sha256').update(data).digest('hex');
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function multiply(a,b) {
  const out=new Array(16).fill(0);
  for(let col=0;col<4;col++)for(let row=0;row<4;row++)
    for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*b[col*4+k];
  return out;
}
function nodeMatrix(n) {
  if(n.matrix)return n.matrix;
  const [x,y,z,w]=n.rotation||[0,0,0,1];
  const [sx,sy,sz]=n.scale||[1,1,1];
  const [tx,ty,tz]=n.translation||[0,0,0];
  return [
    (1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,
    (2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,
    (2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,
    tx,ty,tz,1
  ];
}
const emptyBounds=()=>({min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
function absorb(out,pos) {
  for(let k=0;k<3;k++){out.min[k]=Math.min(out.min[k],pos[k]);out.max[k]=Math.max(out.max[k],pos[k]);}
}
function transformBox(out,min,max,m) {
  for(let bits=0;bits<8;bits++){
    const p=[0,1,2].map(k=>(bits>>k)&1?max[k]:min[k]);
    absorb(out,[0,1,2].map(k=>m[12+k]+m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]));
  }
}
function componentValue(view,componentType,offset) {
  if(componentType===5120)return view.getInt8(offset);
  if(componentType===5121)return view.getUint8(offset);
  if(componentType===5122)return view.getInt16(offset,true);
  if(componentType===5123)return view.getUint16(offset,true);
  if(componentType===5125)return view.getUint32(offset,true);
  if(componentType===5126)return view.getFloat32(offset,true);
  throw Error('Unsupported glTF POSITION type '+componentType);
}
const componentSize={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
function normalized(v,c,enabled) {
  if(!enabled)return v;
  if(c===5120)return Math.max(-1,v/127);
  if(c===5121)return v/255;
  if(c===5122)return Math.max(-1,v/32767);
  if(c===5123)return v/65535;
  if(c===5125)return v/4294967295;
  return v;
}
function imageSize(bytes,mime) {
  if(mime==='image/png'&&bytes.length>24&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))
    return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
  if(mime==='image/webp'&&bytes.subarray(0,4).toString()==='RIFF'){
    const chunk=bytes.subarray(12,16).toString();
    if(chunk==='VP8X')return {width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
    if(chunk==='VP8 '&&bytes.length>30)return {width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};
    if(chunk==='VP8L'&&bytes.length>25){
      const w=1+(((bytes[22]&0x3f)<<8)|bytes[21]);
      const h=1+(((bytes[24]&0xf)<<10)|(bytes[23]<<2)|((bytes[22]&0xc0)>>6));
      return {width:w,height:h};
    }
  }
  if(mime==='image/jpeg'){
    let p=2;
    while(p+9<bytes.length){
      if(bytes[p]!==255){p++;continue}
      const marker=bytes[p+1];p+=2;
      if(marker===0xd8||marker===0xd9)continue;
      if(marker===0xda)break;
      if(p+2>bytes.length)break;
      const n=bytes.readUInt16BE(p);
      if(n<2||p+n>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3].includes(marker)&&n>=7)
        return {width:bytes.readUInt16BE(p+5),height:bytes.readUInt16BE(p+3)};
      p+=n;
    }
  }
  return {width:null,height:null};
}
function parseGLB(bytes){
  assert(bytes.length>100&&bytes.length<2500000,'Unexpected source GLB size');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u32=i=>view.getUint32(i,true);
  assert(u32(0)===0x46546c67&&u32(4)===2&&u32(8)===bytes.length,'Invalid glTF 2.0 GLB header');
  let doc=null,binBase=null,binLength=0,offset=12;
  while(offset+8<=bytes.length){
    const size=u32(offset),type=u32(offset+4);
    assert(size%4===0&&offset+8+size<=bytes.length,'Invalid GLB chunk bounds');
    if(type===0x4e4f534a){assert(!doc,'Duplicate JSON chunk');doc=JSON.parse(bytes.subarray(offset+8,offset+8+size).toString('utf8'))}
    if(type===0x004e4942){assert(binBase===null,'Duplicate BIN chunk');binBase=offset+8;binLength=size}
    offset+=8+size;
  }
  assert(offset===bytes.length&&doc?.asset?.version==='2.0'&&binBase!==null,'Bad GLB manifest');
  const bv=doc.bufferViews||[],accessors=doc.accessors||[];
  let tris=0,primitives=0,meshBounds=[],drawMaterialIds=new Set();
  function getPosBounds(i){
    const a=accessors[i],b=bv[a?.bufferView],sz=componentSize[a?.componentType];
    assert(a?.type==='VEC3'&&sz&&b?.buffer===0&&!a.sparse&&a.count>0,
      'Unsupported POSITION buffer '+JSON.stringify({accessorIndex:i,type:a?.type,
        componentType:a?.componentType,bufferView:a?.bufferView,buffer:b?.buffer,
        count:a?.count,sparse:!!a?.sparse,extensions:b?.extensions}));
    const stride=b.byteStride||sz*3,base=(b.byteOffset||0)+(a.byteOffset||0);
    assert(base+stride*(a.count-1)+sz*3<=(b.byteOffset||0)+b.byteLength,'POSITION out of bufferView');
    assert(base+stride*(a.count-1)+sz*3<=binLength,'POSITION out of BIN');
    const out=emptyBounds();
    if(a.min?.length===3&&a.max?.length===3){
      absorb(out,a.min.map(n=>normalized(n,a.componentType,a.normalized)));
      absorb(out,a.max.map(n=>normalized(n,a.componentType,a.normalized)));
    }else{
      for(let j=0;j<a.count;j++){
        const p=[0,1,2].map(k=>normalized(componentValue(view,a.componentType,binBase+base+j*stride+k*sz),
          a.componentType,a.normalized));
        absorb(out,p);
      }
    }
    return out;
  }
  for(const mesh of doc.meshes||[]){
    const mb=emptyBounds();
    for(const prim of mesh.primitives||[]){
      assert((prim.mode??4)===4,'Not triangles');
      const pa=accessors[prim.attributes?.POSITION];assert(pa,'Missing positions');
      const ia=prim.indices===undefined?pa:accessors[prim.indices];
      assert(Number.isInteger(ia?.count)&&ia.count%3===0,'Bad index count');
      tris+=ia.count/3;primitives++;
      if(prim.material!==undefined)drawMaterialIds.add(prim.material);
      const p=getPosBounds(prim.attributes.POSITION);
      absorb(mb,p.min);absorb(mb,p.max);
    }
    meshBounds.push(mb);
  }
  const global=emptyBounds(),nodes=doc.nodes||[],seen=new Set();
  function walk(idx,parent){
    assert(!seen.has(idx),'Invalid cyclic/reused node');
    seen.add(idx);
    const n=nodes[idx];assert(n,'Bad scene node');
    const mat=multiply(parent,nodeMatrix(n));
    if(n.mesh!==undefined){
      const bounds=meshBounds[n.mesh];assert(bounds,'Missing mesh index');
      transformBox(global,bounds.min,bounds.max,mat);
    }
    for(const c of n.children||[])walk(c,mat);
    seen.delete(idx);
  }
  const roots=doc.scenes?.[doc.scene??0]?.nodes||nodes.map((_,i)=>i);
  for(const r of roots)walk(r,identity);
  assert(Number.isFinite(global.min[0])&&tris>0,'No world-space geometry');
  const materials=doc.materials||[];
  const textures=doc.images||[];
  const imgs=textures.map((x,i)=>{
    const b=x.bufferView===undefined?null:bv[x.bufferView];
    const ib=b&&bytes.subarray(binBase+(b.byteOffset||0),binBase+(b.byteOffset||0)+b.byteLength);
    const size=ib?imageSize(ib,x.mimeType):{width:null,height:null};
    return {index:i,mime:x.mimeType||null,embeddedBytes:ib?.length||0,externalURI:x.uri||null,...size};
  });
  const size=global.max.map((n,i)=>+(n-global.min[i]).toFixed(4));
  return {bytes:bytes.length,sha256:sha256(bytes),triangles:tris,primitives,
    meshes:meshBounds.length,materials:materials.length,materialNames:materials.map(x=>x.name||null),
    embeddedImages:imgs,embeddedTextureBytes:imgs.reduce((n,x)=>n+x.embeddedBytes,0),
    sceneBounds:global,sizeMeters:size,requiredExtensions:doc.extensionsRequired||[],
    animations:(doc.animations||[]).length,materialChannels:materials.map(x=>({
      name:x.name||null,baseColor:!!x.pbrMetallicRoughness?.baseColorTexture,
      metallicRoughness:!!x.pbrMetallicRoughness?.metallicRoughnessTexture,
      normal:!!x.normalTexture,occlusion:!!x.occlusionTexture,emissive:!!x.emissiveTexture
    }))};
}
const catalog=JSON.parse(await readFile('/tmp/tevy-models.json','utf8'));
const tevy=catalog.models?.find(x=>x.slug==='park-bench');
assert(tevy&&tevy.license==='CC0-1.0'&&tevy.units==='meters'&&tevy.up==='+Y'&&tevy.version===1,
  'Publisher catalog license/units/version changed');
assert(tevy.files?.length>=3,'Source catalog has no pinned 3 LODs');
const sourcePage=await readFile('/tmp/tevy-park-bench.html','utf8');
assert(sourcePage.includes('CC0 1.0')&&sourcePage.includes('Park Bench'),
  'Publisher source page/license evidence unavailable');
const outputs=[];
for(let level=0;level<=2;level++){
  const record=tevy.files.find(x=>x.lod===level);
  assert(record?.path==='/models/park-bench/v1/lod'+level+'.glb','Source not version pinned');
  const bytes=await readFile('/tmp/tevy-park-bench-lod'+level+'.glb');
  const info=parseGLB(bytes);
  assert(info.bytes===record.bytes&&info.sha256===record.sha256&&info.triangles===record.triangles,
    'Actual GLB does not match publisher catalog at LOD '+level);
  assert(info.requiredExtensions.length===0,'Source GLB requires extension not supported by current browser adapter');
  const dim=info.sizeMeters;
  assert(dim.every(n=>n>=.25&&n<2.5)&&Math.abs(Math.max(...dim)-1.8)<.15,
    'Invalid real-scale bench bounds');
  outputs.push({lod:level,author:'tevy (publisher; individual artist uncredited)',
    license:'CC0 1.0 (publisher page + catalog)',
    source:'https://tevy.dev'+record.path,sourcePage:'https://tevy.dev/models/park-bench',
    licenseURL:'https://creativecommons.org/publicdomain/zero/1.0/',
    originalRedistributionAllowed:true,model:info});
}
for(let i=1;i<outputs.length;i++)
  assert(outputs[i].model.triangles<outputs[i-1].model.triangles&&
    outputs[i].model.bytes<outputs[i-1].model.bytes,'LOD budget does not descend');
const alternativePage=await readFile('/tmp/innerscene-bench.html','utf8');
assert(alternativePage.includes('Public domain (CC0)')&&
  alternativePage.includes('Original Innerscene model'),'Innerscene copyright statement missing');
const otherBytes=await readFile('/tmp/innerscene-bench.glb');
const other=parseGLB(otherBytes);
const parkSrc=await readFile('assets/nyc/central-park.js','utf8');
const context={};
new Script(parkSrc.replace(/^export /gm,'')+
  '\n;globalThis.park={PARK_WATERS,normalizedWaterDistance};').runInNewContext(context);
const u=9,z=163;
const dists=context.park.PARK_WATERS.map(f=>({name:f.name,
  normalizedWaterDistance:+context.park.normalizedWaterDistance(u,z,f).toFixed(4)}));
const min=Math.min(...dists.map(x=>x.normalizedWaterDistance));
assert(min>1.20,'Bench test site is on an existing lake/shore ribbon');
const x=30+.24*z+u;
assert(Math.abs(u-18)>4.55+1&&Math.abs(z-157)>2.9+1,'Too close to Loeb Boathouse');
const benchSites=[];for(let i=0;i<17;i++)if(i%2===0)
  benchSites.push({u:31,z:68+i*274/16});
const nearest=Math.min(...benchSites.map(p=>Math.hypot(u-p.u,z-p.z)));
assert(nearest>15,'Already furnished by existing Central Park bench');
const placement={
  name:'Lake east-shore lawn-side bench, near Loeb Boathouse',
  prototypeOnly:true,assetLoadedByGame:false,collisionRegistered:false,
  parkLocal:{u,z},patrolWorldXZ:{x:+x.toFixed(2),z},
  referenceOrientation:'seat faces the Lake, with its back on the lawn side; not surveyed',
  locationIsRealWorldSurvey:false,benchWorldScale:1,
  clearance:{normalizedDistances:dists,nearestExistingBenchMetersGameSpace:+nearest.toFixed(2),
    boathouseCenterLocal:{u:18,z:157},waterDistanceGate:min},
  camera:{builtIn:'Central Park · Loeb Boathouse',
    builtInView:{x:85.68,z:157,height:3,bearing:175,radius:17,rise:6.8},
    second:'Central Park · Bow Bridge',fixedNearGround:'x=78.12, z=163; ground height=terrainAt(x,z)+1.6; look at bench center; 35mm equivalent field-of-view'},
  noNewGameCollision:true,noRoadEdit:true,noTerrainEdit:true
};
const result={baseline:'codex/patrol-integration-20261121 (6d50bfd)',
  latestCheckedAt:new Date().toISOString(),
  recommendation:'tevy LOD1 one-asset candidate for isolated QA, not a live-game import',
  sourceIntegrityPass:true,
  tevy:outputs,alternative:{
    author:'Innerscene (publisher; individual artist uncredited)',
    originalSource:'https://www.innerscene.com/tools/library/3d-parts/park-bench-timber-slats-on-cast-legs-e4bff625',
    license:'Publisher original CC0; modification and redistribution allowed',
    model:other},
  placement,gameplayTouched:false};
await writeFile(DIR+'/actual-source-geometry-and-licensing.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({tevy:outputs.map(x=>({lod:x.lod,bytes:x.model.bytes,
  tris:x.model.triangles,dimensions:x.model.sizeMeters,
  embeddedTextures:x.model.embeddedImages,materials:x.model.materials,extensions:x.model.requiredExtensions})),
  alternative:{bytes:other.bytes,triangles:other.triangles,dimensions:other.sizeMeters,
    images:other.embeddedImages},placement,sourceIntegrityPass:true},null,2));
