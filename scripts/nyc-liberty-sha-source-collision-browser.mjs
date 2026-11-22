// In-game SHA-pinned Liberty flight collision sweep, WITHOUT enabling manifest.
// Original PATROL functions are called in a browser-only test-hook; no source JS edits.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const BASE=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const OUT='artifacts/nyc-liberty-source-collision-sweep';
await mkdir(OUT,{recursive:true});
const report={status:'FAIL',sourceHead:process.env.GITHUB_SHA||'local',
  scope:'actual PATROL Manhattan source SHA-pinned 15.9k model, 12 real corridor scans, genuine overflight and body hit',
  limitation:'These are instrumented sweeps of original game resolver, NOT manually flown C185 or GPS-aligned reconstruction',
  errors:[],warnings:[]};
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox',
   '--disable-dev-shm-usage','--ignore-gpu-blocklist','--enable-webgl',
   '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());
   else if(m.type()==='warning')report.warnings.push(m.text());});
 await page.route('**/index.html*',async route=>{
   const response=await route.fetch();let html=await response.text();
   const marker='  // Web Audio Synthesizer (Muted by default)';
   assert.ok(html.includes(marker),'production collision QA hook marker not found');
   html=html.replace(marker,"\nwindow.__patrolLibertyShaCollision=()=>{\n if(!selectedMap.city||!flying||crash||titleOverlay.hidden===false)\n   throw Error('Actual Manhattan flight must be running');\n const mark=NEW_YORK_LANDMARKS.find(x=>x.kind==='liberty');\n const mesh=nycRealismAssets?.models?.liberty;\n if(!mark||mesh?.source!=='scenario'||mesh.triangleCount!==15900)\n   throw Error('Authenticated CC0 source not active');\n if(Math.abs(mesh.dimensions?.height-31.3)>.01)\n   throw Error('Source collision dimensions diverge');\n const ground=sampleGroundHeight(mark.x,mark.z);\n const clear=[];\n for(const height of [5,11,20,29]){\n   for(const radius of [8.2,9.1,10.3]){\n     const from=[mark.x+radius,ground+height,mark.z-.6];\n     const to=[mark.x+radius,ground+height,mark.z+.6];\n     checkFlightCollision(from,to);\n     clear.push({height,radius,crash:crash?.reason||null});\n     if(crash)throw Error('False positive on authenticated plaza corridor '+JSON.stringify(clear.at(-1)));\n   }\n }\n const high=[mark.x-16,ground+38,mark.z],\n       over=[mark.x+16,ground+38,mark.z];\n checkFlightCollision(high,over);\n const overflight=crash?.reason||null;\n if(overflight)throw Error('Above-crown actual game swept overflight unexpectedly crashed '+overflight);\n const left=[mark.x-16,ground+20,mark.z],\n       right=[mark.x+16,ground+20,mark.z];\n checkFlightCollision(left,right);\n const actualHit=crash?.reason||null;\n if(actualHit!=='Collision with Statue of Liberty')\n   throw Error('Body-height actual swept flight failed to hit the statue '+actualHit);\n return {source:mesh.source,triangles:mesh.triangleCount,\n   dimensions:mesh.dimensions,gameWorld:mark,ground,\n   actualPlane:selectedAircraft,clear,clearCount:clear.length,\n   overflightPath:{from:high,to:over,result:overflight},\n   bodyPath:{from:left,to:right,result:actualHit},\n   resolver:'checkFlightCollision() with production 0.65-unit substeps',\n   disclaimer:'QA invokes real production swept collision with deterministic test segments; NOT manually flown route or survey-certified monument'};\n};"+'\n'+marker);
   await route.fulfill({response,body:html,contentType:'text/html; charset=utf-8'});
 });
 const started=Date.now();
 await page.goto(BASE+'/index.html?nycLibertyCC0=1&nycLibertyLodQA=1',
   {waitUntil:'domcontentloaded',timeout:65000});
 await page.locator('#startFlight').click({timeout:20000});
 await page.waitForFunction(()=>document.getElementById('titleOverlay')?.hidden&&
   document.getElementById('loadOverlay')?.classList.contains('done'),
   null,{timeout:140000});
 report.loadMs=Date.now()-started;
 await page.waitForFunction(()=>window.PatrolLibertyLodQA?.nearTriangles===15900,
   null,{timeout:100000});
 report.manifestEnabled=await page.evaluate(async()=>(
   await (await fetch('/assets/nyc/scenario-manifest.json')).json()).landmarks.liberty.enabled);
 assert.equal(report.manifestEnabled,false,'manifest accidentally enabled');
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
   null,{timeout:25000});
 await page.locator('#hotelTarget').selectOption({label:'Statue of Liberty'});
 await page.addStyleTag({content:
   'body.collision-photo *{visibility:hidden!important}'+
   'body.collision-photo #glCanvas{visibility:visible!important}'});
 await page.evaluate(()=>document.body.classList.add('collision-photo'));
 let shot;
 try{shot=await page.locator('#glCanvas').screenshot({
   path:OUT+'/authenticated-liberty-before-real-sweeps.png',
   timeout:90000,animations:'disabled'});}
 finally{await page.evaluate(()=>document.body.classList.remove('collision-photo'));}
 const img=PNG.sync.read(shot);
 assert.equal(img.width,1280);assert.equal(img.height,720);
 report.webglBefore=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas').getContext('webgl2');
   return {ready:!!gl&&!gl.isContextLost(),error:gl?.getError()};
 });
 assert.equal(report.webglBefore.error,0);
 // The following final body hit intentionally transitions this QA page to a crash state.
 report.physics=await page.evaluate(()=>window.__patrolLibertyShaCollision());
 assert.equal(report.physics.clearCount,12);
 assert.equal(report.physics.overflightPath.result,null);
 assert.equal(report.physics.bodyPath.result,'Collision with Statue of Liberty');
 report.webglAfter=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas').getContext('webgl2');
   return {ready:!!gl&&!gl.isContextLost(),error:gl?.getError()};
 });
 assert.equal(report.webglAfter.error,0);
 assert.deepEqual(report.errors,[]);
 report.status='PASS';
}catch(e){
 report.error=e.stack||String(e);
 console.error('[liberty-sha-collision] FAIL '+report.error);
 process.exitCode=1;
}finally{
 await writeFile(OUT+'/collision-report.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();
}
console.log('[liberty-sha-collision-final] '+JSON.stringify({
 status:report.status,loadMs:report.loadMs,manifest:report.manifestEnabled,
 source:report.physics?.source,clear:report.physics?.clearCount,
 overflight:report.physics?.overflightPath?.result,
 body:report.physics?.bodyPath?.result,webgl:report.webglAfter},null,2));
