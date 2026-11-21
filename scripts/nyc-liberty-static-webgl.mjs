// Isolated static NYC Liberty review. Never writes production manifest.
// CI serves a staged GLB and routes one browser's manifest as enabled in memory.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/nyc-liberty';
await mkdir(out,{recursive:true});
const die=message=>{throw Error('LIBERTY_WEBGL_QA: '+message)};
// CI defaults to free, deterministic SwiftShader. Windows users can run this
// EXACT same test in real, headed Chrome with PATROL_LIBERTY_GPU_MODE=native;
// reject any renderer still reporting SwiftShader/llvmpipe/software.
const nativeGpu=process.env.PATROL_LIBERTY_GPU_MODE==='native';
const args=['--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl',...nativeGpu?[]:[
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']];
const browser=await chromium.launch({
 headless:!nativeGpu,...nativeGpu?{channel:'chrome'}:{},args
});
const results={camera:'Statue of Liberty',viewport:[1280,720],
 rendererMode:nativeGpu?'Windows native Chrome GPU QA':'CI software SwiftShader',
 dateLock:'noon summer clear',rollbackManifestUntouched:true,
 manualOrientationVerified:false,manualPedestalOverlapVerified:false,
 browsers:{},preview:{}};
function analyze(bytes){
 const img=PNG.sync.read(bytes),bins=new Set();
 let black=0,n=0;
 for(let y=0;y<img.height;y+=8)for(let x=0;x<img.width;x+=8){
  const i=(y*img.width+x)*4;
  const red=img.data[i],green=img.data[i+1],blue=img.data[i+2];
  bins.add(((red>>4)<<8)|((green>>4)<<4)|(blue>>4));
  black+=red+green+blue<24?1:0;n++;
 }
 const stats={width:img.width,height:img.height,colorBins:bins.size,
   nearBlackFraction:black/Math.max(n,1)};
 if(stats.width<640||stats.height<360||stats.colorBins<28||
    stats.nearBlackFraction>.96)die('near-blank WebGL frame '+JSON.stringify(stats));
 return stats;
}
async function createPage(){
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const pageErrors=[],consoleProblems=[];
 page.on('pageerror',error=>pageErrors.push(error.message));
 page.on('console',message=>{
  if(['error','warning'].includes(message.type()))consoleProblems.push(message.text());
 });
 return {page,pageErrors,consoleProblems};
}
async function screenshot(page,name,selector='#glCanvas'){
 // Hide overlays rather than allowing the game's UI to pass a blank-screen check.
 const game=selector==='#glCanvas';
 if(game){
  await page.addStyleTag({content:
   'body.liberty-qa * {visibility:hidden!important} '+
   'body.liberty-qa #glCanvas {visibility:visible!important}'});
  await page.evaluate(()=>document.body.classList.add('liberty-qa'));
 }
 try{
  const buffer=await page.locator(selector).screenshot({
   path:out+'/'+name,animations:'disabled',timeout:75000});
  return analyze(buffer);
 }finally{
  if(game)await page.evaluate(()=>document.body.classList.remove('liberty-qa'));
 }
}
async function flight(candidate){
 const {page,pageErrors,consoleProblems}=await createPage();
 const requests=[],responses=[];
 if(candidate){
  await page.route('**/assets/nyc/scenario-manifest.json',async route=>{
   const response=await route.fetch();
   if(!response.ok())die('Cannot fetch real manifest for browser-only QA');
   const json=await response.json();
   if(json.landmarks.liberty.enabled)die('Committed manifest was unexpectedly enabled');
   json.landmarks.liberty.enabled=true;
   json.landmarks.liberty.license='Innerscene original CC0 / temporary QA overlay only';
   await route.fulfill({response,contentType:'application/json',body:JSON.stringify(json),
     headers:{...response.headers(),'cache-control':'no-store'}});
  });
 }
 // Add a nonproduction Scenic View to the TEST BROWSER RESPONSE only.
 // This changes camera placement, not PATROL's source files or flight physics.
 // Both rollback and staged candidate are captured from this exact viewpoint.
 await page.route('**/index.html',async route=>{
   const response=await route.fetch();
   if(!response.ok())die('Cannot obtain original PATROL HTML');
   const html=await response.text();
   const anchor='const NYC_SCENIC_VIEWS=[';
   if(html.split(anchor).length!==2)die('NYC scenic anchor changed');
   const extra=`\n    {name:'Liberty Base QA · Harbor-South',x:-140,z:-611,
      height:5,bearing:173,radius:38,rise:1.5,
      detail:'Browser-only low-level pedestal inspection; not production geometry'},`;
   // Attach read-only surface queries and a single actual swept collision
   // path to the isolated browser copy of the game only. Nothing ships in
   // index.html. Swept tests use PATROL's own checkFlightCollision substeps,
   // not an invented geometry/collision approximation.
   const physicsAnchor='  // Web Audio Synthesizer (Muted by default)';
   if(html.split(physicsAnchor).length!==2)
     die('PATROL physics anchor changed; no unsafe instrumentation');
   const physicsProbe=`
  window.__patrolLibertyQaPhysics=()=>{
    if(!selectedMap.city || !flying || crash)
      throw Error('NYC flight not ready for real collision probe');
    const mark=NEW_YORK_LANDMARKS.find(x=>x.kind==='liberty');
    if(!mark || mark.x!==-140 || mark.z!==-611 || mark.top!==31.3)
      throw Error('Liberty game collision bounds changed');
    const sample=[];
    const radii=[0,4,7,9.4,10.2,10.8,11,11.4,13,18,24.8,26];
    for(const radius of radii)for(let step=0;step<8;step++){
      const angle=step*Math.PI/4,x=mark.x+radius*Math.cos(angle);
      const z=mark.z+radius*Math.sin(angle);
      const surface=navigationSurface(x,z);
      const terrain=sampleGroundHeight(x,z);
      if(!Number.isFinite(surface)||!Number.isFinite(terrain))
        throw Error('Non-finite harbor collision surface');
      sample.push([Number(surface.toFixed(3)),Number(terrain.toFixed(3))]);
    }
    const ground=sampleGroundHeight(mark.x,mark.z),left=mark.x-16,right=mark.x+16;
    const asset=nycRealismAssets?.models?.liberty;
    const scenarioShapeActive=asset?.source==='scenario' &&
      asset.triangleCount===15900 && !graphicsCompat && smoothScenery();
    // Flight physics, NOT a polygon-only mock: test 12 genuine corridor
    // sweeps in the plaza outside the actual 15.9k GLB mesh. Historical
    // fallback retains its deliberately broader bounding-box collision.
    let scenarioClearSweeps=0;
    if(scenarioShapeActive){
      for(const relativeHeight of [5,11,20,29]){
        for(const radius of [8.2,9.1,10.3]){
          checkFlightCollision([mark.x+radius,ground+relativeHeight,mark.z-0.6],
            [mark.x+radius,ground+relativeHeight,mark.z+0.6]);
          if(crash)throw Error('Invisible Liberty plaza collision: '+
            JSON.stringify({radius,relativeHeight,reason:crash.reason}));
          scenarioClearSweeps++;
        }
      }
    }
    // Normal engine substeps: aircraft overflies *above* monument top
    // without crashing. No synthetic physics branch or disabled collision.
    checkFlightCollision([left,ground+38,mark.z],[right,ground+38,mark.z]);
    const overflightCrash=crash?.reason||null;
    if(!overflightCrash){
      // Repeat through the center of the actual game landmark at the
      // normal statue-body height. This should crash as in old PATROL.
      checkFlightCollision([left,ground+20,mark.z],[right,ground+20,mark.z]);
    }
    return {aircraft:selectedAircraft,ground,mark:{x:mark.x,z:mark.z,
      w:mark.w,d:mark.d,top:mark.top},sample,
      pathLength:32,nominalCollisionSteps:Math.ceil(32/0.65),
      overflightHeight:ground+38,hitHeight:ground+20,
      overflightCrash,hitReason:crash?.reason||null,
      scenarioClearSweeps,scenarioShapeActive,
      ranRealCollisionResolver:true};
  };
`;
   const rendered=html.replace(anchor,anchor+extra)
     .replace(physicsAnchor,physicsProbe+physicsAnchor);
   await route.fulfill({response,contentType:'text/html; charset=utf-8',
     body:rendered});
 });
 page.on('request',req=>{
  if(req.url().endsWith('/assets/nyc/scenario/liberty.glb'))requests.push(req.url());
 });
 page.on('response',res=>{
  if(res.url().endsWith('/assets/nyc/scenario/liberty.glb'))
    responses.push(res.status());
 });
 try{
  const res=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  if(!res?.ok())die('Game index unavailable');
  await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
  await page.locator('#startFlight').click({force:true});
  await page.waitForFunction(()=>{
   const title=document.getElementById('titleOverlay');
   return title?.hidden&&document.getElementById('loadOverlay')?.classList.contains('done');
  },null,{timeout:120000});
  await page.evaluate(()=>{
   for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
    const node=document.getElementById(id);
    if(!node)throw Error('Missing weather control '+id);
    node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));
   }
  });
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
    null,{timeout:15000});
  await page.locator('#hotelZoom').evaluate(el=>{
   el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#hotelTarget').selectOption({label:'Statue of Liberty'});
  // Allow separate worker geometry + asynchronous manifest fetch to settle.
  await page.waitForTimeout(3800);
  const state=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   const rendererExtension=gl?.getExtension('WEBGL_debug_renderer_info');
   const renderer=rendererExtension?gl.getParameter(rendererExtension.UNMASKED_RENDERER_WEBGL):null;
   return {label:document.querySelector('#hotelTarget option:checked')?.textContent,
    webgl:!!gl&&!gl.isContextLost(),error:gl?.getError()??null,renderer};
  });
  if(!state.webgl||state.error!==0||state.label!=='Statue of Liberty')
   die('Fixed NYC view unavailable '+JSON.stringify(state));
  if(nativeGpu && (!state.renderer ||
     /swiftshader|llvmpipe|lavapipe|software|microsoft basic render/i.test(state.renderer)))
   die('Cannot verify native hardware WebGL2: '+JSON.stringify(state.renderer));
  if(candidate && (!requests.length||!responses.includes(200)))
   die('Candidate GLB did not load through same-origin manifest path');
  const pixels=await screenshot(page,
    candidate?'02-liberty-game-candidate.png':'01-liberty-game-fallback.png');
  const timings=await page.evaluate(async()=>{
   const delta=[];let previous=performance.now();
   for(let k=0;k<42;k++){
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const now=performance.now();
    if(k>4)delta.push(now-previous);
    previous=now;
   }
   return {sampledFrames:delta.length,
    avgMs:delta.reduce((s,v)=>s+v,0)/delta.length,
    maxMs:Math.max(...delta)};
  });
  // Low-level harbor-side base test: same 1280x720 WebGL2 scene, camera
  // just outside Fort Wood. These screenshots must be manually inspected for
  // bottom-fort overlap; a nonblank test alone cannot prove architectural fit.
  const nearName='Liberty Base QA · Harbor-South';
  await page.locator('#hotelTarget').selectOption({label:nearName});
  await page.locator('#hotelZoom').evaluate(el=>{
    el.value='60';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#hotelAngle').evaluate(el=>{
    el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(850);
  const lowState=await page.evaluate(()=>{
    const gl=document.getElementById('glCanvas')?.getContext('webgl2');
    return {label:document.querySelector('#hotelTarget option:checked')?.textContent,
      zoom:document.getElementById('hotelZoom')?.value,
      angle:document.getElementById('hotelAngle')?.value,
      webgl:!!gl&&!gl.isContextLost(),error:gl?.getError()??null};
  });
  if(!lowState.webgl||lowState.error!==0||lowState.label!==nearName||
     lowState.zoom!=='60')die('Low base camera unavailable '+JSON.stringify(lowState));
  const suffix=candidate?'candidate':'fallback';
  const lowBase={state:lowState,source:'browser-only camera preset, no production edits'};
  lowBase.harborSouth=await screenshot(page,'06-liberty-low-south-'+suffix+'.png');
  await page.locator('#hotelAngle').evaluate(el=>{
    el.value='34';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(850);
  lowBase.oblique=await screenshot(page,'07-liberty-low-oblique-'+suffix+'.png');
  // Run after photography: the controlled center-line sweep intentionally
  // invokes the same crash logic as gameplay and ends this QA page's flight.
  const physics=await page.evaluate(()=>{
    if(typeof window.__patrolLibertyQaPhysics!=='function')
      throw Error('No browser-only flight collision probe');
    return window.__patrolLibertyQaPhysics();
  });
  if(physics.overflightCrash!==null ||
     physics.hitReason!=='Collision with Statue of Liberty' ||
     physics.nominalCollisionSteps<40 ||
     physics.aircraft==='jetpack'||
     physics.scenarioClearSweeps!==(candidate?12:0)||
     physics.scenarioShapeActive!==candidate)
    die('NYC swept collision changed '+JSON.stringify({
      overflightCrash:physics.overflightCrash,hitReason:physics.hitReason,
      steps:physics.nominalCollisionSteps,aircraft:physics.aircraft}));
  if(pageErrors.length)die('Page exceptions: '+pageErrors.join('; '));
  if(candidate && consoleProblems.some(x=>/scenario liberty|GLB exceeds|nyc asset fallback/i.test(x)))
   die('GLB decoder warned: '+consoleProblems.join('; ').slice(0,500));
  return {state,pixels,timings,lowBase,physics,requests:requests.length,responses,
   nonfatalConsole:consoleProblems.slice(0,8)};
 }finally{await page.close();}
}
async function preview(){
 const {page,pageErrors,consoleProblems}=await createPage();
 try{
  const res=await page.goto(base+'/tools/scenario_model_preview.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(!res?.ok())die('Bundled WebGL2 model preview unavailable');
  await page.locator('#modelFile').setInputFiles('assets/nyc/scenario/liberty.glb');
  await page.waitForFunction(()=>{
   const n=document.getElementById('state');
   return n?.dataset.status==='PASS'&&n.textContent.includes('liberty.glb');
  },null,{timeout:90000});
  const text=await page.locator('#state').textContent();
  const atlas=await page.locator('#atlas').textContent();
  const triangles=Number((await page.locator('#triangles').textContent()).replace(/,/g,''));
  if(!Number.isFinite(triangles)||triangles>25000||triangles<1500||
    atlas!=='Embedded PNG/JPEG')die('Preview model/atlas budget mismatch');
  for(const [angle,name] of [
    [0,'03-liberty-preview-angle-0.png'],
    [90,'04-liberty-preview-angle-90.png'],
    [180,'05-liberty-preview-angle-180.png']]){
   await page.locator('#angle').evaluate((el,value)=>{
    el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));
   },angle);
   await page.waitForTimeout(350);
   results.preview[name]=await screenshot(page,name,'#preview');
  }
  if(pageErrors.length)die('Preview page exception '+pageErrors.join('; '));
  return {status:text,atlas,triangles,nonfatalConsole:consoleProblems};
 }finally{await page.close();}
}
// Detect a real change in the STATUE-centered pixels, not merely a 200 GLB
// download. A decoder that silently renders the old model must fail this QA.
// These screenshots use identical game cameras, weather and viewport size;
// water/ship motion outside the statue ROI cannot satisfy this threshold.
async function compareStatuePixels(fallback,candidate){
 const a=PNG.sync.read(await readFile(out+'/'+fallback));
 const b=PNG.sync.read(await readFile(out+'/'+candidate));
 if(a.width!==b.width||a.height!==b.height||a.width!==1280||a.height!==720)
  die('Scene comparison size mismatch');
 const roi={left:520,top:80,right:780,bottom:610};
 let changed=0,count=0,absoluteSum=0;
 for(let y=roi.top;y<roi.bottom;y++)for(let x=roi.left;x<roi.right;x++){
  const i=(y*a.width+x)*4;
  const d=Math.max(Math.abs(a.data[i]-b.data[i]),
    Math.abs(a.data[i+1]-b.data[i+1]),
    Math.abs(a.data[i+2]-b.data[i+2]));
  changed+=d>32?1:0;absoluteSum+=d;count++;
 }
 const report={fallback,candidate,roi,changedFraction:changed/count,
  meanMaxChannelDifference:absoluteSum/count,threshold:0.10};
 if(report.changedFraction<report.threshold)
  die('Model did not visibly replace fallback in central region: '+JSON.stringify(report));
 return report;
}
try{
 results.browsers.fallback=await flight(false);
 results.browsers.candidate=await flight(true);
 const a=results.browsers.fallback.physics,b=results.browsers.candidate.physics;
 if(a.sample.length!==b.sample.length||a.sample.length!==96)
   die('Collision sampling grid altered');
 let maxSurfaceDelta=0,maxTerrainDelta=0;
 for(let i=0;i<a.sample.length;i++){
   maxSurfaceDelta=Math.max(maxSurfaceDelta,
     Math.abs(a.sample[i][0]-b.sample[i][0]));
   maxTerrainDelta=Math.max(maxTerrainDelta,
     Math.abs(a.sample[i][1]-b.sample[i][1]));
 }
 results.physicsParity={
  points:a.sample.length,maxSurfaceDelta,maxTerrainDelta,
  baselineCollision:a.hitReason,candidateCollision:b.hitReason,
  safeOverflights:a.overflightCrash===null&&b.overflightCrash===null,
  usingActualSweptFlightCollider:true
 };
 if(maxSurfaceDelta>0.05||maxTerrainDelta>0.05)
   die('Candidate changed NYC collision terrain: '+JSON.stringify(results.physicsParity));
 results.visualDifferences={
  fullView:await compareStatuePixels('01-liberty-game-fallback.png',
    '02-liberty-game-candidate.png'),
  harborBase:await compareStatuePixels('06-liberty-low-south-fallback.png',
    '06-liberty-low-south-candidate.png'),
  obliqueBase:await compareStatuePixels('07-liberty-low-oblique-fallback.png',
    '07-liberty-low-oblique-candidate.png')
 };
 results.preview.status=await preview();
 console.log('LIBERTY_WEBGL_STATIC_PASS '+JSON.stringify(results));
}finally{
 await writeFile(out+'/webgl-review.json',JSON.stringify(results,null,2)+'\n');
 await browser.close();
}
