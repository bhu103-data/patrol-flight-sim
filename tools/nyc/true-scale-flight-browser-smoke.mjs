/** Real Chromium WebGL2 proof: source-metre camera can fly through actual
 * NYC DCM street centerlines while respecting municipal polygon occupancy.
 * Not a claim of real facades/roadbeds or aircraft flight physics.
 */
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
const errors=[],warnings=[],shots=[],report={passed:false};
let page;
try{
  page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')warnings.push(e.text());});
  const loaded=await page.goto('http://127.0.0.1:8765/preview.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(!loaded?.ok())throw Error('Official-source flight HTML did not load');
  await page.waitForFunction(()=>window.geoPilotQA?.ready||window.geoPilotQA?.error,
    null,{timeout:90000});
  const info=await page.evaluate(()=>({
    ...window.geoPilotQA,
    getFlight:undefined,setFlight:undefined,resetFlight:undefined
  }));
  if(!info.ready||info.error||info.sourceBuildings<110||info.sourceRoads<25||
     !info.sourceRoadSpawn||!Number.isFinite(info.sourceRoadSpawn.position[0])||
     !/metres/.test(info.projection))throw Error('Invalid official-source view '+JSON.stringify(info));
  const shot=async name=>{
    await page.waitForTimeout(400);
    await page.locator('#scene').screenshot({path:'artifacts/nyc-true-scale/'+name+'.png',
      timeout:90000,animations:'allow'});
    shots.push(name);
  };
  await shot('01-metric-aerial');
  await page.click('#toggleFlight');
  const initial=await page.evaluate(()=>window.geoPilotQA.getFlight());
  if(!initial.mode||initial.collision||initial.position[1]!==8)
    throw Error('Invalid source street spawn '+JSON.stringify(initial));
  await shot('02-official-road-low-flight');
  // Hold the real E ascent key, not QA-state mutation, so browser input,
  // physics update and source-derived collision path all run in the loop.
  await page.keyboard.down('e');
  try{
    await page.waitForFunction(y=>window.geoPilotQA.getFlight().position[1]>y,
      initial.position[1]+.5,{timeout:45000,polling:200});
  }finally{await page.keyboard.up('e');}
  const climbed=await page.evaluate(()=>window.geoPilotQA.getFlight());
  if(climbed.collision||climbed.position[1]<=initial.position[1]+.5)
    throw Error('Metric camera did not climb away from source road');
  await page.keyboard.down('w');
  try{
    await page.waitForTimeout(1700);
  }finally{await page.keyboard.up('w');}
  const moved=await page.evaluate(()=>window.geoPilotQA.getFlight());
  if(moved.collision||moved.position.some(v=>!Number.isFinite(v)))
    throw Error('Camera inside city building footprint after sweep '+JSON.stringify(moved));
  const displacement=Math.hypot(moved.position[0]-climbed.position[0],
    moved.position[2]-climbed.position[2]);
  if(displacement<.30)throw Error('Metric view camera did not translate along source road');
  await shot('03-source-road-low-fly-moved');
  await page.click('#toggleFlight');
  if((await page.evaluate(()=>window.geoPilotQA.getFlight())).mode)
    throw Error('Failed to restore aerial reference camera');
  const browserInfo=await page.evaluate(()=>{
    const c=document.getElementById('scene'),gl=c.getContext('webgl2');
    return {webgl:!!gl&&!gl.isContextLost(),error:gl.getError(),canvas:[c.width,c.height]};
  });
  if(!browserInfo.webgl||browserInfo.error||warnings.length||errors.length)
    throw Error('WebGL/console failure '+JSON.stringify({browserInfo,warnings,errors}));
  report.passed=true;
  Object.assign(report,{sourceBuildings:info.sourceBuildings,sourceRoads:info.sourceRoads,
    spawn:info.sourceRoadSpawn,initial,climbed,moved,displacement,browserInfo,shots,errors,warnings,
    caveat:'Actual FID roof masses + DCM centerlines, but no surveyed street roadbed/facades/terrain'});
}catch(e){
  report.error=e.stack||String(e);
  report.errors=errors;report.warnings=warnings;report.shots=shots;
  if(page)try{await page.screenshot({
    path:'artifacts/nyc-true-scale/FAILED-flight.png'});}catch{}
}finally{
  writeFileSync('artifacts/nyc-true-scale/flight-browser-report.json',
    JSON.stringify(report,null,2));
  await browser.close();
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(!report.passed)process.exitCode=1;
