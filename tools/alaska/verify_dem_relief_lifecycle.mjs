/**
 * PATROL Alaska DEM relief lifecycle. Only a test-served HTML copy gets a
 * read-only probe; shipping shaders, physics and DOM controls remain intact.
 * Exercises live flight-menu map switching plus a forced 503 source fallback.
 */
import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

const root='http://127.0.0.1:8765/';
const source=readFileSync('index.html','utf8');
const anchor='  window.PatrolSpaceBridge = {';
if(source.split(anchor).length!==2)throw Error('Nonunique lifecycle probe anchor');
const eol=source.includes('\r\n')?'\r\n':'\n';
const hook=[
  '  window.PatrolAlaskaReliefLifecycleQA = () => ({',
  '    map:Object.keys(FLIGHT_MAPS).find(k => FLIGHT_MAPS[k]===selectedMap),',
  '    activeAlaskaTerrainScale,',
  '    visibleTerrainScale:terrainScaleFor(selectedMap),',
  '    peak:sampleGroundHeight(-558.75,-461.25),',
  '    sea:sampleGroundHeight(0,-700),',
  '    playing:flying,',
  '    webglLost:gl.isContextLost()',
  '  });',
  ''
].join(eol);
writeFileSync('alaska-relief-lifecycle-qa.html',source.replace(anchor,hook+anchor));
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle',
  '--use-angle=swiftshader','--enable-unsafe-swiftshader',
  '--disable-gpu-sandbox'
]});
const samples=[],errors=[],failures=[],warnings=[],demResponses=[];
const page=await browser.newPage({viewport:{width:1080,height:680},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{
  // A deliberately injected 503 produces an expected Chromium resource error.
  // Ignore ONLY that single known status after the DEM route has fired.
  if(m.type()==='error' &&
     !(failures.length>0 && m.text().includes('Failed to load resource') &&
       m.text().includes('503')))
    errors.push('console: '+m.text());
  if(m.text().includes('Alaska USGS DEM fallback'))warnings.push(m.text());
});
page.on('response',r=>{
  if(r.url().includes('tracy-arm-3dep.json'))demResponses.push(r.status());
});
async function launch(map,phase,expectedActive,expectedTerrain){
  const picker=page.locator('input[name="flightMap"][value="'+map+'"]');
  await picker.check({force:true});
  const start=Date.now();
  await page.locator('#startFlight').click({timeout:12000});
  await page.waitForFunction(name=>{
    const state=window.PatrolSpaceBridge?.getState?.();
    const load=document.getElementById('loadOverlay');
    const title=document.getElementById('titleOverlay');
    const err=document.getElementById('menuError');
    return (err&&!err.hidden) ||
      (state?.map===name&&state.playing&&
       load?.classList.contains('done')&&title?.hidden);
  },map,{timeout:125000,polling:400});
  const outcome=await page.evaluate(()=>{
    const probe=window.PatrolAlaskaReliefLifecycleQA();
    const err=document.getElementById('menuError');
    const canvas=document.getElementById('glCanvas');
    return {...probe,
      menuError:err?.hidden?null:err?.textContent,
      canvas:[canvas.width,canvas.height]
    };
  });
  const elapsedMs=Date.now()-start;
  if(outcome.menuError||!outcome.playing||outcome.webglLost||
     outcome.map!==map||outcome.activeAlaskaTerrainScale!==expectedActive||
     outcome.visibleTerrainScale!==expectedTerrain)
    throw Error('Alaska relief lifecycle '+phase+' mismatch: '+JSON.stringify(outcome));
  if(phase==='preview'&&(outcome.peak<84||Math.abs(outcome.sea-12.2)>0.05))
    throw Error('Preview peak/sea mismatch: '+JSON.stringify(outcome));
  if(phase==='dem-failure'&&Math.abs(outcome.sea-12.2)>0.05)
    throw Error('Failed DEM must keep ocean height: '+JSON.stringify(outcome));
  const item={phase,elapsedMs,...outcome};
  samples.push(item);
  console.log('Alaska relief lifecycle stage '+JSON.stringify(item));
}
try{
  await page.goto(root+'alaska-relief-lifecycle-qa.html?alaskaRelief=preview',
    {waitUntil:'domcontentloaded',timeout:30000});
  await launch('alaska','preview',95,95);
  await page.locator('#flightMenuBtn').click({timeout:12000});
  await page.waitForFunction(()=>!document.getElementById('titleOverlay')?.hidden,
    null,{timeout:12000});
  await launch('coast','switch-to-coast',75,54);
  await page.locator('#flightMenuBtn').click({timeout:12000});
  await page.waitForFunction(()=>!document.getElementById('titleOverlay')?.hidden,
    null,{timeout:12000});

  // Explicitly force the existing DEM loader to fail without editing the game.
  // Routing disables HTTP cache in Playwright; fail this one request only.
  await page.route('**/assets/alaska/tracy-arm-3dep.json',async route=>{
    failures.push(route.request().url());
    await route.fulfill({status:503,contentType:'application/json',
      body:'{"error":"QA forced official DEM unavailability"}'});
  });
  await launch('alaska','dem-failure',75,75);
  if(failures.length!==1||!demResponses.includes(503)||warnings.length!==1)
    throw Error('DEM failure was not exercised exactly once: '+
      JSON.stringify({failures,demResponses,warnings}));
  if(errors.length)throw Error('Browser errors: '+JSON.stringify(errors));
  const report={profile:'SwiftShader software WebGL2, not target GPU',
    timing:'Wall-clock start click to first verified rendered frame; CI-noisy, not hardware first-load SLA',
    samples,demResponses,forcedFailRequests:failures.length,
    fallbackWarnings:warnings.length,errors};
  writeFileSync('artifacts/alaska-relief-lifecycle.json',
    JSON.stringify(report,null,2));
  console.log('PASS Alaska preview->coast->DEM 503 fallback lifecycle: '+
    JSON.stringify(report));
}finally{
  await page.close();
  await browser.close();
}
