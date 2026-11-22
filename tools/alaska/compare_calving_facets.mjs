/**
 * Source-exact native PATROL WebGL2 before/after capture for Alaska glacier facets.
 * QA-only disposable HTML, not game code and not an offline rendering pipeline.
 */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const BASE='38a9be192ca14cf5d47f6991d050b4093357f044';
const ROOT='http://127.0.0.1:8765/';
const PHASE=42;
mkdirSync('artifacts',{recursive:true});

function replaceUnique(source,needle,replacement,where){
  if(source.split(needle).length!==2)throw Error('Expected one '+where+' anchor: '+needle);
  return source.replace(needle,replacement);
}
function buildQaHtml(input,output,baseline){
  let html=readFileSync(input,'utf8');
  const eol=html.includes('\r\n')?'\r\n':'\n';
  const hook=[
    '  window.PatrolCalvingFacetQA = mode => {',
    '    if(!selectedMap.alaska)throw Error("Alaska-only calving QA");',
    '    window.__patrolCalvingFreezeFlight=true;',
    '    const frontal=mode==="frontal";',
    '    // Pull back over the fjord so the VERTICAL calving wall is visible.',
    '    // Previous z=414/412 framed the ice TOP with the wall below frame.',
    '    plane.pos=[frontal?118:160,frontal?35:32,frontal?355:365];',
    '    plane.yaw=frontal?.12:-.22;',
    '    plane.pitch=frontal?-.14:-.12;',
    '    plane.bank=0;plane.speed=0;plane.throttle=0;plane.vsi=0;',
    '    camInitialized=false;',
    '  };',''
  ].join(eol);
  html=replaceUnique(html,
    '  window.PatrolSpaceBridge = {getState: () => ({',
    hook+'  window.PatrolSpaceBridge = {getState: () => ({','camera');
  const motion=/    }else{\r?\n      flightStep=advanceFlight\(dt\);\r?\n    }/g;
  if([...html.matchAll(motion)].length!==1)throw Error('Flight freeze anchor not unique');
  html=html.replace(motion,[
    '    }else if(window.__patrolCalvingFreezeFlight){',
    '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
    '    }else{',
    '      flightStep=advanceFlight(dt);',
    '    }'
  ].join(eol));
  // Warm/measure pacing with advancing time. Freeze only the final A/B PNG.
  html=replaceUnique(html,'gl.uniform1f(uWorld.time, time);',
    'gl.uniform1f(uWorld.time, window.__patrolCalvingFrozenTime ?? time);','world shader phase');
  html=replaceUnique(html,'gl.uniform1f(uMesh.sceneTime,sceneryTime);',
    'gl.uniform1f(uMesh.sceneTime, window.__patrolCalvingFrozenTime ?? sceneryTime);','mesh shader phase');
  if(baseline){
    html=replaceUnique(html,"import('./assets/alaska/alaska-fjord-detail.js')",
      "import('./alaska-calving-baseline-detail.js')",'baseline-only module');
  }
  writeFileSync(output,html);
}
const baselineHtml=readFileSync('alaska-calving-baseline.html','utf8');
const currentHtml=readFileSync('index.html','utf8');
// Only runtime mesh should vary; no changing cameras, terrain, shaders or controls.
if(baselineHtml!==currentHtml)throw Error('Index baseline is not source-identical to PR; stop and scope the comparison');
buildQaHtml('alaska-calving-baseline.html','alaska-calving-baseline-qa.html',true);
buildQaHtml('index.html','alaska-calving-current-qa.html',false);

