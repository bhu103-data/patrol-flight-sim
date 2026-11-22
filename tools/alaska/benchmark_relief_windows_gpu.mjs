/**
 * Manual Windows Edge / ANGLE D3D11 hardware GPU benchmark for Alaska DEM relief.
 * Source-exact comparison against integration SHA, with identical shader time,
 * terrain camera, framebuffer, and original/preview URL behavior.
 * NEVER describes SwiftShader / unavailable EXT timer as a hardware GPU pass.
 *
 * Run only after starting a localhost static server at 127.0.0.1:8765.
 * Uses test-only HTML copies (deleted on exit), not the shipped index.html.
 */
// Playwright is imported only for the Windows hardware run; CI source validation
// must work without pretending that a Linux software renderer is target GPU.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';

const ROOT='http://127.0.0.1:8765/';
const SHA='38a9be192ca14cf5d47f6991d050b4093357f044';
const originals=['alaska-relief-hardware-base.html','alaska-relief-hardware-preview.html'];
const outfile='artifacts/alaska-relief-hardware-gpu.json';
const W=1280,H=720;
function assertOne(src,original,which){
  if(src.split(original).length!==2)throw Error(which+' not unique: '+original.slice(0,90));
}
function instrument(source){
  const eol=source.includes('\r\n')?'\r\n':'\n';
  const original='  window.PatrolSpaceBridge = {';
  assertOne(source,original,'state probe');
  const qa=[
    '  // Hardware GPU QA ONLY: this block exists in temporary served test copies.',
    "  const __gpuExt=gl.getExtension('EXT_disjoint_timer_query_webgl2');",
    '  const __gpuPending=[];',
    '  const __gpuTimes=[];',
    '  let __gpuQuery=null;',
    '  function __gpuPoll(){',
    '    if(!__gpuExt||gl.isContextLost())return;',
    '    for(let i=__gpuPending.length-1;i>=0;i--){',
    '      const q=__gpuPending[i];',
    '      if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){',
    '        const disjoint=gl.getParameter(__gpuExt.GPU_DISJOINT_EXT);',
    '        const ns=gl.getQueryParameter(q,gl.QUERY_RESULT);',
    '        if(!disjoint&&ns>0)__gpuTimes.push(ns*1e-6);',
    '        gl.deleteQuery(q);__gpuPending.splice(i,1);',
    '      }',
    '    }',
    '  }',
    '  window.PatrolAlaskaGPUQA={',
    '    pose(mode){',
    '      if(!selectedMap.alaska)throw Error("Not in Alaska");',
    '      const s=mode==="west"?[30,-240,-Math.PI/2,.075]:',
    '        mode==="east"?[70,0,Math.PI/2,.06]:null;',
    '      if(!s)throw Error("Invalid GPU camera");',
    '      plane.pos=[s[0],42,s[1]];',
    '      plane.yaw=s[2];plane.pitch=s[3];plane.bank=0;',
    '      plane.speed=0;plane.vsi=0;',
    '      window.__gpuFreezeFlight=true;',
    '      window.__gpuFrozenTime=42;',
    '      resScale=.60;scaleCeiling=.60;resizeTargets();',
    '      camInitialized=false;',
    '      __gpuTimes.length=0;',
    '      window.__gpuRecord=false;',
    '    },',
    '    record(on){window.__gpuRecord=Boolean(on);}',
    '    read(){',
    '      __gpuPoll();',
    "      const info=gl.getExtension('WEBGL_debug_renderer_info');",
    '      return {',
    '        renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):null,',
    '        vendor:info?gl.getParameter(info.UNMASKED_VENDOR_WEBGL):null,',
    '        webgl2:gl instanceof WebGL2RenderingContext,',
    '        extension:!!__gpuExt,gpuMs:[...__gpuTimes],',
    '        pending:__gpuPending.length,',
    '        lost:gl.isContextLost(),',
    '        internal:[fboW,fboH],',
    '        terrainScale:terrainScaleFor(selectedMap),',
    '        peak:sampleGroundHeight(-558.75,-461.25),',
    '        sea:sampleGroundHeight(0,-700),',
    '        position:[...plane.pos],yaw:plane.yaw,pitch:plane.pitch,',
    '        frozenTime:window.__gpuFrozenTime',
    '      };',
    '    }',
    '  };',
    ''
  ].join(eol);
  source=source.replace(original,qa+original);
  const freeze=['    }else if(window.__gpuFreezeFlight){',
    '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
    '    }else{','      flightStep=advanceFlight(dt);','    }'].join(eol);
  const motion=['    }else{','      flightStep=advanceFlight(dt);','    }'].join(eol);
  assertOne(source,motion,'flight freeze');
  source=source.replace(motion,freeze);
  for(const [a,b] of [
    ['gl.uniform1f(uWorld.time, time);',
      'gl.uniform1f(uWorld.time, window.__gpuFrozenTime ?? time);'],
    ['gl.uniform1f(uMesh.sceneTime,sceneryTime);',
      'gl.uniform1f(uMesh.sceneTime, window.__gpuFrozenTime ?? sceneryTime);']
  ]){
    assertOne(source,a,'time freeze');
    source=source.replace(a,b);
  }
  const before=[
    '    gl.bindVertexArray(quadVao);',
    '    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);',
    '',
    '    // Render 3D Aircraft'
  ].join(eol);
  const after=[
    '    gl.bindVertexArray(quadVao);',
    '    __gpuPoll();',
    '    if(window.__gpuRecord&&__gpuExt&&__gpuPending.length<3&&',
    '       __gpuTimes.length+__gpuPending.length<80){',
    '      __gpuQuery=gl.createQuery();',
    '      gl.beginQuery(__gpuExt.TIME_ELAPSED_EXT,__gpuQuery);',
    '    }',
    '    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);',
    '    if(__gpuQuery){',
    '      gl.endQuery(__gpuExt.TIME_ELAPSED_EXT);',
    '      __gpuPending.push(__gpuQuery);__gpuQuery=null;',
    '    }',
    '',
    '    // Render 3D Aircraft'
  ].join(eol);
  assertOne(source,before,'world-pass timer');
  return source.replace(before,after);
}
function stats(values){
  const a=values.filter(v=>Number.isFinite(v)&&v>0).sort((x,y)=>x-y);
  if(!a.length)return null;
  return {count:a.length,meanMs:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3),
    p50Ms:+a[Math.floor(a.length*.5)].toFixed(3),
    p95Ms:+a[Math.min(a.length-1,Math.floor(a.length*.95))].toFixed(3)};
}
async function raf(page,frames){
  return page.evaluate(async n=>{
    const dt=[];let last=null;
    for(let i=0;i<n;i++){
      const t=await new Promise(ok=>requestAnimationFrame(ok));
      if(last!==null)dt.push(t-last);
      last=t;
    }
    return dt;
  },frames);
}
function hardware(renderer){
  return !!renderer && !/swiftshader|llvmpipe|software|microsoft basic render/i.test(renderer);
}
async function run(){
  if(process.platform!=='win32')throw Error('Use Windows + installed Microsoft Edge D3D11 for this manual GPU gate');
  const main=readFileSync('index.html','utf8');
  const base=execFileSync('git',['show',SHA+':index.html'],{encoding:'utf8',maxBuffer:8*1024*1024});
  writeFileSync(originals[0],instrument(base));
  writeFileSync(originals[1],instrument(main));
  mkdirSync('artifacts',{recursive:true});
  const report={
    sourceBase:SHA,sourceHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    context:'Windows Edge visible / ANGLE D3D11; fixed world-pass GPU timer; RAF and GPU separate',
    viewport:[W,H],forcedResolutionScale:.60,
    gpuPass:'main terrain/water/sky WebGL fullscreen pass only, not whole game frame',
    rendererVerified:false,hardwareGpuTimerVerified:false,results:{}
  };
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({channel:'msedge',headless:false,
    args:['--enable-webgl','--use-gl=angle','--use-angle=d3d11','--disable-software-rasterizer']});
  try{
    for(const [label,file,query] of [
      ['baseline',originals[0],''],
      ['preview',originals[1],'&alaskaRelief=preview']
    ]){
      const context=await browser.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const response=await page.goto(ROOT+file+'?alaskaView=harbor'+query,
        {waitUntil:'domcontentloaded',timeout:30000});
      if(response?.status()!==200)throw Error(label+' HTML not served from localhost');
      await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
      const start=performance.now();
      await page.locator('#startFlight').click({timeout:15000});
      await page.waitForFunction(()=>{
        const x=window.PatrolSpaceBridge?.getState?.();
        return x?.playing&&x.map==='alaska'&&
          document.getElementById('loadOverlay')?.classList.contains('done')&&
          document.getElementById('titleOverlay')?.hidden;
      },null,{timeout:120000});
      const loadMs=+(performance.now()-start).toFixed(2);
      const shots={};
      for(const direction of ['west','east']){
        await page.evaluate(side=>{
          for(const [id,value] of [
            ['skyTime','12'],['skyWeather','Clear'],['skySeason','1']
          ]){
            const el=document.getElementById(id);
            el.value=value;
            if(el.value!==value)throw Error('Unsupported UI option '+id+'='+value);
            el.dispatchEvent(new Event('change',{bubbles:true}));
          }
          window.PatrolAlaskaGPUQA.pose(side);
        },direction);
        await raf(page,8);
        await page.evaluate(()=>window.PatrolAlaskaGPUQA.record(true));
        const intervals=await raf(page,115);
        await page.evaluate(()=>window.PatrolAlaskaGPUQA.record(false));
        await raf(page,10); // allow nonblocking WebGL2 timer queries to resolve
        const actual=await page.evaluate(()=>window.PatrolAlaskaGPUQA.read());
        await page.addStyleTag({content:
          '#flightMap,#statusBar,#skySettings,#hudCanvas{visibility:hidden!important}'});
        const image='artifacts/alaska-relief-hardware-'+label+'-'+direction+'.png';
        await page.screenshot({path:image});
        const rafStats=stats(intervals);
        shots[direction]={...actual,gpuWorldMs:stats(actual.gpuMs),
          rafMs:rafStats,screenshot:image};
        delete shots[direction].gpuMs;
        if(actual.lost||!actual.webgl2||actual.terrainScale!==(label==='preview'?95:75))
          throw Error(label+'/'+direction+' GPU state mismatch: '+JSON.stringify(actual));
        if(actual.frozenTime!==42)throw Error('Shader time not locked');
        if(Math.abs(actual.sea-12.2)>.1)throw Error('Waterline moved');
      }
      if(errors.length)throw Error('Runtime errors '+JSON.stringify(errors));
      report.results[label]={loadMs,shots,errors};
      await context.close();
    }
  }finally{await browser.close();}
  const b=report.results.baseline.shots,p=report.results.preview.shots;
  const variations=['west','east'].map(dir=>({
    direction:dir,
    sameFramebuffer:JSON.stringify(b[dir].internal)===JSON.stringify(p[dir].internal),
    sameCamera:JSON.stringify(b[dir].position)===JSON.stringify(p[dir].position)&&
      b[dir].yaw===p[dir].yaw&&b[dir].pitch===p[dir].pitch,
    gpuP95Ratio:b[dir].gpuWorldMs&&p[dir].gpuWorldMs?
      +(p[dir].gpuWorldMs.p95Ms/b[dir].gpuWorldMs.p95Ms).toFixed(3):null
  }));
  report.variations=variations;
  report.rendererVerified=Object.values(report.results).every(v=>
    Object.values(v.shots).every(x=>hardware(x.renderer)));
  report.hardwareGpuTimerVerified=report.rendererVerified&&
    Object.values(report.results).every(v=>Object.values(v.shots).every(x=>
      x.extension&&x.gpuWorldMs?.count>=20))&&
    variations.every(x=>x.sameFramebuffer&&x.sameCamera);
  writeFileSync(outfile,JSON.stringify(report,null,2));
  console.log('Alaska D3D11 GPU bench saved to '+outfile);
  console.log(JSON.stringify({rendererVerified:report.rendererVerified,
    hardwareGpuTimerVerified:report.hardwareGpuTimerVerified,variations},null,2));
  if(!report.hardwareGpuTimerVerified)throw Error(
    'HARDWARE GPU GATE UNVERIFIED: missing native D3D11 renderer, EXT timer, 20 samples or camera parity; inspect '+outfile);
}
try{
  if(process.argv.includes('--validate-only')){
    const original=execFileSync('git',['show',SHA+':index.html'],
      {encoding:'utf8',maxBuffer:8*1024*1024});
    const head=readFileSync('index.html','utf8');
    for(const [name,html] of [['baseline',original],['preview',head]]){
      const injected=instrument(html);
      if(!injected.includes("window.PatrolAlaskaGPUQA={")||
         !injected.includes("gl.beginQuery(__gpuExt.TIME_ELAPSED_EXT"))
        throw Error(name+' hardware shader hook not installed');
    }
    console.log('PASS Windows hardware GPU QA source hooks on both exact baselines; no GPU exercised');
  }else await run();
}finally{
  for(const name of originals)try{unlinkSync(name);}catch{}
}
