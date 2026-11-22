// PATROL NYC harbor: LICENSED generic ro-ro ferry visual-only LOD pilot.
// The three GLBs are publisher tevy CC0 v1 assets, transcoded offline to
// ordinary embedded-PNG GLB2 because the native renderer has no Meshopt/KTX2.
// They are NOT measured NYC Ferry or Staten Island Ferry vessels.
// Gameplay routes, ship collision, C185 footprint and wreck split use the
// existing procedural SHIP_TYPES and never depend on these visual meshes.
const SOURCES = [
  {tier:'far',file:'tevy-ro-ro-lod2.glb',bytes:505076,sha256:'7b14324877e0da022a3e3cbf27bc00206bfbc7a693b7ee3d35d85a528cfaea1b',tris:5502,sourceTris:5478},
  {tier:'mid',file:'tevy-ro-ro-lod1.glb',bytes:2176996,sha256:'c30c18eb05f3ba2f8479bc782794b8fd7115ae6aefd2e1ac9cd244cdeb1baa91',tris:19827,sourceTris:19775},
  {tier:'near',file:'tevy-ro-ro-lod0.glb',bytes:5936236,sha256:'143815ec7d9830970f6d568ba5ec4495d8c422b2be8e2465fc4274819fc58288',tris:52121,sourceTris:52069}
];
const PREFIX='./assets/nyc/harbor/';
function hex(buffer) {
  return Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
}
function releaseMesh(gl,mesh){
  if(!mesh)return;
  for(const b of mesh.buffers||[])gl.deleteBuffer(b);
  if(mesh.vao)gl.deleteVertexArray(mesh.vao);
  if(mesh.texture)gl.deleteTexture(mesh.texture);
}
export function createNycHarborFerryLods(gl, decodeGLB, opts={}) {
  if(!gl||typeof decodeGLB!=='function')throw Error('Ferry preview requires game WebGL2 decoder');
  const fetchFn=opts.fetchFn||fetch;
  const onStatus=opts.onStatus||(()=>{});
  const controllers=new Set();
  const models=new Map();
  let disposed=false,started=false;
  const stats={ready:[],failed:[],bytes:0,loadedTriangles:0,requested:[],
    selections:{near:0,mid:0,far:0,fallback:0}};
  async function loadOne(spec){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),13000);
    controllers.add(ctrl);
    try {
      const url=PREFIX+spec.file;
      stats.requested.push(spec.tier);
      const response=await fetchFn(url,{signal:ctrl.signal,cache:'force-cache'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const bytes=await response.arrayBuffer();
      if(bytes.byteLength!==spec.bytes)throw Error('Source byte count changed');
      if(!globalThis.crypto?.subtle)throw Error('Secure-context SHA-256 unavailable');
      const digest=hex(await globalThis.crypto.subtle.digest('SHA-256',bytes));
      if(digest!==spec.sha256)throw Error('Asset integrity mismatch');
      if(disposed||gl.isContextLost())return;
      // LOD0 has 52,069 unique indexed triangles but 52,121 drawn triangles
      // (469,089 expanded XYZ floats) because both door-ram nodes share
      // and instantiate the same 52-triangle mesh. Keep both copies.
      // Only the SHA/length-verified near tier can exceed the native
      // 240,000-float landmark budget; all other GLBs keep that default.
      const mesh=await decodeGLB(gl,bytes,7.5,
        spec.tier==='near'?480000:240000);
      if(mesh.triangleCount!==spec.tris ||
         mesh.dimensions.width>6.6||mesh.dimensions.depth>26.5){
        releaseMesh(gl,mesh);
        throw Error('GLB geometry exceeds ferry visual/collision contract');
      }
      if(disposed||gl.isContextLost()){releaseMesh(gl,mesh);return;}
      models.set(spec.tier,mesh);
      stats.ready.push(spec.tier);
      stats.bytes+=bytes.byteLength;
      stats.loadedTriangles+=mesh.triangleCount;
      onStatus({tier:spec.tier,status:'ready',triangles:mesh.triangleCount});
    }catch(error){
      if(!disposed){
        stats.failed.push({tier:spec.tier,error:String(error?.message||error)});
        onStatus({tier:spec.tier,status:'fallback',message:String(error?.message||error)});
      }
    }finally{
      clearTimeout(timer);
      controllers.delete(ctrl);
    }
  }
  function start(){
    if(started||disposed)return;
    started=true;
    // Load the 0.5 MB far tier first so near-shore gameplay can recover even
    // if heavy close-detail assets are missing or timeout.
    void (async()=>{for(const spec of SOURCES){
      if(disposed)break;
      await loadOne(spec);
    }})();
  }
  function select(distance){
    if(disposed||!Number.isFinite(distance))return null;
    // Never draw the 52k near tier at long distance: a missing far tier
    // must fall back to the cheap authored hull, not to expensive geometry.
    const tiers=distance<140?['near','mid','far']:
      distance<380?['mid','far']:['far'];
    for(const tier of tiers)if(models.has(tier)){
      stats.selections[tier]++;
      return models.get(tier);
    }
    stats.selections.fallback++;
    return null;
  }
  function dispose(){
    disposed=true;
    for(const controller of controllers)controller.abort();
    controllers.clear();
    for(const mesh of models.values())releaseMesh(gl,mesh);
    models.clear();
  }
  return {start,select,dispose,stats,
    get disposed(){return disposed;},
    get ready(){return models.size>0;}};
}
export const NYC_FERRY_LOD_PREVIEW={source:'https://tevy.dev/models/car-ferry',
  author:'tevy (publisher)',license:'CC0-1.0',commercial:true,
  modify:true,redistribute:true,nearDistance:140,midDistance:380,
  role:'Generic ro-ro reference vessel; not an exact New York ferry'};
