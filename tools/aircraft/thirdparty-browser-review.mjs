// Isolated CC0 source rendering QA, NOT the live PATROL simulator.
// Generates a throwaway viewer only inside CI artifacts; never edits index.html.
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='artifacts/c185-asset-review/viewer';
await mkdir(root,{recursive:true});
const candidates=[
  {id:'patrol-current',url:'/assets/aircraft/cessna185-floats.glb',label:'PATROL original C185 (procedural)'},
  {id:'3dassets-highwing',url:'/artifacts/c185-asset-review/viewer/3dassets-highwing.glb',label:'3DAssets generic 4-seat twin floats'},
  {id:'3dassets-lite',url:'/artifacts/c185-asset-review/viewer/3dassets-lite.glb',label:'3DAssets generic small twin floats'},
  {id:'innerscene-twin',url:'/artifacts/c185-asset-review/viewer/innerscene-twin.glb',label:'Innerscene generic 4-seat dual floats'},
  {id:'innerscene-amphibious',url:'/artifacts/c185-asset-review/viewer/innerscene-amphibious.glb',label:'Innerscene generic amphibious floats'},
  {id:'innerscene-sixseat',url:'/artifacts/c185-asset-review/viewer/innerscene-sixseat.glb',label:'Innerscene six-seat generic dual floats, 11.2m span'}
];
const html=`<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box} body{margin:0;background:#bfd5e1;color:#102533}
#canvas{display:block;width:960px;height:540px}
</style></head><body><canvas id="canvas"></canvas><script type="module">
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
const choices=${JSON.stringify(candidates)},params=new URLSearchParams(location.search);
const choice=choices.find(x=>x.id===params.get('model')),angle=params.get('angle')||'oblique';
const canvas=document.querySelector('#canvas');
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb4d1e1);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(960,540,false);renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
scene.add(new THREE.HemisphereLight(0xffffff,0x587b8b,2.5));
const sun=new THREE.DirectionalLight(0xffffff,2.7);sun.position.set(6,17,10);scene.add(sun);
const water=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({
  color:0x396a83,metalness:.15,roughness:.26,transparent:true,opacity:.67,side:THREE.DoubleSide
}));water.rotation.x=-Math.PI/2;water.position.y=.17;scene.add(water);
const grid=new THREE.GridHelper(26,26,0x6ca0ac,0x628b9d);grid.position.y=.183;scene.add(grid);
let errorMessage=null;
try {
 if(!choice)throw Error('Unrecognized candidate');
 const t0=performance.now();
 const gltf=await new GLTFLoader().loadAsync(choice.url);
 const decodeMs=performance.now()-t0;
 const model=gltf.scene;
 scene.add(model);model.updateMatrixWorld(true);
 const rawBounds=new THREE.Box3().setFromObject(model);
 const min=rawBounds.min.toArray(),max=rawBounds.max.toArray();
 const size=rawBounds.getSize(new THREE.Vector3()),center=rawBounds.getCenter(new THREE.Vector3());
 if(![size.x,size.y,size.z].every(x=>Number.isFinite(x)&&x>1&&x<20))
   throw Error('Invalid meter-scale model size: '+size.toArray());
 model.position.set(-center.x,-rawBounds.min.y,-center.z);
 model.updateMatrixWorld(true);
 const length=Math.max(size.x,size.z);
 const camera=new THREE.PerspectiveCamera(43,960/540,.1,120);
 if(angle==='side')camera.position.set(length*1.35,size.y*.75+1.9,0);
 else camera.position.set(length*.94,size.y*1.5+3,length*1.22);
 camera.lookAt(0,size.y*.46,0);
 camera.updateProjectionMatrix();
 let meshes=0,materials=new Set(),textures=new Set();
 model.traverse(n=>{
   if(n.isMesh){
     meshes++;
     for(const mat of (Array.isArray(n.material)?n.material:[n.material])){
       if(mat){materials.add(mat.uuid);
         for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap']){
           if(mat[key])textures.add(mat[key].uuid);
         }
       }
     }
   }
 });
 const durations=[];let last=null;
 for(let i=0;i<8;i++){
   await Promise.race([
     new Promise((resolve,reject)=>requestAnimationFrame(now=>{
       try{
         if(last!==null)durations.push(now-last);
         last=now;renderer.render(scene,camera);resolve();
       }catch(e){reject(e)}
     })),
     new Promise((_,reject)=>setTimeout(()=>reject(Error('Timed out waiting for real WebGL render frame')),12000))
   ]);
 }
 renderer.render(scene,camera);
 durations.sort((a,b)=>a-b);
 const sample=p=>Math.round(durations[Math.floor((durations.length-1)*p)]*10)/10;
 window.__c185QA={
   done:true,id:choice.id,angle,webgl2:renderer.capabilities.isWebGL2,
   sizeMeters:size.toArray().map(x=>+x.toFixed(4)),rawBounds:{min,max},
   calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
   drawMeshes:meshes,materials:materials.size,textureObjects:textures.size,
   animations:gltf.animations.map(a=>a.name||'unnamed'),
   loadMs:Math.round(decodeMs),medianFrameMs:sample(.5),p95FrameMs:sample(.95),
   frameSamples:durations.length,
   warning:'Water plane is a visual reference at minY + 0.17, NOT a measured floating waterline.'
 };
}catch(e){
 errorMessage=e.stack||String(e);
 window.__c185QA={done:true,error:errorMessage,id:choice?.id||null,angle};
}
document.documentElement.dataset.qa='done';
</script></body></html>`;
await writeFile(root+'/viewer.html',html);
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const base=(process.env.PATROL_C185_QA_BASE||'http://127.0.0.1:8766').replace(/\/$/,'');
const reports=[];
try{
 for(const candidate of candidates){
   for(const angle of ['oblique','side']){
     const page=await browser.newPage({viewport:{width:960,height:540}});
     const errors=[];
     page.on('pageerror',e=>errors.push(String(e)));
     try{
       const url=base+'/artifacts/c185-asset-review/viewer/viewer.html?'+
         new URLSearchParams({model:candidate.id,angle});
       const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
       if(!response?.ok())throw Error('Standalone QA viewer not served');
       await page.waitForFunction(()=>document.documentElement.dataset.qa==='done',null,{timeout:75000});
       const data=await page.evaluate(()=>window.__c185QA);
       if(!data||data.error||!data.webgl2||data.triangles<500)
         throw Error('GLTFLoader source render failed: '+JSON.stringify(data));
       if(errors.length)throw Error('Browser JS exceptions: '+errors.join(';'));
       await page.locator('#canvas').screenshot({path:root+'/'+candidate.id+'-'+angle+'.png'});
       reports.push({...data,screenshot:candidate.id+'-'+angle+'.png'});
     }catch(error){
       reports.push({id:candidate.id,angle,error:String(error),errors});
     }finally{await page.close()}
   }
 }
}finally{
 await browser.close();
}
const out={environment:'Chromium SwiftShader software WebGL2, NOT real GPU FPS or PATROL gameplay',
 reportedAt:new Date().toISOString(),reports,
  pass:reports.every(x=>!x.error),
  releaseApproved:false,
  identityNote:'Most CC0 candidates are generic four-seat planes; Innerscene six-seat is C185-like in size but NOT a proven exact Cessna 185.'
};
await writeFile('artifacts/c185-asset-review/browser-report.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(!out.pass)process.exitCode=1;
