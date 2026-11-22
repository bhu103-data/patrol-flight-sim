/** Pinned same-game WebGL2 baseline/updated scene QA for Alaska.
 * Frozen near-floe screenshots use actual surveyed-water geometry gates.
 * These pictures are evidence, not automated realism certification.
 */
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const root='http://127.0.0.1:8765';
const baselineSha='bc155141742811bca3c4b1988672b238bd50a98b';
// Add the SAME QA-only camera hook to both documents in temporary copies.
 // Neither the actual game source nor the benchmark geometry is changed.
 function cameraQAPage(input,output){
   let html=readFileSync(input,'utf8');
   const activeModule='./assets/alaska/alaska-fjord-detail.js';
   if(html.split(activeModule).length!==2)
     throw Error('Cannot prove actual glacier module import on '+input);
   if(input==='alaska-baseline.html'){
     html=html.replace(activeModule,
       './assets/alaska/alaska-fjord-detail-baseline-qa.js');
   }
   const marker='  window.PatrolSpaceBridge = {getState: () => ({';
   if(html.split(marker).length!==2)throw Error('QA bridge anchor missing: '+input);
   const hook=`  window.PatrolHarborNearQA = () => {
     if(!selectedMap.alaska)throw Error('Near QA requires Alaska');
     window.__patrolQaHold=true;
     // Derive a cabin-facing camera from the ACTUAL terrain-grounded
     // obstacle positions so shore-pad placement cannot shift it away.
     const cabins=alaskaObstacles.filter(o=>o.name==='harbor building');
     if(cabins.length!==6)throw Error('Missing cabins in near QA');
     const [first,second]=cabins;
     const targetX=(first.x+second.x)*.5;
     const targetZ=(first.z+second.z)*.5;
     const targetY=(first.top+second.top)*.5-1.1;
     plane.pos=[first.x-5,Math.max(first.top,second.top)+4,
       Math.min(first.z,second.z)-14];
     const dx=targetX-plane.pos[0],dz=targetZ-plane.pos[2];
     plane.yaw=Math.atan2(dx,dz);
     plane.pitch=Math.atan2(targetY-plane.pos[1],Math.hypot(dx,dz));
     plane.bank=0; plane.speed=0; plane.throttle=0; plane.vsi=0;
     camInitialized=false;
   };
 `;
   const floeHook="  // Select a floe admitted by the actual shoreline guards and height field.\n  // QA only: no gameplay mesh or physics mutation.\n  window.PatrolFloeNearQA = () => {\n    if(!selectedMap.alaska)throw Error('Floe QA requires Alaska');\n    const hash=n=>{const s=Math.sin(n*127.1+78.233)*43758.5453;\n      return s-Math.floor(s);};\n    const isWater=(x,z)=>{\n      const h=sampleTerrainHeight(x,z);\n      return Number.isFinite(h)&&h<=WATER_H+.12;\n    };\n    let best=null;\n    for(let i=0;i<86;i++){\n      const h=hash(i*11+17),j=hash(i*13+37);\n      const north=i<56?250+h*195:-600+h*215;\n      const east=i<56?28+j*152:38+j*137;\n      const radius=1.35+3.9*hash(i*19+3);\n      if(!isWater(east,north))continue;\n      let clear=true;\n      for(let edge=0;edge<8;edge++){\n        const a=edge*Math.PI/4;\n        if(!isWater(east+Math.cos(a)*radius,\n                    north+Math.sin(a)*radius)){clear=false;break;}\n      }\n      if(!clear)continue;\n      const corners=7+i%3,ring=[];\n      for(let k=0;k<corners;k++){\n        const a=k*2*Math.PI/corners,scale=.75+.31*hash(i*37+k*23);\n        ring.push([east+Math.cos(a)*radius*scale,\n          north+Math.sin(a)*radius*(.53+.23*h)*scale]);\n      }\n      if(ring.some((p,k)=>{\n        const n=ring[(k+1)%corners];\n        return !isWater(p[0],p[1]) ||\n          !isWater((p[0]+n[0])*.5,(p[1]+n[1])*.5) ||\n          !isWater((p[0]+east)*.5,(p[1]+north)*.5);\n      }))continue;\n      const priority=(i>=56?100:0)+radius;\n      if(!best||priority>best.priority)\n        best={index:i,east,north,radius,priority,corners};\n    }\n    if(!best)throw Error('No valid measured-water floe for close QA');\n    const target=[best.east,WATER_H+.3,best.north];\n    const eye=[best.east-2.6,WATER_H+3.1,best.north-6.1];\n    const dx=target[0]-eye[0],dz=target[2]-eye[2];\n    window.__patrolQaHold=true;\n    viewIdx=1; // cockpit: don't occlude the floe with the chase-view airplane\n    plane.pos=eye;\n    plane.yaw=Math.atan2(dx,dz);\n    plane.pitch=Math.atan2(target[1]-eye[1],Math.hypot(dx,dz));\n    plane.bank=0;plane.speed=0;plane.throttle=0;plane.vsi=0;\n    camInitialized=false;\n    window.__patrolQaFloe={...best,target,eye,yaw:plane.y,\n      pitch:plane.pitch,waterY:WATER_H};\n    return window.__patrolQaFloe;\n  };\n";
   html=html.replace(marker,hook+floeHook+marker);
   const movement=/    }else{\r?\n      flightStep=advanceFlight\(dt\);\r?\n    }/g;
   const sites=[...html.matchAll(movement)];
   if(sites.length!==1)throw Error('QA flight freeze anchor missing: '+input);
   const eol=html.includes('\r\n')?'\r\n':'\n';
   html=html.replace(movement,[
     '    }else if(window.__patrolQaHold){',
     '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
     '    }else{','      flightStep=advanceFlight(dt);','    }'
   ].join(eol));
   // Freeze BOTH software-water shader phase and authored boat/floe motion
   // only when the QA-specific pose hold is active. Otherwise the same
   // geometry can look like a different silhouette through moving waves.
   // This edit exists solely in temporary QA HTML, never production index.html.
   const clockAnchors=[
     ['    const time = now * 0.001;',
      '    const time = window.__patrolQaHold ? 42.125 : now * 0.001;'],
     ['    sceneryTime += Math.min(rawDt, 0.12);',
      '    if(!window.__patrolQaHold)sceneryTime += Math.min(rawDt, 0.12);'],
     ['    const environment=sampleFlightEnvironment(Math.min(rawDt,0.12));',
      '    const environment=sampleFlightEnvironment(window.__patrolQaHold?0:Math.min(rawDt,0.12));']
   ];
   for(const [original,stable] of clockAnchors){
     if(html.split(original).length!==2)
       throw Error('Freeze-time QA anchor missing/non-unique: '+original);
     html=html.replace(original,stable);
   }
   writeFileSync(output,html);
 }
 cameraQAPage('alaska-baseline.html','alaska-qa-baseline.html');
 cameraQAPage('index.html','alaska-qa-updated.html');
 const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
