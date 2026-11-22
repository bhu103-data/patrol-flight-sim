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
// LOD1 WINDOW QA ONLY: instrument the served HTML response in-memory.
// No production index.html camera/geometry, shader or flight changes.
const lodSourceReturn='    return {panes,triangles:panes*18};';
const lodScenicAnchor='  const DC_SCENIC_VIEWS=[';
const lodBuilderAnchor='  function buildCityBuildings(parcels,local=false) {';
await page.route('**/index.html*',async route=>{
 const response=await route.fetch();
 let html=await response.text();
 check(html.split(lodSourceReturn).length===2,
   'Actual LOD1 window helper missing from tested game HTML');
 check(html.split(lodScenicAnchor).length===2,
   'Expected single NYC scenic array boundary for QA-only camera');
 check(html.split(lodBuilderAnchor).length===2,
   'Expected single actual production NYC building builder for eligibility audit');
 const collector=[
   '    if(panes>0){',
   '      const sites=(window.__patrolLodSiteSamples??=[]);',
   '      if(sites.length<256)sites.push({x,z,w,d,y,shaftHeight,panes});',
   '    }'
 ].join('\n');
 html=html.replace(lodSourceReturn,collector+'\n'+lodSourceReturn);
 const hook=[
   '  window.__patrolLodInstallCamera=(site,name)=>{',
   '    if(!site||!Number.isFinite(site.x)||!Number.isFinite(site.z)||',
   '       !(site.panes>=1))return null;',
   '    const view={name,site:{name},x:site.x,z:site.z,',
   '      height:Math.max(7,Math.min(14,site.shaftHeight*.46)),',
   '      bearing:0,radius:Math.max(19,site.d*.5+15),rise:1.8,',
   '      detail:"QA-only source-selected real LOD1 window facade"};',
   '    NYC_SCENIC_VIEWS.push(view);',
   '    prepareScenicViews();',
   '    return view;',
   '  };'
 ].join('\n');
 html=html.replace(lodScenicAnchor,hook+'\n'+lodScenicAnchor);
 const eligibility=[
   '    if(!local && selectedMap.city && !window.__patrolLodEligibility){',
   '      const info={total:parcels.length,surveyed:0,band0:0,band1:0,band2:0,band3:0,',
   '        inRegion:0,regionBand1:0,regionBand1Tall:0,seedHit:0,geometryEligible:0,examples:[]};',
   '      for(const lot of parcels){',
   '        const [east,north,w,d,h,tone,destroyed]=lot;',
   '        if(lot[7]){info.surveyed++;continue;}',
   '        const band=nycDetailBand(east,north);info["band"+band]++;',
   '        if(!(east>-185&&east<175&&north>-526&&north<-155))continue;',
   '        info.inRegion++;if(band!==1)continue;info.regionBand1++;',
   '        if(info.examples.length<16)info.examples.push({east,north,w,d,h,band,destroyed});',
   '        if(!(h>20)||destroyed)continue;',
   '        info.regionBand1Tall++;',
   '        const gridX=Math.floor((east-MANHATTAN_GRID.tilt*north-MANHATTAN_GRID.offset)/MANHATTAN_GRID.blockWidth);',
   '        const gridZ=Math.floor(north/MANHATTAN_GRID.blockLength);',
   '        const seed=(Math.imul(gridX,73856093)^Math.imul(gridZ,19349663)^',
   '          Math.imul(gridX*gridZ,83492791))>>>0;',
   '        if(((seed>>>4)&3)!==0)continue;info.seedHit++;',
   '        if(w>6.2&&d>5.5&&h*(.62+(seed%13%3)*.09)>11)info.geometryEligible++;',
   '        if(info.examples.length<16)info.examples.push({east,north,w,d,h,band,seed});',
   '      }',
   '      window.__patrolLodEligibility=info;',
   '    }'
 ].join('\n');
 html=html.replace(lodBuilderAnchor,lodBuilderAnchor+'\n'+eligibility);

 await route.fulfill({response,body:html});
});


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
 await capture('09-manhattan-window-facades.png');
// True game-only close view, not another broad harbor silhouette.
// Sample actual generated LOD1 helper calls and preserve exact game-space
// x/z + pose for independent screenshot QA. No fake meshes are drawn.
const lodSites=await page.evaluate(()=>window.__patrolLodSiteSamples||[]);
const lodEligibility=await page.evaluate(()=>window.__patrolLodEligibility||null);
await writeFile(out+'/lod1-eligibility-diagnostic.json',JSON.stringify({count:lodSites.length,sites:lodSites.slice(0,15),eligibility:lodEligibility},null,2));
check(lodSites.length>0,'LOD1 helper generated zero source-selected panes: '+JSON.stringify(lodEligibility));
const ordered=[...lodSites].sort((a,b)=>
  b.w*b.shaftHeight-a.w*a.shaftHeight);
const selected=[];
for(const site of ordered){
 if(selected.every(prev=>Math.hypot(prev.x-site.x,prev.z-site.z)>25))
  selected.push(site);
 if(selected.length===3)break;
}
check(selected.length>=1,'No separated actual LOD1 facade candidates');
const lodRecords=[];
for(let i=0;i<selected.length;i++){
 const site=selected[i],label='QA LOD1 Window Bay '+i;
 const view=await page.evaluate(({site,label})=>
   window.__patrolLodInstallCamera?.(site,label),{site,label});
 check(view?.name===label,'Failed to install test-only scenic camera '+i);
 await page.locator('#hotelTarget').selectOption({label});
 await page.locator('#hotelZoom').evaluate(el=>{
   el.value='68';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.locator('#hotelAngle').evaluate(el=>{
   el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.waitForTimeout(1750);
 const telemetry=await page.evaluate(()=>{
   const canvas=document.getElementById('glCanvas');
   const gl=canvas?.getContext('webgl2');
   return {webgl2:!!gl&&!gl.isContextLost(),glError:gl?.getError(),
     selected:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent,
     canvasSize:[canvas?.width,canvas?.height]};
 });
 check(telemetry.webgl2&&telemetry.glError===0&&telemetry.selected===label,
   'Actual LOD1 near camera or WebGL2 invalid: '+JSON.stringify(telemetry));
 const shot='10-lod1-window-close-'+i+'.png';
 await capture(shot);
 lodRecords.push({name:shot,sourceSite:site,view,telemetry});
}
await writeFile(out+'/lod1-window-close-poses.json',
 JSON.stringify({sourceHead:process.env.GITHUB_SHA||'unknown',
  count:lodRecords.length,cameraPoses:lodRecords},null,2));

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
