// Real PATROL game (NOT a standalone ocean shader): same-height/same-exposure
// sunward vs anti-sunward NYC seaplane water views, old vs corrected optics.
// Every override below exists ONLY in this browser test's HTML response.
// Production map switching, ship wakes and C185 flotation are untouched.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const dir='artifacts/nyc-sunward-component-probe',base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
await mkdir(dir,{recursive:true});
const report={passed:false,errors:[],scenes:[],
  note:'Same scene height/exposure/time controls. SwiftShader RAF != native GPU time. Source-verified geometry and controls, NOT city photogrammetry.'};
const ensure=(ok,msg)=>{if(!ok)throw Error(msg)};
const prod=await readFile('index.html','utf8');
const newRay='reflDir.y = uManhattan ? max(reflDir.y, 0.002) : abs(reflDir.y);';
const oldRay='reflDir.y = abs(reflDir.y);';
const newMoon='float moonAngularRadius=uManhattan?0.00455:0.026;\n      float moonMinDot=uManhattan?0.9999895:0.99958;';
const oldMoon='float moonAngularRadius=0.026;\n      float moonMinDot=0.99958;';
for(const a of [newRay,newMoon,'const aspect = fboW / fboH;',
  '  window.PatrolSpaceBridge = {','gl.uniform1f(uWorld.time, time);'])
  ensure(prod.split(a).length===2,'Nonunique source QA anchor: '+a.slice(0,65));
