// QA-only real WebGL2 capture. Never writes index.html. RAF deltas != GPU time.
// Run after: python -m http.server 8766 --bind 127.0.0.1
import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

const url=process.env.PATROL_TEST_URL||'http://127.0.0.1:8766/';
const out='artifacts/nyc-ocean-wave';mkdirSync(out,{recursive:true});
const source=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const camera='    const viewMat = mat4LookAt(camPos, camLook, camUp);';
const end='  // Optional orbital gateway bridge; city renderers and physics remain intact.';
for(const marker of [camera,end])
  if(source.split(marker).length!==2)throw Error('Unmatched baseline anchor: '+marker);
const html=source.replace(camera,`
    // Test-only fixed camera for repeatable NYC waterline screenshots.
    if(window.PatrolWaveQA?.fixed){
      camPos=[...window.PatrolWaveQA.fixed.eye];
      camLook=[...window.PatrolWaveQA.fixed.look];
      camUp=[0,1,0];
    }
`+camera).replace(end,`
  window.PatrolWaveQA={
    fixed:null,
    lock(){
      if(!flying||crash||!waterborne||selectedAircraft!=='seaplane'||
         !selectedMap.city||!usableFloatWater(plane.pos[0],plane.pos[2],plane.yaw))
        throw Error('NYC safe water-start not established');
      plane.speed=0;plane.afterburner=false;brakes=true;
      const [x,,z]=plane.pos;
      this.fixed={eye:[x+23,WATER_H+10.6,z+24],
        look:[x,WATER_H+1.65,z]};
      return {x,z,yaw:plane.yaw,fixed:this.fixed};
    },
    read(){
      const t=Math.fround((lastTime??0)*.001);
      const [x,y,z]=plane.pos;
      const p=floatOceanPose(x,z,plane.yaw,t,selectedMap,WATER_H,sampleFloatOceanFloor);
      return {x,y,z,time:t,height:p.height,pitch:p.pitch,bank:p.bank,
        expectedY:WATER_H+FLOAT_CLEARANCE+p.height,waterborne,
        crashed:Boolean(crash),speed:plane.speed,
        camera:[...camPos],fixed:this.fixed,contextLost:gl.isContextLost()};
    }
  };
`+end);

const chrome=process.env.PATROL_BROWSER_CHANNEL==='chrome';
const browser=await chromium.launch({
  ...(chrome?{channel:'chrome'}:{}),headless:true,
  args:chrome?['--ignore-gpu-blocklist']:
    ['--no-sandbox','--enable-webgl','--use-gl=angle',
     '--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox']
});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[],glb=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.url().includes('cessna185-floats.glb'))glb.push(r.status());});
const origin=new URL(url).origin;
await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.origin===origin&&(u.pathname==='/'||u.pathname==='/index.html'))
    await route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:html});
  else await route.continue();
});
const report={baseline:'6d50bfd',browser:chrome?'Chrome':'SwiftShader Chromium',
  gpuFrameMs:null,errors,glb,shots:[]};
try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  for(const [name,value] of [['flightMap','manhattan'],['aircraft','seaplane']])
    await page.locator('input[name="'+name+'"][value="'+value+'"]').check({force:true});
  await page.locator('input[name="waterStart"]').check({force:true});
  await page.locator('#startFlight').click({force:true});
  await page.waitForFunction(()=>document.getElementById('titleOverlay')?.hidden&&
    document.getElementById('loadOverlay')?.classList.contains('done')&&
    window.PatrolWaveQA&&window.PatrolSpaceBridge?.getState()?.playing,
    null,{timeout:150000});
  await page.evaluate(()=>{
    for(const [id,v] of [['skyTime','12'],['skySeason','1'],
                         ['skyWeather','Clear'],['nyStreetQuality','2']]){
      const e=document.getElementById(id);if(!e)throw Error('Missing '+id);
      e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  report.stage=await page.evaluate(()=>window.PatrolWaveQA.lock());
  await page.waitForTimeout(1500);
  await page.addStyleTag({content:
    'body.wave-only *{visibility:hidden!important;} '+
    'body.wave-only #glCanvas{visibility:visible!important;}'});
  report.renderer=await page.evaluate(()=>{
    const gl=document.getElementById('glCanvas').getContext('webgl2');
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,
      vendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null};
  });
  const shot=async file=>{
    const s=await page.evaluate(()=>window.PatrolWaveQA.read());
    if(s.crashed||!s.waterborne||s.contextLost||Math.abs(s.y-s.expectedY)>.025)
      throw Error('Float contact mismatch: '+JSON.stringify(s));
    if(s.camera.some((v,i)=>Math.abs(v-s.fixed.eye[i])>.001))
      throw Error('Camera drift: '+JSON.stringify(s));
    await page.evaluate(()=>document.body.classList.add('wave-only'));
    try{await page.locator('#glCanvas').screenshot({
      path:out+'/'+file,timeout:90000,animations:'disabled'});}
    finally{await page.evaluate(()=>document.body.classList.remove('wave-only'));}
    report.shots.push({file,...s});
  };
  await shot('nyc-c185-same-camera-a.png');
  const ticks=await page.evaluate(async()=>{
    const d=[];let prev;
    for(let i=0;i<48;i++){
      const t=await new Promise(done=>requestAnimationFrame(done));
      if(prev!==undefined)d.push(t-prev);
      prev=t;
    }
    return d;
  });
  const sorted=[...ticks].sort((a,b)=>a-b),p=v=>sorted[Math.floor((sorted.length-1)*v)];
  report.rafFrameMs={p50:p(.5),p95:p(.95),p99:p(.99),samples:ticks.length};
  await shot('nyc-c185-same-camera-b.png');
  if(report.shots.every(s=>Math.abs(s.height)<.003))
    throw Error('No visible swell: both confirmed waterborne shots had zero height');
  if(!glb.includes(200)||errors.length)throw Error('C185 model or JS errors: '+JSON.stringify({glb,errors}));
  report.passed=true;
}catch(error){report.passed=false;report.failure=String(error.stack||error);process.exitCode=1;}
finally{writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
