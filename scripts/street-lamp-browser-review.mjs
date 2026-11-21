// Same-camera *real Chongqing game* WebGL2 visual and frame pacing evidence.
// GitHub Actions downloads the officially hosted GLB to the local test server.
// Never interprets this experiment as a release approval.
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {PNG} from 'pngjs';

const base=(process.env.CHONGQING_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/streetlamp-review';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const experiments=[];
const warnings=[];
function metric(values,p){
  const ordered=[...values].sort((a,b)=>a-b);
  return Math.round(ordered[Math.min(ordered.length-1,Math.floor((ordered.length-1)*p))]*100)/100;
}
async function capture(label,pose,preview,quality='high'){
  const page=await browser.newPage({
    viewport:{width:960,height:540},deviceScaleFactor:1
  });
  const failures=[];
  page.on('pageerror',e=>failures.push(String(e)));
  page.on('console',msg=>{
    if(msg.type()==='error')failures.push(msg.text());
    if(msg.type()==='warning')warnings.push({label,message:msg.text().slice(0,200)});
  });
  const params=new URLSearchParams({
    quality,time:'day',assetQA:pose
  });
  if(preview)params.set('lampReview','grab3d');
  try{
    const response=await page.goto(base+'/chongqing.html?'+params,{
      waitUntil:'domcontentloaded',timeout:75000
    });
    if(!response?.ok())throw Error('Game endpoint unavailable');
    await page.locator('#loading').waitFor({state:'detached',timeout:120000});
    if(preview){
      const expected=quality==='low'?'low-fallback':'ready';
      await page.waitForFunction(expected=>
        document.documentElement.dataset.streetlampReview===expected,
        expected,{timeout:90000,polling:250});
    }
    // Remove HUD overlays from the *canvas screenshot*; UI is tested elsewhere.
    await page.addStyleTag({content:'body > :not(canvas#world):not(script) { visibility:hidden!important; }'});
    await page.waitForTimeout(900);
    // Bound the comparison on software WebGL: no browser-only test may
    // hold a free CI runner indefinitely waiting for perfect frame counts.
    const samples=await page.evaluate(async()=>new Promise(resolve=>{
      const timestamps=[];
      let last=null,done=false;
      function finish(){
        if(done)return;
        done=true;clearTimeout(watchdog);
        resolve(timestamps.slice(Math.min(3,Math.floor(timestamps.length/5))));
      }
      const watchdog=setTimeout(finish,35000);
      function tick(now){
        if(done)return;
        if(last!==null)timestamps.push(now-last);
        last=now;
        if(timestamps.length>=22)finish();
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }));
    if(samples.length<8)throw Error('Insufficient software WebGL frames: '+samples.length);
    const game=await page.evaluate(()=>{
      const c=document.querySelector('canvas#world');
      const gl=c?.getContext('webgl2');
      return {
        webgl2:Boolean(gl&&!gl.isContextLost()),
        canvas:[c?.width,c?.height],
        playing:window.PatrolSpaceBridge?.getState?.().playing,
        stats:window.PatrolSpaceBridge?.getAssetReviewState?.()
      };
    });
    if(!game.webgl2||!game.playing||!game.stats?.anchor)
      throw Error('No live WebGL scene or safe lamp anchor');
    const projected=game.stats.lampScreenProjection;
    if(!projected||Math.abs(projected[0])>0.38||Math.abs(projected[1])>0.38||
       Math.abs(projected[2])>1){
      throw Error('Target lamp is out of usable camera frame: '+JSON.stringify(projected));
    }
    if(preview&&quality!=='low'&&
      (game.stats.status!=='ready'||game.stats.candidateBytes!==702900))
      throw Error('Audited GLB not swapped into the scene');
    if(preview&&quality==='low'&&game.stats.status!=='low-fallback')
      throw Error('Low quality failed to retain the original instanced light');
    const png=dir+'/'+label+'.png';
    await page.locator('canvas#world').screenshot({path:png});
    const result={
      label,pose,preview,quality,webgl2:game.webgl2,
      status:game.stats.status,anchor:game.stats.anchor,
      cameraPosition:game.stats.cameraPosition,
      lampScreenProjection:game.stats.lampScreenProjection,
      calls:game.stats.drawCalls,triangles:game.stats.triangles,
      pixelRatio:game.stats.pixelRatio,candidateBytes:game.stats.candidateBytes,
      decodeMs:game.stats.decodeMs,
      frames:samples.length,frameMsMedian:metric(samples,.5),
      frameMsP95:metric(samples,.95),
      screenshot:png,
      errors:failures
    };
    experiments.push(result);
    if(failures.length)throw Error('WebGL browser errors: '+failures.join('; '));
  }finally{
    await page.close();
  }
}
let report;
try{
  // Identical viewport, quality, clock preset, streets and scene positions.
  await capture('street-original','street',false);
  await capture('street-candidate','street',true);
  await capture('lowair-original','air',false);
  await capture('lowair-candidate','air',true);
  await capture('low-quality-fallback','street',true,'low');
  const comparisons=[];
  for(const pose of ['street','air']){
    const baseShot=experiments.find(x=>x.pose===pose&&!x.preview);
    const candidate=experiments.find(x=>x.pose===pose&&x.preview&&x.quality==='high');
    const imageA=PNG.sync.read(await readFile(baseShot.screenshot));
    const imageB=PNG.sync.read(await readFile(candidate.screenshot));
    if(imageA.width!==imageB.width||imageA.height!==imageB.height)
      throw Error('A/B screenshot dimensions differ');
    // Actual lamp must visibly change in the central ROI, not behind a hill.
    // Ignore dynamic particles outside this ROI. Compare RGB channels only.
    const w=imageA.width,h=imageA.height;
    let changedPixels=0,observedPixels=0,brightness=0;
    for(let y=Math.floor(h*.22);y<Math.ceil(h*.83);y++){
      for(let x=Math.floor(w*.3);x<Math.ceil(w*.7);x++){
        const i=(y*w+x)*4;
        const a=imageA.data,b=imageB.data;
        brightness+=(a[i]+a[i+1]+a[i+2])/3;
        observedPixels++;
        if(Math.max(
          Math.abs(a[i]-b[i]),
          Math.abs(a[i+1]-b[i+1]),
          Math.abs(a[i+2]-b[i+2]))>20)changedPixels++;
      }
    }
    const changedRatio=changedPixels/observedPixels;
    const meanBaselineBrightness=brightness/observedPixels;
    comparisons.push({
      pose,
      meanBaselineBrightness:Math.round(meanBaselineBrightness*100)/100,
      visuallyChangedPixels:changedPixels,
      visuallyChangedPercent:Math.round(changedRatio*10000)/100,
      medianDeltaMs:Math.round((candidate.frameMsMedian-baseShot.frameMsMedian)*100)/100,
      p95DeltaMs:Math.round((candidate.frameMsP95-baseShot.frameMsP95)*100)/100,
      drawCallDelta:candidate.calls-baseShot.calls,
      triangleDelta:candidate.triangles-baseShot.triangles
    });
    if(meanBaselineBrightness<30)
      throw Error('Camera still obscured/black: '+pose+', brightness '+meanBaselineBrightness);
    if(changedPixels<150)
      throw Error('Replacement not visibly confirmed at '+pose+': only '+changedPixels+' pixels changed');

  }
  report={passed:true,environment:'Chromium SwiftShader (software WebGL2, not GPU benchmark)',
    experiments,comparisons,warnings,
    decision:'Review screenshot and frame-time deltas; test does NOT approve production swap'};
}catch(e){
  report={passed:false,error:e.stack||String(e),experiments,warnings};
}finally{
  await writeFile(dir+'/visual-report.json',JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
