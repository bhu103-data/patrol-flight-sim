// Targeted Manhattan atmosphere screenshots on a single verified camera.
// PATROL_BASE_URL serves a checked-out game; this script never edits it.
// Run on baseline and PR with identical 1280x720 camera/time/season/weather.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';

const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8871').replace(/\/$/,'');
const version=process.env.PATROL_ENV_VARIANT||'local';
const out='artifacts/nyc-time-visibility/'+version;
const camera='Lower Manhattan · Window Facades';
await mkdir(out,{recursive:true});
// Keep the existing 18:30 UI preset for regression, but also capture the
// near-horizon solar dusk. In summer the game's latitude/declination model
// places the sun about +8.9° at 18:30 and -1.3° at 19:30, so testing only
// the preset would miss the actual Manhattan sunset fog transition.
const times=[{name:'noon',value:'12'},{name:'dusk',value:'18.5'},
 {name:'solar-dusk',value:'19.5'},
 {name:'solar-dusk-fog',value:'19.5',weather:'Fog'},
 {name:'midnight',value:'0'}];
const problems=[],shots=[],started=Date.now();
let browser;
function imageMetrics(buffer){
 const png=PNG.sync.read(buffer),luma=[];
 let saturated=0,nearBlack=0,total=0,rSum=0,gSum=0,bSum=0;
 const buckets=new Set();
 // Fixed Manhattan ROIs: distant skyline and nearby masonry under the same
 // camera. Report these separately so global sky/water don't hide haze deltas.
 const regions={distantSkyline:{bounds:[45,170,335,400],sum:0,count:0},
   foregroundBuildings:{bounds:[175,350,985,690],sum:0,count:0}};
 for(let y=0;y<png.height;y+=4)for(let x=0;x<png.width;x+=4){
  const k=(y*png.width+x)*4,r=png.data[k],g=png.data[k+1],b=png.data[k+2];
  const Y=.2126*r+.7152*g+.0722*b;
  luma.push(Y);total++;rSum+=r;gSum+=g;bSum+=b;
  for(const region of Object.values(regions)){
   const [x0,y0,x1,y1]=region.bounds;
   if(x>=x0&&x<x1&&y>=y0&&y<y1){region.sum+=Y;region.count++;}
  }
  if(Math.max(r,g,b)>=250)saturated++;
  if(Y<10)nearBlack++;
  buckets.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
 }
 luma.sort((a,b)=>a-b);
 const percentile=p=>Number(luma[Math.floor((luma.length-1)*p)].toFixed(3));
 const p10=percentile(.1),p90=percentile(.9);
 return {width:png.width,height:png.height,samples:total,
   meanLuma:Number((luma.reduce((a,v)=>a+v,0)/total).toFixed(3)),
   p10,p50:percentile(.5),p90,
   p90p10Contrast:Number((p90-p10).toFixed(3)),
   channelMeans:[rSum,gSum,bSum].map(v=>Number((v/total).toFixed(3))),
   clippedChannelFraction:Number((saturated/total).toFixed(5)),
   nearBlackFraction:Number((nearBlack/total).toFixed(5)),
   colorBins:buckets.size,
   regionMeanLuma:Object.fromEntries(Object.entries(regions).map(([k,v])=>
     [k,Number((v.sum/Math.max(1,v.count)).toFixed(3))]))};
}
const report={version,base,camera,resolution:[1280,720],
  season:'Summer',weather:'Clear except solar-dusk-fog',zoom:'42',angle:'0',
  times:times.map(({name,value,weather='Clear'})=>({name,clock:value,weather})),shots,
  errors:problems,passed:false};
