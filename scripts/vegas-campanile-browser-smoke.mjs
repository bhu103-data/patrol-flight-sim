// Focused live WebGL2 4-camera close-up of The Venetian's campanile.
// Start: python3 -m http.server 8765 --bind 127.0.0.1
// Run: node scripts/vegas-campanile-browser-smoke.mjs
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/vegas-campanile';
await mkdir(out,{recursive:true});
const errors=[],shots=[],checks=[];
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));
page.on('requestfailed',req=>{
 if(req.url().startsWith(base))errors.push('local fetch failure: '+req.url());
});
const assert=(value,msg)=>{if(!value)throw new Error(msg);};
const stats=bytes=>{
 const im=PNG.sync.read(bytes),unique=new Set();
 let nearBlack=0,total=0,centerVariance=0,centerSum=0,centerSum2=0,n=0;
 for(let y=0;y<im.height;y+=8)for(let x=0;x<im.width;x+=8){
  const i=(y*im.width+x)*4,r=im.data[i],g=im.data[i+1],b=im.data[i+2];
  unique.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
  if(r+g+b<20)nearBlack++;
  total++;
  if(x>=im.width*.34&&x<=im.width*.66&&
     y>=im.height*.1&&y<=im.height*.9){
   const v=(r+g+b)/3;centerSum+=v;centerSum2+=v*v;n++;
  }
 }
 centerVariance=Math.sqrt(Math.max(0,centerSum2/Math.max(1,n)-
  (centerSum/Math.max(1,n))**2));
 // The campanile's green pyramidal spire must not be clipped by the top
 // framebuffer edge in the near/noon camera. This is a narrow object-color
 // guard, NOT a metric of photorealism.
 let greenAtTop=0,topSamples=0;
 for(let y=0;y<Math.min(8,im.height);y++)
  for(let x=Math.floor(im.width*.34);x<Math.ceil(im.width*.66);x++){
   const i=(y*im.width+x)*4,r=im.data[i],g=im.data[i+1],b=im.data[i+2];
   topSamples++;
   if(g>=26&&g>r+12&&g>b+2)greenAtTop++;
  }
 return {width:im.width,height:im.height,colorBins:unique.size,
  nearBlackFraction:nearBlack/total,centerStdDev:centerVariance,
  topGreenFraction:greenAtTop/Math.max(1,topSamples)};
};
async function settle(frames=32){
 await page.evaluate(n=>new Promise((resolve,reject)=>{
  let i=0;
  const tid=setTimeout(()=>reject(new Error('campanile scenic pose timed out')),45000);
  function tick(){if(++i>=n){clearTimeout(tid);resolve(i)}
   else requestAnimationFrame(tick);}
  requestAnimationFrame(tick);
 }),frames);
}
let result={status:'failed',errors,shots,checks};
try{
 const response=await page.goto(base+'/index.html?graphics=compat',{
  waitUntil:'domcontentloaded',timeout:60000});
 assert(response?.ok(),'game launcher not available');
 await page.locator('input[name="flightMap"][value="vegas"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 await page.waitForFunction(()=>{
  const title=document.getElementById('titleOverlay');
  const load=document.getElementById('loadOverlay');
  return title?.hidden&&load?.classList.contains('done');
 },null,{timeout:210000});
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.querySelector('#hotelViews')?.hidden,
  null,{timeout:15000});
 await page.locator('#hotelTarget').selectOption({label:'Venetian Campanile Close-up'});
 await page.locator('#hotelAngle').evaluate(el=>{
  el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.addStyleTag({content:
  'body.campanile-only *{visibility:hidden!important;}'+
  'body.campanile-only #glCanvas{visibility:visible!important;}'});
 for(const [light,time] of [['noon','12'],['night','0']]){
  await page.locator('#skyTime').evaluate((el,t)=>{
   el.value=t;el.dispatchEvent(new Event('change',{bubbles:true}));
  },time);
  await page.locator('#skyWeather').evaluate(el=>{
   el.value='Clear';el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  for(const [distance,zoom] of [['near','70'],['far','36']]){
   await page.locator('#hotelZoom').evaluate((el,z)=>{
    el.value=z;el.dispatchEvent(new Event('input',{bubbles:true}));
   },zoom);
   await settle();
   const view=await page.evaluate(()=>{
    const canvas=document.getElementById('glCanvas');
    const gl=canvas?.getContext('webgl2');
    const info=gl?.getExtension('WEBGL_debug_renderer_info');
    return {webgl2:Boolean(gl&&!gl.isContextLost()),glError:gl?.getError(),
     renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'unknown',
     map:document.querySelector('input[name="flightMap"]:checked')?.value,
     target:document.querySelector('#hotelTarget')?.selectedOptions[0]?.textContent,
     zoom:document.getElementById('hotelZoom')?.value,
     time:document.getElementById('skyTime')?.value};
   });
   assert(view.webgl2&&view.glError===0,'WebGL2 missing or errored');
   assert(view.map==='vegas'&&view.target==='Venetian Campanile Close-up',
    'scenic target missing: '+JSON.stringify(view));
   const file='venetian-belfry-'+distance+'-'+light+'.png';
   await page.evaluate(()=>document.body.classList.add('campanile-only'));
   let bytes;
   try{bytes=await page.locator('#glCanvas').screenshot({
    path:out+'/'+file,timeout:75000,animations:'allow'});}
   finally{await page.evaluate(()=>document.body.classList.remove('campanile-only'));}
   const pixels=stats(bytes);
   assert(pixels.width>=640&&pixels.height>=360&&pixels.colorBins>35&&
    pixels.nearBlackFraction<.9,'blank campanile scene '+file+' '+JSON.stringify(pixels));
   if(light==='noon'&&distance==='near')
    assert(pixels.topGreenFraction<.005,
      'Campanile green roof is clipped by the top viewport edge: '+
      JSON.stringify(pixels));
   checks.push({file,...pixels});
   shots.push({file,...view});
  }
 }
 assert(errors.length===0,'browser errors: '+errors.join(' | '));
 result={status:'passed',browser:'Playwright Chromium SwiftShader (software)',
  errors,shots,checks};
}catch(e){errors.push(e.message);}
finally{
 await writeFile(out+'/report.json',JSON.stringify(result,null,2));
 await browser.close();
}
if(result.status!=='passed')throw Error('Campanile browser QA failed: '+errors.join('; '));
console.log(JSON.stringify(result,null,2));
