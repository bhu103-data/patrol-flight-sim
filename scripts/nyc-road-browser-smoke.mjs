// PATROL NYC WebGL smoke and screenshots; run after Playwright Chromium install.
// Start: python3 -m http.server 8765 --bind 127.0.0.1
// Test: node scripts/nyc-road-browser-smoke.mjs
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/nyc';await mkdir(out,{recursive:true});
const errors=[],warnings=[];
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')warnings.push(message.text());});
page.on('requestfailed',req=>{
 if(req.url().includes('/assets/nyc/nyc-street-network.js'))
   errors.push('NYC street module failed: '+req.url());
});
const check=(v,s)=>{if(!v)throw Error(s);};

 // Count actual PNG pixels to catch blank/black WebGL frames.
 // These checks are not a photorealism score.
function screenshotPixels(bytes){
 const img=PNG.sync.read(bytes),colors=new Set();
 let black=0,count=0;
 for(let y=0;y<img.height;y+=10)for(let x=0;x<img.width;x+=10){
  const i=(y*img.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
  colors.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
  if(r+g+b<22)black++;
  count++;
 }
 return {width:img.width,height:img.height,colorBins:colors.size,
  nearBlackFraction:black/Math.max(count,1)};
}
// HUD panels overlap the canvas in the browser compositor. Even an
// element.screenshot() includes those overlays unless we hide them.
// The temporary class preserves canvas visibility and is always removed,
// so scenic view controls still work for subsequent camera selections.
const screenshots=[],pixels={},captureTimings={};
let pendingShot=null,hudStyleInstalled=false;
async function capture(name){
 // Navigation replaces document styles, so install the UI-hiding style
 // lazily on the loaded game page, not on Playwright's blank startup tab.
 if(!hudStyleInstalled){
  await page.addStyleTag({content:
   'body.patrol-qa-scene-only * {visibility:hidden !important;} '+
   'body.patrol-qa-scene-only #glCanvas {visibility:visible !important;}'});
  hudStyleInstalled=true;
 }
 // Photograph WebGL color alone. The menu/HUD cannot make a blank scene
 // appear detailed. Software SwiftShader gets a bounded 75-second budget.
 const started=Date.now();
 pendingShot=name;
 console.log('[PATROL QA] capturing canvas-only scene '+name);
 await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
 try{
  const hidden=await page.locator('#hotelViews').evaluate(
   el=>getComputedStyle(el).visibility==='hidden');
  check(hidden,'Scenic Views overlay still covers WebGL screenshot');
  const image=await page.locator('#glCanvas').screenshot({
   path:out+'/'+name,animations:'allow',timeout:75000
  });
  const stats=screenshotPixels(image);
  captureTimings[name]=Date.now()-started;
  check(stats.width>=640&&stats.height>=360&&stats.colorBins>32&&
   stats.nearBlackFraction<.97,
   'Blank or nearly uniform NYC WebGL canvas: '+name+' '+JSON.stringify(stats));
  screenshots.push(name);pixels[name]=stats;
  pendingShot=null;
  console.log('[PATROL QA] captured '+name+' '+captureTimings[name]+'ms');
 }finally{
  await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
 }
}

let result;
try{
 const res=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 check(res?.ok(),'NYC launcher did not respond');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 // Terrain generation is asynchronous. Require the game overlay to complete.
 await page.waitForFunction(()=>{
  const title=document.getElementById('titleOverlay');
  const load=document.getElementById('loadOverlay');
  return title?.hidden&&load?.classList.contains('done');
 },null,{timeout:120000});
 // PATROL_NYC_QA_DAYLIGHT_LOCK_V1: a nine/ten-camera SwiftShader tour
 // can consume most of the game's 240-second day-night cycle. Freeze the
 // *test browser only* at noon, clear summer daylight for repeatable
 // facade reflectance and consistent camera-to-camera image metrics.
 await page.evaluate(()=>{
  for(const [id,value] of [
   ['skyTime','12'],['skySeason','1'],['skyWeather','Clear']
  ]){
   const el=document.getElementById(id);
   if(!el)throw Error('Missing flight environment control: '+id);
   el.value=value;
   el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await page.waitForTimeout(1800);
 const state=await page.evaluate(()=>{
  const glCanvas=document.getElementById('glCanvas');
  const gl=glCanvas?.getContext('webgl2');
  return {
   canvasW:glCanvas?.width||0,canvasH:glCanvas?.height||0,
   webgl:Boolean(gl&&!gl.isContextLost()),
   selected:document.querySelector('input[name="flightMap"]:checked')?.value,
   menuHidden:document.getElementById('titleOverlay')?.hidden
  };
 });
 check(state.webgl,'NYC WebGL2 context lost');
 check(state.canvasW>300&&state.canvasH>200,'NYC canvas is unexpectedly small');
 check(state.selected==='manhattan'&&state.menuHidden,'NYC map did not start');
 await capture('00-harbor.png');
 await page.waitForTimeout(3500);
 await capture('01-city-loaded.png');
 // The previous smoke test photographed only the spawn harbor. Explicitly
 // visit the Brooklyn Bridge camera so bridgehead, nearby parcels and road
 // clipping are visible in CI artifacts rather than being inferred from code.
 const bridgeShortcut=page.locator('#bridgeShortcutButton');
 check(await bridgeShortcut.isVisible(),'Brooklyn Bridge camera button missing');
 await bridgeShortcut.click();
 await page.waitForFunction(()=>{
   const panel=document.getElementById('hotelViews');
   const target=document.getElementById('hotelTarget');
   return panel&&!panel.hidden&&
     target?.options[target.selectedIndex]?.textContent==='Brooklyn Bridge · Deck View';
 },null,{timeout:12000});
 await page.waitForTimeout(1800);
 const bridge=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   const target=document.getElementById('hotelTarget');
   return {camera:target?.options[target.selectedIndex]?.textContent,
     webgl:Boolean(gl&&!gl.isContextLost()),
     graphicsError:gl?.getError()??null};
 });
 check(bridge.webgl&&bridge.graphicsError===0,
   'Brooklyn Bridge view lost WebGL: '+JSON.stringify(bridge));
 await capture('02-brooklyn-bridgehead.png');
 // Also inspect the residential/warehouse blocks. The bridge deck camera
 // fills most of the frame with cables and cannot assess street facades.
 await page.locator('#hotelTarget').selectOption({label:'DUMBO · Warehouse Blocks'});
 await page.waitForTimeout(1800);
 const dumbo=await page.evaluate(()=>{
   const target=document.getElementById('hotelTarget');
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   return {camera:target?.options[target.selectedIndex]?.textContent,
     webgl:Boolean(gl&&!gl.isContextLost()),graphicsError:gl?.getError()??null};
 });
 check(dumbo.camera==='DUMBO · Warehouse Blocks'&&dumbo.webgl&&
   dumbo.graphicsError===0,'DUMBO building view failed: '+JSON.stringify(dumbo));
 await capture('03-dumbo-warehouse.png');
 // Review the procedural Liberty crown from the dedicated close-up camera,
 // rather than inferring statue quality from distant harbor screenshots.
 await page.locator('#hotelTarget').selectOption({label:'Statue of Liberty'});
 await page.waitForTimeout(1600);
 const liberty=await page.evaluate(()=>{
   const target=document.getElementById('hotelTarget');
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   return {camera:target?.options[target.selectedIndex]?.textContent,
     webgl:Boolean(gl&&!gl.isContextLost()),graphicsError:gl?.getError()??null};
 });
 check(liberty.camera==='Statue of Liberty'&&liberty.webgl&&
   liberty.graphicsError===0,
   'Liberty Island close-up lost WebGL: '+JSON.stringify(liberty));
 await capture('04-liberty-crown.png');

 // Times Square camera evidence shares the already verified NYC Chromium
 // run, instead of relying on a separate workflow that skips normal edits.
 const timesViews=[
  ['Times Square Street Level','05-times-square-street.png'],
  ['44th Street LED Canyon','06-times-square-led-canyon.png'],
  ['One Times Square','07-one-times-square.png'],
  ['Duffy Square Street View','08-duffy-square.png']
 ];
 for(const [camera,name] of timesViews){
  await page.locator('#hotelTarget').selectOption({label:camera});
  await page.waitForTimeout(1250);
  const view=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   const label=document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent;
   return {label,webgl:Boolean(gl&&!gl.isContextLost()),error:gl?.getError()??null};
  });
  check(view.label===camera&&view.webgl&&view.error===0,
   'Times Square camera failed: '+JSON.stringify(view));
  await capture(name);
 }


 // Inspect the newly physical OTI window surrounds with the same real
 // headless WebGL pipeline; a distant spawn skyline cannot reveal their
 // geometry or catch the camera facing the wrong side of the city.
 await page.locator('#hotelTarget').selectOption({label:'Lower Manhattan · Window Facades'});
 await page.waitForTimeout(1600);
 const facadeView=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   const label=document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent;
   return {label,webgl:Boolean(gl&&!gl.isContextLost()),error:gl?.getError()??null};
 });
 check(facadeView.label==='Lower Manhattan · Window Facades'&&
   facadeView.webgl&&facadeView.error===0,
   'Lower Manhattan facade camera failed: '+JSON.stringify(facadeView));
 await capture('09-manhattan-window-facades.png');

 check(errors.length===0,'NYC critical JS errors: '+errors.join('; '));
 result={passed:true,state,bridge,dumbo,liberty,screenshots,pixels,captureTimings,warnings};
}catch(e){
 result={passed:false,error:e.stack||String(e),pendingShot,screenshots,pixels,
   captureTimings,errors,warnings};
 // Avoid another potentially stalled screenshot when the failure itself was
 // a SwiftShader capture timeout. Partial completed images stay in artifacts.
 if(!pendingShot)try{
   await page.screenshot({path:out+'/FAILED.png',timeout:10000});
 }catch{}
}finally{
 await writeFile(out+'/smoke-report.json',JSON.stringify(result,null,2));
 await browser.close();
}
process.stdout.write(JSON.stringify(result,null,2)+'\n');
if(!result.passed)process.exitCode=1;