try{
 browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.on('pageerror',e=>problems.push('JS: '+e.message));
 page.on('console',m=>{
  if(m.type()==='error')problems.push('console: '+m.text().slice(0,300));
 });
 const response=await page.goto(base+'/index.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 if(!response?.ok())throw Error('Game HTTP response missing');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 await page.waitForFunction(()=>
  document.getElementById('titleOverlay')?.hidden&&
  document.getElementById('loadOverlay')?.classList.contains('done'),
 null,{timeout:180000});
 // Environment controls are intentionally inside a collapsed panel.
 // Set the actual selects through the DOM, as the existing NYC QA does;
 // selectOption() would time out because the native controls are hidden.
 await page.evaluate(()=>{
  for(const [id,value] of [['skySeason','1'],['skyWeather','Clear']]){
   const el=document.getElementById(id);
   if(!el)throw Error('Missing environment control: '+id);
   el.value=value;
   el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
  null,{timeout:15000});
 // QA-only extra option: the game has no public 19:30 preset. This
 // operates on the test browser's DOM; production controls remain unchanged.
 await page.evaluate(()=>{
  const select=document.getElementById('skyTime');
  if(!select)throw Error('Time control not found');
  const o=document.createElement('option');
  o.value='19.5';o.textContent='QA solar horizon 19:30';
  select.appendChild(o);
 });
 await page.locator('#hotelTarget').selectOption({label:camera});
 await page.locator('#hotelZoom').evaluate(el=>{
  el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.locator('#hotelAngle').evaluate(el=>{
  el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.addStyleTag({content:
  'body.patrol-env-qa * {visibility:hidden !important;} '+
  'body.patrol-env-qa #glCanvas {visibility:visible !important;}'});
 for(const time of times){
  await page.evaluate(({value,weather='Clear'})=>{
   for(const [id,choice] of [['skyTime',value],['skyWeather',weather]]){
    const el=document.getElementById(id);
    if(!el)throw Error('Missing environment control: '+id);
    el.value=choice;
    el.dispatchEvent(new Event('change',{bubbles:true}));
   }
  },time);
  // SwiftShader can take several seconds per world frame. A fixed
  // wait previously recorded "skyTime=12" while the game still reported
  // its launch state "14:45". Wait for sampleFlightEnvironment() to
  // acknowledge THIS clock and weather before trusting any pixel metrics.
  const minutes=Math.floor(Number(time.value)*60);
  const clock=String(Math.floor(minutes/60)).padStart(2,'0')+':'+
    String(minutes%60).padStart(2,'0');
  const expectedStatus=clock+' · Summer · '+(time.weather||'Clear');
  await page.waitForFunction(expected=>
    document.getElementById('skyStatus')?.textContent?.trim()===expected,
    expectedStatus,{timeout:90000,polling:250});
  // The environment status is a CPU-side acknowledgement, not evidence that
  // the new sky/fog uniforms have made it into a rendered WebGL frame. A fixed
  // 850 ms sleep could still capture the prior frame under slow SwiftShader.
  // Fence two animation frames so both baseline and patch capture a fully
  // rendered environment state, without changing simulation/game source.
  await page.evaluate(()=>new Promise((resolve,reject)=>{
   const watchdog=setTimeout(()=>
     reject(Error('No two browser paint frames after environment update')),90000);
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
     clearTimeout(watchdog);resolve();
   }));
  }));
  const state=await page.evaluate(()=>{
   const el=document.getElementById('glCanvas'),gl=el?.getContext('webgl2');
   return {map:document.querySelector('input[name="flightMap"]:checked')?.value,
    camera:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text,
    zoom:document.getElementById('hotelZoom')?.value,
    angle:document.getElementById('hotelAngle')?.value,
    clock:document.getElementById('skyTime')?.value,
    weather:document.getElementById('skyWeather')?.value,
    season:document.getElementById('skySeason')?.value,
    status:document.getElementById('skyStatus')?.textContent,
    webgl2:!!gl&&!gl.isContextLost(),glError:gl?.getError()??-1};
  });
  if(!state.webgl2||state.glError!==0||state.map!=='manhattan'||
     state.camera!==camera||state.zoom!=='42'||state.angle!=='0'||
     state.clock!==time.value||state.weather!==(time.weather||'Clear')||
     state.season!=='1'||state.status?.trim()!==expectedStatus)
   throw Error('Fixed-camera invariant failed: '+JSON.stringify(state));
  await page.evaluate(()=>document.body.classList.add('patrol-env-qa'));
  let buffer;
  try{
   buffer=await page.locator('#glCanvas').screenshot({
    path:out+'/'+time.name+'.png',timeout:90000,animations:'disabled'});
  }finally{
   await page.evaluate(()=>document.body.classList.remove('patrol-env-qa'));
  }
  const metrics=imageMetrics(buffer);
  if(metrics.width<640||metrics.height<360||metrics.colorBins<25||
     metrics.nearBlackFraction>.97)
    throw Error('Unusable '+time.name+' screenshot: '+JSON.stringify(metrics));
  shots.push({name:time.name,state,metrics});
  console.log('[NYC atmosphere QA] '+version+' '+time.name+' '+JSON.stringify(metrics));
 }
 report.passed=problems.length===0;
 if(problems.length)throw Error(problems.join(' | '));
}catch(e){
 report.error=String(e?.stack||e);
 process.exitCode=1;
}finally{
 report.elapsedMs=Date.now()-started;
 await writeFile(out+'/metrics.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();
}
console.log('NYC FIXED-CAMERA TIME REPORT '+JSON.stringify(report,null,2));
