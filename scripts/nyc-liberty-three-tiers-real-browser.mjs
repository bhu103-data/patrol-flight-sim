// Exact original PATROL Manhattan scene, SHA-pinned Liberty: 3 real camera/plane distances.
// The QA hook changes only a served HTML response, not index.html on any Git branch.
// These are placed reproducible IN-GAME aircraft poses, NOT flown physical routes or GPS photo matches.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const ROOT=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const OUT='artifacts/nyc-liberty-three-distance-tiers';
await mkdir(OUT,{recursive:true});
const cases=[
 {name:'near',cameraDistance:56,aircraftDistance:59,bearing:173,lod:'near-cc0',tris:15900},
 {name:'mid',cameraDistance:180,aircraftDistance:207,bearing:45,lod:'mid-bundled-glb',tris:292},
 {name:'far',cameraDistance:340,aircraftDistance:371,bearing:45,lod:'far-bundled-glb',tris:292}
];
const report={status:'FAIL',source:process.env.GITHUB_SHA||'local',
 geometry:'authored CC0, NOT surveyed NYC',backend:'SwiftShader software WebGL2',
 method:'test-only browser HTTP injection moves actual in-game aircraft and scenic camera',
 hardLimits:'not physically flown, not registered GPS camera, no native GPU FPS',
 tiers:[],errors:[],warnings:[]};
