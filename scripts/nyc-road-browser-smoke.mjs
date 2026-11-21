// PATROL NYC WebGL smoke and screenshots; run after Playwright Chromium install.
// Start: python3 -m http.server 8765 --bind 127.0.0.1
// Test: node scripts/nyc-road-browser-smoke.mjs
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {visibleHarborSkyFraction,MIN_HARBOR_SKY_FRACTION} from './nyc-harbor-sky-qa.mjs';
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
  nearBlackFraction:black/Math.max(count,1),
  upperSkyFraction:visibleHarborSkyFraction(img)};
}
// Narrow screenshot ROI corresponding to the previously verified blank
// FID 384606 right foreground (at the fixed 1280x720, zoom-42 camera).
// This is a pixel-backed *local wall detail* test, not a realism score.
function timesWallDetail(bytes){
 const img=PNG.sync.read(bytes);
 const bounds=[930,1180,190,320],scaleX=img.width/1280,scaleY=img.height/720;
 let samples=0,coolGlass=0,sum=0,sum2=0;
 for(let y=Math.round(bounds[2]*scaleY);y<bounds[3]*scaleY;y+=5)
  for(let x=Math.round(bounds[0]*scaleX);x<bounds[1]*scaleX;x+=5){
   const i=(y*img.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
   const value=(r+g+b)/3;
   samples++;sum+=value;sum2+=value*value;
   if(b>r+5)coolGlass++;
  }
 const mean=sum/Math.max(1,samples);
 return {bounds,samples,coolGlassFraction:coolGlass/Math.max(1,samples),
   colorStdDev:Math.sqrt(Math.max(0,sum2/Math.max(1,samples)-mean*mean))};
}
// Diagnostic only: count nearly uniform 64px wall-sized tiles in the
// right foreground of the street-level Times Square view. This exposes
// persistent blank facade regions without treating a flat wall as a
// WebGL failure or requiring a particular color/material.
function timesSquareFlatWallProbe(bytes){
 const img=PNG.sync.read(bytes),tile=64;
 const bounds={x0:Math.floor(img.width*.55),x1:Math.floor(img.width*.98),
  y0:Math.floor(img.height*.25),y1:Math.floor(img.height*.90)};
 let totalTiles=0,flatTiles=0;
 const candidates=[];
 for(let y=bounds.y0;y+tile<=bounds.y1;y+=tile){
  for(let x=bounds.x0;x+tile<=bounds.x1;x+=tile){
   let n=0,sr=0,sg=0,sb=0,s2=0;
   for(let yy=y;yy<y+tile;yy+=8)for(let xx=x;xx<x+tile;xx+=8){
    const p=(yy*img.width+xx)*4,r=img.data[p],
     g=img.data[p+1],b=img.data[p+2];
    sr+=r;sg+=g;sb+=b;s2+=r*r+g*g+b*b;n++;
   }
   const mean=[sr/n,sg/n,sb/n];
   const variance=Math.max(0,s2/n-mean.reduce((a,v)=>a+v*v,0));
   totalTiles++;
   if(variance<72){
    flatTiles++;
    candidates.push({x,y,rgb:mean.map(v=>Math.round(v)),
     variance:Math.round(variance)});
   }
  }
 }
 return {region:bounds,tilePx:tile,totalTiles,flatTiles,
  flatTileFraction:flatTiles/Math.max(totalTiles,1),
  candidates:candidates.slice(0,40)};
}
// HUD panels overlap the canvas in the browser compositor. Even an
// element.screenshot() includes those overlays unless we hide them.
// The temporary class preserves canvas visibility and is always removed,
// so scenic view controls still work for subsequent camera selections.
const screenshots=[],pixels={},captureTimings={},controlPixels={};
// Actual requestAnimationFrame intervals in Chromium SwiftShader, not PNG
// capture latency. Use these as diagnostic frame pacing, NOT production FPS.
const framePacing={};
async function sampleFramePacing(label,frames=45){
 const v=await page.evaluate(async count=>{
  const durations=[];let last=null;
  await new Promise(resolve=>{
   const tick=t=>{if(last!==null)durations.push(t-last);last=t;
    if(durations.length>=count)resolve();else requestAnimationFrame(tick)};
   requestAnimationFrame(tick);
  });
  durations.sort((a,b)=>a-b);
  const at=p=>durations[Math.min(durations.length-1,Math.floor(p*(durations.length-1)))];
  return {frames:durations.length,medianFrameMs:at(.5),p95FrameMs:at(.95),
    minFrameMs:durations[0],maxFrameMs:durations.at(-1)};
 },frames);
 framePacing[label]=v;
 console.log('[PATROL QA] frame pacing '+label+' '+JSON.stringify(v));
}
let pendingShot=null,hudStyleInstalled=false;
async function capture(name,{control=false}={}){
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
  if(name==='05-times-square-street.png'){
    stats.rightWall=timesWallDetail(image);
    check(stats.rightWall.coolGlassFraction>=.025 &&
      stats.rightWall.colorStdDev>=3.5,
      'Times Square FID 384606 street wall is still visually blank: '+
       JSON.stringify(stats.rightWall));
  }
  captureTimings[name]=Date.now()-started;
  check(stats.width>=640&&stats.height>=360&&stats.colorBins>32&&
   stats.nearBlackFraction<.97,
   'Blank or nearly uniform NYC WebGL canvas: '+name+' '+JSON.stringify(stats));
  // A diverse set of nearby windows and walls gave a false green check in
  // actual 44865972470. Harbor-facing OTI camera must ALSO see enough
  // bright sky in the top half to prove it is outside the building canyon.
  if(name==='09-manhattan-window-facades.png')
   check(stats.upperSkyFraction>=MIN_HARBOR_SKY_FRACTION,
    'NYC facade camera is still hidden by nearby building walls: '+JSON.stringify(stats));
  if(control)controlPixels[name]=stats;
  else {
   screenshots.push(name);
   pixels[name]=name==='05-times-square-street.png'
    ? {...stats,flatWallProbe:timesSquareFlatWallProbe(image)} : stats;
  }
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
 // Capture the financial-district facade *before* the bridge shortcut
 // changes zoom to 68 and before a nine-camera tour advances to night.
 // Both factors previously made 09 render a near-wall/night scene even
 // when the independent default-zoom daylight view was fully clear.
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
  null,{timeout:15000});
 await page.locator('#hotelZoom').evaluate(el=>{
  el.value='42';
  el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.locator('#hotelTarget').selectOption({label:'Lower Manhattan · Window Facades'});
 await page.waitForTimeout(1600);
 const facadeView=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   const label=document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent;
   return {label,webgl:Boolean(gl&&!gl.isContextLost()),error:gl?.getError()??null,
     zoom:document.getElementById('hotelZoom')?.value};
 });
 check(facadeView.label==='Lower Manhattan · Window Facades'&&
   facadeView.webgl&&facadeView.error===0&&facadeView.zoom==='42',
   'Lower Manhattan harbor-side facade view failed: '+JSON.stringify(facadeView));
 await sampleFramePacing('09-manhattan-window-facades');
 await capture('09-manhattan-window-facades.png');
 // Same official OTI camera target, closer zoom for street/roof relief QA.
 // Do not call this a free-flight low pass: it is a hotel-camera close view.
 await page.locator('#hotelZoom').evaluate(el=>{
  el.value='27';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.waitForTimeout(1300);
 await sampleFramePacing('11-oti-downtown-close');
 await capture('11-oti-downtown-close.png');
 // Restore the same free-flight state as the original tour before invoking
 // the existing Brooklyn Bridge shortcut. Keep its visibility/controls intact.
 await page.locator('#resumeFlight').click({force:true});
 await page.waitForFunction(()=>document.getElementById('hotelViews')?.hidden,
  null,{timeout:12000});
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
 await sampleFramePacing('02-brooklyn-bridgehead');
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
 await sampleFramePacing('03-dumbo-warehouse');
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



 // Matched diagnostic control: use the engine's existing GIS-off switch
 // rather than guessing which Times Square geometry owns a flat wall.
 // Capture after the normal ten views, at the same noon/clear + zoom 68.
 if(process.env.PATROL_NYC_QA_GIS_CONTROL==='1'){
  console.log('[PATROL QA] matched Times Square GIS-off control');
  const res=await page.goto(base+'/index.html?nycGIS=off',
   {waitUntil:'domcontentloaded',timeout:60000});
  check(res?.ok(),'NYC GIS-off launcher did not respond');
  hudStyleInstalled=false;
  await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
  await page.locator('#startFlight').click({force:true});
  await page.waitForFunction(()=>{
   const title=document.getElementById('titleOverlay');
   const load=document.getElementById('loadOverlay');
   return title?.hidden&&load?.classList.contains('done');
  },null,{timeout:120000});
  await page.evaluate(()=>{
   for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
    const el=document.getElementById(id);
    if(!el)throw Error('Missing GIS-off environment control '+id);
    el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
   }
  });
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
   null,{timeout:15000});
  await page.locator('#hotelZoom').evaluate(el=>{
   el.value='68';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#hotelTarget').selectOption({label:'Times Square Street Level'});
  await page.waitForTimeout(1800);
  await capture('10-times-square-no-gis.png',{control:true});
 }
 check(errors.length===0,'NYC critical JS errors: '+errors.join('; '));
 result={passed:true,state,bridge,dumbo,liberty,screenshots,pixels,controlPixels,captureTimings,warnings};
 result.framePacing=framePacing;
}catch(e){
 result={passed:false,error:e.stack||String(e),pendingShot,screenshots,pixels,controlPixels,
   captureTimings,framePacing,errors,warnings};
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
