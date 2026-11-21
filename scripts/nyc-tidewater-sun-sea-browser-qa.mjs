// Browser acceptance for PATROL's Tidewater-inspired sky/sea visual patch.
// Same native New York Harbor scene, no fake GPU hardware FPS assertions.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8899').replace(/\/$/,'');
const dest='artifacts/nyc-tidewater-sun-sea';
await mkdir(dest,{recursive:true});
const errors=[],screenshots=[],states={},pixels={};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));
page.on('requestfailed',r=>{if(r.url().startsWith(base))errors.push('HTTP asset failed: '+r.url());});
const requireState=(condition,message)=>{if(!condition)throw Error(message);};
let result={passed:false,errors,screenshots,states,pixels};
try{
 const response=await page.goto(base+'/index.html?graphics=compat',
  {waitUntil:'domcontentloaded',timeout:60000});
 requireState(response?.ok(),'The game HTML did not load');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 await page.waitForFunction(()=>
  document.getElementById('titleOverlay')?.hidden &&
  document.getElementById('loadOverlay')?.classList.contains('done'),
  null,{timeout:180000});
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
  null,{timeout:15000});
 await page.locator('#hotelTarget').selectOption({label:'New York Harbor'});
 await page.locator('#hotelZoom').evaluate(el=>{
  el.value='44';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.addStyleTag({content:
  'body.qa-sun-sea *{visibility:hidden!important;}'+
  'body.qa-sun-sea #glCanvas{visibility:visible!important;}'});
 for(const [label,clock,angle] of [
  // This harbor camera faces ~347°; face its sun instead of putting the
  // sunset behind the viewer (the prior 140° / 220° pair looked like daylight).
  // Summer 19:00 is close to the horizon in PATROL's 41°-latitude clock.
  ['golden-left','19','330'],['golden-right','19','359'],['noon-auto','12','-1']
 ]){
  await page.evaluate(([hour,azimuth])=>{
   for(const [id,value] of [
    ['skyTime',hour],['skySeason','1'],['skyWeather','Clear'],['skyAzimuth',azimuth]
   ]){
    const el=document.getElementById(id);
    if(!el)throw Error('Environment UI is missing '+id);
    el.value=value;
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
   }
  },[clock,angle]);
  await page.waitForTimeout(1500);
  const state=await page.evaluate(()=>{
   const canvas=document.getElementById('glCanvas');
   const gl=canvas?.getContext('webgl2');
   return {webgl2:!!gl&&!gl.isContextLost(),error:gl?.getError()??null,
    selected:document.querySelector('input[name="flightMap"]:checked')?.value,
    camera:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text,
    clock:document.getElementById('skyTime')?.value,
    azimuth:document.getElementById('skyAzimuth')?.value,
    label:document.getElementById('skyAzimuthValue')?.textContent};
  });
  requireState(state.webgl2&&state.error===0,'WebGL context/shader error '+JSON.stringify(state));
  requireState(state.selected==='manhattan'&&state.camera==='New York Harbor',
    'Wrong map/camera '+JSON.stringify(state));
  requireState(state.clock===clock&&state.azimuth===angle&&
    state.label===(angle==='-1'?'Auto':angle+'°'),
    'Sun direction control not applied: '+JSON.stringify(state));
  const name='nyc-harbor-'+label+'.png';
  await page.evaluate(()=>document.body.classList.add('qa-sun-sea'));
  let imageBytes;
  try{imageBytes=await page.locator('#glCanvas').screenshot({
    path:dest+'/'+name,animations:'allow',timeout:75000
  });}finally{await page.evaluate(()=>document.body.classList.remove('qa-sun-sea'));}
  const img=PNG.sync.read(imageBytes),bins=new Set();
  let black=0,count=0;
  for(let y=0;y<img.height;y+=12)for(let x=0;x<img.width;x+=12){
   const i=(y*img.width+x)*4;
   const red=img.data[i],green=img.data[i+1],blue=img.data[i+2];
   if(red+green+blue<25)black++;
   bins.add(((red>>4)<<8)|((green>>4)<<4)|(blue>>4));
   count++;
  }
  const metric={width:img.width,height:img.height,colorBins:bins.size,
    darkFraction: black/Math.max(1,count)};
  requireState(img.width>=640&&img.height>=360&&bins.size>25&&metric.darkFraction<0.97,
    'Almost blank output '+name+' '+JSON.stringify(metric));
  screenshots.push(name);
  states[label]=state;
  pixels[label]=metric;
 }
 requireState(!errors.length,'Browser exceptions/assets: '+JSON.stringify(errors));
 result={passed:true,errors,screenshots,states,pixels,
  note:'Software SwiftShader render and three actual screenshots; not a 60 FPS or realism score'};
}catch(e){
 result={...result,passed:false,error:e.stack||String(e)};
 process.exitCode=1;
}finally{
 await writeFile(dest+'/report.json',JSON.stringify(result,null,2));
 await browser.close();
}
console.log('NYC SKY/SEA '+JSON.stringify(result,null,2));
