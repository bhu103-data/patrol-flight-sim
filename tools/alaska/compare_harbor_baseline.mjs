/** Paired browser capture of pinned current main and the Alaska cabin candidate.
 * Both pages use the same served assets, viewport and opt-in harbor spawn.
 * Screenshot differences are evidence, not an automated realism verdict.
 */
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const root='http://127.0.0.1:8765';
const baselineSha='bc155141742811bca3c4b1988672b238bd50a98b';
// Add the SAME QA-only camera hook to both documents in temporary copies.
 // Neither the actual game source nor the benchmark geometry is changed.
 function cameraQAPage(input,output){
   let html=readFileSync(input,'utf8');
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
   const floeHook="  window.PatrolFloeNearQA = () => {\n    if(!selectedMap.alaska || !alaskaDetailMesh?.count)\n      throw Error('Floe close QA requires uploaded Alaska detail');\n    window.__patrolQaHold=true;\n    // Match the production floe generator and its full shoreline probes.\n    const hash=n=>{const s=Math.sin(n*127.1+78.233)*43758.5453;return s-Math.floor(s);};\n    const isWater=(x,z)=>{\n      const y=sampleTerrainHeight(x,z);\n      return Number.isFinite(y)&&y<=WATER_H+.12;\n    };\n    let best=null,score=-Infinity;\n    for(let i=0;i<86;i++){\n      const h=hash(i*11+17),j=hash(i*13+37);\n      const north=i<56?250+h*195:-600+h*215;\n      const east=i<56?28+j*152:38+j*137;\n      const radius=1.35+3.9*hash(i*19+3);\n      if(!isWater(east,north))continue;\n      let clean=true;\n      for(let edge=0;edge<8;edge++){\n        const angle=edge*Math.PI/4;\n        if(!isWater(east+Math.cos(angle)*radius,north+Math.sin(angle)*radius)){\n          clean=false;break;\n        }\n      }\n      if(!clean)continue;\n      const corners=7+i%3,ring=[];\n      for(let k=0;k<corners;k++){\n        const a=k*2*Math.PI/corners,scale=.75+.31*hash(i*37+k*23);\n        ring.push([east+Math.cos(a)*radius*scale,\n          north+Math.sin(a)*radius*(.53+.23*h)*scale]);\n      }\n      if(ring.some((point,k)=>{\n        const next=ring[(k+1)%corners];\n        return !isWater(point[0],point[1]) ||\n          !isWater((point[0]+next[0])*.5,(point[1]+next[1])*.5) ||\n          !isWater((point[0]+east)*.5,(point[1]+north)*.5);\n      }))continue;\n      for(let angleIndex=0;angleIndex<8;angleIndex++){\n        const a=angleIndex*Math.PI/4,distance=radius+6;\n        const x=east+Math.cos(a)*distance,z=north+Math.sin(a)*distance;\n        if(!isWater(x,z) || !isWater((x+east)*.5,(z+north)*.5))continue;\n        // Prefer large skirts and nearby sheltered harbor ice, not a hillside.\n        const rank=radius-Math.hypot(east-105,north+480)*.0003;\n        if(rank>score){score=rank;best={index:i,east,north,radius,x,z,angleIndex};}\n      }\n    }\n    if(!best)throw Error('No shoreline-clear waterline close-up target');\n    plane.pos=[best.x,WATER_H+1.65,best.z];\n    const dx=best.east-best.x,dz=best.north-best.z;\n    plane.yaw=Math.atan2(dx,dz);\n    // True cockpit camera removes the chase aircraft occluding the 0.2m skirt.\n    plane.pitch=Math.atan2(WATER_H+.12-(plane.pos[1]+.42),Math.hypot(dx,dz));\n    plane.bank=0;plane.speed=0;plane.throttle=0;plane.vsi=0;\n    viewIdx=1;camBlend=1;camInitialized=false;\n    return {...best,waterY:WATER_H,view:'cockpit',target:[best.east,WATER_H+.12,best.north]};\n  };\n";
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
async function capture(label,file){
  const page=await browser.newPage({
    viewport:{width:1280,height:800},deviceScaleFactor:1
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
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
  await page.addStyleTag({content:
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
  // Inspect actual shoreline-clear faceted ice at water level, not distant huts.
  const floe=await page.evaluate(()=>{
    if(typeof window.PatrolFloeNearQA!=='function')throw Error('Floe QA hook missing');
    return window.PatrolFloeNearQA();
  });
  await page.waitForTimeout(1150);
  await page.screenshot({path:'artifacts/alaska-floe-port-'+label+'-waterline-close.png'});
  const floeState=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  if(!floeState?.playing||floeState.map!=='alaska')
    throw Error('Floe close QA is not in playable Alaska state');
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
  records[label]={...state.flight,after,near,floe,floeState,pageErrors:errors,
    firstPlayableMs,softwareRafSamples:sorted.length,
    softwareRafP50Ms:percentile(.5),softwareRafP95Ms:percentile(.95)};
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
  const firstFloe=records.baseline.floe,secondFloe=records.updated.floe;
  const floeDrift=Math.hypot(...records.baseline.floeState.position.map(
    (v,i)=>v-records.updated.floeState.position[i]));
  const sameFloe=firstFloe.index===secondFloe.index &&
    firstFloe.angleIndex===secondFloe.angleIndex &&
    Math.abs(firstFloe.radius-secondFloe.radius)<1e-9;
  records.cameraDrift={displacement,yawDelta,nearDrift,floeDrift,sameFloe};
  if(nearDrift>.5)throw Error('Near-view QA pose is not identical');
  if(!sameFloe||floeDrift>1e-6)throw Error('Floe waterline A/B views differ');
  console.log('Alaska paired screenshot state:',JSON.stringify(records));
  if(displacement>9||yawDelta>.20)
    throw Error('Baseline/updated harbor camera moved too far for visual comparison');
  writeFileSync('artifacts/alaska-cabin-port-camera.json',JSON.stringify(records,null,2));
}finally{await browser.close();}