mkdirSync('artifacts',{recursive:true});
const records={baselineSha,headSha:process.env.GITHUB_SHA||null,viewport:[1280,800]};

async function verifySamePageMapSwitch(page){
  // Use the shipped Flight Menu and launcher, never set selectedMap by hand.
  const results=[];
  await page.evaluate(()=>{window.__patrolQaHold=false;});
  for(const map of ['manhattan','alaska']){
    await page.locator('#flightMenuBtn').click({timeout:10000});
    await page.waitForFunction(()=>!document.getElementById('titleOverlay')?.hidden,
      null,{timeout:10000});
    await page.locator('input[name="flightMap"][value="'+map+'"]').check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const error=document.getElementById('menuError');
      const loader=document.getElementById('loadOverlay');
      const title=document.getElementById('titleOverlay');
      return (error&&!error.hidden)||
        (loader?.classList.contains('done')&&title?.hidden);
    },null,{timeout:110000});
    await page.waitForTimeout(900);
    const state=await page.evaluate(()=>({
      flight:window.PatrolSpaceBridge?.getState?.(),
      menuError:document.getElementById('menuError')?.hidden?null:
        document.getElementById('menuError')?.textContent,
      contextLost:document.getElementById('glCanvas')?.getContext('webgl2')?.isContextLost()
    }));
    if(state.menuError||state.contextLost||
       !state.flight?.playing||state.flight.map!==map)
      throw Error('Same-page map lifecycle failed on '+map+': '+JSON.stringify(state));
    await page.screenshot({path:'artifacts/alaska-floe-switch-'+map+'.png'});
    results.push({map,position:state.flight.position,
      aircraft:state.flight.aircraft,contextLost:state.contextLost});
  }
  return results;
}

