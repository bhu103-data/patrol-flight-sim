'use strict';
// Opt-in Chromium/WebGL smoke test for Manhattan's Central Park scenic views.
// Runs against the checked-out static game, not the live GitHub Pages deployment.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PATROL_PLAYWRIGHT ||
  '/tmp/patrol-browser/node_modules/playwright');
const base=process.env.PATROL_TEST_URL||'http://127.0.0.1:8127/index.html';
const outDir=path.join(process.cwd(),'artifacts');
fs.mkdirSync(outDir,{recursive:true});

(async()=>{
 const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox'
 ]});
 const page=await browser.newPage({viewport:{width:1280,height:720},
  deviceScaleFactor:1});
 const logs=[];
 page.on('console',m=>{
   if(m.type()==='error'||m.type()==='warning')
    logs.push(m.type()+': '+m.text().slice(0,320));
 });
 page.on('pageerror',e=>logs.push('pageerror: '+String(e).slice(0,350)));
 const photo=async name=>{
  await page.screenshot({path:path.join(outDir,name),animations:'disabled',
    timeout:30000});
 };
 const current=()=>page.evaluate(()=>{
  const glCanvas=document.getElementById('glCanvas');
  const context=glCanvas?.getContext('webgl2');
  return {
   map:new FormData(document.getElementById('flightSetup')).get('flightMap'),
   webgl2:!!context,contextLost:context?.isContextLost()||false,
   canvasWidth:glCanvas?.width||0,canvasHeight:glCanvas?.height||0,
   pageLoading:!document.getElementById('loadOverlay')?.classList.contains('done'),
   titleVisible:!document.getElementById('titleOverlay')?.hidden,
   parkButtonVisible:!document.getElementById('centralParkShortcutButton')?.hidden,
   scenicPanelVisible:!document.getElementById('hotelViews')?.hidden,
   detail:document.getElementById('hotelDetail')?.textContent||'',
   selectedView:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text||'',
   flight:window.PatrolSpaceBridge?.getState?.()||null
  };
 });
 const report={url:base,stages:[],warnings:[]};
 try{
  await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(await page.locator('input[name=flightMap]:checked').inputValue(),'manhattan');
  assert.equal(await page.locator('#startFlight').isEnabled(),true);
  await page.locator('#startFlight').click();
  await page.waitForFunction(()=>{
   const load=document.getElementById('loadOverlay');
   const menu=document.getElementById('titleOverlay');
   const button=document.getElementById('centralParkShortcutButton');
   return Boolean(load?.classList.contains('done') && menu?.hidden &&
     button && !button.hidden && document.getElementById('glCanvas')?.width>500);
  },null,{timeout:180000,polling:1000});
  await page.waitForTimeout(1600);
  const initial=await current();
  assert(initial.webgl2&&!initial.contextLost);
  assert(initial.canvasWidth>=500&&initial.canvasHeight>=300);
  assert.equal(initial.map,'manhattan');
  assert.equal(initial.flight?.map,'manhattan');
  assert.equal(initial.parkButtonVisible,true);
  await photo('nyc-initial-flight.png');
  report.stages.push({stage:'flight',...initial});

  await page.keyboard.press('p');
  await page.waitForFunction(()=>{
   const d=document.getElementById('hotelDetail');
   return d?.textContent?.includes('Reservoir shoreline') &&
     !document.getElementById('hotelViews')?.hidden;
  },null,{timeout:25000});
  await page.waitForTimeout(700);
  const reservoir=await current();
  assert.match(reservoir.detail,/Reservoir shoreline/);
  assert.match(reservoir.selectedView,/Central Park · Reservoir Aerial/);
  assert(reservoir.scenicPanelVisible && reservoir.webgl2 && !reservoir.contextLost);
  await photo('nyc-central-park-reservoir.png');
  report.stages.push({stage:'reservoir',...reservoir});

  await page.locator('#hotelTarget').selectOption({label:'Central Park · Bow Bridge'});
  await page.waitForFunction(()=>
   document.getElementById('hotelDetail')?.textContent?.includes('Iron arch'),
  null,{timeout:15000});
  await page.waitForTimeout(700);
  const bow=await current();
  assert.match(bow.selectedView,/Central Park · Bow Bridge/);
  assert(bow.webgl2&&!bow.contextLost);
  await photo('nyc-central-park-bow-bridge.png');
  report.stages.push({stage:'bow-bridge',...bow});

  await page.locator('#resumeFlight').click();
  await page.waitForFunction(()=>document.getElementById('hotelViews')?.hidden,
   null,{timeout:10000});
  await page.waitForTimeout(650);
  const restored=await current();
  assert.equal(restored.scenicPanelVisible,false);
  assert.equal(restored.flight?.map,'manhattan');
  assert.equal(restored.flight?.playing,true);
  assert(restored.webgl2&&!restored.contextLost);
  await photo('nyc-flight-after-park.png');
  report.stages.push({stage:'resumed',...restored});
  console.log('PASS NYC in-page park visual smoke: '+JSON.stringify(report,null,2));
 }catch(error){
  report.error=String(error);
  console.error('FAIL NYC browser smoke: '+JSON.stringify(report,null,2));
  throw error;
 }finally{
  fs.writeFileSync(path.join(outDir,'nyc-browser-report.json'),
   JSON.stringify({...report,warnings:logs.slice(-35)},null,2));
  console.log('Browser console errors/warnings: ',JSON.stringify(logs.slice(-35)));
  await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