const origin=new URL(base).origin;
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
function instrument(src){
 const qaAPI=[
 '  window.__patrolSunwaterQA={facing:null,origin:null,sun:null,moon:null,',
 '    active:false,frameTime:20.0,',
 '    setup(){',
 "      if(!flying||crash||!selectedMap.city||selectedAircraft!=='seaplane'||",
 "         !waterborne||!usableFloatWater(plane.pos[0],plane.pos[2],plane.yaw))",
 "        throw Error('C185 not afloat in safe NYC harbor');",
 '      plane.speed=0;plane.afterburner=false;brakes=true;',
 '      this.origin=[plane.pos[0]+23,WATER_H+10.6,plane.pos[2]+24];',
 '      this.active=true;this.facing="sun";',
 '      return this.read();',
 '    },',
 '    read(){',
 '      return {map:Object.keys(FLIGHT_MAPS).find(k=>FLIGHT_MAPS[k]===selectedMap),',
 '        waterborne,crashed:!!crash,position:[...plane.pos],',
 '        boatCount:boats.length,boatsActive:boats.filter(b=>!b.wreck).length,',
 '        boatWakeWidth:boatWakes[3],',
 '        shipCollision:boats.length?(()=>{',
 '          const a=boats[0],p=sceneryPose(a,sceneryTime);',
 '          return vehicleAt(p[0],WATER_H+2,p[1],.48)?.kind||null;',
 '        })():null,',
 '        sameEye:this.origin&&[...this.origin],',
 '        sun:this.sun,moon:this.moon,sunClock:this.sunClock,skyWeather:this.skyWeather,skySeason:this.skySeason,',
 '        sunHeight:this.sun?.[1],sphereActive:!!sphereMesh,',
 '        moonAngularRadiusRadians:selectedMap.city?0.00455:0.026,',
 '        eye:[...camPos],face:this.facing,',
 '        webglError:gl.getError(),contextLost:gl.isContextLost(),',
 '        rendererWidth:fboW,rendererHeight:fboH};',
 '    }',
 '  };'
 ].join('\n')+'\n';
 const cameraOverride=[
 '    if(window.__patrolSunwaterQA?.active && selectedMap.city){',
 '      const state=window.__patrolSunwaterQA;',
 '      const eye=state.origin;',
 '      const dir=state.facing==="moon"?environment.moon:environment.sun;',
 '      const length=Math.max(Math.hypot(dir[0],dir[2]),0.00001);',
 '      const sign=state.facing==="anti"?-1:1;',
 '      state.sun=[...environment.sun];state.moon=[...environment.moon];',
 '      state.sunClock=skyTime.value;state.skyWeather=skyWeather.value;',
 '      state.skySeason=skySeason.value;',
 '      // Fixed FBO pixel density in diagnostic only; disables adaptive visual
      // resolution as a confounder in independent scene loads.
      if(Math.abs(resScale-0.55)>0.00001){
        resScale=0.55;scaleCeiling=0.55;resizeTargets();
      }
      camPos=[...eye];camUp=[0,1,0];',
 '      // Moon close-frame looks slightly above horizon; sun/anti both use',
 '      // precisely the same 11.0-m downward angle and camera elevation.',
 '      camLook=state.facing==="moon"?',
 '        [eye[0]+dir[0]*120,eye[1]+dir[1]*120,eye[2]+dir[2]*120]:',
 '        [eye[0]+sign*dir[0]/length*120,eye[1]-11.0,',
 '         eye[2]+sign*dir[2]/length*120];',
 '    }'
 ].join('\n')+'\n';
 return src.replace('  window.PatrolSpaceBridge = {',qaAPI+'  window.PatrolSpaceBridge = {')
   .replace('    const aspect = fboW / fboH;',cameraOverride+'    const aspect = fboW / fboH;')
   .replace('gl.uniform1f(uWorld.time, time);',
     'gl.uniform1f(uWorld.time, window.__patrolSunwaterQA?.active && selectedMap.city ? 20.0 : time);');
}
function stats(bytes,facing){
 const im=PNG.sync.read(bytes),bins=new Set();
 let colored=0,n=0;for(let y=40;y<im.height;y+=5)for(let x=0;x<im.width;x+=5){
  const p=(y*im.width+x)*4;
  bins.add((im.data[p]>>4)*256+(im.data[p+1]>>4)*16+(im.data[p+2]>>4));
  colored+=Number(im.data[p]+im.data[p+1]+im.data[p+2]>90);n++;
 }
 // A physically valid midnight Moon view is dark; it cannot satisfy a
 // daytime "bright pixels" threshold, even while stars and moon are visible.
 const moonNight=facing==='moon',minBins=moonNight?25:55,
   minVisible=moonNight?.08:.35;
 ensure(im.width===1280&&im.height===720&&bins.size>minBins&&
   colored>n*minVisible,
   'Empty 3D WebGL canvas '+JSON.stringify({facing,bins:bins.size,colored,n}));
 return {width:im.width,height:im.height,colors:bins.size,
   visibleFraction:colored/n,sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function launch(mode,map='manhattan'){
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const errors=[],httpErrors=[],models=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',res=>{
   if(res.status()>=400)httpErrors.push(res.status()+' '+res.url());
   if(res.url().includes('cessna185-floats.glb'))models.push(res.status());
 });
  // These are TEST-ONLY one-term ablations, never shipped or color-tuning.
 const variants={
   baseline:[],
   noGGX:[['float glitter = min(ggx * facetSparkle, 18.0)',
           'float glitter = 0.0 * min(ggx * facetSparkle, 18.0)']],
   noSkyReflection:[['waterCol=mix(waterCol,reflectedSky,waterReflectance);',
                     'waterCol=mix(waterCol,reflectedSky,0.0);']],
   noCrest:[['waterCol+=vec3(0.025,0.24,0.18)*crest*back*sunAbove*clearSky*litFactor;',
             'waterCol+=vec3(0.025,0.24,0.18)*0.0*crest*back*sunAbove*clearSky*litFactor;']],
   flatNormal:[['vec3 wn = normalize(vec3(-slope.x, 1.0, -slope.y));',
                'vec3 wn = vec3(0.0,1.0,0.0);']]
 };
 if(!(mode in variants))throw Error('Unknown component probe '+mode);
 let src=prod;
 for(const [from,to] of variants[mode]){
   if(src.split(from).length!==2)throw Error('Missing unique optical probe: '+from);
   src=src.replace(from,to);
 }
 const html=instrument(src);
 await page.route('**/*',async route=>{
   const req=new URL(route.request().url());
   if(req.origin===origin&&(req.pathname==='/'||req.pathname==='/index.html'))
     await route.fulfill({status:200,body:html,contentType:'text/html; charset=utf-8',
       headers:{'cache-control':'no-store'}});
   else await route.continue();
 });
 try{
   const response=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:65000});
   ensure(response?.ok(),'PATROL launcher unreachable');
   const form=await page.evaluate(map=>{
     const set=(selector)=>{
       const el=document.querySelector(selector);
       if(!el)throw Error('Missing checkbox '+selector);
       el.checked=true;
       el.dispatchEvent(new Event('input',{bubbles:true}));
       el.dispatchEvent(new Event('change',{bubbles:true}));
     };
     set('input[name="flightMap"][value="'+map+'"]');
     set('input[name="aircraft"][value="seaplane"]');
     if(map==='manhattan')set('input[name="waterStart"]');
     const v=new FormData(document.getElementById('flightSetup'));
     return {map:v.get('flightMap'),aircraft:v.get('aircraft'),
       waterStart:v.has('waterStart'),waterStartEnabled:
         !document.getElementById('waterStart').disabled};
   },map);
   ensure(form.map===map&&form.aircraft==='seaplane','Map/plane mismatch '+JSON.stringify(form));
   if(map==='manhattan')ensure(form.waterStart&&form.waterStartEnabled,
     'C185 safe harbor launch not enabled');
   await page.locator('#startFlight').click({force:true});
   await page.waitForFunction(()=>document.getElementById('titleOverlay')?.hidden&&
     document.getElementById('loadOverlay')?.classList.contains('done')&&
     window.PatrolSpaceBridge?.getState()?.playing,
     null,{timeout:150000,polling:450});
   await page.evaluate(()=>{
     for(const [id,value] of [['skyTime','18.5'],['skySeason','1'],
       ['skyWeather','Clear'],['nyStreetQuality','2']]){
       const e=document.getElementById(id);
       if(!e)throw Error('Missing locked exposure/time control '+id);
       e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));
     }
   });
   const state=map==='manhattan'?
     await page.evaluate(()=>window.__patrolSunwaterQA.setup()):
     await page.evaluate(()=>({
       map:window.PatrolSpaceBridge.getState().map,
       contextLost:document.getElementById('glCanvas').getContext('webgl2').isContextLost()
     }));
   if(map==='manhattan'){
     ensure(state.waterborne && !state.crashed&&state.boatCount>0 &&
       state.boatsActive>0, 'C185/ship water contact failed '+JSON.stringify(state));
     ensure(state.shipCollision==='ship',
       'Real moving vessel collider not accessible '+JSON.stringify(state));
     ensure(!state.sphereActive,'Vegas Sphere Show leaked into NYC');
     ensure(models.includes(200),'Actual C185 model was not loaded');
   }
   if(map!=='manhattan')return {page,state,form,errors,httpErrors,models};
   const samples=[];
   for(const facing of ['sun','anti']){
     if(facing==='moon'){
       await page.evaluate(()=>{
         const e=document.getElementById('skyTime');
         e.value='0';e.dispatchEvent(new Event('change',{bubbles:true}));
       });
     }
     await page.evaluate(facing=>{window.__patrolSunwaterQA.facing=facing;},facing);
     await page.waitForFunction(facing=>{
       const v=window.__patrolSunwaterQA;
       return v&&v.facing===facing&&v.sun&&v.moon;
     },facing,{timeout:18000}).catch(()=>{});
     await page.waitForTimeout(800);
     const snap=await page.evaluate(()=>window.__patrolSunwaterQA.read());
     ensure(!snap.contextLost&&snap.webglError===0 && snap.sphereActive===false &&
       snap.sameEye.every((n,i)=>Math.abs(n-snap.eye[i])<.001),
       'Invalid WebGL/precise-camera '+JSON.stringify(snap));
     if(facing!=='moon')ensure(snap.sunClock==='18.5'&&snap.skyWeather==='Clear'&&snap.skySeason==='1',
       'Sun/anti setting drift');
     await page.addStyleTag({content:'body.patrol-water-qa *{visibility:hidden!important} '+
       'body.patrol-water-qa #glCanvas{visibility:visible!important}'});
     await page.evaluate(()=>document.body.classList.add('patrol-water-qa'));
     let bytes;
     try{
       bytes=await page.locator('#glCanvas').screenshot({path:dir+'/'+mode+'-'+facing+'.png',
         timeout:90000,animations:'disabled'});
     }finally{await page.evaluate(()=>document.body.classList.remove('patrol-water-qa'))}
     samples.push({facing,snap,shot:stats(bytes,facing)});
   }
   const raf=await page.evaluate(async()=>{
     const d=[];let prev=performance.now();
     for(let i=0;i<18;i++){
       await new Promise(resolve=>requestAnimationFrame(resolve));
       const now=performance.now();
       if(i>2)d.push(now-prev);prev=now;
     }
     d.sort((a,b)=>a-b);
     return {samples:d.length,p50Ms:d[Math.floor(.50*d.length)],
       p95Ms:d[Math.floor(.95*d.length)]};
   });
   ensure(errors.length===0,'Browser JS errors '+errors.join(';'));
   ensure(httpErrors.filter(x=>/404/.test(x)&&/\.glb/.test(x)).length===0,
     'Required GLB not found '+httpErrors);
   return {page,state,form,samples,raf,errors,httpErrors,models};
 }catch(e){await page.close();throw e}
}
try{
 for(const mode of ['baseline','noGGX','noSkyReflection','noCrest','flatNormal']){
   const scene=await launch(mode,'manhattan');
   report.scenes.push({mode,form:scene.form,initial:scene.state,
     views:scene.samples,raf:scene.raf,models:scene.models,
     httpErrors:scene.httpErrors,errors:scene.errors});
   await scene.page.close();
 }

 const baseline=report.scenes[0];
 for(const scene of report.scenes){
   for(const facing of ['sun','anti']){
     const a=baseline.views.find(x=>x.facing===facing).snap;
     const b=scene.views.find(x=>x.facing===facing).snap;
     ensure(a.sameEye.every((x,i)=>Math.abs(x-b.sameEye[i])<1e-5),
       'Camera height/position differs for '+scene.mode+'/'+facing);
     ensure(a.rendererWidth===b.rendererWidth&&
       a.rendererHeight===b.rendererHeight,
       'Adaptive resolution changed between optical probes '+scene.mode+'/'+facing);
     ensure(Math.abs(a.sun[0]-b.sun[0])<1e-4 &&
       Math.abs(a.sun[1]-b.sun[1])<1e-4,
       'Sun vector differs for '+scene.mode+'/'+facing);
     ensure(b.boatCount===4&&b.waterborne&&!b.sphereActive&&b.webglError===0,
       'Wrong game scene during optical probe '+scene.mode+'/'+facing);
   }
 }
  report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}
finally{
 await writeFile(dir+'/report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 await browser.close();
}