async function capture(label,file){
  const page=await browser.newPage({
    viewport:{width:1280,height:800},deviceScaleFactor:1
  });
  const errors=[],alaskaModules=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',response=>{
    const path=new URL(response.url()).pathname;
    if(path.includes('alaska-fjord-detail'))
      alaskaModules.push({path,status:response.status()});
  });
  const startupClock=Date.now();
  const response=await page.goto(root+'/'+file+'?alaskaView=harbor',
    {waitUntil:'domcontentloaded',timeout:30000});
  if(response?.status()!==200)throw Error('HTTP error for '+label);
  if(!await page.evaluate(()=>Boolean(document.querySelector('#glCanvas')?.getContext('webgl2'))))
    throw Error('WebGL2 unavailable for '+label);
  await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
  await page.locator('#startFlight').click({timeout:15000});
  await page.waitForFunction(()=>{
    const err=document.getElementById('menuError');
    const load=document.getElementById('loadOverlay');
    const title=document.getElementById('titleOverlay');
    return (err&&!err.hidden)||(load?.classList.contains('done')&&title?.hidden);
  },null,{timeout:110000});
  const expectedModule=label==='baseline'?
    '/assets/alaska/alaska-fjord-detail-baseline-qa.js':
    '/assets/alaska/alaska-fjord-detail.js';
  if(!alaskaModules.some(asset=>asset.path===expectedModule&&asset.status===200)||
      alaskaModules.some(asset=>asset.path!==expectedModule))
    throw Error('Floe A/B mixed or missing module bytes '+label+': '+
      JSON.stringify({expectedModule,alaskaModules}));
  // Measured browser-harness wall-clock time to the first playable scene.
  // This includes UI/selection and is not a pure asset download benchmark.
  const firstPlayableMs=Date.now()-startupClock;
  const state=await page.evaluate(()=>({
    flight:window.PatrolSpaceBridge?.getState?.(),
    menuError:document.getElementById('menuError')?.hidden?null:
      document.getElementById('menuError')?.textContent,
    gpuLost:document.getElementById('glCanvas')?.getContext('webgl2')?.isContextLost()
  }));
  if(state.menuError||state.gpuLost||!state.flight?.playing||state.flight.map!=='alaska')
    throw Error(label+' failed to load: '+JSON.stringify(state));
  await page.evaluate(()=>{
    for(const [id,value] of [['skyTime','12'],['skyWeather','Clear']]){
      const control=document.getElementById(id);
      control.value=value;
      control.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  await page.waitForTimeout(1300);
  const cleanScreenshotStyle=await page.addStyleTag({content:
    '#flightMap,#statusBar,#skySettings,#hudCanvas{visibility:hidden!important}'});
  await page.screenshot({path:'artifacts/alaska-cabin-port-'+label+'-harbor.png'});
  const after=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  await page.evaluate(()=>{
    if(typeof window.PatrolHarborNearQA!=='function')
      throw Error('Near camera hook missing');
    window.PatrolHarborNearQA();
  });
  await page.waitForTimeout(950);
  await page.screenshot({path:'artifacts/alaska-cabin-port-'+label+'-near.png'});
  const near=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  const floe=await page.evaluate(()=>{
    if(typeof window.PatrolFloeNearQA!=='function')
      throw Error('Measured-water floe QA hook is missing');
    return window.PatrolFloeNearQA();
  });
  await page.waitForTimeout(1350);
  await page.screenshot({path:'artifacts/alaska-floe-waterline-'+label+'.png'});
  const floePose=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  if(!floePose?.playing||floePose.map!=='alaska')
    throw Error(label+' did not retain a live Alaska floe view');
  // Fixed-pose RAF cadence on headless SwiftShader: diagnostic ONLY, not GPU FPS.
  // Bound measurement to 12 intervals or 15 seconds if software GL is slow.
  const intervals=await page.evaluate(()=>new Promise(resolve=>{
    let previous=null,done=false;const values=[];
    const timeout=setTimeout(()=>{done=true;resolve(values);},15000);
    const frame=now=>{
      if(done)return;
      if(previous!==null)values.push(now-previous);
      previous=now;
      if(values.length>=12){
        done=true;clearTimeout(timeout);resolve(values);
      }else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }));
  const sorted=intervals.slice().sort((a,b)=>a-b);
  const percentile=p=>sorted.length?sorted[Math.max(0,Math.ceil(p*sorted.length)-1)]:null;
  records[label]={...state.flight,after,near,floe,floePose,alaskaModules,pageErrors:errors,
    firstPlayableMs,softwareRafSamples:sorted.length,
    softwareRafP50Ms:percentile(.5),softwareRafP95Ms:percentile(.95)};
  if(label==='updated'){
    // The screenshot-only HUD concealment includes the Flight Menu button.
    // Restore normal UI before exercising the real, clickable map selector.
    await cleanScreenshotStyle.evaluate(el=>el.remove());
    if(!await page.locator('#flightMenuBtn').isVisible())
      throw Error('Flight Menu must be visible after QA HUD restoration');
    // Alaska -> Manhattan -> Alaska, within the SAME browser tab and GL context.
    records.mapSwitch=await verifySamePageMapSwitch(page);
  }
  if(errors.length)throw Error(label+' JS errors: '+errors.join('; '));
  await page.close();
}
try{
  await capture('baseline','alaska-qa-baseline.html');
  await capture('updated','alaska-qa-updated.html');
  const old=records.baseline.after,newer=records.updated.after;
  const displacement=Math.hypot(...old.position.map((p,i)=>p-newer.position[i]));
  const yawDelta=Math.abs(old.yaw-newer.yaw);
  const nearPos=records.baseline.near.position;
  const updatedNearPos=records.updated.near.position;
  const nearDrift=Math.hypot(...nearPos.map((v,i)=>v-updatedNearPos[i]));
  const f0=records.baseline.floe,f1=records.updated.floe;
  const floeDrift=Math.hypot(...records.baseline.floePose.position.map(
    (x,i)=>x-records.updated.floePose.position[i]));
  records.cameraDrift={displacement,yawDelta,nearDrift,floeDrift};
  if(f0.index!==f1.index||floeDrift>.02||
     f0.radius!==f1.radius||
     records.baseline.floePose.yaw!==records.updated.floePose.yaw)
    throw Error('Floe candidate and baseline do not show the same admitted polygon');
  if(nearDrift>.5)throw Error('Near-view QA pose is not identical');
  console.log('Alaska paired screenshot state:',JSON.stringify(records));
  if(displacement>9||yawDelta>.20)
    throw Error('Baseline/updated harbor camera moved too far for visual comparison');
  writeFileSync('artifacts/alaska-cabin-port-camera.json',JSON.stringify(records,null,2));
}finally{await browser.close();}
