// Audit only NEW NYC landmark candidates against integration baseline 6d50bfd.
// No Sketchfab viewer extraction, no production asset import, no paid services.
// Usage: node tools/nyc/audit-new-landmark-candidates.mjs
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const dir='artifacts/nyc-new-landmark-audit';
await mkdir(dir,{recursive:true});
function assert(ok,message){if(!ok)throw Error(message);}
function sha(data){return createHash('sha256').update(data).digest('hex');}
async function optional(path){try{return await readFile(path)}catch{return null}}
function parseGLB(data){
  assert(data&&data.length>=32&&data.length<=18_000_000,'Missing/oversized source GLB');
  const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
  const n=i=>v.getUint32(i,true);
  assert(n(0)===0x46546c67&&n(4)===2&&n(8)===data.length,'Invalid glTF2 header');
  let offset=12,json=null,binLength=0;
  while(offset+8<=data.length){
    const size=n(offset),type=n(offset+4);
    assert(size%4===0&&offset+8+size<=data.length,'GLB chunk outside file');
    if(type===0x4e4f534a){
      assert(!json,'Duplicate JSON chunk');
      json=JSON.parse(data.subarray(offset+8,offset+8+size).toString('utf8'));
    }
    if(type===0x004e4942)binLength=size;
    offset+=8+size;
  }
  assert(offset===data.length&&json?.asset?.version==='2.0'&&binLength>0,'Invalid GLB content');
  const views=json.bufferViews||[],accessors=json.accessors||[];
  let triangles=0,primitives=0,drawMaterials=new Set();
  for(const mesh of json.meshes||[]){
    for(const prim of mesh.primitives||[]){
      assert((prim.mode??4)===4,'Non-triangle topology');
      const a=accessors[prim.indices??prim.attributes?.POSITION];
      assert(Number.isInteger(a?.count)&&a.count>0&&a.count%3===0,'Missing triangle topology');
      triangles+=a.count/3;
      primitives++;
      if(prim.material!==undefined)drawMaterials.add(prim.material);
    }
  }
  const images=(json.images||[]).map((im,i)=>{
    const bv=im.bufferView===undefined?null:views[im.bufferView];
    return {index:i,embedded:!!bv,mimeType:im.mimeType||null,
      embeddedBytes:bv?.byteLength??null,externalUri:im.uri||null};
  });
  let texturesTotal=0;
  for(const im of images)texturesTotal+=im.embeddedBytes||0;
  const roots=json.scenes?.[json.scene||0]?.nodes||[];
  const nodeNames=(json.nodes||[]).map(x=>x.name||'');
  return {
    sourceGLBBytes:data.length,sha256:sha(data),
    triangles,primitives,meshCount:(json.meshes||[]).length,
    materials:(json.materials||[]).length,
    namedMaterials:(json.materials||[]).map(x=>x.name||'unnamed').slice(0,30),
    usedDrawMaterials:drawMaterials.size,
    images,texturePayloadBytes:texturesTotal,
    externalImages:images.filter(x=>x.externalUri).length,
    imageMimeFormats:[...new Set(images.map(x=>x.mimeType).filter(Boolean))],
    extensionsRequired:json.extensionsRequired||[],
    extensionsUsed:json.extensionsUsed||[],
    animationCount:(json.animations||[]).length,
    skinCount:(json.skins||[]).length,
    nodeNames:nodeNames.slice(0,80),
    sceneRoots:roots,
    gltfGenerator:json.asset.generator||null,
    noAuthoredLODs:!(nodeNames.some(x=>/\\bLOD\\d\\b/i.test(x))||
      (json.extensionsUsed||[]).includes('MSFT_lod')),
    sourceMeshDimensionsNotCertified:true
  };
}
const sketchfabCandidates=[
 {name:'Brooklyn Bridge - Union',id:'a1ea746e42d6499080d73db514848d6b',
  subject:'New York Brooklyn Bridge'},
 {name:'Statue of Liberty - Gravity Jack',id:'84094e8d5e724b5c882cf576ca12e44e',
  subject:'New York Statue of Liberty (authored replica, not a scan)'},
 {name:'One World Trade Center - NanoRay',id:'44e60b2d0d764fdab74d33703847d38e',
  subject:'New York One World Trade Center'}
];
const results=[];
for(const candidate of sketchfabCandidates){
  const p=dir+'/sketchfab-'+candidate.id+'.json';
  const doc=await optional(p);
  if(!doc){results.push({name:candidate.name,status:'NO_OFFICIAL_API_METADATA'});continue;}
  const response=JSON.parse(doc);
  const m=response.metadata||{};
  const lic=m.license||{};
  const officialBy=lic.slug==='by'&&/creativecommons.org\\/licenses\\/by\\/4\\.0/.test(lic.url||'');
  const author=m.user?.username||null;
  results.push({
    name:candidate.name,subject:candidate.subject,
    originalModelURL:'https://sketchfab.com/3d-models/'+candidate.id,
    officialMetadataHTTP:response.metadataHTTP,officialDownloadHTTP:response.downloadHTTP,
    author,license:lic.fullName||null,licenseURL:lic.url||null,
    attributionRequired:officialBy,
    permitsPublicGitHubAdaptation:officialBy,
    sourceMarkedDownloadable:!!m.isDownloadable,
    publicFaces:m.faceCount??null,publicVertices:m.vertexCount??null,
    sourceGeometryInspected:false,
    sourceTexturesInspected:false,
    originalTriangulatedCount:null,
    originalGLBBytes:null,
    actualNYCLandmarkIdentityVerified:false,
    accessBlocker:response.downloadHTTP===401?
      'Official Sketchfab model download API requires authentication; no authorized download archive obtained':
      'Official archive not obtained; source checks still required',
    decision:'HOLD — no verified, redistributable original mesh or textures'
  });
}
const pub=await optional(dir+'/innerscene-page.html');
let innerscene={status:'NOT_DOWNLOADED'};
if(pub){
  const page=pub.toString('utf8');
  const cc0=page.includes('Public domain (CC0)')&&
    page.includes('Original Innerscene model');
  const correctSite=page.includes('liberty island')&&page.includes('Statue of Liberty');
  const binary=await optional('/tmp/nyc-statue-on-pedestal.glb');
  if(binary){
    try{
      const geometry=parseGLB(binary);
      innerscene={
        status:'DOWNLOADED_AND_GEOMETRY_INSPECTED',author:'Innerscene',
        sourcePage:'https://www.innerscene.com/tools/library/3d-parts/statue-of-liberty-on-its-pedestal-c8a7318f',
        licenseClaim:cc0?'CC0 (original publisher webpage)':'UNVERIFIED — NOT FOR REDISTRIBUTION',
        canRedistributeClaim:cc0,
        correctNewYorkLandmarkDepictedByPublisher:correctSite,
        isPhotogrammetry:false,
        exactNYCLibertyIslandGeometry:false,
        scaleClaim:'27.7m × 27.7m × 92.996m, producer nominal dimensions only',
        geometry,
        productionApproved:false,
        browserBudgetCaution:'The GLB is much larger than PATROL current 37,276-byte MIT statue; no swap or reuse without visual and flight-FPS test'
      };
    }catch(error){innerscene={status:'SOURCE_PARSE_FAILED',error:String(error),canRedistributeClaim:cc0};}
  }else innerscene={status:'OFFICIAL_DOWNLOAD_UNAVAILABLE',canRedistributeClaim:cc0};
}
const summary={
  baselineBranch:'codex/patrol-integration-20261121',
  baselineSHA:'6d50bfda4b2d3837e550751ede49b200b140bc72',
  scope:'New NYC landmark candidates only. No old C185, Grab3D or Paris replica re-audit.',
  sketchfabCandidates:results,innersceneStatue:innerscene,
  productionAssetsModified:false,
  caveat:'License claims are from creators; check third-party texture authors and model accuracy before redistributing.'
};
await writeFile(dir+'/new-nyc-landmark-candidate-verdict.json',
  JSON.stringify(summary,null,2)+'\\n');
console.log(JSON.stringify({
  baseline:summary.baselineSHA,
  sketchfab:results.map(x=>({name:x.name,author:x.author,license:x.license,
    faces:x.publicFaces,verts:x.publicVertices,downloadHTTP:x.officialDownloadHTTP})),
  innerscene:innerscene.status==='DOWNLOADED_AND_GEOMETRY_INSPECTED'?
    {status:innerscene.status,licensed:innerscene.canRedistributeClaim,
      site:innerscene.correctNewYorkLandmarkDepictedByPublisher,
      bytes:innerscene.geometry.sourceGLBBytes,
      tris:innerscene.geometry.triangles,
      materials:innerscene.geometry.materials,
      embeddedImages:innerscene.geometry.images.length,
      texturePayloadBytes:innerscene.geometry.texturePayloadBytes,
      noAuthoredLODs:innerscene.geometry.noAuthoredLODs}:
    innerscene,productionApproved:false
},null,2));
if(innerscene.status!=='DOWNLOADED_AND_GEOMETRY_INSPECTED')process.exitCode=1;
