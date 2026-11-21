// Third-party floatplane provenance and actual original GLB parser.
// No game runtime, paid API, code or index.html changes. Node 22 built-ins only.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
const dir='artifacts/c185-asset-review';
const sources=[
  {id:'patrol-current',path:'assets/aircraft/cessna185-floats.glb',selfAuthored:true},
  {id:'3dassets-highwing',path:'/tmp/3dassets-highwing.glb',metadata:'/tmp/3dassets-highwing.json',
   publishedId:'32603',maxBytes:1800000},
  {id:'3dassets-lite',path:'/tmp/3dassets-lite.glb',metadata:'/tmp/3dassets-lite.json',
   publishedId:'18714',maxBytes:850000},
  {id:'innerscene-twin',path:'/tmp/innerscene-twin.glb',source:'https://www.innerscene.com/tools/library/3d-parts/high-wing-4-seat-floatplane-twin-floats-8fde8873',maxBytes:2200000},
  {id:'innerscene-amphibious',path:'/tmp/innerscene-amphibious.glb',source:'https://www.innerscene.com/tools/library/3d-parts/high-wing-4-seat-on-amphibious-floats-4be93185',maxBytes:2500000},
  {id:'innerscene-sixseat',path:'/tmp/innerscene-sixseat.glb',source:'https://www.innerscene.com/tools/library/3d-parts/seaplane-floatplane-edd77cd2',maxBytes:12000000}
];
const identity=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
function mult(a,b){const out=new Array(16).fill(0);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)
    for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];
  return out;
}
function matrix(node){
  if(node.matrix)return node.matrix;
  const [x,y,z,w]=node.rotation||[0,0,0,1], [sx,sy,sz]=node.scale||[1,1,1],
    [tx,ty,tz]=node.translation||[0,0,0];
  return [
    (1-2*y*y-2*z*z)*sx,(2*x*y+2*z*w)*sx,(2*x*z-2*y*w)*sx,0,
    (2*x*y-2*z*w)*sy,(1-2*x*x-2*z*z)*sy,(2*y*z+2*x*w)*sy,0,
    (2*x*z+2*y*w)*sz,(2*y*z-2*x*w)*sz,(1-2*x*x-2*y*y)*sz,0,
    tx,ty,tz,1
  ];
}
function bounds(){return {min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};}
function absorb(b,p){for(let i=0;i<3;i++){b.min[i]=Math.min(b.min[i],p[i]);b.max[i]=Math.max(b.max[i],p[i]);}}
function corners(lo,hi,m,b){
  for(let bits=0;bits<8;bits++){
    const p=[0,1,2].map(i=>(bits>>i)&1?hi[i]:lo[i]);
    const q=[0,1,2].map(r=>m[12+r]+m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]);
    absorb(b,q);
  }
}
function readGlb(data){
  const v=new DataView(data.buffer,data.byteOffset,data.byteLength),u32=i=>v.getUint32(i,true);
  if(data.length<32||data.length>20_000_000||u32(0)!==0x46546c67||u32(4)!==2||u32(8)!==data.length)
    throw Error('Bad glTF 2.0 GLB header or excessive binary bytes');
  let off=12,doc=null,binStart=0,binLength=0;
  while(off+8<=data.length){
    const n=u32(off),kind=u32(off+4);
    if(n%4||off+8+n>data.length)throw Error('Bad GLB chunk bounds');
    if(kind===0x4e4f534a){if(doc)throw Error('Duplicate JSON chunk');doc=JSON.parse(data.subarray(off+8,off+8+n).toString('utf8'));}
    if(kind===0x004e4942){binStart=off+8;binLength=n;}
    off+=8+n;
  }
  if(off!==data.length||!doc||!binLength||doc.asset?.version!=='2.0')throw Error('Invalid GLB payload');
  const bs=doc.bufferViews||[],accessors=doc.accessors||[];
  function accessor(index){
    const a=accessors[index],b=bs[a?.bufferView];
    if(!a||!b||b.buffer!==0||a.sparse||!Number.isSafeInteger(a.count)||a.count<1)
      throw Error('Unsupported or missing accessor');
    if(b.byteOffset+b.byteLength>binLength)throw Error('Accessor bufferView outside GLB');
    return a;
  }
  let triangles=0,posTypes=new Set(),meshNames=[],primCount=0;
  const ownMeshBounds=[];
  for(let mi=0;mi<(doc.meshes||[]).length;mi++){
    const mesh=doc.meshes[mi],mb=bounds();
    meshNames.push(mesh.name||'mesh-'+mi);
    for(const p of mesh.primitives||[]){
      if((p.mode??4)!==4)throw Error('Unexpected nontriangle primitive');
      const pa=accessor(p.attributes?.POSITION);
      const ind=p.indices===undefined?null:accessor(p.indices);
      const count=ind?.count??pa.count;
      if(count%3)throw Error('Nontriangular index buffer');
      triangles+=count/3;primCount++;
      posTypes.add(pa.componentType);
      // glTF accessor min/max store *quantized integer values* even when
      // accessor.normalized is true (Khronos glTF 2.0 and KHR_mesh_quantization).
      // Correctly normalize before applying a node's dequantization transform.
      const normalize=n=>{
        if(!pa.normalized)return n;
        if(pa.componentType===5120)return Math.max(-1,n/127);
        if(pa.componentType===5121)return n/255;
        if(pa.componentType===5122)return Math.max(-1,n/32767);
        if(pa.componentType===5123)return n/65535;
        if(pa.componentType===5125)return n/4294967295;
        throw Error('Normalized POSITION has invalid component type');
      };
      if(pa.min&&pa.max){absorb(mb,pa.min.map(normalize));absorb(mb,pa.max.map(normalize));}
      else if(pa.componentType===5126){
        const b=bs[pa.bufferView],stride=b.byteStride||12,start=binStart+(b.byteOffset||0)+(pa.byteOffset||0);
        const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
        for(let i=0;i<pa.count;i++)absorb(mb,[0,4,8].map(j=>view.getFloat32(start+i*stride+j,true)));
      }
    }
    ownMeshBounds.push(mb);
  }
  const sceneBounds=bounds(),floatNodes=[],floatsBounds=bounds(),meshInstances=[];
  const nodes=doc.nodes||[],seen=new Set();
  function scan(index,parent){
    if(seen.has(index))return;seen.add(index);
    const n=nodes[index];if(!n)return;
    const m=mult(parent,matrix(n));
    if(Number.isInteger(n.mesh)){
      const b=ownMeshBounds[n.mesh],world=bounds(),name=n.name||meshNames[n.mesh]||'unnamed';
      if(Number.isFinite(b.min[0])){
        corners(b.min,b.max,m,sceneBounds);corners(b.min,b.max,m,world);
        if(/(?:^|[^a-z])floats?(?:[^a-z]|$)|pontoon|hull|spreader|water.?rudder|sponson/i.test(name+' '+meshNames[n.mesh])){
          corners(b.min,b.max,m,floatsBounds);
          floatNodes.push({name,meshName:meshNames[n.mesh],bounds:world});
        }
      }
      meshInstances.push({name,mesh:n.mesh});
    }
    for(const child of n.children||[])scan(child,m);
  }
  const roots=doc.scenes?.[doc.scene||0]?.nodes||nodes.map((_,i)=>i);
  for(const root of roots)scan(root,identity);
  const images=(doc.images||[]).map((img,i)=>{
    const bv=img.bufferView===undefined?null:bs[img.bufferView];
    return {index:i,mimeType:img.mimeType||null,embedded:!!bv,bytes:bv?.byteLength??null,
      externalUri:img.uri||null};
  });
  return {
    gltfGenerator:doc.asset.generator||null,
    bytes:data.length,triangles,primitives:primCount,meshes:(doc.meshes||[]).length,
    meshInstances:meshInstances.length,materials:(doc.materials||[]).length,
    images,animationNames:(doc.animations||[]).map(a=>a.name||'unnamed'),
    requiredExtensions:doc.extensionsRequired||[],
    extensionsUsed:doc.extensionsUsed||[],positionComponentTypes:[...posTypes],
    names:meshNames.slice(0,80),floatNodes:floatNodes.slice(0,35),
    calculatedBounds:sceneBounds,
    calculatedSize:sceneBounds.max.map((v,i)=>Number((v-sceneBounds.min[i]).toFixed(4))),
    floatGeometryBounds:Number.isFinite(floatsBounds.min[0])?floatsBounds:null,
    sampledPositionAccessors:(doc.meshes||[]).flatMap(m=>(m.primitives||[]).map(p=>{
      const a=accessors[p.attributes?.POSITION];return a?{
        componentType:a.componentType,normalized:!!a.normalized,min:a.min,max:a.max
      }:null;
    })).filter(Boolean).slice(0,4),
    sampleNodeTransforms:nodes.filter(n=>n.matrix||n.scale).slice(0,5).map(n=>({
      name:n.name,translation:n.translation,scale:n.scale,matrix:n.matrix?.slice(0,16)
    })),
    lodDeclares:doc.extensionsUsed?.includes('MSFT_lod')||
      [...meshNames,...nodes.map(n=>n.name||'')].some(n=>/\bLOD\d?\b/i.test(n))||false,
    currentPATROLDecoderCompatible:
      (doc.extensionsRequired||[]).length===0 &&
      [...posTypes].every(t=>t===5126) &&
      meshInstances.every(n=>{
        const orig=nodes.find(m=>m.name===n.name);
        return orig&&!orig.matrix&&!orig.rotation&&!orig.scale&&!orig.translation;
      })
  };
}
async function optionalText(p){try{return await readFile(p,'utf8')}catch{return ''}}
async function main(){
 await mkdir(dir,{recursive:true});
 const results=[];
 for(const source of sources){
   try{
    const data=await readFile(source.path);
    if(data.length>(source.maxBytes||2_000_000))throw Error('Source file exceeds download budget');
    const report=readGlb(data);
    report.id=source.id;report.source=source.source||'existing local repository';
    report.sha256=createHash('sha256').update(data).digest('hex');
    report.exactCessna185=source.selfAuthored;
    report.licenseEvidence=source.selfAuthored?'Original PATROL procedural Blender source (no third-party original)':null;
    if(source.metadata){
      const claim=JSON.parse(await readFile(source.metadata,'utf8')).data;
      if(claim?.id!==source.publishedId)throw Error('Publisher model identity mismatch');
      if(claim.license?.slug!=='cc0-1.0'||claim.license.attributionRequired)
        throw Error('Publisher does not claim unrestricted CC0 adaptation and redistribution');
      if(claim.cdnUrl!==`https://cdn.3dassets.dev/assets/${source.publishedId}/v1/model.glb`)
        throw Error('Source URL does not match official pinned asset API');
      if(claim.stats.fileSize!==data.length||claim.stats.triangles!==report.triangles||
         claim.stats.meshes!==report.meshes||claim.stats.materials!==report.materials)
        throw Error('Actual binary metadata does not match publisher');
      report.source=claim.url;report.originalGlb=claim.cdnUrl;
      report.licenseEvidence={license:claim.license,contributor:claim.contributor,
        aiGenerated:claim.aiGenerated,aiModel:claim.aiModel};
      report.nominalSizeMeters=claim.stats.sizeMeters;
      report.declaredAnimations=claim.stats.animations;
    }else if(!source.selfAuthored){
      const page=await optionalText('/tmp/'+source.id+'.html');
      if(!page.includes('Public domain (CC0)')||
         !page.includes('Original Innerscene model'))throw Error('CC0 source page evidence missing');
      report.licenseEvidence={license:'CC0 (publisher page, no file-sidecar rights proven)',
        creator:'Innerscene',url:source.source};
    }
    report.waterline='UNVERIFIED: asset geometry baseline is not a measured loaded waterline, and visual/hydrodynamics need a separate in-game check';
    report.browserBudget={maxSourceBytes:2_000_000,sourceBytes:report.bytes,
      triangles:report.triangles,maxCurrentPATROLTriangles:50_000,
      pixelTexturesBytes:report.images.reduce((a,v)=>a+(v.bytes||0),0)};
    report.eligibleForExactC185Replacement=!!source.selfAuthored;
    results.push({id:source.id,downloaded:true,ok:true,report});
   }catch(e){results.push({id:source.id,downloaded:false,ok:false,error:String(e)});}
 }
 const status=await optionalText(dir+'/sketchfab-access.json');
 let sketchfab=null;try{sketchfab=JSON.parse(status)}catch{}
 const summary={
   generatedAt:new Date().toISOString(),
   referenceAircraft:{name:'Cessna A185F on Wipline 3000 dual floats',
     reference:'https://www.wipaire.com/wp-content/uploads/2018/06/Cessna-185-rev-4-18.pdf',
     wingSpanMeters:10.922,referenceOnly:'Wipaire drawings not licensed geometry; do not reproduce them as 3D meshes'},
   results,sketchfab,
   conclusion:'No checked generic four-seat floatplane is a true six-seat C185. No game changes or main merge approved.'
 };
 await writeFile(dir+'/actual-glb-report.json',JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({sources:results.map(x=>({id:x.id,ok:x.ok,bytes:x.report?.bytes,
   triangles:x.report?.triangles,size:x.report?.calculatedSize,
   floatNodes:x.report?.floatNodes?.map(n=>n.name).slice(0,10),
   lod:x.report?.lodDeclares,images:x.report?.images?.length,
   animations:x.report?.animationNames?.length,decoder:x.report?.currentPATROLDecoderCompatible,
   error:x.error})),sketchfab},null,2));
 if(!results.some(x=>x.id==='3dassets-highwing'&&x.ok))process.exitCode=1;
}
await main();
