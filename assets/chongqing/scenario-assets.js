// PATROL_CQ_SCENARIO_PREVIEW_V2 — review-only GLB import from Scenario for Blender.
// Never used to replace procedural landmarks without independent visual QA.
// Requires the same Three.js singleton import map as chongqing.html.
export function validateChongqingScenarioManifest(manifest){
  if(!manifest||manifest.schema!=='patrol.chongqing.scenario-assets.v1'||
     !Array.isArray(manifest.entries))throw Error('Scenario manifest invalid');
  if(manifest.entries.length>8)throw Error('Too many Scenario assets');
  const seen=new Set();
  for(const e of manifest.entries){
    if(!e||!['hongyadong','qiansimen','raffles','liziba'].includes(e.id)||
       seen.has(e.id))throw Error('Unrecognized or repeated asset id');
    seen.add(e.id);
    if(!Array.isArray(e.anchor)||e.anchor.length!==3||
       !e.anchor.every(Number.isFinite)||!Number.isFinite(e.scale)||
       e.scale<=0||e.scale>4)throw Error('Invalid anchor/scale: '+e.id);
    if(e.enabled && (!e.license||!e.license.trim()))
      throw Error('Enabled Scenario model lacks redistribution license: '+e.id);
    if(e.enabled&&!/^[.][/]+assets[/]chongqing[/]scenario[/][a-z0-9-]+[.]glb$/i.test(e.file))
      throw Error('Unsafe non-local asset path');
  }
  return true;
}
export async function previewChongqingScenarioAssets({THREE,scene,ground}){
  const query=new URLSearchParams(location.search);
  if(query.get('scenarioPreview')!=='1')return {mode:'inactive',loaded:[]};
  const response=await fetch('./assets/chongqing/scenario-manifest.json',{cache:'no-store'});
  if(!response.ok)throw Error('Scenario manifest HTTP '+response.status);
  const manifest=await response.json();
  validateChongqingScenarioManifest(manifest);
  const enabled=manifest.entries.filter(item=>item.enabled);
  if(!enabled.length)return {mode:'preview',loaded:[],note:'No paid or reviewed Scenario GLB is enabled'};
  const {GLTFLoader}=await import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js');
  const loader=new GLTFLoader(),loaded=[],max=8*1024*1024;
  for(const item of enabled){
    try{
      const abs=new URL(item.file,document.baseURI);
      const base=new URL('./assets/chongqing/scenario/',document.baseURI);
      if(abs.origin!==base.origin||!abs.pathname.startsWith(base.pathname))
        throw Error('Refusing external Scenario asset');
      const result=await fetch(abs,{mode:'same-origin'});
      if(!result.ok)throw Error('HTTP '+result.status);
      const buffer=await result.arrayBuffer();
      if(buffer.byteLength<20||buffer.byteLength>max)throw Error('Asset exceeds 8 MiB or is empty');
      const scene3d=await new Promise((resolve,reject)=>{
        loader.parse(buffer,base.href,gltf=>resolve(gltf.scene),reject);
      });
      let triangles=0;
      scene3d.traverse(obj=>{
        if(!obj.isMesh)return;
        const geo=obj.geometry;
        triangles+=geo.index?geo.index.count/3:(geo.getAttribute('position')?.count||0)/3;
        obj.castShadow=true;obj.receiveShadow=true;
      });
      if(triangles>25000)throw Error('Asset exceeds 25k triangles');
      const [x,,z]=item.anchor,off=item.offset||[0,0,0];
      scene3d.position.set(x+off[0],ground(x,z)+off[1],z+off[2]);
      scene3d.scale.setScalar(item.scale);
      scene3d.userData.patrolScenarioPreview=item.id;
      // Preview appears next to procedural geometry and is never considered
      // a production replacement or a physics collider.
      scene.add(scene3d);loaded.push({id:item.id,triangles});
    }catch(error){console.warn('[PATROL] Scenario preview fallback',item.id,error);}
  }
  return {mode:'preview',loaded};
}