let browser;
function imageStats(data){
 const p=PNG.sync.read(data),bins=new Set();let n=0,black=0;
 for(let y=0;y<p.height;y+=9)for(let x=0;x<p.width;x+=9){
   const i=(y*p.width+x)*4,r=p.data[i],g=p.data[i+1],b=p.data[i+2];
   bins.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));n++;
   if(r+g+b<25)black++;
 }
 assert.equal(p.width,1280);assert.equal(p.height,720);
 assert.ok(bins.size>28&&black/n<.96,'blank actual flight screenshot');
 return {width:p.width,height:p.height,colorBins:bins.size,blackFraction:black/n};
}
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage',
   '--ignore-gpu-blocklist','--enable-webgl','--use-gl=angle',
   '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());
   else if(m.type()==='warning')report.warnings.push(m.text());});
 await page.route('**/index.html*',async route=>{
   const res=await route.fetch();let html=await res.text();
   const marker='  // Web Audio Synthesizer (Muted by default)';
   assert.ok(html.includes(marker),'PATROL QA injection anchor missing');
   html=html.replace(marker,"\nwindow.__libertyDistanceQA={\n ready:()=>({city:!!selectedMap.city,playing:!!(flying&&!crash),\n   source:nycRealismAssets?.models?.liberty?.source||'none',\n   triangles:nycRealismAssets?.models?.liberty?.triangleCount||0}),\n pose:(p)=>{\n   if(!selectedMap.city||!scenicViewActive||!flying||crash)throw Error('real NYC flight/scenic mode not ready');\n   const mark=NEW_YORK_LANDMARKS.find(x=>x.kind==='liberty');\n   const view=NYC_SCENIC_VIEWS.find(x=>x.name==='Statue of Liberty');\n   if(!mark||!view)throw Error('real in-game Liberty site missing');\n   hotelZoom.value='42'; hotelAngle.value='0';\n   view.radius=p.cameraDistance/(1.24-0.68*.42); view.bearing=p.bearing;\n   plane.pos=[mark.x+p.aircraftDistance,\n     Math.max(90,sampleGroundHeight(mark.x+p.aircraftDistance,mark.z)+40),\n     mark.z];\n   plane.speed=0;plane.throttle=0;plane.vsi=0;plane.pitch=0;plane.bank=0;\n   camInitialized=false;\n   window.PatrolLibertyLodQA=null;\n   return {viewRadius:view.radius,bearing:view.bearing,aircraft:[...plane.pos],\n     target:[mark.x,mark.z]};\n },\n sample:()=>{\n   const mark=NEW_YORK_LANDMARKS.find(x=>x.kind==='liberty');\n   const c=getScenicCamera();\n   const ctx=glCanvas.getContext('webgl2');\n   const model=nycRealismAssets?.models?.liberty;\n   return {\n     fov:c.fov,actualEye:[...camPos],computedScenicEye:[...c.eye],\n     aircraft:[...plane.pos],aircraftType:selectedAircraft,\n     eyeDistance:Math.hypot(camPos[0]-mark.x,camPos[2]-mark.z),\n     aircraftDistance:Math.hypot(plane.pos[0]-mark.x,plane.pos[2]-mark.z),\n     lod:window.PatrolLibertyLodQA||null,\n     gl:{webgl2:!!ctx&&!ctx.isContextLost(),error:ctx?.getError()??null},\n     model:{source:model?.source,triangles:model?.triangleCount,\n       texture:!!model?.texture},\n     running:!!(flying&&!crash),crash:crash?.reason||null\n   };\n }\n};"+'\n'+marker);
   await route.fulfill({response:res,body:html,contentType:'text/html; charset=utf-8'});
 });
 const started=Date.now();
 const resp=await page.goto(ROOT+'/index.html?nycLibertyCC0=1&nycLibertyLodQA=1',
   {waitUntil:'domcontentloaded',timeout:65000});
 assert.ok(resp?.ok(),'original game unavailable');
 await page.locator('#startFlight').click({timeout:20000});
 await page.waitForFunction(()=>document.getElementById('loadOverlay')?.classList.contains('done')
   &&document.getElementById('titleOverlay')?.hidden,null,{timeout:165000});
 report.initialLoadMs=Date.now()-started;
 await page.waitForFunction(()=>{
   const q=window.__libertyDistanceQA?.ready();
   return q?.city&&q?.playing&&q?.source==='scenario'&&q?.triangles===15900;
 },null,{timeout:100000});
 report.start=await page.evaluate(()=>window.__libertyDistanceQA.ready());
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
   null,{timeout:20000});
 await page.locator('#hotelTarget').selectOption({label:'Statue of Liberty'});
 await page.addStyleTag({content:
  'body.tier-photo *{visibility:hidden!important} body.tier-photo #glCanvas{visibility:visible!important}'});
 for(const tier of cases){
   const setup=await page.evaluate(p=>window.__libertyDistanceQA.pose(p),tier);
   await page.waitForFunction(expected=>{
     const s=window.__libertyDistanceQA?.sample();
     return s?.running&&s?.gl.webgl2&&s?.gl.error===0&&s?.lod?.lod===expected;
   },tier.lod,{timeout:95000,polling:300});
   // 10+ genuine rAF intervals from this game; these are wall-clock intervals, not hardware GPU timings.
   const frame=await page.evaluate(()=>new Promise(resolve=>{
     let prev=null,values=[],finished=false;
     const complete=()=>{
       if(finished)return;finished=true;clearTimeout(watchdog);
       values.sort((a,b)=>a-b);
       resolve({samples:values.length,
         meanMs:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,
         p95Ms:values.length?values[Math.ceil(values.length*.95)-1]:null});
     };
     const watchdog=setTimeout(complete,65000);
     const take=t=>{
       if(finished)return;
       if(prev!==null&&t>prev&&t-prev<10000)values.push(t-prev);
       prev=t;
       if(values.length>=10)complete();else requestAnimationFrame(take);
     };
     requestAnimationFrame(take);
   }));
   const actual=await page.evaluate(()=>window.__libertyDistanceQA.sample());
   assert.equal(actual.lod?.lod,tier.lod,'renderer picked wrong LOD');
   assert.equal(actual.lod?.drawTriangles,tier.tris,'renderer sent wrong mesh tris');
   assert.equal(actual.gl.error,0,'WebGL error');
   const nearest=Math.min(actual.eyeDistance,actual.aircraftDistance);
   if(tier.name==='near')assert.ok(nearest<105,'near threshold not reached');
   if(tier.name==='mid')assert.ok(nearest>=105&&nearest<275,
     'both actual camera+plane must cross 105 but not 275');
   if(tier.name==='far')assert.ok(nearest>=275,
     'both actual camera+plane must cross 275');
   assert.ok(frame.samples>=6,'insufficient rAF samples');
   await page.evaluate(()=>document.body.classList.add('tier-photo'));
   let bytes;
   try{bytes=await page.locator('#glCanvas').screenshot({
     path:OUT+'/'+tier.name+'-real-game.png',timeout:115000,animations:'disabled'});}
   finally{await page.evaluate(()=>document.body.classList.remove('tier-photo'));}
   const pixels=imageStats(bytes);
   report.tiers.push({name:tier.name,expected:tier,setup,actual,
     frame,pixels,file:tier.name+'-real-game.png'});
   console.log('[liberty-3-tier] '+JSON.stringify({name:tier.name,lod:actual.lod,
     eye:actual.eyeDistance,aircraft:actual.aircraftDistance,frame,pixels}));
 }
 assert.deepEqual(report.errors,[],'JS/WebGL errors occurred in actual PATROL');
 report.status='PASS';
}catch(e){
 report.error=e.stack||String(e);
 console.error('[liberty-3-tier] FAIL '+report.error);
 process.exitCode=1;
}finally{
 await writeFile(OUT+'/three-tier-report.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();
}
console.log('[liberty-3-tier-FINAL] '+JSON.stringify({status:report.status,
 initialLoadMs:report.initialLoadMs,tiers:report.tiers.map(t=>({
 name:t.name,lod:t.actual.lod?.lod,eye:t.actual.eyeDistance,
 plane:t.actual.aircraftDistance,tris:t.actual.lod?.drawTriangles,frame:t.frame}))},null,2));
