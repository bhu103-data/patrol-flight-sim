// Real Chromium GLTFLoader WebGL2 PBR preview of ORIGINAL publisher CC0 source.
// Not the PATROL live fighter renderer and not an approved runtime import.
import {chromium} from 'playwright';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
const base=(process.env.PATROL_TEST_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/aircraft-two-choice-review';
await mkdir(dir,{recursive:true});
const html=String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8">
<style>
html,body{margin:0;background:#acccda}canvas{display:block;width:960px;height:540px}
</style>
<script type="importmap">{"imports":{
"three":"/node_modules/three/build/three.module.js",
"three/addons/":"/node_modules/three/examples/jsm/"
}}</script></head><body><canvas id="canvas" width="960" height="540"></canvas>
<script type="module">
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
const canvas=document.getElementById('canvas');
const q=new URLSearchParams(location.search),lod=q.get('lod')||'1';
let renderer=null;
try {
 if(!['1','2'].includes(lod))throw Error('Invalid source LOD');
 renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.setSize(960,540,false);
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xb4cdda);
 const hemi=new THREE.HemisphereLight(0xffffff,0x647b85,2.4);scene.add(hemi);
 const sun=new THREE.DirectionalLight(0xfff7e8,2.5);sun.position.set(8,19,17);
 scene.add(sun);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),
   new THREE.MeshStandardMaterial({color:0x9ca5aa,roughness:.9}));
 floor.rotation.x=-Math.PI/2;floor.position.y=-.04;scene.add(floor);
 const grid=new THREE.GridHelper(40,40,0x4b6b71,0x80949c);
 grid.position.y=.014;scene.add(grid);
 const ktx=new KTX2Loader()
   .setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/')
   .detectSupport(renderer);
 const loader=new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
 const url='/artifacts/aircraft-two-choice-review/source/stealth-fighter-lod'+lod+'.glb';
 const began=performance.now();
 const gltf=await loader.loadAsync(url);
 const loadMs=Math.round(performance.now()-began);
 const model=gltf.scene;
 let meshes=0,materials=new Set(),images=new Set(),textureUses=0,normalMaps=0,
   sourceDrawTriangles=0,movingNodeNames=[];
 model.traverse(obj=>{
   if(obj.isMesh){
     meshes++;
     const g=obj.geometry;
     sourceDrawTriangles+=(g.index?.count||g.attributes.position.count)/3;
     for(const mat of (Array.isArray(obj.material)?obj.material:[obj.material])){
       if(!mat)continue;
       materials.add(mat.uuid);
       for(const k of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap']){
         if(mat[k]){textureUses++;images.add(mat[k].uuid);
           if(k==='normalMap')normalMaps++;}
       }
     }
   }
   if(obj.name&&/flap|canopy|rudder|gear|aileron/i.test(obj.name))
     movingNodeNames.push(obj.name);
 });
 scene.add(model);
 model.updateMatrixWorld(true);
 const world=new THREE.Box3().setFromObject(model),size=world.getSize(new THREE.Vector3());
 if(![size.x,size.y,size.z].every(x=>Number.isFinite(x)&&x>2&&x<25))
   throw Error('Incorrect model dimensions '+size.toArray());
 if(Math.abs(size.x-11.7)>.4||Math.abs(size.y-3.95)>.3||
    Math.abs(size.z-17.72)>.4)
   throw Error('Dimensions do not match metric publisher metadata '+size.toArray());
 const center=world.getCenter(new THREE.Vector3());
 model.position.set(-center.x,-world.min.y,-center.z);
 model.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(42,960/540,.1,150);
 camera.position.set(size.x*.86,size.y*1.55+5,size.z*.94);
 camera.lookAt(0,size.y*.42,0);
 camera.updateProjectionMatrix();
 const readROI=()=>{
   const gl=renderer.getContext();
   const x=240,y=95,w=480,h=350;
   const buf=new Uint8Array(w*h*4);
   gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
   return buf;
 };
 model.visible=false;renderer.render(scene,camera);
 const bg=readROI();
 model.visible=true;renderer.render(scene,camera);
 const fg=readROI();
 let changed=0,visiblePixels=0,sumBrightness=0;
 for(let i=0;i<fg.length;i+=4){
   const distance=Math.abs(fg[i]-bg[i])+Math.abs(fg[i+1]-bg[i+1])+
     Math.abs(fg[i+2]-bg[i+2]);
   if(distance>48){changed++;sumBrightness+=(fg[i]+fg[i+1]+fg[i+2])/3;}
   if(fg[i]+fg[i+1]+fg[i+2]>30)visiblePixels++;
 }
 if(changed<1500||sumBrightness/Math.max(1,changed)<22)
   throw Error('Source jet is black, missing or not visible: '+changed+' changed pixels');
 const frames=[];let last=undefined;
 for(let i=0;i<6;i++){
   await new Promise((resolve,reject)=>requestAnimationFrame(time=>{
     try{renderer.render(scene,camera);if(last!==undefined)frames.push(time-last);
       last=time;resolve();}
     catch(e){reject(e);}
   }));
 }
 renderer.render(scene,camera);
 frames.sort((a,b)=>a-b);
 const gl=renderer.getContext(),dbg=gl.getExtension('WEBGL_debug_renderer_info');
 const gpuRenderer=dbg?gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
 const stat={lod:Number(lod),done:true,webgl2:renderer.capabilities.isWebGL2,gpuRenderer,
   dimensions:size.toArray().map(x=>+x.toFixed(4)),
   centeredAt:world.getCenter(new THREE.Vector3()).toArray(),
   meshes,materials:materials.size,uniqueTextureHandles:images.size,
   textureUses,normalMaps,sourceDrawTriangles:Math.round(sourceDrawTriangles),
   renderedTriangles:renderer.info.render.triangles,
   drawnCalls:renderer.info.render.calls,loadMs,
   scenePixelDelta:changed,visiblePixels,meanSubjectBrightness:
     +(sumBrightness/changed).toFixed(2),
   movingNodeNames:movingNodeNames.slice(0,25),
   frameTimesMs:frames.map(x=>+x.toFixed(1)),
   renderer:'Inspect gpuRenderer. Default CI is SwiftShader; PATROL_WEBGL_NATIVE=1 requests installed Chrome'};
 window.__jetQA=stat;
 ktx.dispose();
}catch(error){window.__jetQA={done:true,error:String(error?.stack||error)};}
document.documentElement.dataset.ready='1';
</script></body></html>`;
await writeFile(dir+'/stealth-fighter-preview.html',html);
const nativeMode=process.env.PATROL_WEBGL_NATIVE==='1';
const browser=await chromium.launch(nativeMode
  ?{headless:false,channel:'chrome',args:['--enable-webgl']}
  :{headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--disable-gpu-sandbox','--disable-dev-shm-usage'
  ]});
const outputs=[];
try{
 for(const lod of [1,2]){
   const page=await browser.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
   const consoleErrors=[];
   page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
   page.on('pageerror',e=>consoleErrors.push(e.message));
   try{
     const url=base+'/'+dir+'/stealth-fighter-preview.html?lod='+lod;
     const res=await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
     if(!res?.ok())throw Error('Source preview inaccessible');
     await page.waitForFunction(()=>document.documentElement.dataset.ready==='1',
       null,{timeout:130000});
     const report=await page.evaluate(()=>window.__jetQA);
     if(!report||report.error||!report.webgl2||report.sourceDrawTriangles<3000)
       throw Error('Unverified candidate: '+JSON.stringify(report));
     if(nativeMode&&/swiftshader|llvmpipe|software/i.test(report.gpuRenderer||''))
       throw Error('Native Chrome GPU fallback detected: '+report.gpuRenderer);
     if(consoleErrors.length)throw Error('Browser console errors: '+consoleErrors.join(';'));
     const shot=dir+'/stealth-fighter-source-lod'+lod+'-swiftshader.png';
     await page.locator('canvas').screenshot({path:shot,timeout:40000});
     outputs.push({...report,screenshot:shot});
   }catch(error){outputs.push({lod,error:String(error),consoleErrors});}
   finally{await page.close()}
 }
}finally{await browser.close()}
const result={
  source:'tevy CC0 v1 Stealth Fighter, NOT exactly a Viper or a licensed manufacturer jet',
  approvedForPatrol:false,
  nativeChromeRequested:nativeMode,
  windowsHardwareVerified:nativeMode&&process.platform==='win32'&&outputs.every(x=>!x.error),
  fileImport:'Real GLTFLoader + KTX2Loader + MeshoptDecoder original GLBs in temporary standalone viewer',
  limitations:'Original PATROL aircraft mesh/flight physics unchanged; no production texture/PBR renderer added',
  reports:outputs,complete:outputs.every(x=>!x.error)
};
await writeFile(dir+'/stealth-fighter-browser-report.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(!result.complete)process.exitCode=1;
