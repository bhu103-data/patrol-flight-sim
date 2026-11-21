// Test-only same-camera A/B for NYC water, foam and sky. The baseline disables
// only the selected visual branch; no code/model changes are shipped by this script.
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const url=process.env.PATROL_TEST_URL||'http://127.0.0.1:8766/';
const root='artifacts/nyc-ocean-wave';mkdirSync(root,{recursive:true});
const src=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const modern='vec3 crestTint=uManhattan?vec3(0.032,0.041,0.046):vec3(0.025,0.24,0.18);';
const old='vec3 crestTint=uManhattan?vec3(0.025,0.24,0.18):vec3(0.025,0.24,0.18);';
const camera='    const viewMat = mat4LookAt(camPos, camLook, camUp);';
const bridge='  window.PatrolSpaceBridge = {';
const clock='gl.uniform1f(uWorld.time, time);';
const aircraftClock='plane.yaw,Math.fround(time),';
for(const marker of [modern,camera,bridge,clock,aircraftClock])
  if(src.split(marker).length!==2)throw Error('Nonunique A/B source anchor: '+marker);
const inject=html=>html.replace(camera,`
    if(window.PatrolCrestCompare?.fixed){
      camPos=[...window.PatrolCrestCompare.fixed.eye];
      camLook=[...window.PatrolCrestCompare.fixed.look];
      camUp=[0,1,0];
    }
`+camera).replace(bridge,`
  window.PatrolCrestCompare={
    fixed:null,
    lock(){
      if(!flying||crash||!waterborne||selectedAircraft!=='seaplane'||
         !selectedMap.city||!usableFloatWater(plane.pos[0],plane.pos[2],plane.yaw))
         throw Error('C185 not afloat on safe NYC water');
      plane.speed=0;plane.afterburner=false;brakes=true;
      const [x,,z]=plane.pos;
      this.fixed={eye:[x+23,WATER_H+10.6,z+24],
        look:[x,WATER_H+1.65,z]};
      return {x,z,yaw:plane.yaw,camera:this.fixed};
    },
    read(){
      const [x,y,z]=plane.pos;
      const pose=floatOceanPose(x,z,plane.yaw,20.0,selectedMap,WATER_H,sampleFloatOceanFloor);
      const environment=sampleFlightEnvironment(0);
      return {x,y,z,sceneWave:pose.height,
        waterborne,crashed:Boolean(crash),camera:[...camPos],fixed:this.fixed,
        sky:{time:skyTime.value,season:skySeason.value,weather:skyWeather.value,
          sun:environment.sun,atmosphere:environment.atmosphere},
        contextLost:gl.isContextLost()};
    }
  };
`+bridge).replace(clock,'gl.uniform1f(uWorld.time, 20.0);')
    .replace(aircraftClock,'plane.yaw,20.0,');
const compareMode=process.env.PATROL_COMPARE_MODE||'crest';
const seaDetailAB=compareMode==='sea-detail';
const skyAtmosphereAB=compareMode==='sky-atmosphere';
const detailEnabled='const bool NYC_TIDEWATER_DETAIL = true;';
const detailDisabled='const bool NYC_TIDEWATER_DETAIL = false;';
const skyEnabled='const bool NYC_TIDEWATER_SKY = true;';
const skyDisabled='const bool NYC_TIDEWATER_SKY = false;';
if(seaDetailAB&&src.split(detailEnabled).length!==2)
  throw Error('Missing reversible NYC sea detail marker');
if(skyAtmosphereAB&&src.split(skyEnabled).length!==2)
  throw Error('Missing reversible NYC sky marker');
const beforeHtml=skyAtmosphereAB?src.replace(skyEnabled,skyDisabled):
  seaDetailAB?src.replace(detailEnabled,detailDisabled):src.replace(modern,old);
