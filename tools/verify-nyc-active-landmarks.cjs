'use strict';
// End-to-end activation test: Manhattan flight uses all three reviewed GLBs.
// npm install --no-save playwright@1.56.1 ; python3 -m http.server 8127 &
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PATROL_PLAYWRIGHT||
  '/tmp/patrol-browser/node_modules/playwright');
const origin=process.env.PATROL_TEST_ORIGIN||'http://127.0.0.1:8127';
const out=path.join(process.cwd(),'artifacts');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox'
 ]});
 const responses={},messages=[],required=['trade','empire','chrysler'];
 const report={source:'actual Manhattan flight',required,network:responses};
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('response',response=>{
   for(const name of required)if(response.url().includes('/assets/nyc/scenario/'+name+'.glb'))
    responses[name]={status:response.status(),url:response.url()};
  });
  page.on('pageerror',e=>messages.push('pageerror: '+e.message));
  page.on('console',m=>{
   if(/NYC asset fallback|scenario|out of memory|WebGL/.test(m.text()))
    messages.push(m.type()+': '+m.text().slice(0,400));
  });
  const response=await page.goto(origin+'/index.html?nycModels=enabled',
   {waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response?.status(),200);
  const configured=await page.evaluate(async()=>{
   const response=await fetch('./assets/nyc/scenario-manifest.json');
   const manifest=await response.json();
   return Object.fromEntries(['trade','empire','chrysler'].map(name=>
    [name,manifest.landmarks[name]?.enabled]));
  });
  for(const name of required)assert.equal(configured[name],true,
   name+' is not enabled in source manifest');
  await page.locator('input[name="flightMap"][value="manhattan"]').check();
  await page.locator('input[name="flightMode"][value="free"]').check();
  await page.locator('#startFlight').click();
  await page.waitForFunction(()=>{
   const overlay=document.getElementById('loadOverlay');
   const title=document.getElementById('titleOverlay');
   const canvas=document.getElementById('glCanvas');
   return overlay?.classList.contains('done') && title?.hidden &&
     canvas?.width>500;
  },null,{timeout:180000,polling:1200});
  await page.waitForFunction(()=>
   ['trade','empire','chrysler'].every(name=>
    performance.getEntriesByType('resource').some(e=>
      e.name.includes('/assets/nyc/scenario/'+name+'.glb'))),
   null,{timeout:90000,polling:1200});
  await page.waitForTimeout(1800);
  report.state=await page.evaluate(()=>{
   const canvas=document.getElementById('glCanvas');
   const gl=canvas?.getContext('webgl2');
   const info=window.PatrolSpaceBridge?.getState?.()||{};
   return {webgl2:!!gl,contextLost:gl?.isContextLost(),
    canvas:[canvas?.width,canvas?.height],
    playing:info.playing,map:info.map};
  });
  report.messages=messages.slice(-25);
  report.configured=configured;
  for(const name of required)assert.equal(responses[name]?.status,200,
   name+' GLB request did not succeed; '+JSON.stringify(responses));
  assert.equal(report.state.map,'manhattan');
  assert.equal(report.state.playing,true);
  assert.equal(report.state.webgl2,true);
  assert.equal(report.state.contextLost,false);
  await page.screenshot({path:path.join(out,'manhattan-three-glbs.png'),
   animations:'disabled',timeout:30000});
  report.pass=true;
  console.log('PASS active Manhattan 3-GLB scene '+JSON.stringify(report,null,2));
 }catch(error){
  report.pass=false;report.error=String(error);
  console.error('FAIL active Manhattan 3-GLB scene '+JSON.stringify(report,null,2));
  throw error;
 }finally{
  fs.writeFileSync(path.join(out,'manhattan-three-glbs-report.json'),
   JSON.stringify(report,null,2)+'\n');
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
