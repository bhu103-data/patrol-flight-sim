// SHA-locked 828-triangle 3DAssets.dev streetlight preview. NO production import.
// Source CC0 claim and exact bytes verified in run 44869352893.
const SOURCE='./assets/chongqing/review/3dassets-street-light.glb';
const SHA256='78665c352776386f7b968b6bccb14e022e326238632577becf6df396428a4a88';
const BYTES=205696;
export async function load3dAssetsLampPreview({THREE,scene,streetBuild,search='',fetcher=fetch}){
  if(new URLSearchParams(search).get('lampReview')!=='3dassets')
    return {active:false,reason:'Not a review URL'};
  if(!streetBuild.reviewLampSlot)throw Error('No checked roadside slot');
  const url=new URL(SOURCE,location.href);
  if(url.origin!==location.origin)throw Error('GLB must use local test server');
  const response=await fetcher(url.href,{cache:'no-store'});
  if(!response.ok)throw Error('Audited source GLB unavailable from test server');
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==BYTES)throw Error('Source binary length mismatch');
  const sum=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const hex=Array.from(sum,n=>n.toString(16).padStart(2,'0')).join('');
  if(hex!==SHA256)throw Error('Source SHA-256 changed');
  const started=performance.now();
  const {GLTFLoader}=await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js');
  const asset=await new Promise((resolve,reject)=>
    new GLTFLoader().parse(bytes,'',resolve,reject));
  const model=asset.scene;
  if(!model?.isObject3D)throw Error('No Three.js object in source GLB');
  const box=new THREE.Box3().setFromObject(model);
  const size=box.getSize(new THREE.Vector3());
  if(![size.x,size.y,size.z].every(x=>Number.isFinite(x)&&x>0&&x<15))
    throw Error('Unexpected source model bounds');
  const a=streetBuild.reviewLampSlot;
  model.position.set(a.x-(box.min.x+box.max.x)*.5,a.y-box.min.y,
    a.z-(box.min.z+box.max.z)*.5);
  model.traverse(node=>{
    if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}
  });
  scene.add(model);
  let active=true,low=false;
  const decodeMs=performance.now()-started;
  function setQuality(q){
    if(!active)return;
    low=q==='low';
    model.visible=!low;
    streetBuild.setReviewLampVisible(low);
    document.documentElement.dataset.streetlampReview=low?'low-fallback':'ready';
  }
  try{setQuality('high');}
  catch(e){scene.remove(model);streetBuild.setReviewLampVisible(true);throw e;}
  return {
    active,bytes:bytes.byteLength,triangles:828,sha256:hex,
    bounds:[size.x,size.y,size.z],decodeMs,anchor:a,setQuality,
    restore(){
      if(!active)return;
      scene.remove(model);
      streetBuild.setReviewLampVisible(true);
      active=false;
      document.documentElement.dataset.streetlampReview='off';
    }
  };
}
