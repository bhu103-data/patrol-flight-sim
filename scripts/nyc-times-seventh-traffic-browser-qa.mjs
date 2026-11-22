// NYC 7th Av / W 44 St source-exact Chrome WebGL2 signal + car QA.
// Test-only page response injection, no production runtime mutation.
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/nyc-times-seventh-qa';
await mkdir(out,{recursive:true});
const errors=[],screenshots=[];
const result={passed:false,errors,screenshots,head:'W 44 St / 7 Av (game space)',renderer:'unverified'};
const check=(v,s)=>{if(!v)throw Error(s);};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('requestfailed',r=>{
 if(r.url().startsWith(base))errors.push('request: '+r.url());
});
try{
 await page.route('**/index.html',async route=>{
  const response=await route.fetch(),html=await response.text();
  const traffic='  function prepareCityTraffic() {';
  const loop='    sceneryTime += Math.min(rawDt, 0.12);';
  const camera='  function getScenicCamera() {';
  for(const hook of [traffic,loop,camera])
    check(html.split(hook).length===2,'missing production probe: '+hook);
  const injection=[
   '  window.__patrolTimesQaSetTime=t=>{',
   '    window.__patrolTimesQaHoldTime=t;',
   '    sceneryTime=t;',
   '  };',
   '  window.__patrolTimesQaState=()=>{',
   '    const gl=document.getElementById("glCanvas")?.getContext("webgl2");',
   '    const group=cityTraffic.filter(x=>x.timesSeventh);',
   '    const probe=group.length?',
   '      {route:group[0].route,pace:6,offset:NYC_TIMES_SEVENTH.stopDistance}:null;',
   '    const lamp=timesSeventhSignalPhase(sceneryTime);',
   '    const mesh=nycTimesSignalMeshes?.[lamp.vehicle+"-"+lamp.pedestrian];',
   '    return {city:!!selectedMap.city,renderer:gl?.getParameter(gl.RENDERER),',
   '      webgl2:!!gl&&!gl.isContextLost(),glError:gl?.getError(),',
   '      canvas:[glCanvas.width,glCanvas.height],',
   '      phase:lamp,vehicleCount:group.length,',
   '      variants:Object.keys(nycTimesSignalMeshes||{}),',
   '      activeSignalTriangles:mesh?.count||0,',
   '      proofDistance:probe?timesSeventhControlledDistance(probe,sceneryTime):null,',
   '      carSamples:group.slice(0,3).map(x=>trafficPose(x,sceneryTime))};',
   '  };',
   traffic
  ].join('\n');
  const clock=loop+'\n    if(Number.isFinite(window.__patrolTimesQaHoldTime))sceneryTime=window.__patrolTimesQaHoldTime;';
  const scenic=camera+'\n    if(window.__patrolTimesQaCamera) return {'+
    'eye:[14,22.7,23],look:[10,19.4,6.45],up:worldUp,fov:44};';
  const instrumented=html.replace(traffic,injection)
    .replace(loop,clock).replace(camera,scenic);
  await route.fulfill({response,body:instrumented});
 });
 const response=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 check(response?.ok(),'Game launcher did not respond');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 await page.waitForFunction(()=>{
  const title=document.getElementById('titleOverlay');
  const load=document.getElementById('loadOverlay');
  return title?.hidden&&load?.classList.contains('done');
 },null,{timeout:150000});
 await page.waitForFunction(()=>window.__patrolTimesQaState?.().variants.length===5,
   null,{timeout:120000});
 await page.evaluate(()=>{
  for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
   const el=document.getElementById(id);
   if(!el)throw Error('Missing env control '+id);
   el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
  }
 });
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
  null,{timeout:15000});
 await page.locator('#hotelTarget').selectOption({label:'Times Square Street Level'});
 await page.evaluate(()=>{window.__patrolTimesQaCamera=true;});
 result.frames=[];
 for(const [name,time,vehicle,pedestrian] of [
  ['01-red-pedestrian-lead.png',2,'red','walk'],
  ['02-green-walk.png',10,'green','walk'],
  ['03-amber-hand.png',42,'amber','hand'],
  ['04-red-hand.png',60,'red','hand']
 ]){
   await page.evaluate(t=>window.__patrolTimesQaSetTime(t),time);
   await page.evaluate(()=>new Promise(resolve=>
     requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const state=await page.evaluate(()=>window.__patrolTimesQaState());
   check(state.city&&state.webgl2&&state.glError===0&&
    state.vehicleCount===18&&state.activeSignalTriangles>0&&
    state.variants.length===5&&state.phase.vehicle===vehicle&&
    state.phase.pedestrian===pedestrian&&
    Math.abs(state.phase.phaseSeconds-time)<1e-8,
     'Live NYC traffic signal head missing or contradictory '+JSON.stringify({name,state}));
   check(state.carSamples.every(v=>[v.x,v.y,v.z,v.yaw].every(Number.isFinite)),
     'Non-finite NYC lane actors');
   if(time===2)check(Math.abs(state.proofDistance-47.8)<1e-6,
     'Leading pedestrian signal did not stop vehicle');
   if(time===10)check(state.proofDistance>47.8+1,
     'Vehicle did not resume on green');
   if(time===42)check(state.phase.rightOnRed===false,
     'NYC default prohibition missing');
   const shot=await page.locator('#glCanvas').screenshot({
     path:out+'/'+name,timeout:90000,animations:'allow'
   });
   check(shot.length>5000,'Blank traffic signal screenshot '+name);
   screenshots.push({name,bytes:shot.length});
   result.frames.push({name,time,state});
 }
 check(errors.length===0,errors.join('; '));
 result.renderer='ANGLE SwiftShader / software WebGL2';
 result.passed=true;
}catch(error){
 errors.push(error.stack||String(error));
 process.exitCode=1;
}finally{
 await writeFile(out+'/times-seventh-traffic-report.json',JSON.stringify(result,null,2));
 console.log('[PATROL NYC TIMES 7AV QA]',JSON.stringify(result,null,2));
 await browser.close();
}
