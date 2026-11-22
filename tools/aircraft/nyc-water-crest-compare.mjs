// Test-only A/B water color: same NYC camera, same shader time, same
// game version. The reference shader restores only the old teal crest term.
// No code/model changes are shipped by this script.
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
      return {x,y,z,sceneWave:pose.height,
        waterborne,crashed:Boolean(crash),camera:[...camPos],fixed:this.fixed,
        contextLost:gl.isContextLost()};
    }
  };
`+bridge).replace(clock,'gl.uniform1f(uWorld.time, 20.0);')
    .replace(aircraftClock,'plane.yaw,20.0,');
const seaDetailAB=process.env.PATROL_COMPARE_MODE==='sea-detail';
const bandFilterAB=process.env.PATROL_COMPARE_MODE==='band-filter';
const detailEnabled='const bool NYC_TIDEWATER_DETAIL = true;';
const detailDisabled='const bool NYC_TIDEWATER_DETAIL = false;';
if(seaDetailAB&&src.split(detailEnabled).length!==2)
  throw Error('Missing reversible NYC sea detail marker');
const bandEnabled='const bool NYC_HORIZON_SLOPE_FILTER = true;';
const bandDisabled='const bool NYC_HORIZON_SLOPE_FILTER = false;';
if(bandFilterAB&&src.split(bandEnabled).length!==2)
  throw Error('Missing reversible NYC horizon shading filter');
const sourceBefore=inject(bandFilterAB
  ?src.replace(bandEnabled,bandDisabled)
  :seaDetailAB?src.replace(detailEnabled,detailDisabled)
  :src.replace(modern,old));
const sourceAfter=inject(src);
const origin=new URL(url).origin,report={
  mode:bandFilterAB?'band-filter':seaDetailAB?'sea-detail':'crest',
  cameraTime:20,frames:[],errors:[],
  note:'Test-only fixed shader time, not a runtime setting'};
const chrome=process.env.PATROL_BROWSER_CHANNEL==='chrome';
report.browser=chrome?'installed Chrome':'Chromium SwiftShader';
const browser=await chromium.launch({headless:true,
  ...(chrome?{channel:'chrome'}:{}),
  args:chrome?['--ignore-gpu-blocklist']:[
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
      // CI software browsers occasionally synthesize a click without
      // committing styled radio state. Select through real form properties,
      // dispatch the app's change handler, and assert FormData before launch.
      const selected=await page.evaluate(()=>{
        const select=(selector)=>{
          const el=document.querySelector(selector);
          if(!el)throw Error('Missing flight form input '+selector);
          el.checked=true;
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
        };
        select('input[name="flightMap"][value="manhattan"]');
        select('input[name="aircraft"][value="seaplane"]');
        select('input[name="waterStart"]');
        const v=new FormData(document.getElementById('flightSetup'));
        const state={map:v.get('flightMap'),aircraft:v.get('aircraft'),
          afloat:v.has('waterStart'),
          enabled:!document.getElementById('waterStart').disabled};
        if(state.map!=='manhattan'||state.aircraft!=='seaplane'||
           !state.afloat||!state.enabled)
          throw Error('Water QA form selection not stable: '+JSON.stringify(state));
        return state;
      });
      report.form=selected;
      await page.locator('#startFlight').click({force:true});
      await page.waitForFunction(()=>document.getElementById('titleOverlay')?.hidden &&
        document.getElementById('loadOverlay')?.classList.contains('done')&&
        window.PatrolCrestCompare&&window.PatrolSpaceBridge?.getState()?.playing,
        null,{timeout:150000,polling:450});
      // Pin game weather/time and NYC graphics quality, not just shader phase.
      await page.evaluate(()=>{
        for(const [id,value] of [
          ['skyTime','12'],['skySeason','1'],['skyWeather','Clear'],
          ['nyStreetQuality','2']]){
          const control=document.getElementById(id);
          if(!control)throw Error('Missing QA control '+id);
          control.value=value;
          control.dispatchEvent(new Event('change',{bubbles:true}));
        }
      });
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
      const screenshot=await page.locator('#glCanvas').screenshot({
        path:file,animations:'disabled',timeout:90000
      });
      // Quantify the same unoccluded far-left water rectangle for both images.
      // This is a diagnostic, not a visual acceptance gate or GPU benchmark.
      const farWater=await page.evaluate(async pngBase64=>{
        const picture=new Image();
        picture.src='data:image/png;base64,'+pngBase64;
        await picture.decode();
        const roi={x:20,y:205,width:600,height:90};
        if(picture.naturalWidth<roi.x+roi.width ||
           picture.naturalHeight<roi.y+roi.height)
          throw Error('A/B screenshot too small for fixed water ROI');
        const canvas=document.createElement('canvas');
        canvas.width=picture.naturalWidth;canvas.height=picture.naturalHeight;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});
        if(!ctx)throw Error('Missing 2D context for A/B image metrics');
        ctx.drawImage(picture,0,0);
        const pixels=ctx.getImageData(roi.x,roi.y,roi.width,roi.height).data;
        const gray=new Float32Array(roi.width*roi.height);
        for(let i=0;i<gray.length;i++){
          const j=i*4;
          gray[i]=(0.2126*pixels[j]+0.7152*pixels[j+1]+
            0.0722*pixels[j+2])/255;
        }
        let vertical=0,horizontal=0,count=0;
        for(let y=1;y<roi.height;y++)for(let x=1;x<roi.width;x++){
          const pos=y*roi.width+x;
          const dy=gray[pos]-gray[pos-roi.width];
          const dx=gray[pos]-gray[pos-1];
          vertical+=dy*dy;horizontal+=dx*dx;count++;
        }
        const verticalRms=Math.sqrt(vertical/count);
        const horizontalRms=Math.sqrt(horizontal/count);
        return {roi,verticalRms,horizontalRms,
          stripeDirectionRatio:verticalRms/Math.max(horizontalRms,1e-9),
          pixelsCompared:count};
      },screenshot.toString('base64'));
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
      report.frames.push({version,file,stage,state,modelHttp:responses,farWater,
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
  // Independent scene loads can alter unpinned geometry/LOD; report these
  // pixel metrics as an audit aid, never as proof of physical ocean quality.
  const pctChange=(before,after)=>
    before>1e-9?Number((100*(after-before)/before).toFixed(2)):null;
  report.farWaterComparison={
    roi:a.farWater.roi,
    verticalRmsChangePct:pctChange(a.farWater.verticalRms,b.farWater.verticalRms),
    stripeDirectionRatioChangePct:pctChange(
      a.farWater.stripeDirectionRatio,b.farWater.stripeDirectionRatio),
    note:'Diagnostic only: relative luminance gradients in fixed water pixels; not GPU time, sea-state measurement, or an automated visual pass'
  };
  report.passed=true;
}catch(e){report.passed=false;report.failure=String(e.stack||e);process.exitCode=1;}
finally{
  writeFileSync(root+'/nyc-water-'+report.mode+'-comparison.json',
    JSON.stringify(report,null,2));
  await browser.close();
}
console.log(JSON.stringify(report,null,2));
