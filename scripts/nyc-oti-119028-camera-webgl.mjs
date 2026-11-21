// Real in-game OTI 119028 upper-window camera: same-source 42/68 zoom.
// This is a QA scenic camera, NOT actual free-flight or survey photography.
// Retain the original whole-frame screenshot validation; never make a single
// wall or blue window automatically pass as a realistic NYC streetscape.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8927').replace(/\/$/,'');
const dest='artifacts/nyc-oti-119028';
await mkdir(dest,{recursive:true});
const report={passed:false,target:'Lower Manhattan · 119028 Upper Window',
 sourceId:119028,sourceEdge:12,projection:'PATROL compressed OTI, not survey',
 screenshots:[],measurements:{},warnings:[],errors:[]};
const check=(condition,why)=>{if(!condition)throw Error(why)};
let browser,page;
try{
 browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
 ]});
 page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.on('pageerror',err=>report.errors.push(err.message));
 page.on('console',msg=>{if(msg.type()==='error')report.warnings.push(msg.text())});
 const response=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 check(response?.ok(),'PATROL launcher not served');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 await page.waitForFunction(()=>{
  const title=document.getElementById('titleOverlay'),
        load=document.getElementById('loadOverlay');
  return title?.hidden&&load?.classList.contains('done');
 },null,{timeout:180000});
 await page.evaluate(()=>{
  for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
   const el=document.getElementById(id);
   if(!el)throw Error('Missing environment selector: '+id);
   el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
  null,{timeout:15000});
 await page.locator('#hotelTarget').selectOption({label:report.target});
 await page.addStyleTag({content:
  'body.patrol-qa-scene-only * {visibility:hidden !important;} '+
  'body.patrol-qa-scene-only #glCanvas {visibility:visible !important;}'});
 let anyFailed=false;
 for(const [name,zoom] of [['01-oti119028-mid.png',42],['02-oti119028-near.png',68]]){
  await page.locator('#hotelZoom').evaluate((el,v)=>{
   el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));
  },zoom);
  await page.waitForTimeout(1700);
  const state=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   return {webgl:Boolean(gl&&!gl.isContextLost()),
    glError:gl?.getError()??null,
    view:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text,
    zoom:document.getElementById('hotelZoom')?.value};
  });
  check(state.webgl&&state.glError===0&&state.view===report.target&&
    Number(state.zoom)===zoom,'Invalid exact OTI119028 camera: '+JSON.stringify(state));
  const cadence=await page.evaluate(async()=>{
   let last=null,done=false;const intervals=[];
   await new Promise(resolve=>{
    const timeout=setTimeout(()=>{done=true;resolve()},10000);
    const frame=t=>{if(done)return;
     if(last!==null)intervals.push(t-last);last=t;
     if(intervals.length>=12){done=true;clearTimeout(timeout);resolve()}
     else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
   });
   intervals.sort((a,b)=>a-b);
   return {frames:intervals.length,complete:intervals.length>=12,
    medianFrameMs:intervals.length?intervals[Math.floor(intervals.length/2)]:null,
    p95FrameMs:intervals.length?intervals[Math.floor((intervals.length-1)*.95)]:null};
  });
  await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
  let bytes;
  try{
   // Locator screenshots wait for element-stability and can time out when
   // SwiftShader continuously resizes/paints the live canvas. The HUD is
   // hidden above, so viewport screenshot preserves live WebGL pixels
   // without Playwright's element scroll/stability wait. 1280x720 fixed.
   bytes=await page.screenshot({
    path:dest+'/'+name,animations:'allow',timeout:75000});
  }finally{
   await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
  }
  const png=PNG.sync.read(bytes),colorBins=new Set;
  let nearBlack=0,samples=0;
  for(let y=0;y<png.height;y+=10)for(let x=0;x<png.width;x+=10){
   const pos=(y*png.width+x)*4,data=png.data;
   colorBins.add(((data[pos]>>4)<<8)|((data[pos+1]>>4)<<4)|(data[pos+2]>>4));
   if(data[pos]+data[pos+1]+data[pos+2]<22)nearBlack++;
   samples++;
  }
  const health={width:png.width,height:png.height,colorBins:colorBins.size,
   nearBlackFraction:nearBlack/samples,passed:png.width===1280&&
   png.height===720&&colorBins.size>32&&nearBlack/samples<.97};
  report.screenshots.push(name);
  report.measurements[name]={state,framePacing:cadence,health};
  if(!health.passed)anyFailed=true;
  console.log('[OTI119028] '+name+' '+JSON.stringify(report.measurements[name]));
 }
 check(!report.errors.length,'Game errors: '+report.errors.join('; '));
 check(!anyFailed,'One or more source-window screenshots failed original scene-health gate');
 report.passed=true;
}catch(error){
 report.error=error.stack||String(error);
 process.exitCode=1;
}finally{
 await writeFile(dest+'/qa-report.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();
}
console.log('[OTI119028 QA] '+JSON.stringify(report,null,2));
