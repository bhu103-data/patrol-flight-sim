// Isolated static NYC Liberty review. Never writes production manifest.
// CI serves a staged GLB and routes one browser's manifest as enabled in memory.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/nyc-liberty';
await mkdir(out,{recursive:true});
const die=message=>{throw Error('LIBERTY_WEBGL_QA: '+message)};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
]});
const results={camera:'Statue of Liberty',viewport:[1280,720],
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
   await route.fulfill({response,contentType:'text/html; charset=utf-8',
     body:html.replace(anchor,anchor+extra)});
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
   return {label:document.querySelector('#hotelTarget option:checked')?.textContent,
    webgl:!!gl&&!gl.isContextLost(),error:gl?.getError()??null};
  });
  if(!state.webgl||state.error!==0||state.label!=='Statue of Liberty')
   die('Fixed NYC view unavailable '+JSON.stringify(state));
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
  if(pageErrors.length)die('Page exceptions: '+pageErrors.join('; '));
  if(candidate && consoleProblems.some(x=>/scenario liberty|GLB exceeds|nyc asset fallback/i.test(x)))
   die('GLB decoder warned: '+consoleProblems.join('; ').slice(0,500));
  return {state,pixels,timings,lowBase,requests:requests.length,responses,
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