const sourceBefore=inject(beforeHtml);
const sourceAfter=inject(src);
const origin=new URL(url).origin,report={
  mode:skyAtmosphereAB?'sky-atmosphere':seaDetailAB?'sea-detail':'crest',
  cameraTime:20,frames:[],errors:[],
  note:'Test-only fixed shader time, not a runtime setting'};
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox']});
try{
  for(const [version,html] of [['before',sourceBefore],['after',sourceAfter]]){
    const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const errors=[],responses=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('response',r=>{if(r.url().includes('cessna185-floats.glb'))responses.push(r.status());});
    await page.route('**/*',async route=>{
      const location=new URL(route.request().url());
      if(location.origin===origin&&(location.pathname==='/'||location.pathname==='/index.html'))
        await route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:html});
      else await route.continue();
    });
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
      await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
      await page.locator('input[name="aircraft"][value="seaplane"]').check({force:true});
      await page.locator('input[name="waterStart"]').check({force:true});
      if(skyAtmosphereAB)await page.evaluate(()=>{
        document.getElementById('skyTime').value='7';
        document.getElementById('skySeason').value='2';
        document.getElementById('skyWeather').value='Clear';
      });
      await page.locator('#startFlight').click({force:true});
      await page.waitForFunction(()=>document.getElementById('titleOverlay')?.hidden &&
        document.getElementById('loadOverlay')?.classList.contains('done')&&
        window.PatrolCrestCompare&&window.PatrolSpaceBridge?.getState()?.playing,
        null,{timeout:150000,polling:450});
      const stage=await page.evaluate(()=>window.PatrolCrestCompare.lock());
      await page.waitForTimeout(1200);
      await page.addStyleTag({content:'body.crest-only *{visibility:hidden!important;} '+
        'body.crest-only #glCanvas{visibility:visible!important;}'});
      const state=await page.evaluate(()=>window.PatrolCrestCompare.read());
      if(!state.waterborne||state.crashed||state.contextLost ||
        state.camera.some((x,i)=>Math.abs(x-state.fixed.eye[i])>.001))
        throw Error('Invalid paired water scene: '+JSON.stringify(state));
      if(!responses.includes(200)||errors.length)
        throw Error('GLB/console failure: '+JSON.stringify({responses,errors}));
      await page.evaluate(()=>document.body.classList.add('crest-only'));
      const file=root+'/nyc-water-'+report.mode+'-'+version+'.png';
      await page.locator('#glCanvas').screenshot({path:file,animations:'disabled',timeout:90000});
      // Actual RAF pacing, not elapsed screenshot time and not GPU timestamp.
      const intervals=await page.evaluate(async()=>{
        const out=[];let previous;
        for(let i=0;i<17;i++){
          const t=await new Promise(ok=>requestAnimationFrame(ok));
          if(previous!==undefined)out.push(t-previous);
          previous=t;
        }
        return out;
      });
      const sorted=[...intervals].sort((a,b)=>a-b);
      report.frames.push({version,file,stage,state,modelHttp:responses,
        rafP50ms:sorted[Math.floor(sorted.length*.5)],
        rafP95ms:sorted[Math.floor(sorted.length*.95)],
        rafSamples:intervals.length,gpuFrameMs:null});
      report.errors.push(...errors);
    }finally{await page.close();}
  }
  if(report.frames.length!==2)throw Error('Missing before/after screenshots');
  const [a,b]=report.frames;
  if(Math.abs(a.stage.x-b.stage.x)>.0001 ||
     Math.abs(a.stage.z-b.stage.z)>.0001 ||
     Math.abs(a.stage.yaw-b.stage.yaw)>.0001)
    throw Error('Water-start state differs between paired scenes');
  if(skyAtmosphereAB&&JSON.stringify(a.state.sky)!==JSON.stringify(b.state.sky))
    throw Error('Sky time, sun direction or weather differs between paired scenes');
  report.passed=true;
}catch(e){report.passed=false;report.failure=String(e.stack||e);process.exitCode=1;}
finally{
  writeFileSync(root+'/nyc-water-'+report.mode+'-comparison.json',
    JSON.stringify(report,null,2));
  await browser.close();
}
console.log(JSON.stringify(report,null,2));
