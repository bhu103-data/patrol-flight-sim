// Real Chromium WebGL check for the standalone Chongqing PATROL level.
// With a local HTTP server running: node scripts/chongqing-browser-smoke.mjs
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdir, writeFile } from 'node:fs/promises';

const base=(process.env.CHONGQING_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/chongqing';
await mkdir(dir,{recursive:true});
const errors=[],warnings=[];
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',err=>errors.push(err.message));
page.on('console',msg=>{if(msg.type()==='error')warnings.push(msg.text());});
page.on('requestfailed',req=>{
  if(req.url().includes('/assets/chongqing/')||req.url().includes('three.module.js'))
    errors.push('Failed core request: '+req.url()+' '+(req.failure()?.errorText||''));
});
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const screenshots=[];
async function capture(name){
  const state=await page.evaluate(()=>{
    const canvas=document.getElementById('world');
    const gl=canvas?.getContext('webgl2');
    return {
      width:canvas?.width||0,height:canvas?.height||0,
      webgl:Boolean(gl&&!gl.isContextLost()),
      game:window.PatrolSpaceBridge?.getState?.()
    };
  });
  check(state.webgl,'Missing WebGL2 context at '+name);
  check(state.width>300&&state.height>200,'Empty canvas at '+name);
  check(state.game?.map==='chongqing'&&state.game?.playing,'Game did not start at '+name);
  check(state.game.position.every(Number.isFinite),'Nonfinite pilot position at '+name);
  // Capture the actual WebGL canvas, not HUD panels that can hide black frames.
  // Element screenshots can still include HTML HUD painted above the canvas
  // by the browser compositor. Explicitly hide the overlay just for capture.
  await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
  let raw;
  try{
    check(await page.locator('#questHotpot').evaluate(
      el=>getComputedStyle(el).visibility==='hidden'),
      'HUD overlays not hidden during Chongqing WebGL screenshot');
    raw=await page.locator('#world').screenshot({
      path:dir+'/'+name+'.png',timeout:75000,animations:'allow'
    });
  }finally{
    await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
  }
  const png=PNG.sync.read(raw),colorBins=new Set();
  let nearBlack=0,sampled=0;
  for(let y=0;y<png.height;y+=10)for(let x=0;x<png.width;x+=10){
    const i=(y*png.width+x)*4;
    const red=png.data[i],green=png.data[i+1],blue=png.data[i+2];
    colorBins.add(((red>>4)<<8)|((green>>4)<<4)|(blue>>4));
    if(red+green+blue<22)nearBlack++;
    sampled++;
  }
  const pixels={width:png.width,height:png.height,colorBins:colorBins.size,
    nearBlackFraction:nearBlack/Math.max(1,sampled)};
  if(name==='00-spawn'){
    // The original oversized red sphere covered ~36% of this fixed ROI.
    // A real open hotpot should leave the restaurant storefront visible.
    let red=0,total=0;
    for(let y=100;y<335;y+=4)for(let x=540;x<790;x+=4){
      const offset=(y*png.width+x)*4;
      const r=png.data[offset],g=png.data[offset+1],bl=png.data[offset+2];
      if(r>90&&r>g*1.6&&r>bl*1.7)red++;
      total++;
    }
    pixels.hotpotRedDomeFraction=red/Math.max(1,total);
    check(pixels.hotpotRedDomeFraction<.18,
      'Oversized red hotpot sphere still hides spawn storefront: '+
        pixels.hotpotRedDomeFraction);
    check(state.game.hotpotDisplayParts>=17&&state.game.hotpotDisplayParts<=25&&
      state.game.hotpotDisplayHeight<=2.5,
      'Grounded open hotpot display missing from live game');
  }
  // Conservative limits: reject empty/noise frames without treating this as
  // a geometry realism score. Keep night scenes and dark river areas valid.
  check(pixels.width>=640&&pixels.height>=360&&pixels.colorBins>20&&
    pixels.nearBlackFraction<0.985,
    'Blank Chongqing WebGL frame at '+name+': '+JSON.stringify(pixels));
  const render=state.game.renderMetrics;
  check(render&&Number.isFinite(render.drawCalls)&&
    Number.isFinite(render.triangles)&&Number.isFinite(render.pixelRatio),
    'No live draw/triangle/pixel-ratio counters at '+name);
  screenshots.push({name,width:state.width,height:state.height,
    altitude:state.game.altitude,pixels,render});
}
let report;
try{
  const response=await page.goto(base+'/chongqing.html?quality=low&time=night',{
    waitUntil:'domcontentloaded',timeout:60000
  });
  check(response?.ok(),'Chongqing HTTP page unavailable');
  await page.addStyleTag({content:
    'body.patrol-qa-scene-only * {visibility:hidden !important;} '+
    'body.patrol-qa-scene-only #world {visibility:visible !important;}'});
  await page.locator('#loading').waitFor({state:'detached',timeout:105000});
  await page.waitForTimeout(900);
  await capture('00-spawn');
  for(const [key,name] of [['1','01-hongyadong'],['2','02-raffles'],['3','03-liziba']]){
    await page.keyboard.press(key);
    await page.waitForTimeout(1100);
    await capture(name);
  }
  // Inspect the actual riverbank dead-end guardrails in real WebGL:
  // the left side of the tributary must show rails on dry asphalt, no
  // floating posts or uninterrupted underwater road through the channel.
  await page.keyboard.press('5');
  await page.waitForTimeout(1100);
  await capture('03b-tributary-safety-guards');
  // Include the actual street-level light fixtures in the Chromium tour.
  // Existence alone is not visual validation; capture the real canvas pixels.
  await page.keyboard.press('6');
  await page.waitForTimeout(1100);
  const signalState=await page.evaluate(()=>window.PatrolSpaceBridge.getState());
  check(signalState.signalCrossings>=2 &&
    signalState.signalMasts===signalState.signalCrossings*2 &&
    signalState.signalStopLines===signalState.signalCrossings*2,
    'Directional lights/stop bars missing in live scene: '+JSON.stringify(signalState));
  check(['green','amber','red'].includes(signalState.signalAspect),
    'No running three-aspect traffic cycle');
  await capture('03c-signalized-street');
  // Matched camera in daylight reveals the steel housing/visor outlines
  // hidden by dark asphalt; verify both scenes use the same pilot position.
  const signalView=await page.evaluate(()=>window.PatrolSpaceBridge.getState().position);
  await page.locator('#cqTime').selectOption('day');
  await page.waitForTimeout(850);
  const dayView=await page.evaluate(()=>window.PatrolSpaceBridge.getState().position);
  check(Math.hypot(...signalView.map((v,i)=>v-dayView[i]))<3,
    'The daytime signal screenshot drifted away from its night camera');
  await capture('03d-signalized-street-day');
  // Low-quality keeps moving traffic accessible on software GPUs; inspect
  // the SAME daylight lens/cornice view in full high detail once, then
  // revert before the flight ascent to preserve the old smoke budget.
  await page.locator('#qualityBtn').click(); // low -> auto
  await page.locator('#qualityBtn').click(); // auto -> high
  check((await page.evaluate(()=>window.PatrolSpaceBridge.getState()))
    .renderMetrics.quality==='high','QA failed to enable high-detail facades');
  await page.waitForTimeout(2800);
  await capture('03e-signalized-street-high-detail');
  await page.locator('#qualityBtn').click(); // high -> low
  await page.locator('#cqTime').selectOption('night');
  await page.keyboard.press('2');
  await page.waitForTimeout(250);
  const starting=await page.evaluate(()=>window.PatrolSpaceBridge.getState());
  check(starting.avatarFlying,'Scenic shortcut 2 must enable flying');
  const before=starting.altitude;
  // Software SwiftShader may render at only a few FPS; the game's fixed
  // maximum physics step deliberately slows simulated time at that rate.
  // Poll the actual altitude, not a 2-second wall-clock assumption.
  await page.keyboard.down('Space');
  try{
    await page.waitForFunction(target=>{
      const state=window.PatrolSpaceBridge?.getState?.();
      return Boolean(state?.avatarFlying&&state.altitude>target);
    },before+18,{timeout:45000,polling:250});
  }finally{
    await page.keyboard.up('Space');
  }
  const after=await page.evaluate(()=>window.PatrolSpaceBridge.getState().altitude);
  check(after>before+18,'Flight failed to clear high-rise: '+before+' -> '+after);
  await capture('04-high-rise-climb');
  // Photograph both sunlight and night glow using the actual game controls.
  await page.locator('#cqTime').selectOption('day');
  await page.waitForTimeout(1200);
  await page.keyboard.press('H');
  await capture('05-day-cinematic');
  await page.keyboard.press('H');
  await page.locator('#cqTime').selectOption('night');
  await page.waitForTimeout(1200);
  await page.keyboard.press('H');
  await capture('06-night-cinematic');
  await page.keyboard.press('H');
  for(const id of ['questHotpot','questFerry','questRaffles','questLiziba','qualityBtn'])
    check(await page.locator('#'+id).count()===1,'Missing game HUD #'+id);
  check(!errors.length,'Uncaught runtime error: '+errors.join('; '));
  report={passed:true,climb:{before,after,above300:after>300},environments:['day','night'],screenshots,warnings};
}catch(e){
  report={passed:false,error:e.stack||String(e),errors,warnings,screenshots};
  try{await page.screenshot({path:dir+'/FAILED.png',fullPage:true});}catch{}
}finally{
  await writeFile(dir+'/smoke-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(!report.passed)process.exitCode=1;
