'use strict';
// Real WebGL2 screenshot regression for the polygonal Times Square replacement.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('/tmp/patrol-browser/node_modules/playwright');
const {PNG}=require('/tmp/patrol-browser/node_modules/pngjs');
const url=process.env.PATROL_TEST_URL||'http://127.0.0.1:8127/index.html';
const dir=path.resolve('artifacts/nyc-times');
fs.mkdirSync(dir,{recursive:true});
function analyze(buffer){
 const img=PNG.sync.read(buffer),colors=new Set();let black=0,total=0;
 for(let y=0;y<img.height;y+=10)for(let x=0;x<img.width;x+=10){
  const i=(y*img.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
  colors.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
  if(r+g+b<22)black++;
  total++;
 }
 return {width:img.width,height:img.height,colors:colors.size,blackFraction:black/total};
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const report={source:url,status:'PENDING',stages:[],errors:[],assetErrors:[]};
 page.on('pageerror',error=>report.errors.push('pageerror: '+String(error).slice(0,350)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,350))});
 page.on('response',response=>{
  if(response.url().includes('/assets/nyc/')&&!response.ok())
   report.assetErrors.push(response.status()+': '+response.url());
 });
 async function capture(filename,expected){
  await page.waitForTimeout(1200);
  const scene=await page.evaluate(()=>{
   const c=document.getElementById('glCanvas'),gl=c?.getContext('webgl2');
   return {width:c?.width||0,height:c?.height||0,webgl2:!!gl,
     contextLost:gl?.isContextLost()||false,
     view:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text||'',
     panel:!document.getElementById('hotelViews')?.hidden};
  });
  assert(scene.webgl2&&!scene.contextLost&&scene.width>=500&&scene.height>=300);
  if(expected)assert.equal(scene.view,expected);
  const screenshot=await page.screenshot({
   path:path.join(dir,filename+'.png'),timeout:30000,animations:'disabled'
  });
  const pixels=analyze(screenshot);
  assert(pixels.colors>40&&pixels.blackFraction<.97,
   'Blank screenshot: '+filename);
  report.stages.push({filename,...scene,pixels});
 }
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(await page.locator('input[name=flightMap]:checked').inputValue(),'manhattan');
  await page.locator('#startFlight').click();
  await page.waitForFunction(()=>{
   const overlay=document.getElementById('loadOverlay');
   return !!(overlay?.classList.contains('done') &&
     document.getElementById('titleOverlay')?.hidden &&
     document.getElementById('glCanvas')?.width>=500);
  },null,{timeout:180000,polling:1000});
  await capture('harbor-start');
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
   null,{timeout:20000});
  for(const [view,file] of [
    ['Times Square Street Level','times-square-street'],
    ['44th Street LED Canyon','times-square-led-canyon'],
    ['One Times Square','one-times-square'],
    ['Duffy Square Street View','tkts-duffy-square']
  ]){
   await page.locator('#hotelTarget').selectOption({label:view});
   await capture(file,view);
  }
  assert.equal(report.assetErrors.length,0,'NYC textures/models all loaded');
  assert(!report.errors.some(e=>/shader|uncaught|WebGL|GIS fallback/i.test(e)),
    'No fatal scene or shader errors');
  report.status='PASS';
  console.log('PASS NYC Times Square visual regression: '+JSON.stringify(report,null,2));
 }catch(error){
  report.status='FAIL';
  report.error=String(error);
  console.error('FAIL NYC Times Square visual regression: '+JSON.stringify(report,null,2));
  process.exitCode=1;
 }finally{
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exitCode=1});
