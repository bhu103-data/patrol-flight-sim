// Isolated A/B WebGL preview. Never loads on normal game URLs.
// CI downloads the exact producer GLB into the *temporary* static server.
// No external model host, token, payment or unreviewed texture is contacted by the game.
const CANDIDATE='./assets/chongqing/review/street-light.glb';
const APPROVED_SHA256='68cc8b7e67065bc365724c4535ad6a7eb6a2a3d911ef279978a8adda5b82f0ef';
const APPROVED_BYTES=702900;

export async function loadAuditedLampPreview({THREE,scene,streetBuild,search='',fetcher=fetch}){
  if(new URLSearchParams(search).get('lampReview')!=='grab3d')
    return {active:false,reason:'Review disabled'};
  if(!streetBuild.reviewLampSlot)throw Error('No collision-clear original streetlamp slot');
  const url=new URL(CANDIDATE,location.href);
  if(url.origin!==location.origin)throw Error('Only same-origin audited GLB preview is permitted');
  const response=await fetcher(url.href,{cache:'no-store'});
  if(!response.ok)throw Error('Original producer GLB not present in review sandbox');
  const data=await response.arrayBuffer();
  if(data.byteLength!==APPROVED_BYTES)throw Error('Review GLB byte count differs from independently audited source');
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  const hash=Array.from(digest,n=>n.toString(16).padStart(2,'0')).join('');
  if(hash!==APPROVED_SHA256)throw Error('Source GLB sha256 mismatch; procedural fallback retained');
  const view=new DataView(data);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||
    view.getUint32(8,true)!==data.byteLength)throw Error('Not an audited glTF 2.0 file');

  const start=performance.now();
  const {GLTFLoader}=await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js');
  const loaded=await new Promise((resolve,reject)=>
    new GLTFLoader().parse(data,'',resolve,reject));
  const model=loaded.scene;
  if(!model?.isObject3D)throw Error('GLTFLoader returned no model');
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  if(![size.x,size.y,size.z].every(n=>Number.isFinite(n)&&n>0&&n<15))
    throw Error('Unexpected imported model dimensions');
  const anchor=streetBuild.reviewLampSlot;
  // Keep the official 8.158m height, not the original stylized 12m pole.
  model.position.set(anchor.x-(bounds.min.x+bounds.max.x)*.5,
    anchor.y-bounds.min.y,
    anchor.z-(bounds.min.z+bounds.max.z)*.5);
  model.traverse(node=>{
    if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}
  });
  model.updateMatrixWorld(true);
  const decodeMs=performance.now()-start;
  scene.add(model);
  let active=true,lowQuality=false;
  function setQuality(mode){
    if(!active)return;
    lowQuality=mode==='low';
    model.visible=!lowQuality;
    streetBuild.setReviewLampVisible(lowQuality);
    document.documentElement.dataset.streetlampReview=lowQuality?'low-fallback':'ready';
  }
  try{setQuality('high');}
  catch(e){scene.remove(model);streetBuild.setReviewLampVisible(true);throw e;}
  return {
    active,decodeMs,sha256:hash,bytes:data.byteLength,
    sourceTriangles:5280,bounds:[size.x,size.y,size.z],anchor,
    setQuality,
    get lowFallback(){return lowQuality;},
    restore(){
      if(!active)return;
      scene.remove(model);
      streetBuild.setReviewLampVisible(true);
      active=false;
      document.documentElement.dataset.streetlampReview='off';
    }
  };
}
