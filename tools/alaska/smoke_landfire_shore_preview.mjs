/**
 * PATROL Alaska optional LF2025 shore mode: real Chromium WebGL2 A/B smoke.
 * Fixed viewport, same harbor inspector spawn; no offline still-image rendering.
 * rAF delta is wall-clock frame pacing on SwiftShader CI, NOT discrete-GPU FPS.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';

const root='http://127.0.0.1:8765/';
const browser=await chromium.launch({
  headless:true,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
        '--enable-unsafe-swiftshader','--disable-gpu-sandbox']
});
const cases=[
  {name:'baseline',query:'?alaskaView=harbor',expectMask:false,expectPreview:false},
  {name:'landfire-preview',query:'?alaskaView=harbor&alaskaShore=landfire-preview',
    expectMask:true,expectPreview:true},
  {name:'compat-fallback',query:'?alaskaView=harbor&alaskaShore=landfire-preview&graphics=compat',
    expectMask:false,expectPreview:false},
];
const report={kind:'PATROL_ALASKA_LF2025_SHORE_EXPERIMENT_BROWSER_QA_V1',
  renderer:'Playwright Chromium headless SwiftShader WebGL2',
  viewport:[1280,800],cases:{},limitations:[
    'Same harbor inspection start camera and fixed viewport; autonomous flight can move slightly between captures.',
    'These are real game WebGL2 screenshots, not coastal survey or controlled pixel-perfect comparisons.',
    'rAF frame pacing reflects GitHub software WebGL2 runner and is not a hardware GPU FPS benchmark.',
    'Preview mask carves only 3DEP 1–12m cells classified water by LANDFIRE; high cliff conflict remains.',
  ]};
mkdirSync('artifacts',{recursive:true});

try {
  for(const scenario of cases) {
    const page=await browser.newPage({viewport:{width:1280,height:800},
      deviceScaleFactor:1});
    const requests=[],warnings=[],errors=[];
    page.on('pageerror',error=>errors.push('pageerror: '+error.message));
    page.on('console',message=>{
      const text=message.text();
      if(message.type()==='error')errors.push('console: '+text.slice(0,400));
      if(text.includes('[PATROL] EXPERIMENTAL Alaska shoreline preview'))
        warnings.push(text);
    });
    page.on('response',response=>{
      if(response.url().includes('landfire-evc-water-preview.json'))
        requests.push({url:response.url(),status:response.status()});
    });
    const response=await page.goto(root+scenario.query,
      {waitUntil:'domcontentloaded',timeout:45000});
    if(response?.status()!==200)throw Error(scenario.name+': HTTP failure');
    const supportsGl=await page.evaluate(()=>Boolean(
      document.querySelector('#glCanvas')?.getContext('webgl2')));
    if(!supportsGl)throw Error('Software WebGL2 unavailable in '+scenario.name);
    await page.locator('input[name="flightMap"][value="alaska"]')
      .check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const err=document.querySelector('#menuError');
      const overlay=document.querySelector('#loadOverlay');
      const title=document.querySelector('#titleOverlay');
      return (err&&!err.hidden)||(overlay?.classList.contains('done')&&title?.hidden);
    },null,{timeout:110000});
    const status=await page.evaluate(()=>({
      error:document.getElementById('menuError')?.hidden?null:
        document.getElementById('menuError')?.textContent,
      done:document.getElementById('loadOverlay')?.classList.contains('done'),
      glLost:document.getElementById('glCanvas')?.getContext('webgl2')?.isContextLost(),
      flight:window.PatrolSpaceBridge?.getState?.(),
    }));
    if(status.error||!status.done||status.glLost||
       status.flight?.map!=='alaska'||!status.flight?.playing)
      throw Error(scenario.name+': Alaska not playable '+JSON.stringify(status));

    await page.waitForTimeout(800);
    const gotMask=requests.some(x=>x.status===200);
    const gotWarning=warnings.length>0;
    if(gotMask!==scenario.expectMask || gotWarning!==scenario.expectPreview)
      throw Error(scenario.name+': opt-in mask expectations failed: '+
        JSON.stringify({requests,warnings}));

    const paced=await page.evaluate(async()=>{
      const times=[];
      await new Promise(resolve=>{
        let prev=0;
        const tick=t=>{
          if(prev>0)times.push(t-prev);
          prev=t;
          if(times.length>=36)resolve();else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      times.sort((a,b)=>a-b);
      return {frames:times.length,
        medianMs:+times[Math.floor(times.length/2)].toFixed(2),
        p90Ms:+times[Math.floor(times.length*.9)].toFixed(2)};
    });
    await page.screenshot({path:'artifacts/alaska-shore-'+scenario.name+'.png'});
    report.cases[scenario.name]={status,maskRequests:requests,
      activationLog:gotWarning,framePacing: paced,jsErrors:errors};
    if(errors.length)throw Error(scenario.name+' JS errors: '+errors.join(' | '));
    console.log('PATROL Alaska shoreline browser mode:',scenario.name,
      JSON.stringify(report.cases[scenario.name]));
    await page.close();
  }
  report.status='PASS';
  writeFileSync('artifacts/alaska-shore-ab-webgl-report.json',
    JSON.stringify(report,null,2)+'\n');
  console.log('PASS: Alaska baseline, opt-in LF2025, graphics=compat fallback');
} finally {
  await browser.close();
}
