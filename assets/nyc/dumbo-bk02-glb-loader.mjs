// Strict same-origin GLB 2.0 decoder for the bounded NYC DCP 2014 BK02 source mesh.
const MAX_BYTES=2_000_000,MAX_TRIANGLES=20_000;
const MAGIC=0x46546c67,JSON_CHUNK=0x4e4f534a,BIN_CHUNK=0x004e4942;
const finite=Number.isFinite;
function readChunk(view,offset,expected){
  if(offset+8>view.byteLength)throw Error('Truncated BK02 GLB chunk');
  const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);
  if(type!==expected||offset+8+length>view.byteLength)throw Error('Invalid BK02 GLB chunk');
  return {length,start:offset+8,end:offset+8+length};
}
function accessor(doc,view,binStart,binLength,index,type,componentType){
  const a=doc.accessors?.[index],b=a&&doc.bufferViews?.[a.bufferView];
  if(!a||!b||a.type!==type||a.componentType!==componentType||a.sparse||b.buffer!==0||b.byteStride!==undefined)
    throw Error('Unsupported BK02 GLB accessor');
  const components=type==='VEC3'?3:1,vo=b.byteOffset??0,vl=b.byteLength,ao=a.byteOffset??0;
  if(!Number.isSafeInteger(vo)||vo<0||!Number.isSafeInteger(vl)||vl<components*4||vo+vl>binLength||
     !Number.isSafeInteger(ao)||ao<0||ao%4!==0||!Number.isSafeInteger(a.count)||a.count<1||ao+a.count*components*4>vl)
    throw Error('BK02 GLB accessor exceeds bufferView');
  const start=binStart+vo+ao;
  const read=componentType===5126?(i,k=0)=>view.getFloat32(start+(i*components+k)*4,true):
    componentType===5125?(i)=>view.getUint32(start+i*4,true):null;
  if(!read)throw Error('Unsupported BK02 GLB component type');
  return {count:a.count,read};
}
export function decodeDumbo2014GLB(bytes){
  if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<36||bytes.byteLength>MAX_BYTES)throw Error('BK02 GLB empty or over 2 MB budget');
  const view=new DataView(bytes);
  if(view.getUint32(0,true)!==MAGIC||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)
    throw Error('Invalid BK02 GLB header');
  const jc=readChunk(view,12,JSON_CHUNK);
  const doc=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,jc.start,jc.length)));
  const bc=readChunk(view,jc.end,BIN_CHUNK),binLength=bc.length,binStart=bc.start;
  if(bc.end!==bytes.byteLength||doc.asset?.version!=='2.0'||doc.buffers?.length!==1||doc.buffers[0].uri||
     doc.buffers[0].byteLength>binLength||doc.meshes?.length!==1||doc.nodes?.length!==1||doc.nodes[0].mesh!==0||
     doc.nodes[0].matrix||doc.nodes[0].translation||doc.nodes[0].rotation||doc.nodes[0].scale)
    throw Error('Unsupported BK02 GLB document structure');
  const meta=doc.asset.extras;
  if(meta?.sourceVintage!==2014||meta?.verticalDatumVerified!==false||meta?.diagnosticOffsetApplied!==false||
     meta?.runtimeRole!=='VISUAL_ONLY_HISTORICAL_SOURCE_LAYER; no collision or current building replacement')
    throw Error('BK02 source provenance gate failed');
  const primitives=doc.meshes[0].primitives;
  if(!Array.isArray(primitives)||primitives.length!==3)throw Error('Expected three BK02 layer primitives');
  const out=[],counts={};let totalTriangles=0,visibleTriangles=0;
  for(const primitive of primitives){
    if(primitive.mode!==4||primitive.attributes?.POSITION===undefined||primitive.attributes?.NORMAL===undefined||primitive.indices===undefined)
      throw Error('Unsupported BK02 GLB primitive');
    const kind=primitive.extras?.sourceLayerKind;
    if(!['roof','facade','footprint'].includes(kind)||counts[kind])throw Error('Invalid BK02 layer kind');
    const p=accessor(doc,view,binStart,binLength,primitive.attributes.POSITION,'VEC3',5126);
    const n=accessor(doc,view,binStart,binLength,primitive.attributes.NORMAL,'VEC3',5126);
    const ix=accessor(doc,view,binStart,binLength,primitive.indices,'SCALAR',5125);
    if(p.count!==n.count||ix.count%3!==0||ix.count/3>MAX_TRIANGLES)throw Error('BK02 GLB count mismatch');
    const color=doc.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorFactor;
    if(!Array.isArray(color)||color.length!==4||!color.every(x=>finite(x)&&x>=0&&x<=1))throw Error('Invalid BK02 GLB material');
    const triangles=ix.count/3;totalTriangles+=triangles;
    if(totalTriangles>MAX_TRIANGLES)throw Error('BK02 GLB triangle budget exceeded');
    counts[kind]={triangles,patches:primitive.extras?.sourcePatches??0};
    if(kind==='footprint')continue;
    visibleTriangles+=triangles;
    for(let i=0;i<ix.count;i++){
      const v=ix.read(i);if(v>=p.count)throw Error('BK02 GLB index outside position accessor');
      const pos=[p.read(v,0),p.read(v,1),p.read(v,2)],normal=[n.read(v,0),n.read(v,1),n.read(v,2)],mag=Math.hypot(...normal);
      if(!pos.every(finite)||!normal.every(finite)||mag<.5||mag>1.5||
         pos[0]<-350||pos[0]>300||pos[1]<-.1||pos[1]>150||pos[2]<-330||pos[2]>330)
        throw Error('BK02 GLB vertex outside DUMBO metre bounds');
      out.push(...pos,...normal,color[0],color[1],color[2]);
    }
  }
  if(totalTriangles!==8541||counts.facade?.patches!==2093||counts.roof?.patches!==314||
     counts.footprint?.patches!==82||visibleTriangles!==7475)throw Error('BK02 GLB counts differ from reviewed source snapshot');
  return {vertices:new Float32Array(out),stats:{triangles:totalTriangles,visibleTriangles,vertexCount:out.length/9,counts,
    sourceVintage:meta.sourceVintage,verticalDatumVerified:meta.verticalDatumVerified,diagnosticOffsetApplied:meta.diagnosticOffsetApplied,
    source3dmSha256:meta.source3dmSha256,sourceZipSha256:meta.sourceZipSha256,
    sourceCoordinateReference:meta.sourceCoordinateReference,viewerCoordinateFrame:meta.viewerCoordinateFrame}};
}
export async function loadDumbo2014GLB(url){
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error('DUMBO 2014 GLB HTTP '+response.status);
  if(Number(response.headers.get('content-length')||0)>MAX_BYTES)throw Error('DUMBO 2014 GLB exceeds 2 MB budget');
  return decodeDumbo2014GLB(await response.arrayBuffer());
}
