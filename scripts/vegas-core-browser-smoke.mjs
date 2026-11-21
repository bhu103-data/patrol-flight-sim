// Las Vegas fixed-interface WebGL smoke. Requires installed Playwright Chromium.
// Start local HTTP server: python3 -m http.server 8765 --bind 127.0.0.1
// Run: node scripts/vegas-core-browser-smoke.mjs
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const qaTag=process.env.PATROL_QA_TAG||'candidate';
const output='artifacts/vegas/'+qaTag;await mkdir(output,{recursive:true});
const errors=[],screenshots=[],shots=[],startupSnapshots=[];
const ridgeLoadMessages=[],tigerLoadMessages=[];
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{
 const line=msg.text();
 if(line.includes('[PATROL] Vegas USGS measured ridge profile loaded'))
   ridgeLoadMessages.push(line);
 if(line.includes('[PATROL] Vegas Census TIGER measured Strip loaded'))
   tigerLoadMessages.push(line);
});
page.on('requestfailed',r=>{if(r.url().startsWith(base))errors.push('failed local asset: '+r.url());});
const assert=(yes,message)=>{if(!yes)throw Error(message);};
let result={status:'failed',qaTag,errors,screenshots,shots};
try {
 const navStarted=Date.now();
 const response=await page.goto(base+'/index.html?graphics=compat',{waitUntil:'domcontentloaded',timeout:60000});
 assert(response?.ok(),'PATROL launcher request failed');
 await page.locator('input[name="flightMap"][value="vegas"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 // Software SwiftShader can be slower than hardware Chrome. Watch loading
 // progress and persist diagnostics rather than silently losing the run.
 const startupStarted=Date.now();
 let loaded=false;
 while(Date.now()-startupStarted<210000){
  const status=await page.evaluate(()=>{
   const title=document.getElementById('titleOverlay');
   const load=document.getElementById('loadOverlay');
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   return {titleHidden:!!title?.hidden,loadDone:!!load?.classList.contains('done'),
    step:document.getElementById('loadStep')?.textContent,
    progress:document.getElementById('loadBar')?.style.width,
    menuError:document.getElementById('menuError')?.textContent,
    glLost:!!gl?.isContextLost()};
  });
  startupSnapshots.push({elapsedMs:Date.now()-startupStarted,...status});
  if(status.titleHidden&&status.loadDone){loaded=true;break;}
  if(status.menuError&&status.titleHidden===false&&status.loadDone)break;
  await page.waitForTimeout(8000);
 }
 if(!loaded)throw Error('Vegas startup failed or timed out: '+
   JSON.stringify(startupSnapshots.slice(-8)));
 const loadMs=Date.now()-navStarted;
 // The candidate is only accepted as survey-backed if the actual game
 // reports it decoded the committed profile. The untouched baseline is
 // intentionally NOT required to load the new Vegas file.
 if(qaTag==='candidate'){
   assert(ridgeLoadMessages.some(line=>
     line.includes('856259460e4e687285eb40949ab8764e7543ccf09e9f81177a8d2152bdb8046d')),
     'Vegas scene fell back to procedural ridges instead of verified USGS 3DEP');
   assert(tigerLoadMessages.some(line=>
     line.includes('dba759001381d6c502160dc6f8b1987bef4e89544ac475943820cd870f07fbf9')),
     'Vegas scene did not load verified Census TIGER 2026 Strip centerline');
 }
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
  null,{timeout:15000});
 await page.locator('#hotelTarget').selectOption({label:'Strip Street View'});
 await page.locator('#hotelAngle').evaluate(el=>{
  el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.addStyleTag({content:
  'body.vegas-qa-canvas *{visibility:hidden!important;}'+
  'body.vegas-qa-canvas #glCanvas{visibility:visible!important;}'});
 for(const [preset,clock] of [['noon','12'],['night','0']]){
  await page.locator('#skyTime').evaluate((el,v)=>{
   el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));
  },clock);
  await page.locator('#skyWeather').evaluate(el=>{
   el.value='Clear';el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  for(const [view,zoom] of [['near','70'],['far','24']]){
   const expectedTarget=view==='near'?'Strip Street View':'Bellagio';
   await page.locator('#hotelTarget').selectOption({label:expectedTarget});
   await page.locator('#hotelZoom').evaluate((el,v)=>{
    el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));
   },zoom);
   await page.waitForTimeout(1200);
   const telemetry=await page.evaluate(()=>{
    const canvas=document.getElementById('glCanvas');
    const gl=canvas?.getContext('webgl2');
    return {webgl2:Boolean(gl&&!gl.isContextLost()),error:gl?.getError(),
      canvasSize:[canvas?.width,canvas?.height],
      selected:document.querySelector('input[name="flightMap"]:checked')?.value,
      target:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent,
      zoom:document.getElementById('hotelZoom')?.value};
   });
   assert(telemetry.webgl2&&telemetry.error===0,'Vegas WebGL2/context error');
   assert(telemetry.selected==='vegas'&&telemetry.target===expectedTarget,
    'Vegas scenic camera not selected');
   const shotName='vegas-core-'+view+'-'+preset+'.png';
   await page.evaluate(()=>document.body.classList.add('vegas-qa-canvas'));
   try{await page.locator('#glCanvas').screenshot({
    path:output+'/'+shotName,timeout:60000,animations:'allow'
   });}finally{await page.evaluate(()=>document.body.classList.remove('vegas-qa-canvas'));}
   screenshots.push(shotName);
   shots.push({shotName,...telemetry});
  }
 }
 // Frame interval is a CPU/browser observational diagnostic, not GPU time.
 const frameSampling=await page.evaluate(()=>new Promise(resolve=>{
  let count=0,last=0,sum=0,max=0;
  const tick=now=>{
   if(last){const dt=now-last;sum+=dt;max=Math.max(max,dt);count++;}
   last=now;
   if(count>=90)resolve({sampledFrames:count,meanFrameIntervalMs:sum/count,
     maxFrameIntervalMs:max,approxFPS:1000*count/sum});
   else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 }));
 result={status:'passed',qaTag,loadMs,errors,screenshots,shots,startupSnapshots,ridgeLoadMessages,tigerLoadMessages,
   frameSampling,incrementalGeometry:{triangles:qaTag==='candidate'?1554:0,textures:0}};
 assert(errors.length===0,'Browser errors: '+JSON.stringify(errors));
} catch(error) {
 errors.push(error.message);
 result={...result,status:'failed',errors,startupSnapshots,ridgeLoadMessages,tigerLoadMessages};
 process.exitCode=1;
}finally{
 await writeFile(output+'/vegas-core-report.json',JSON.stringify(result,null,2));
 await browser.close();
}
