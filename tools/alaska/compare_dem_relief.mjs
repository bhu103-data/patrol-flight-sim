/** Browser A/B of default Alaska DEM against an opt-in bounded higher relief.
 * Captures actual WebGL2 at locked game pose and browser animation-frame pacing.
 * No offline animation, video, third-party render asset, or physics edits.
 */
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const sha='38a9be192ca14cf5d47f6991d050b4093357f044';
const root='http://127.0.0.1:8765/';
mkdirSync('artifacts',{recursive:true});
function qaDocument(input,output){
  let html=readFileSync(input,'utf8');
  const eol=html.includes('\r\n')?'\r\n':'\n';
  const anchor='  window.PatrolSpaceBridge = {getState: () => ({';
  if(html.split(anchor).length!==2)throw Error('QA state anchor nonunique: '+input);
  const hook=[
    '  window.PatrolAlaskaNormalQA = mode => {',
    '    if(!selectedMap.alaska)throw Error("Alaska-only visual QA");',
    '    window.__patrolNormalFreeze=true;',
    "    // Terrain-relative DEM-facing QA: view actual steep land, not glacier mesh.",
    "    // Source grid steep gradients verified; coords are compact game units.",
    "    const shots={",
    "      west:{x:30,z:-240,yaw:-Math.PI/2,pitch:0.075,minAlt:30},",
    "      east:{x:70,z:0,yaw:Math.PI/2,pitch:0.060,minAlt:35}",
    "    };",
    "    const shot=shots[mode];",
    "    if(!shot)throw Error(\"Unknown Alaska DEM ridge QA camera: \"+mode);",
    "    const y=42;",
    "    if(sampleGroundHeight(shot.x,shot.z)>y-5)throw Error(\"Unsafe relief QA pose\");",
    "    plane.pos=[shot.x,y,shot.z];",
    "    plane.yaw=shot.yaw;",
    "    plane.pitch=shot.pitch;",
    '    plane.bank=0; plane.speed=0; plane.throttle=0; plane.vsi=0;',
    '    camInitialized=false;',
    '  };',
    '  window.PatrolAlaskaReliefMetrics=()=>({',
    '    scale:terrainScaleFor(selectedMap),',
    '    peak:sampleGroundHeight(-558.75,-461.25),',
    '    west:sampleGroundHeight(-350,-240),',
    '    east:sampleGroundHeight(350,0),',
    '    sea:sampleGroundHeight(100,-500),',
    '    ceiling:CEILING',
    '  });',''
  ].join(eol);
  html=html.replace(anchor,hook+anchor);
  const motion=/    }else{\r?\n      flightStep=advanceFlight\(dt\);\r?\n    }/g;
  if([...html.matchAll(motion)].length!==1)throw Error('QA flight freeze anchor nonunique');
  html=html.replace(motion,[
    '    }else if(window.__patrolNormalFreeze){',
    '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
    '    }else{','      flightStep=advanceFlight(dt);','    }'
  ].join(eol));
  // Test copies only: do not change actual game shaders. Live RAF samples
  // are collected before the screenshots use a common GPU time phase.
  for(const [original,replacement] of [
    ['gl.uniform1f(uWorld.time, time);',
      'gl.uniform1f(uWorld.time, window.__patrolDemFrozenTime ?? time);'],
    ['gl.uniform1f(uMesh.sceneTime,sceneryTime);',
      'gl.uniform1f(uMesh.sceneTime, window.__patrolDemFrozenTime ?? sceneryTime);']
  ]){
    if(html.split(original).length!==2)
      throw Error('Nonunique DEM QA shader-time anchor: '+original+' in '+input);
    html=html.replace(original,replacement);
  }
  writeFileSync(output,html);
}
qaDocument('alaska-relief-base.html','alaska-relief-base-qa.html');
qaDocument('index.html','alaska-relief-head-qa.html');
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
const result={baseline:sha,pr:process.env.GITHUB_SHA||null,viewport:[1280,720],metric:'SwiftShader requestAnimationFrame pacing, not native GPU frame timing'};
async function framePacing(page,count=32){
  return page.evaluate(async n=>{
    const intervals=[];
    let prev=null;
    for(let i=0;i<n+10;i++){
      const t=await new Promise(ok=>requestAnimationFrame(ok));
      if(prev!==null&&i>=10)intervals.push(t-prev);
      prev=t;
    }
    intervals.sort((a,b)=>a-b);
    const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;
    return {samples:intervals.length,meanFrameMs:+avg.toFixed(2),
      p50FrameMs:+intervals[Math.floor(intervals.length*.5)].toFixed(2),
      p95FrameMs:+intervals[Math.floor(intervals.length*.95)].toFixed(2),
      observedFps:+(1000/avg).toFixed(2)};
  },count);
}
async function capture(label,file){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[],failedAssets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{
    if(r.url().includes('/assets/alaska/')&&r.status()>=400)
      failedAssets.push(r.url()+' '+r.status());
  });
  try{
    const response=await page.goto(root+file+'?alaskaView=harbor'+(label==='preview'?'&alaskaRelief=preview':''),
      {waitUntil:'domcontentloaded',timeout:30000});
    if(response?.status()!==200)throw Error(label+' page not served');
    if(!await page.evaluate(()=>Boolean(document.getElementById('glCanvas')?.getContext('webgl2'))))
      throw Error('WebGL2 unavailable');
    await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const load=document.getElementById('loadOverlay');
      const title=document.getElementById('titleOverlay');
      const err=document.getElementById('menuError');
      return (err&&!err.hidden)||(load?.classList.contains('done')&&title?.hidden);
    },null,{timeout:110000});
    const state=await page.evaluate(()=>({
      flight:window.PatrolSpaceBridge?.getState?.(),
      menuError:document.getElementById('menuError')?.hidden?null:document.getElementById('menuError')?.textContent,
      gpuLost:document.getElementById('glCanvas')?.getContext('webgl2')?.isContextLost()
    }));
    if(state.menuError||state.gpuLost||!state.flight?.playing||state.flight.map!=='alaska')
      throw Error(label+' Alaska load failed: '+JSON.stringify(state));
    // Oblique ridges from opposite sides of USGS terrain corridor.
    const scenarios=[['west-ridge','west','12'],['east-ridge','east','12']];
    const record={};
    for(const [name,mode,hour] of scenarios){
      await page.evaluate(({mode,hour})=>{
        window.__patrolDemFrozenTime=null; // time advances during frame pacing
        for(const [id,value] of [['skyTime',hour],['skyWeather','Clear'],['skySeason','1']]){
          const el=document.getElementById(id);
          el.value=value;
          if(el.value!==value)throw Error('Invalid QA environment option '+id+'='+value);
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
        window.PatrolAlaskaNormalQA(mode);
      },{mode,hour});
      await page.waitForTimeout(650);
      const timing=await framePacing(page,24);
      const pose=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
      const canvas=await page.evaluate(()=>{
        const c=document.getElementById('glCanvas');
        return {width:c.width,height:c.height,lost:c.getContext('webgl2').isContextLost()};
      });
      await page.addStyleTag({content:
        '#flightMap,#statusBar,#skySettings,#hudCanvas{visibility:hidden!important}'});
      // Freeze only AFTER timing samples, allowing two WebGL redraws at
      // an identical phase across separately loaded baseline/patch pages.
      await page.evaluate(async()=>{
        window.__patrolDemFrozenTime=42;
        await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
      });
      await page.screenshot({path:'artifacts/alaska-relief-'+label+'-'+name+'.png'});
      const relief=await page.evaluate(()=>window.PatrolAlaskaReliefMetrics());
      record[name]={pose,timing,canvas,relief,frozenShaderTime:42};
    }
    if(errors.length||failedAssets.length)throw Error(label+' errors: '+errors.join('; ')+failedAssets.join('; '));
    return record;
  }finally{await page.close();}
}
try{
  result.old=await capture('baseline','alaska-relief-base-qa.html');
  result.updated=await capture('preview','alaska-relief-head-qa.html');
  for(const key of Object.keys(result.old)){
    const b=result.old[key],n=result.updated[key];
    const drift=Math.hypot(...b.pose.position.map((x,i)=>x-n.pose.position[i]));
    if(drift>.01||Math.abs(b.pose.yaw-n.pose.yaw)>.005)
      throw Error('Mismatch '+key+' camera: '+drift);
    if(b.canvas.lost||n.canvas.lost)throw Error('Lost WebGL2 context');
    if(b.relief.scale!==75||n.relief.scale!==95)
      throw Error('DEM preview scale mismatch '+key+': '+b.relief.scale+' / '+n.relief.scale);
    if(n.relief.peak-b.relief.peak<16)
      throw Error('DEM preview peak relief not increased '+key);
    if(n.relief.peak>n.relief.ceiling-12)
      throw Error('DEM preview exceeds 12-unit ceiling margin '+key);
    if(Math.abs(b.relief.sea-n.relief.sea)>.1)
      throw Error('Waterline moved in DEM preview '+key);
    if(b.frozenShaderTime!==42||n.frozenShaderTime!==42)
      throw Error('Mismatched shader phase in '+key);
    result[key]={cameraDrift:drift,baselineFps:b.timing.observedFps,
      updatedFps:n.timing.observedFps,baselineCanvas:b.canvas,updatedCanvas:n.canvas,oldRelief:b.relief,newRelief:n.relief,frozenShaderTime:42};
  }
  console.log('Alaska DEM opt-in relief live A/B',JSON.stringify(result));
  writeFileSync('artifacts/alaska-relief-performance.json',JSON.stringify(result,null,2));
}finally{await browser.close();}
