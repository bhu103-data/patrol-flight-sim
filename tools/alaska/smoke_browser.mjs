/**
 * Optional browser-level visual smoke test of the Alaska production scene.
 * Run with a local static server, Playwright Chromium and software WebGL2.
 * Screenshot is kept only as a CI artifact; no claims of measured FPS.
 */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const url=process.env.PATROL_TEST_URL || 'http://127.0.0.1:8765/';
const errors=[],requests=[],glacierDetailLogs=[],villageLogs=[];
const browser=await chromium.launch({
  headless:true,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
        '--enable-unsafe-swiftshader','--disable-gpu-sandbox']
});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',error=>errors.push('JS exception: '+error.message));
  page.on('console',message=>{
    const m=message.text();
    if(message.type()==='error')errors.push('Console: '+m);
    if(m.includes('[PATROL] Alaska fjord detail'))glacierDetailLogs.push(m);
    if(m.includes('[PATROL] Alaska surveyed village'))villageLogs.push(m);
    if(/Alaska|WebGL|photo|GPU/i.test(m))console.log('[BROWSER]',m.slice(0,300));
  });
  page.on('response',response=>{
    const u=response.url();
    if(u.includes('/assets/alaska/')){
      requests.push({url:u,status:response.status()});
      if(response.status()>=400)errors.push('Alaska asset failed: '+u+' HTTP '+response.status());
    }
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  const webgl=await page.evaluate(()=>{
    const canvas=document.querySelector('#glCanvas');
    return Boolean(canvas?.getContext('webgl2'));
  });
  if(!webgl)throw new Error('Browser WebGL2 unavailable');
  await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
  await page.locator('#startFlight').click({timeout:15000});
  await page.waitForFunction(()=>{
    const err=document.getElementById('menuError');
    const loader=document.getElementById('loadOverlay');
    const title=document.getElementById('titleOverlay');
    return (err && !err.hidden) ||
       (loader?.classList.contains('done') && title?.hidden);
  },null,{timeout:110000});
  const state=await page.evaluate(()=>({
    loadingDone:document.getElementById('loadOverlay')?.classList.contains('done'),
    menuError:document.getElementById('menuError')?.hidden?null:
      document.getElementById('menuError')?.textContent,
    screenWidth:document.getElementById('glCanvas')?.width,
    screenHeight:document.getElementById('glCanvas')?.height,
    gpuLost:document.getElementById('glCanvas')?.getContext('webgl2')?.isContextLost()
  }));
  console.log('Alaska live-state:',JSON.stringify(state));
  if(!state.loadingDone||state.menuError||state.gpuLost)
    throw new Error('Alaska failed to render: '+JSON.stringify(state));
  // Ensure the local measured DEM AND both CC0 photo maps were requested.
  await page.waitForTimeout(2500);
  const requested=requests.filter(x=>x.status===200).map(x=>x.url);
  for(const file of ['tracy-arm-3dep.json','alaska-photo-albedo.webp',
                     'alaska-photo-nrm-rough.webp']){
    if(!requested.some(x=>x.endsWith('/'+file)))
      throw new Error('Missing successful Alaska local asset request: '+file);
  }
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/alaska-live-webgl.png'});
  if(!glacierDetailLogs.some(m=>/seracs:\s*28/.test(m) && /iceStrata:\s*62/.test(m))){
    throw new Error('Glacier serac and strata geometry not confirmed in live WebGL pass: '+
      glacierDetailLogs.join(' | '));
  }
  const villageLine=villageLogs.find(m=>m.includes('[PATROL] Alaska surveyed village'));
  const audit=villageLine && JSON.parse(villageLine.slice(
    villageLine.indexOf('{')));
  if(!audit||audit.cabins!==6||audit.sidingRows!==72||audit.roofSeams<45||
     audit.undergrowth<100)
    throw new Error('Alaska harbor lodge geometry not present in real WebGL: '+
      JSON.stringify({audit,villageLogs}));
  // A second reproducible screenshot faces the actual glacier mouth.
  // This is opt-in inspection mode only; default Alaska spawn is unchanged.
  const focusUrl=new URL(url);
  focusUrl.searchParams.set('alaskaView','glacier');
  await page.goto(focusUrl.toString(),{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
  await page.locator('#startFlight').click({timeout:15000});
  await page.waitForFunction(()=>{
    const err=document.getElementById('menuError');
    const overlay=document.getElementById('loadOverlay');
    const title=document.getElementById('titleOverlay');
    return (err&&!err.hidden)||(overlay?.classList.contains('done')&&title?.hidden);
  },null,{timeout:110000});
  if(!(await page.locator('#loadOverlay').evaluate(el=>el.classList.contains('done'))))
    throw new Error('Alaska glacier focus did not load');
  await page.waitForTimeout(2300);
  await page.screenshot({path:'artifacts/alaska-glacier-closeup.png'});
  // Third QA camera points at the actual surveyed six-cabin harbor scene.
  // The default spawn and the public menu do not change.
  focusUrl.searchParams.set('alaskaView','harbor');
  await page.goto(focusUrl.toString(),{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
  await page.locator('#startFlight').click({timeout:15000});
  await page.waitForFunction(()=>{
    const err=document.getElementById('menuError');
    const loading=document.getElementById('loadOverlay');
    const title=document.getElementById('titleOverlay');
    return (err&&!err.hidden)||(loading?.classList.contains('done')&&title?.hidden);
  },null,{timeout:110000});
  await page.waitForTimeout(1400);
  const harborState=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  if(!harborState?.playing||harborState.map!=='alaska' ||
     harborState.position[0]<70||harborState.position[0]>150||
     harborState.altitude<25 || !Number.isFinite(harborState.yaw))
    throw new Error('Alaska harbor visual QA camera failed: '+JSON.stringify(harborState));
  await page.screenshot({path:'artifacts/alaska-surveyed-harbor-houses.png'});
  // Separate art-only evidence from the gameplay UI. No special renderer or
  // fake static image: this is the same live WebGL2 canvas, minus HTML HUD.
  await page.addStyleTag({content:
    '#flightMap,#statusBar,#skySettings,#hudCanvas{visibility:hidden !important;}'});
  await page.screenshot({path:'artifacts/alaska-surveyed-harbor-clean.png'});
  console.log('Alaska village WebGL2 scene:',JSON.stringify(audit),
    'camera:',JSON.stringify(harborState));
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('PASS: Alaska measured DEM, real CC0 photo atlases, live WebGL2 and frame accepted.');
}finally{
  await browser.close();
}
