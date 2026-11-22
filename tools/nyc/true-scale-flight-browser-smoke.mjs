/** Real Chromium WebGL2 proof: source-metre camera can fly through actual
 * NYC DCM street centerlines while respecting municipal polygon occupancy.
 * Not a claim of real facades/roadbeds or aircraft flight physics.
 */
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
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
    getFlight:undefined,setFlight:undefined,resetFlight:undefined,
    pedestrianVisible:undefined,setPedestrian:undefined
  }));
  if(!info.ready||info.error||info.sourceBuildings<110||info.sourceRoads<25||
     !info.officialRoadbed2022||info.officialRoadbed2022.features<70||
     info.officialRoadbed2022.triangles<7000||!info.noInventedStreetSurface||
     !info.officialPedestrian2022||
     info.officialPedestrian2022.plazas<5||
     info.officialPedestrian2022.sidewalks<40||
     info.officialPedestrian2022.curb<150||
     info.officialPedestrian2022.curbCuts<150||
     !info.officialPedestrian2022.noSurveyedVerticalDatum||
     !info.officialPedestrian2022.sidewalkDisplayMask?.visualOnly||
     !info.officialPedestrian2022.sidewalkDisplayMask?.originalSourceIntact||
     info.officialPedestrian2022.sidewalkDisplayMask?.maskedSquareMetres<=0||
     info.officialPedestrian2022.sidewalkDisplayMask?.postMaskBuildingOverlapSquareMetres>1e-6||
     !info.sourceRoadSpawn||!Number.isFinite(info.sourceRoadSpawn.position[0])||
     !info.streetWidthEnvelopes||
     info.streetWidthEnvelopes.derivedWidthFeatures<20||
     info.streetWidthEnvelopes.missingWidthRecords<8||
     info.streetWidthEnvelopes.triangles<30||
     !/metres/.test(info.projection))throw Error('Invalid official-source view '+JSON.stringify(info));
  const shot=async name=>{
    await page.waitForTimeout(400);
    const image=await page.locator('#scene').screenshot({
      path:'artifacts/nyc-true-scale/'+name+'.png',
      timeout:90000,animations:'allow'});
    shots.push(name);
    return createHash('sha256').update(image).digest('hex');
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
  // Same browser + camera A/B. A source surface must visibly change pixels.
  // No second independent scene load, no randomization/noise confound.
  await page.click('#pedestrianToggle');
  if(await page.evaluate(()=>window.geoPilotQA.pedestrianVisible()))
    throw Error('Official pedestrian source overlay failed to turn OFF');
  const offHash=await shot('04-aerial-pedestrian-hidden');
  await page.click('#pedestrianToggle');
  if(!(await page.evaluate(()=>window.geoPilotQA.pedestrianVisible())))
    throw Error('Official pedestrian source overlay failed to turn ON');
  const onHash=await shot('05-aerial-pedestrian-visible');
  if(offHash===onHash)throw Error('True pedestrian surfaces invisible in fixed-camera A/B');
  const browserInfo=await page.evaluate(()=>{
    const c=document.getElementById('scene'),gl=c.getContext('webgl2');
    return {webgl:!!gl&&!gl.isContextLost(),error:gl.getError(),canvas:[c.width,c.height]};
  });
  if(!browserInfo.webgl||browserInfo.error||warnings.length||errors.length)
    throw Error('WebGL/console failure '+JSON.stringify({browserInfo,warnings,errors}));
  report.passed=true;
  Object.assign(report,{sourceBuildings:info.sourceBuildings,sourceRoads:info.sourceRoads,
    spawn:info.sourceRoadSpawn,initial,climbed,moved,displacement,browserInfo,shots,errors,warnings,
    officialRoadbed2022:info.officialRoadbed2022,
    officialPedestrian2022:info.officialPedestrian2022,
    sidewalkDisplayMask:info.officialPedestrian2022.sidewalkDisplayMask,
    fixedCameraPedestrianAB:{offSha256:offHash,onSha256:onHash,different:offHash!==onHash},
    caveat:'Actual OTI 2022 flat roadbed/plaza/sidewalk/curb survey-outline sources + FID roof masses + DCM centerlines; no verified 2026 curb heights, lane access, facades, terrain, DOT traffic or aircraft physics'});
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
