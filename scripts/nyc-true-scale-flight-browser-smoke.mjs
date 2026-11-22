// QA: native WebGL2 1:1 Times Square flythrough, official DCM geometry
// and actual PATROL map launcher. SwiftShader certifies rendering logic,
// NOT native GPU frame rates or photographic/surveyed fidelity.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,''),
  out='artifacts/nyc-true-scale-flight';
await mkdir(out,{recursive:true});
const report={passed:false,errors:[],source:'NYC OTI + NYC DCM',quality:'SwiftShader WebGL2'};
const check=(cond,msg)=>{if(!cond)throw Error(msg)};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('JS '+e.message));
  page.on('response',response=>{
    if(response.status()>=400)report.errors.push('HTTP '+response.status()+' '+response.url());
  });
  const landing=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  check(landing?.ok(),'PATROL launcher HTTP failure');
  await page.locator('input[name="flightMap"][value="manhattanReality"]').check({force:true});
  await page.locator('#startFlight').click({force:true});
  await page.waitForURL(/assets\/nyc\/nyc-true-scale-flight\.html/,{timeout:20000});
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.ready&&
    window.PatrolMetricFlightQA.frames>12,null,{timeout:60000});
  report.initial=await page.evaluate(()=>({
    ...window.PatrolMetricFlightQA,
    glVersion:document.querySelector('#scene')?.getContext('webgl2')?.getParameter(
      document.querySelector('#scene')?.getContext('webgl2')?.VERSION)
  }));
  check(report.initial.buildings===undefined ? report.initial.sourceBuildingCount>=115 :
    report.initial.buildings>=115,'Missing real building massing');
  check(report.initial.sourceStreetCount>=35,'DCM street lines not displayed');
  check(report.initial.streetSegments>=80,'Official source geometry incomplete');
  check(report.initial.metresPerWorldUnit===1,'Wrong scene geographic scale');
  check(report.initial.spawnFromOfficialStreet===true,
    'Free-flight spawn is not on an accepted official Seventh Avenue centerline');
  check(report.initial.windowVisuals>100,'No bounded facade detail');
  check(report.initial.glError===0,'WebGL2 error after first rendered frames');
  const initial=await page.locator('#scene').screenshot({
    path:out+'/01-true-scale-flythrough.png',timeout:90000});
  const png=PNG.sync.read(initial);
  let pixels=0;
  for(let y=45;y<png.height;y+=4)for(let x=0;x<png.width;x+=4){
    const i=(y*png.width+x)*4;
    if(png.data[i]>65&&png.data[i+1]>70&&png.data[i+2]>75)pixels++;
  }
  report.visibleSamples=pixels;
  check(pixels>1000,'New NYC scene is blank or black');
  await page.keyboard.down('w');
  await page.waitForTimeout(900);
  await page.keyboard.up('w');
  await page.waitForTimeout(200);
  report.afterFlight=await page.evaluate(()=>({
    frames:window.PatrolMetricFlightQA.frames,
    camera:window.PatrolMetricFlightQA.camera,
    glError:window.PatrolMetricFlightQA.glError,
    errors:window.PatrolMetricFlightQA.errors
  }));
  check(report.afterFlight.frames>report.initial.frames+10,'Animation loop not advancing');
  check(report.afterFlight.glError===0,'GL error after movement');
  check(report.afterFlight.errors.length===0,
    'Invalid flight state: '+report.afterFlight.errors.join('; '));
  const before=report.initial.camera,after=report.afterFlight.camera;
  const moved=Math.hypot(...before.map((v,i)=>after[i]-v));
  report.flightMetres=moved;
  check(moved>4&&moved<70,'Flight camera did not move plausibly: '+moved);
  const afterPng=await page.locator('#scene').screenshot({
    path:out+'/02-after-flythrough.png',timeout:90000});
  report.initialSHA256=createHash('sha256').update(initial).digest('hex');
  report.afterSHA256=createHash('sha256').update(afterPng).digest('hex');
  check(report.initialSHA256!==report.afterSHA256,
    'Movement did not result in different scene pixels');
  // Low-detail mode must still retain source buildings and DCM street paths.
  await page.goto(base+'/assets/nyc/nyc-true-scale-flight.html?quality=low',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.ready&&
    window.PatrolMetricFlightQA.frames>2,null,{timeout:60000});
  report.fallback=await page.evaluate(()=>window.PatrolMetricFlightQA);
  check(report.fallback.windowVisuals===0,'Low detail still generates window geometry');
  check(report.fallback.sourceStreetCount===report.initial.sourceStreetCount,
    'Fallback lost official centerlines');
  check(report.fallback.sourceBuildingCount===report.initial.sourceBuildingCount,
    'Fallback lost surveyed footprints');
  // Source-registered eye-height evidence: two UNEDITED canvas PNGs
  // with full physical camera records for later official street QA.
  await page.goto(base+'/assets/nyc/nyc-true-scale-flight.html?qaEyeLevel=1',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.ready&&
    window.PatrolMetricFlightQA?.cameraRegistration?.frame>=4,
    null,{timeout:60000});
  const capture=async name=>{
    const record=await page.evaluate(()=>({
      ...window.PatrolMetricFlightQA.cameraRegistration,
      evidenceMode:window.PatrolMetricFlightQA.evidenceMode,
      glError:window.PatrolMetricFlightQA.glError,
      errors:[...window.PatrolMetricFlightQA.errors]
    }));
    check(record.schema==='patrol-nyc-metric-camera-v1'&&
      record.evidenceMode==='source-centreline-eye-height',
      'Camera register missing from actual eye-level scene');
    check(record.originWGS84LonLat.length===2&&
      record.eyeENUmeters.length===3&&record.eyeWGS84LonLat.length===2,
      'Incomplete georeferenced camera pose');
    check(record.originAltitudeMeters===null&&
      record.eyeAbsoluteAltitudeMeters===null&&record.verticalDatum==='unknown',
      'Unknown vertical datum was silently invented');
    check(record.eyeENUmeters[2]===1.8,'Eye height is not 1.8m local');
    check(record.sourceBuildingFids.length>=118,
      'No official building FIDs in camera registration');
    check(record.viewportPixels.join(',')==='1280,720',
      'Unmatched browser render viewport');
    check(record.glError===0&&record.errors.length===0,
      'Eye-level WebGL2 context error');
    const png=await page.locator('#scene').screenshot({
      path:out+'/'+name,timeout:90000});
    return {image:name,sha256:createHash('sha256').update(png).digest('hex'),
      capturedUTC:new Date().toISOString(),record};
  };
  const registered1=await capture('03-registered-eye-height.png');
  await page.waitForTimeout(180);
  const registered2=await capture('04-registered-eye-height-repeat.png');
  const normalized=r=>JSON.stringify({
    position:r.eyeENUmeters,lonlat:r.eyeWGS84LonLat,
    yaw:r.yawRadians,pitch:r.pitchRadians,fov:r.verticalFovRadians,
    viewport:r.viewportPixels,sourceFids:r.sourceBuildingFids,
    quality:r.quality,lighting:r.lighting
  });
  check(normalized(registered1.record)===normalized(registered2.record),
    'Registered evidence camera drifted between live PNG captures');
  report.registeredEvidence=[registered1,registered2];
  check(report.errors.length===0,'Browser errors '+report.errors.join('; '));
  report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}
finally{
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
