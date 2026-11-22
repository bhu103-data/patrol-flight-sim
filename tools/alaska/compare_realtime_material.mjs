/** Browser A/B of baseline and Alaska-only terrain phototexture scales.
 * Captures actual WebGL2 at locked game pose and browser animation-frame pacing.
 * No offline animation, video, third-party render asset, or physics edits.
 */
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const sha='b94564895e9c18311bd485ae814c645ab7c8668b';
const root='http://127.0.0.1:8765/';
mkdirSync('artifacts',{recursive:true});
function qaDocument(input,output){
  let html=readFileSync(input,'utf8');
  const eol=html.includes('\r\n')?'\r\n':'\n';
  const anchor='  window.PatrolSpaceBridge = {getState: () => ({';
  if(html.split(anchor).length!==2)throw Error('QA state anchor nonunique: '+input);
  const hook=[
    '  window.PatrolAlaskaMaterialQA = mode => {',
    '    if(!selectedMap.alaska)throw Error("Alaska-only visual QA");',
    '    window.__patrolMaterialFreeze=true;',
    '    // Terrain-relative near-view camera; no runtime spawn edits.',
    '    const x=mode==="glacier"?118:190;',
    '    const z=mode==="glacier"?415:-567;',
    '    const y=mode==="glacier"',
    '      ?Math.max(45,sampleGroundHeight(x,z)+22)',
    '      :Math.max(32,sampleGroundHeight(x,z)+15);',
    '    plane.pos=[x,Math.min(CEILING-8,y),z];',
    '    plane.yaw=mode==="glacier"?.12:.08;',
    '    plane.pitch=mode==="glacier"?-.14:-.20;',
    '    plane.bank=0; plane.speed=0; plane.throttle=0; plane.vsi=0;',
    '    camInitialized=false;',
    '  };',''
  ].join(eol);
  html=html.replace(anchor,hook+anchor);
  const motion=/    }else{\r?\n      flightStep=advanceFlight\(dt\);\r?\n    }/g;
  if([...html.matchAll(motion)].length!==1)throw Error('QA flight freeze anchor nonunique');
  html=html.replace(motion,[
    '    }else if(window.__patrolMaterialFreeze){',
    '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
    '    }else{','      flightStep=advanceFlight(dt);','    }'
  ].join(eol));
  writeFileSync(output,html);
}
qaDocument('alaska-material-base.html','alaska-material-base-qa.html');
qaDocument('index.html','alaska-material-head-qa.html');
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
    const response=await page.goto(root+file+'?alaskaView=harbor',
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
    const scenarios=[['glacier-rock-snow','glacier','12'],['harbor-coast','shore','12']];
    const record={};
    for(const [name,mode,hour] of scenarios){
      await page.evaluate(({mode,hour})=>{
        for(const [id,value] of [['skyTime',hour],['skyWeather','Clear'],['skySeason','1']]){
          const el=document.getElementById(id);
          el.value=value;
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
        window.PatrolAlaskaMaterialQA(mode);
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
      await page.screenshot({path:'artifacts/alaska-material-'+label+'-'+name+'.png'});
      record[name]={pose,timing,canvas};
    }
    if(errors.length||failedAssets.length)throw Error(label+' errors: '+errors.join('; ')+failedAssets.join('; '));
    return record;
  }finally{await page.close();}
}
try{
  result.old=await capture('baseline','alaska-material-base-qa.html');
  result.updated=await capture('updated','alaska-material-head-qa.html');
  for(const key of Object.keys(result.old)){
    const b=result.old[key],n=result.updated[key];
    const drift=Math.hypot(...b.pose.position.map((x,i)=>x-n.pose.position[i]));
    if(drift>.01||Math.abs(b.pose.yaw-n.pose.yaw)>.005)
      throw Error('Mismatch '+key+' camera: '+drift);
    if(b.canvas.lost||n.canvas.lost)throw Error('Lost WebGL2 context');
    result[key]={cameraDrift:drift,baselineFps:b.timing.observedFps,
      updatedFps:n.timing.observedFps,baselineCanvas:b.canvas,updatedCanvas:n.canvas};
  }
  console.log('Alaska Alaska material live A/B',JSON.stringify(result));
  writeFileSync('artifacts/alaska-material-performance.json',JSON.stringify(result,null,2));
}finally{await browser.close();}
