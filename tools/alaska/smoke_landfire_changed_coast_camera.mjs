/**
 * Fixed-camera live WebGL2 A/B at an ACTUALLY CHANGED LF2025 coast location.
 * Camera hooks are added only to temporary QA HTML, not committed game source.
 */
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';

let html=readFileSync('index.html','utf8');
const marker='  window.PatrolSpaceBridge = {getState: () => ({';
if(html.split(marker).length!==2)throw Error('No unique state bridge anchor');
const hook=[
  "  window.PatrolShorePatchNearQA = () => {",
  "    if(!selectedMap.alaska)throw Error('Requires Alaska');",
  "    window.__patrolQaHold=true;",
  "    // Changed LF2025 area: game x=111..173, z=147..213.",
  "    // QA camera is over source DEM water at (140,100).",
  "    const tx=140,tz=184,px=140,py=49,pz=100;",
  "    plane.pos=[px,py,pz];",
  "    plane.yaw=Math.atan2(tx-px,tz-pz);",
  "    plane.pitch=Math.atan2(15-py,Math.hypot(tx-px,tz-pz));",
  "    plane.bank=0; plane.speed=0;plane.vsi=0;",
  "    plane.afterburner=false;",
  "    camInitialized=false;",
  "  };"
].join('\n')+'\n';
html=html.replace(marker,hook+marker);
const movement=/    }else{\r?\n      flightStep=advanceFlight\(dt\);\r?\n    }/g;
if([...html.matchAll(movement)].length!==1)throw Error('Expected single flight-loop pause anchor');
const eol=html.includes('\r\n')?'\r\n':'\n';
html=html.replace(movement,[
  '    }else if(window.__patrolQaHold){',
  '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
  '    }else{','      flightStep=advanceFlight(dt);','    }'
].join(eol));
writeFileSync('alaska-shore-qa-fixed.html',html);

const base='http://127.0.0.1:8765/alaska-shore-qa-fixed.html?alaskaView=harbor';
const browser=await chromium.launch({
  headless:true,args:['--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox']
});
mkdirSync('artifacts',{recursive:true});
const out={kind:'PATROL_ALASKA_SHORE_CHANGED_SITE_FIXED_CAMERA_WEBGL2_AB',
  renderer:'actual WebGL2 on GitHub Chromium SwiftShader',
  targetGameXZ:[140,184],cameraGame:[140,49,100],
  cases:{},limits:[
    'Real scene captures, temporary QA-only camera hook, no production source mutation.',
    'This visualizes a small 1–12m LANDFIRE class-11 water experiment; no bathymetric accuracy is established.',
    'Water shaders and lighting remain animated; photos are not pixel-perfect material measurements.',
  ]};
try {
  for(const key of ['baseline','preview']){
    const page=await browser.newPage({viewport:{width:1280,height:800},
      deviceScaleFactor:1});
    const errors=[],requests=[],warnings=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{
      if(r.url().includes('landfire-evc-water-preview.json'))
        requests.push(r.status());
    });
    page.on('console',m=>{
      if(m.type()==='error')errors.push(m.text());
      if(m.text().includes('EXPERIMENTAL Alaska shoreline preview'))
        warnings.push(m.text());
    });
    const url=base+(key==='preview'?'&alaskaShore=landfire-preview':'');
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
    const webgl=await page.evaluate(()=>Boolean(
      document.querySelector('#glCanvas')?.getContext('webgl2')));
    if(!webgl)throw Error('No WebGL2 in '+key);
    await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const load=document.querySelector('#loadOverlay'),err=document.querySelector('#menuError');
      return (load?.classList.contains('done')&&document.querySelector('#titleOverlay')?.hidden)||
        (err&&!err.hidden);
    },null,{timeout:110000});
    const before=await page.evaluate(()=>({
      ok:document.querySelector('#loadOverlay')?.classList.contains('done'),
      menuError:document.querySelector('#menuError')?.hidden?null:
        document.querySelector('#menuError')?.textContent,
      glLost:document.querySelector('#glCanvas')?.getContext('webgl2')?.isContextLost(),
      flight:window.PatrolSpaceBridge?.getState?.(),
    }));
    if(!before.ok||before.menuError||before.glLost||before.flight?.map!=='alaska')
      throw Error('Alaska load failed: '+JSON.stringify(before));
    await page.evaluate(()=>window.PatrolShorePatchNearQA());
    await page.waitForTimeout(1200);
    const after=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
    if(after?.map!=='alaska'||!after.playing||
       Math.hypot(after.position[0]-140,after.position[1]-49,
                  after.position[2]-100)>.001)
      throw Error('Fixed QA camera moved: '+JSON.stringify(after));
    await page.addStyleTag({content:
      '#flightMap,#statusBar,#skySettings,#hudCanvas{visibility:hidden!important}'});
    await page.screenshot({path:'artifacts/alaska-shore-changed-site-'+key+'.png'});
    if((key==='preview')!==requests.includes(200) ||
       (key==='preview')!==(warnings.length>0))
      throw Error('Mask activation incorrect at fixed camera: '+
        JSON.stringify({requests,warnings}));
    if(errors.length)throw Error('Browser JS errors: '+errors.join(' | '));
    out.cases[key]={before:before.flight,after,requests,warnings};
    console.log('PASS changed-site fixed camera',key,JSON.stringify(out.cases[key]));
    await page.close();
  }
  const a=out.cases.baseline.after.position,b=out.cases.preview.after.position;
  if(Math.hypot(...a.map((x,i)=>x-b[i]))>.001)
    throw Error('Camera not identical between baseline and preview');
  writeFileSync('artifacts/alaska-shore-changed-site-qa.json',
    JSON.stringify(out,null,2)+'\n');
  console.log('PASS two matched live WebGL2 coastal patch screenshots');
} finally {
  await browser.close();
}
