// Four matched camera screenshots: current noon/dusk/night + pinned main dusk.
// PATROL's existing WebGL2 and scenic camera, not WebGPU or a fake preview.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='artifacts/nyc-golden-hour',shots=[],errors=[],warnings=[];
await mkdir(out,{recursive:true});
let browser,report={passed:false};
const check=(ok,message)=>{if(!ok)throw Error(message)};
function pixels(buffer){
 const image=PNG.sync.read(buffer),bins=new Set(),up=[0,0,0],low=[0,0,0];
 let u=0,l=0,dark=0,clip=0,total=0;
 for(let y=0;y<image.height;y+=8)for(let x=0;x<image.width;x+=8){
  const i=(y*image.width+x)*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2];
  bins.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));total++;
  if(r+g+b<22)dark++;
  if(r>=250||g>=250||b>=250)clip++;
  if(y<image.height*.40){up[0]+=r;up[1]+=g;up[2]+=b;u++}
  if(y>=image.height*.66){low[0]+=r;low[1]+=g;low[2]+=b;l++}
 }
 const mean=(a,n)=>a.map(v=>+(v/n).toFixed(2));
 return {width:image.width,height:image.height,colorBins:bins.size,
  darkFraction:+(dark/total).toFixed(5),clippedFraction:+(clip/total).toFixed(5),
  upperMeanRGB:mean(up,u),lowerMeanRGB:mean(low,l)};
}
async function openGame(url,tag){
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(tag+': '+e.message));
 page.on('console',m=>{if(m.type()==='error')warnings.push(tag+': '+m.text())});
 const res=await page.goto(url+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 check(res?.ok(),tag+' HTTP failed');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 await page.waitForFunction(()=>{
  return document.getElementById('titleOverlay')?.hidden&&
   document.getElementById('loadOverlay')?.classList.contains('done');
 },null,{timeout:180000});
 await page.evaluate(()=>{
  for(const [id,v] of [['skyTime','18.5'],['skySeason','1'],['skyWeather','Clear']]){
   const el=document.getElementById(id);el.value=v;
   el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden);
 await page.locator('#hotelTarget').selectOption({label:'New York Harbor'});
 await page.locator('#hotelAngle').evaluate(el=>{
  el.value='-48';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.locator('#hotelZoom').evaluate(el=>{
  el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}))});
 await page.addStyleTag({content:
  'body.qa-golden * {visibility:hidden!important} '+
  'body.qa-golden #glCanvas {visibility:visible!important}'});
 return page;
}
async function snap(page,tag,time,label){
 await page.evaluate(v=>{
  const el=document.getElementById('skyTime');el.value=v;
  el.dispatchEvent(new Event('change',{bubbles:true}));
 },time);
 await page.waitForTimeout(1900);
 const state=await page.evaluate(()=>{
  const gl=document.getElementById('glCanvas')?.getContext('webgl2');
  return {hour:document.getElementById('skyTime')?.value,
   season:document.getElementById('skySeason')?.value,
   weather:document.getElementById('skyWeather')?.value,
   view:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text,
   angle:document.getElementById('hotelAngle')?.value,
   zoom:document.getElementById('hotelZoom')?.value,
   webgl:Boolean(gl&&!gl.isContextLost()),glError:gl?.getError()};
 });
 check(state.hour===time&&state.season==='1'&&state.weather==='Clear'&&
  state.view==='New York Harbor'&&state.angle==='-48'&&state.zoom==='42'&&
  state.webgl&&state.glError===0,'Wrong render state: '+JSON.stringify(state));
 const file=tag+'-'+label+'.png';
 await page.evaluate(()=>document.body.classList.add('qa-golden'));
 let buffer;
 try{buffer=await page.locator('#glCanvas').screenshot({
  path:out+'/'+file,animations:'allow',timeout:120000});}
 finally{await page.evaluate(()=>document.body.classList.remove('qa-golden'))}
 const p=pixels(buffer);
 check(p.width>=640&&p.height>=360&&p.colorBins>20&&p.darkFraction<.97,
  'Blank WebGL screenshot '+file+' '+JSON.stringify(p));
 shots.push({file,time,state,pixels:p});
}
try{
 browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader']});
 let page=await openGame(process.env.PATROL_BASE_URL||'http://127.0.0.1:8891','candidate');
 for(const [time,label] of [['12','noon'],['18.5','dusk'],['0','night']])
  await snap(page,'candidate',time,label);
 await page.close();
 page=await openGame(process.env.PATROL_BASELINE_URL||'http://127.0.0.1:8892','baseline');
 await snap(page,'baseline','18.5','dusk');
 await page.close();
 check(errors.length===0,'Game exceptions: '+errors.join('; '));
 check(warnings.length===0,'WebGL console errors: '+warnings.join('; '));
 const c=shots.find(x=>x.file==='candidate-dusk.png').pixels;
 const b=shots.find(x=>x.file==='baseline-dusk.png').pixels;
 report={passed:true,shots,skyMeanDeltaRGB:c.upperMeanRGB.map((v,i)=>
  +(v-b.upperMeanRGB[i]).toFixed(2)),
  limitations:'SwiftShader capture, not hardware GPU performance or AAA proof',
  errors,warnings};
}catch(e){report={passed:false,shots,error:e.stack||String(e),errors,warnings};process.exitCode=1}
finally{
 await writeFile(out+'/smoke-report.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();
}
console.log('PATROL GOLDEN HOUR QA '+JSON.stringify(report,null,2));
