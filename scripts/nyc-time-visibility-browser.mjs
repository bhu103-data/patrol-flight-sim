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
const times=[{name:'noon',value:'12'},{name:'dusk',value:'18.5'},
 {name:'midnight',value:'0'}];
const problems=[],shots=[],started=Date.now();
let browser;
function imageMetrics(buffer){
 const png=PNG.sync.read(buffer),luma=[];
 let saturated=0,nearBlack=0,total=0,rSum=0,gSum=0,bSum=0;
 const buckets=new Set();
 for(let y=0;y<png.height;y+=4)for(let x=0;x<png.width;x+=4){
  const k=(y*png.width+x)*4,r=png.data[k],g=png.data[k+1],b=png.data[k+2];
  const Y=.2126*r+.7152*g+.0722*b;
  luma.push(Y);total++;rSum+=r;gSum+=g;bSum+=b;
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
   colorBins:buckets.size};
}
const report={version,base,camera,resolution:[1280,720],
  season:'Summer',weather:'Clear',zoom:'42',angle:'0',
  times:times.map(({name,value})=>({name,clock:value})),shots,
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
  await page.evaluate(value=>{
   const el=document.getElementById('skyTime');
   if(!el)throw Error('Missing time-of-day control');
   el.value=value;
   el.dispatchEvent(new Event('change',{bubbles:true}));
  },time.value);
  // Updating the dropdown does not alter the camera or reset the aircraft.
  // Let two shader frames settle before capturing, without advancing the
  // automatic day/night clock (the user has chosen a fixed time).
  await page.waitForTimeout(1600);
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
     state.clock!==time.value||state.weather!=='Clear'||state.season!=='1')
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
