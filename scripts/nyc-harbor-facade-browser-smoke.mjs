// Single-camera real WebGL acceptance for OTI Manhattan facade vantage.
// Keeps the costly nine-scene tour as a separate full visual suite.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {visibleHarborSkyFraction,MIN_HARBOR_SKY_FRACTION} from './nyc-harbor-sky-qa.mjs';
import {mkdir,writeFile} from 'node:fs/promises';

const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8899').replace(/\/$/,'');
const dest='artifacts/nyc-harbor-facade';
await mkdir(dest,{recursive:true});
const errors=[],warnings=[],start=Date.now();
let browser,page,report={passed:false,camera:'Lower Manhattan · Window Facades'};
const check=(value,label)=>{if(!value)throw Error(label);};
try{
 browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
 ]});
 page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')warnings.push(m.text());});
 const nav=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 check(nav?.ok(),'Flight simulator HTTP page failed');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 await page.waitForFunction(()=>{
  const overlay=document.getElementById('loadOverlay');
  return document.getElementById('titleOverlay')?.hidden&&
    overlay?.classList.contains('done');
 },null,{timeout:180000});
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
  null,{timeout:15000});
 await page.locator('#hotelTarget').selectOption({
  label:'Lower Manhattan · Window Facades'
 });
 await page.waitForTimeout(2600);
 const state=await page.evaluate(()=>{
  const canvas=document.getElementById('glCanvas');
  const gl=canvas?.getContext('webgl2');
  return {view:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text,
    webgl:!!gl&&!gl.isContextLost(),error:gl?.getError()??null,
    width:canvas?.width||0,height:canvas?.height||0};
 });
 check(state.webgl&&state.error===0,'Invalid WebGL: '+JSON.stringify(state));
 check(state.view===report.camera,'Wrong scenic view: '+state.view);
 await page.addStyleTag({content:
   'body.patrol-qa-scene-only * {visibility:hidden !important;} '+
   'body.patrol-qa-scene-only #glCanvas {visibility:visible !important;}'});
 await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
 let png;
 try{
  check(await page.locator('#hotelViews').evaluate(
    el=>getComputedStyle(el).visibility==='hidden'),
    'HUD was visible during canvas capture');
  png=await page.locator('#glCanvas').screenshot({
    path:dest+'/09-manhattan-window-facades.png',
    animations:'allow',timeout:90000
  });
 }finally{
  await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
 }
 const img=PNG.sync.read(png),colors=new Set();
 let dark=0,count=0;
 for(let y=0;y<img.height;y+=10)for(let x=0;x<img.width;x+=10){
  const p=(y*img.width+x)*4;
  const r=img.data[p],g=img.data[p+1],b=img.data[p+2];
  colors.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
  if(r+g+b<22)dark++;count++;
 }
 const pixels={width:img.width,height:img.height,colorBins:colors.size,
   nearBlackFraction:dark/count,
   upperSkyFraction:visibleHarborSkyFraction(img)};
 check(colors.size>32&&dark/count<.97,
   'Harbor facade screenshot too uniform: '+JSON.stringify(pixels));
 // A 35-bin screenshot passed while showing only near-wall glass/stone;
 // the dedicated harbor shot must include open daylight sky as well.
 check(pixels.upperSkyFraction>=MIN_HARBOR_SKY_FRACTION,
   'Harbor facade camera is blocked by nearby walls: '+JSON.stringify(pixels));
 check(!errors.length,'Game exceptions: '+errors.join('; '));
 report={passed:true,state,pixels,elapsedMs:Date.now()-start,
   warnings,errors};
}catch(error){
 report={...report,passed:false,error:error.stack||String(error),
  elapsedMs:Date.now()-start,warnings,errors};
 process.exitCode=1;
}finally{
 await writeFile(dest+'/smoke-report.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();
}
console.log('NYC HARBOR FACADE SINGLE VIEW: '+JSON.stringify(report,null,2));
