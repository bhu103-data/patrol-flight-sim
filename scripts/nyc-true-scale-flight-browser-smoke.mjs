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
  check(report.initial.coreRoadbedGeometryVerified===true&&
    report.initial.officialRoadbedPolygons===11&&
    report.initial.officialRoadbedIntersections===3&&
    report.initial.officialRoadbedTriangles===207&&
    report.initial.roadbedReferenceYear===2022,
    'Official OTI 2022 source polygons missing from 1:1 flythrough');
  check(report.initial.trueRoadbedVerified===false,
    '11 central roadbed polygons are NOT a full city roadbed verification');
  check(report.initial.spawnFromOfficialStreet===true,
    'Free-flight spawn is not on an accepted official Seventh Avenue centerline');
  check(report.initial.safeStreetCandidateCount>=1,
    'No clearance-checked source street spawn candidates');
  check(report.initial.streetClearanceRadiusMetres===1.2,
    'Missing 1.2m official building footprint clearance');
  check(report.initial.streetEyeMetres===3.2&&
    Math.abs(report.initial.camera[1]-3.2)<.001,
    'Labelled street view must use 3.2m eye height, not 65m: '+
      JSON.stringify(report.initial.camera));
  check(report.initial.windowVisuals>100,'No bounded facade detail');
  check(report.initial.glError===0,'WebGL2 error after first rendered frames');
  check(report.initial.historical2014ModelImported===true&&
    report.initial.historical2014SourceYear===2014&&
    report.initial.historical2014RoofTriangles===1974&&
    report.initial.historical2014FacadeTriangles===540&&
    report.initial.historical2014RoofFids===33&&
    report.initial.historical2014FacadeFids===30,
    'Original 2014 DCP MN05 roof/facade mesh import counts or source year mismatch');
  check(report.initial.historical2014CollisionEnabled===false&&
    report.initial.historical2014VerticalDatumVerified===false&&
    report.initial.historical2014SourceRhinoSha256===
      'b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57',
    'Historical model was incorrectly promoted to collision or absolute elevation');
  check(report.initial.trueFacadeVerified===false,
    'A bounded historical facade subset must not be called complete facade verification');
  const initial=await page.locator('#scene').screenshot({
    path:out+'/01-true-scale-flythrough.png',timeout:90000});
  const initialCapturedUTC=new Date().toISOString();
  const focusOnPage=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const focusOffPage=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  focusOnPage.on('pageerror',e=>report.errors.push('historical-focus-on JS '+e.message));
  focusOffPage.on('pageerror',e=>report.errors.push('historical-focus-off JS '+e.message));
  await focusOnPage.goto(base+'/assets/nyc/nyc-true-scale-flight.html?focus2014=212747',
    {waitUntil:'domcontentloaded',timeout:60000});
  await focusOffPage.goto(base+'/assets/nyc/nyc-true-scale-flight.html?focus2014=212747&historical=off',
    {waitUntil:'domcontentloaded',timeout:60000});
  await Promise.all([focusOnPage,focusOffPage].map(p=>p.waitForFunction(()=>
    window.PatrolMetricFlightQA?.ready&&window.PatrolMetricFlightQA.frames>12,
    null,{timeout:60000})));
  const onCamera=await focusOnPage.evaluate(()=>window.PatrolMetricFlightQA.cameraRegistration);
  const offCamera=await focusOffPage.evaluate(()=>window.PatrolMetricFlightQA.cameraRegistration);
  const cameraPositionError=Math.hypot(...onCamera.eyeENUmeters.map(
    (v,i)=>v-offCamera.eyeENUmeters[i]));
  const cameraAngleError=Math.max(
    Math.abs(onCamera.yawRadians-offCamera.yawRadians),
    Math.abs(onCamera.pitchRadians-offCamera.pitchRadians));
  const onPngData=await focusOnPage.evaluate(()=>
    document.querySelector('#scene').toDataURL('image/png').split(',')[1]);
  const offPngData=await focusOffPage.evaluate(()=>
    document.querySelector('#scene').toDataURL('image/png').split(',')[1]);
  await writeFile(out+'/03-2014-matched-building-model-on.png',Buffer.from(onPngData,'base64'));
  await writeFile(out+'/04-2014-matched-building-model-off.png',Buffer.from(offPngData,'base64'));
  const meshOnPng=PNG.sync.read(Buffer.from(onPngData,'base64'));
  const meshOffPng=PNG.sync.read(Buffer.from(offPngData,'base64'));
  check(meshOnPng.width===meshOffPng.width&&meshOnPng.height===meshOffPng.height,
    '2014 mesh A/B canvas frames do not share the same viewport');
  check(cameraPositionError<1e-6&&cameraAngleError<1e-9&&
    onCamera.viewportPixels.join(',')===offCamera.viewportPixels.join(','),
    'Historical model ON/OFF captures did not use the exact same camera pose');
  let historicalChangedPixels=0;
  for(let i=0;i<meshOnPng.data.length;i+=4){
    const delta=(Math.abs(meshOnPng.data[i]-meshOffPng.data[i])+
      Math.abs(meshOnPng.data[i+1]-meshOffPng.data[i+1])+
      Math.abs(meshOnPng.data[i+2]-meshOffPng.data[i+2]))/3;
    if(delta>6)historicalChangedPixels++;
  }
  report.historical2014VisualAB={
    focusFID:212747,onTriangles:await focusOnPage.evaluate(()=>window.PatrolMetricFlightQA.triangles),
    offTriangles:await focusOffPage.evaluate(()=>window.PatrolMetricFlightQA.triangles),
    onRoofTriangles:await focusOnPage.evaluate(()=>window.PatrolMetricFlightQA.historical2014RoofTriangles),
    onFacadeTriangles:await focusOnPage.evaluate(()=>window.PatrolMetricFlightQA.historical2014FacadeTriangles),
    changedCanvasPixelsOver6:historicalChangedPixels,
    sameCanvasViewport:true,cameraPositionErrorMetres:cameraPositionError,
    cameraAngleErrorRadians:cameraAngleError,
    offModelImported:await focusOffPage.evaluate(()=>
      window.PatrolMetricFlightQA.historical2014ModelImported)
  };
  check(report.historical2014VisualAB.offModelImported===false&&
    report.historical2014VisualAB.onRoofTriangles===1974&&
    report.historical2014VisualAB.onFacadeTriangles===540&&
    historicalChangedPixels>=100,
    'Imported 2014 geometry is not visible in the same-camera canvas-only WebGL2 A/B');
  await Promise.all([focusOnPage.close(),focusOffPage.close()]);
  const png=PNG.sync.read(initial);
  let pixels=0;
  for(let y=45;y<png.height;y+=4)for(let x=0;x<png.width;x+=4){
    const i=(y*png.width+x)*4;
    if(png.data[i]>65&&png.data[i+1]>70&&png.data[i+2]>75)pixels++;
  }
  const camera1=report.initial.cameraRegistration;
  check(camera1?.schema==='patrol-nyc-metric-camera-v1',
    'No georeferenced camera evidence in real WebGL scene');
  check(camera1.eyeENUmeters?.[2]===3.2&&
    report.initial.streetEyeMetres===3.2&&
    report.initial.streetClearanceRadiusMetres===1.2,
    'Registered street camera missing 3.2m eye height / 1.2m clearance');
  check(camera1.originAltitudeMeters===null&&
    camera1.eyeAbsoluteAltitudeMeters===null&&
    camera1.verticalDatum==='unknown',
    'Unknown vertical datum was silently fabricated');
  check(camera1.sourceBuildingFids.length>=118&&
    camera1.viewportPixels.join(',')==='1280,720'&&
    camera1.sourceStreetFeatures>=35,
    'Camera source FIDs, street records or viewport incomplete');
  check(camera1.eyeWGS84LonLat?.length===2&&
    camera1.eyeWGS84LonLat.every(Number.isFinite),
    'Registered camera has no finite WGS84 horizontal position');
  await page.waitForTimeout(180);
  const camera2=await page.evaluate(()=>({
    ...window.PatrolMetricFlightQA.cameraRegistration,
    webglError:window.PatrolMetricFlightQA.glError,
    errors:[...window.PatrolMetricFlightQA.errors]
  }));
  check(camera2.webglError===0&&camera2.errors.length===0,
    'Registered street-level camera WebGL2 error');
  const fingerprint=v=>JSON.stringify({
    origin:v.originWGS84LonLat,eye:v.eyeENUmeters,lonlat:v.eyeWGS84LonLat,
    yaw:v.yawRadians,pitch:v.pitchRadians,fov:v.verticalFovRadians,
    viewport:v.viewportPixels,fids:v.sourceBuildingFids,
    streets:v.sourceStreetFeatures,quality:v.quality,lighting:v.lighting
  });
  check(fingerprint(camera1)===fingerprint(camera2),
    'Registration drift between same-pose camera samples');
  const repeated=await page.locator('#scene').screenshot({
    path:out+'/01b-registered-street-eye-repeat.png',timeout:90000});
  const repeatedCapturedUTC=new Date().toISOString();
  check(Date.parse(repeatedCapturedUTC)>Date.parse(initialCapturedUTC),
    'Real screenshot timestamps did not advance between captures');
  report.registeredEvidence=[
    {image:'01-true-scale-flythrough.png',
      sha256:createHash('sha256').update(initial).digest('hex'),
      capturedUTC:initialCapturedUTC,record:camera1},
    {image:'01b-registered-street-eye-repeat.png',
      sha256:createHash('sha256').update(repeated).digest('hex'),
      capturedUTC:repeatedCapturedUTC,record:camera2}
  ];
  await page.locator('#aerial').click();
  await page.waitForTimeout(350);
  const sourceAerial=await page.locator('#scene').screenshot({
    path:out+'/03-2022-source-roadbed-aerial.png',timeout:90000
  });
  await page.locator('#roadbedFocus').click();
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.camera?.[1]===70,
    null,{timeout:45000});
  const sourceCore=await page.locator('#scene').screenshot({
    path:out+'/05-source-roadbed-FID24700-core.png',timeout:90000
  });
  report.sourceCoreCamera=await page.evaluate(()=>window.PatrolMetricFlightQA.camera);
  check(report.initial.roadbedFocusFID===24700,
    'Source roadbed intersection camera is not tied to official FID 24700');
  await page.locator('#reset').click();
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
  check(Math.abs(after[1]-3.2)<.01,
    'Horizontal W flight unexpectedly changed the 3.2m street eye height');
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
  check(report.fallback.streetEyeMetres===3.2&&
    Math.abs(report.fallback.camera?.[1]-3.2)<.001,
    'Low graphics mode lost source-street eye height');
  check(report.fallback.sourceStreetCount===report.initial.sourceStreetCount,
    'Fallback lost official centerlines');
  check(report.fallback.sourceBuildingCount===report.initial.sourceBuildingCount,
    'Fallback lost surveyed footprints');
  check(report.fallback.officialRoadbedPolygons===11,
    'Quality fallback must retain official roadbed shape');
  // Controlled on/off comparison: same camera, same FOV, source-given
  // building/centreline geometry, only 11 actual 2022 roadbed polygons differ.
  await page.goto(base+'/assets/nyc/nyc-true-scale-flight.html?roadbed=off',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.ready&&
    window.PatrolMetricFlightQA.frames>12,null,{timeout:60000});
  report.sourceOff=await page.evaluate(()=>window.PatrolMetricFlightQA);
  check(report.sourceOff.officialRoadbedPolygons===0&&
    report.sourceOff.coreRoadbedGeometryVerified===false,
    'Source polygon A/B-off view still using new official geometry');
  check(report.sourceOff.sourceBuildingCount===report.initial.sourceBuildingCount&&
    report.sourceOff.streetSegments===report.initial.streetSegments,
    'Source roadbed A/B switch accidentally changed buildings or DCM routing');
  await page.locator('#aerial').click();
  await page.waitForTimeout(350);
  const sourceOffAerial=await page.locator('#scene').screenshot({
    path:out+'/04-old-invented-roadbands-aerial.png',timeout:90000
  });
  await page.locator('#roadbedFocus').click();
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.camera?.[1]===70,
    null,{timeout:45000});
  const sourceOffCore=await page.locator('#scene').screenshot({
    path:out+'/06-old-roadbands-FID24700-core.png',timeout:90000
  });
  report.sourceOffCoreCamera=await page.evaluate(()=>window.PatrolMetricFlightQA.camera);
  check(report.sourceCoreCamera.every((v,i)=>
    Math.abs(v-report.sourceOffCoreCamera[i])<1e-8),
    'Core intersection on/off camera differs: '+JSON.stringify({
      source:report.sourceCoreCamera,baseline:report.sourceOffCoreCamera
    }));
  const a=PNG.sync.read(sourceAerial),b=PNG.sync.read(sourceOffAerial);
  check(a.width===b.width&&a.height===b.height,
    'A/B screenshot framebuffer sizes differ');
  let changed=0;
  for(let y=230;y<a.height;y+=2)for(let x=2;x<a.width;x+=2){
    const i=(y*a.width+x)*4;
    if(Math.max(...[0,1,2].map(j=>Math.abs(a.data[i+j]-b.data[i+j])))>18)
      changed++;
  }
  report.aerialRoadbedDifferencePixelsOver18=changed;
  report.aerialComparisonResolution=[a.width,a.height];
  report.aerialComparisonNote='Identical fixed source/old aerial pose with sky/HUD excluded; pixel-difference is geometry-localization QA, not photoreal score';
  check(changed>80,'Official roadbed aerial not distinguishable from old bands: '+changed);
  const src=PNG.sync.read(sourceCore),ref=PNG.sync.read(sourceOffCore);
  check(src.width===ref.width&&src.height===ref.height,
    'FID24700 true-roadbed A/B framebuffer differs');
  let changedCore=0;
  for(let y=210;y<src.height;y+=2)for(let x=2;x<src.width;x+=2){
    const i=(y*src.width+x)*4;
    if(Math.max(...[0,1,2].map(j=>Math.abs(src.data[i+j]-ref.data[i+j])))>18)
      changedCore++;
  }
  report.coreRoadbedPixelsDifferentOver18=changedCore;
  report.coreRoadbedAB={sourceFID:24700,sourceYear:2022,
    sourceCamera:report.sourceCoreCamera,
    referenceCamera:report.sourceOffCoreCamera,
    sampledStepPixels:2,excludedHUDTopPixels:210};
  check(changedCore>300,'Source roadbed FID24700 geometry invisible from the identical focused camera: '+changedCore);
  // Finally enter the exact same official metre-tile world in the optional
  // source-parameter C185 cockpit. This tests the actual PATROL-derived
  // airborne-only kinematics, NOT water, wheels or native engine flight.
  await page.goto(base+'/assets/nyc/nyc-true-scale-flight.html?flight=patrol-c185',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.ready&&
    window.PatrolMetricFlightQA.airborneMode===true&&
    window.PatrolMetricFlightQA.airborneSteps>=4,
    null,{timeout:65000});
  report.c185Before=await page.evaluate(()=>({
    pos:window.PatrolMetricFlightQA.airbornePos,
    yaw:window.PatrolMetricFlightQA.airborneYaw,
    pitch:window.PatrolMetricFlightQA.airbornePitch,
    speed:window.PatrolMetricFlightQA.airborneSpeed,
    steps:window.PatrolMetricFlightQA.airborneSteps,
    nativePhysics:window.PatrolMetricFlightQA.usesOriginalAircraftPhysics,
    airborneSubset:window.PatrolMetricFlightQA.usesPatrolAirborneEquations,
    completePhysics:window.PatrolMetricFlightQA.airborneFullPhysics,
    sourceRoadbed:window.PatrolMetricFlightQA.officialRoadbedPolygons
  }));
  check(report.c185Before.airborneSubset===true&&
    report.c185Before.completePhysics===false&&
    report.c185Before.nativePhysics===false&&
    report.c185Before.sourceRoadbed===11,
    'Do not claim full native aircraft physics or lose exact OTI source geometry');
  const cockpitBefore=await page.locator('#scene').screenshot({
    path:out+'/07-c185-source-airborne-cockpit-before.png',timeout:90000
  });
  await page.keyboard.down('w');
  await page.keyboard.down('d');
  await page.keyboard.down('Space');
  try{
    await page.waitForFunction(()=>
      window.PatrolMetricFlightQA?.airborneActiveControlFrames>=2,
      null,{timeout:18000});
  }catch(error){
    report.c185InputDiagnostic=await page.evaluate(()=>({
      keys:window.PatrolMetricFlightQA?.keyboardDiagnostics,
      activeFrames:window.PatrolMetricFlightQA?.airborneActiveControlFrames||0,
      lastControl:window.PatrolMetricFlightQA?.airborneLastControl,
      hasFocus:document.hasFocus(),activeElement:document.activeElement?.id
    }));
    throw Error('C185 controls never reached RAF: '+JSON.stringify(report.c185InputDiagnostic));
  }
  await page.waitForFunction(n=>
    window.PatrolMetricFlightQA?.airborneSteps>=n+6,
    report.c185Before.steps,{timeout:65000});
  report.c185After=await page.evaluate(()=>({
    pos:window.PatrolMetricFlightQA.airbornePos,
    yaw:window.PatrolMetricFlightQA.airborneYaw,
    pitch:window.PatrolMetricFlightQA.airbornePitch,
    speed:window.PatrolMetricFlightQA.airborneSpeed,
    bank:window.PatrolMetricFlightQA.airborneBank,
    gForce:window.PatrolMetricFlightQA.airborneGForce,
    collision:window.PatrolMetricFlightQA.airborneCollision,
    steps:window.PatrolMetricFlightQA.airborneSteps,
    glError:window.PatrolMetricFlightQA.glError,
    errors:window.PatrolMetricFlightQA.errors,
    activeControlFrames:window.PatrolMetricFlightQA.airborneActiveControlFrames||0,
    keyHistory:window.PatrolMetricFlightQA.airborneKeyHistory||[],
    inputDiagnostics:window.PatrolMetricFlightQA.keyboardDiagnostics
  }));
  await page.keyboard.up('Space');
  await page.keyboard.up('d');
  await page.keyboard.up('w');
  report.c185AirborneMovedMeters=Math.hypot(
    ...report.c185Before.pos.map((v,i)=>report.c185After.pos[i]-v)
  );
  check(report.c185AirborneMovedMeters>.4&&
    report.c185AirborneMovedMeters<50,
    'Source C185 airborne camera failed real metric movement: '+
    report.c185AirborneMovedMeters);
  check(Math.abs(report.c185After.yaw-report.c185Before.yaw)>.0005&&
    report.c185After.pitch>report.c185Before.pitch+.0005&&
    report.c185After.speed>19.2&&
    report.c185After.gForce>=.3&&report.c185After.gForce<=7.5,
    'PATROL-derived C185 pitch/turn/boost equations did not affect real scene');
  check(report.c185After.glError===0&&report.c185After.errors.length===0,
    'C185 source-airborne mode has browser/GL fault');
  const cockpitAfter=await page.locator('#scene').screenshot({
    path:out+'/08-c185-source-airborne-cockpit-after.png',timeout:90000
  });
  report.c185Screenshots={beforeBytes:cockpitBefore.length,afterBytes:cockpitAfter.length};
  check(cockpitBefore.length>5000&&cockpitAfter.length>5000,
    'C185 source-geometry camera screenshots are blank');
  check(report.errors.length===0,'Browser errors '+report.errors.join('; '));
  report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}
finally{
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