const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
async function pace(page,count=12){
  return page.evaluate(async n=>{
    const dt=[];let old=null;
    for(let k=0;k<n+5;k++){
      const t=await new Promise(resolve=>requestAnimationFrame(resolve));
      if(old!==null&&k>=5)dt.push(t-old);
      old=t;
    }
    dt.sort((a,b)=>a-b);
    const mean=dt.reduce((a,b)=>a+b,0)/dt.length;
    return {samples:dt.length,meanFrameMs:+mean.toFixed(2),
      p50FrameMs:+dt[Math.floor(dt.length*.5)].toFixed(2),
      p95FrameMs:+dt[Math.floor(dt.length*.95)].toFixed(2),
      observedFps:+(1000/mean).toFixed(2)};
  },count);
}
async function capture(label,file){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[],assets=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{
    if(r.url().includes('/assets/alaska/')&&r.status()>=400)assets.push(r.url()+' HTTP '+r.status());
  });
  // Capture the complete original stats object, not Playwright's truncated console preview.
  await page.addInitScript(()=>{
    const oldInfo=console.info;
    console.info=function(...args){
      if(args[0]==='[PATROL] Alaska fjord detail')window.__patrolCalvingMeshStats=args[1];
      oldInfo.apply(console,args);
    };
  });
  try{
    const response=await page.goto(ROOT+file+'?alaskaView=harbor',
      {waitUntil:'domcontentloaded',timeout:30000});
    if(response?.status()!==200)throw Error('No QA HTML: '+file);
    const available=await page.evaluate(()=>Boolean(document.getElementById('glCanvas')?.getContext('webgl2')));
    if(!available)throw Error('WebGL2 unavailable');
    await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const load=document.getElementById('loadOverlay');
      const err=document.getElementById('menuError');
      return (err&&!err.hidden)||(load?.classList.contains('done')&&document.getElementById('titleOverlay')?.hidden);
    },null,{timeout:110000});
    const state=await page.evaluate(()=>({
      flight:window.PatrolSpaceBridge?.getState?.(),
      err:document.getElementById('menuError')?.hidden?null:document.getElementById('menuError')?.textContent
    }));
    if(state.err||!state.flight?.playing||state.flight.map!=='alaska')throw Error('Alaska load: '+JSON.stringify(state));
    await page.waitForFunction(()=>window.__patrolCalvingMeshStats?.seracs===28,null,{timeout:60000});
    const mesh=await page.evaluate(()=>window.__patrolCalvingMeshStats);
    if(mesh.seracs!==28||mesh.iceStrata!==62)throw Error('Missing glacier mesh: '+JSON.stringify(mesh));
    if(label==='current'&&mesh.glacierFacets!==112)throw Error('New ice facet batch absent: '+JSON.stringify(mesh));
    if(label==='baseline'&&Object.hasOwn(mesh,'glacierFacets'))throw Error('Wrong baseline module loaded');

    await page.addStyleTag({content:'#flightMap,#statusBar,#skySettings,#hudCanvas{visibility:hidden!important}'});
    const shots={};
    for(const mode of ['frontal','oblique']){
      await page.evaluate(m=>{
        window.__patrolCalvingFrozenTime=null;
        for(const [id,value] of [['skyTime','12'],['skyWeather','Clear'],['skySeason','1']]){
          const el=document.getElementById(id);
          if(!el)throw Error('Missing sky control '+id);
          el.value=value;
          el.dispatchEvent(new Event('change',{bubbles:true}));
        }
        window.PatrolCalvingFacetQA(m);
      },mode);
      await page.waitForTimeout(800);
      const timing=await pace(page,12);
      await page.evaluate(async()=>{
        window.__patrolCalvingFrozenTime=42;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      });
      const shot='artifacts/alaska-calving-'+label+'-'+mode+'.png';
      const pose=await page.evaluate(()=>{
        const c=document.getElementById('glCanvas');
        return {flight:window.PatrolSpaceBridge?.getState?.(),
          innerCanvas:[c.width,c.height],contextLost:c.getContext('webgl2').isContextLost(),
          frozenShaderTime:window.__patrolCalvingFrozenTime};
      });
      if(pose.contextLost||pose.frozenShaderTime!==PHASE)throw Error('GPU phase/context invalid: '+JSON.stringify(pose));
      await page.screenshot({path:shot});
      shots[mode]={...pose,timing,shot};
    }
    if(errors.length||assets.length)throw Error('Browser/asset errors: '+errors.join('; ')+assets.join('; '));
    return {mesh,shots};
  }finally{await page.close();}
}
function imageDiff(first,second,out){
  const a=PNG.sync.read(readFileSync(first)),b=PNG.sync.read(readFileSync(second));
  if(a.width!==b.width||a.height!==b.height)throw Error('Different screenshot dimensions');
  const vis=new PNG({width:a.width,height:a.height});
  let total=0,changed=0,strong=0,midTotal=0,midStrong=0,midCount=0;
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
    const i=(y*a.width+x)*4;
    const r=Math.abs(a.data[i]-b.data[i]);
    const g=Math.abs(a.data[i+1]-b.data[i+1]);
    const bl=Math.abs(a.data[i+2]-b.data[i+2]);
    const delta=(r+g+bl)/3;
    total+=delta;
    if(delta>1)changed++;
    if(delta>5)strong++;
    if(x>=a.width*.2&&x<a.width*.8&&y>=a.height*.2&&y<a.height*.8){
      midTotal+=delta;midCount++;if(delta>5)midStrong++;
    }
    // Magnify the RGB difference for visual review; never treat it as an in-game image.
    vis.data[i]=Math.min(255,r*5);
    vis.data[i+1]=Math.min(255,g*5);
    vis.data[i+2]=Math.min(255,bl*5);
    vis.data[i+3]=255;
  }
  writeFileSync(out,PNG.sync.write(vis));
  const n=a.width*a.height;
  return {resolution:[a.width,a.height],meanRgbDelta:+(total/n).toFixed(4),
    changedOver1Pct:+(changed*100/n).toFixed(4),
    changedOver5Pct:+(strong*100/n).toFixed(4),
    centerMeanRgbDelta:+(midTotal/midCount).toFixed(4),
    centerOver5Pct:+(midStrong*100/midCount).toFixed(4)};
}
const result={baseline:BASE,head:process.env.PATROL_HEAD_SHA||null,
  runtime:'native PATROL WebGL2 under Chromium SwiftShader (software), not real GPU timings',
  shaderPhase:PHASE,viewport:[1280,720]};
try{
  result.before=await capture('baseline','alaska-calving-baseline-qa.html');
  result.after=await capture('current','alaska-calving-current-qa.html');
  result.comparisons={};
  for(const mode of ['frontal','oblique']){
    const a=result.before.shots[mode],b=result.after.shots[mode];
    const drift=Math.hypot(...a.flight.position.map((v,i)=>v-b.flight.position[i]));
    if(drift>.01||Math.abs(a.flight.yaw-b.flight.yaw)>.005
      ||Math.abs(a.flight.pitch-b.flight.pitch)>.005)throw Error('Camera mismatch '+mode+': '+drift);
    if(a.innerCanvas.join()!==b.innerCanvas.join())throw Error('Inner framebuffer mismatch '+mode);
    const metrics=imageDiff(a.shot,b.shot,'artifacts/alaska-calving-difference-'+mode+'.png');
    result.comparisons[mode]={...metrics,cameraDrift:drift,
      innerCanvas:a.innerCanvas,
      baselineFps:a.timing.observedFps,currentFps:b.timing.observedFps};
  }
  writeFileSync('artifacts/alaska-calving-matched-qa.json',JSON.stringify(result,null,2));
  console.log('Alaska calving same-time real WebGL A/B: '+JSON.stringify(result.comparisons));
}finally{await browser.close();}
