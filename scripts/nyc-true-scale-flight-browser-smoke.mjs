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
  const initial=await page.locator('#scene').screenshot({
    path:out+'/01-true-scale-flythrough.png',timeout:90000});
  const png=PNG.sync.read(initial);
  let pixels=0;
  for(let y=45;y<png.height;y+=4)for(let x=0;x<png.width;x+=4){
    const i=(y*png.width+x)*4;
    if(png.data[i]>65&&png.data[i+1]>70&&png.data[i+2]>75)pixels++;
  }
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
  // Evidence-only third view: no invented DCM-width asphalt, with official
  // 2022 roadbed polygons and real DCM centerline trace left intact.
  await page.goto(base+'/assets/nyc/nyc-true-scale-flight.html?roadbed=only',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.ready&&
    window.PatrolMetricFlightQA.frames>12,null,{timeout:60000});
  report.sourceOnly=await page.evaluate(()=>window.PatrolMetricFlightQA);
  check(report.sourceOnly.sourceRoadbedOnly===true&&
    report.sourceOnly.illustrativeRoadBandTriangles===0,
    'Source-only view still renders fictitious DCM-width asphalt');
  check(report.sourceOnly.officialRoadbedPolygons===11&&
    report.sourceOnly.officialRoadbedTriangles===207&&
    report.sourceOnly.streetSegments===89,
    'Source-only view dropped official roadbed/centerline geometries');
  check(report.sourceOnly.triangles===report.initial.triangles-178,
    'Source-only 1:1 scene must hide exactly 2 fake triangles per 89 DCM segments');
  await page.locator('#aerial').click();
  await page.waitForTimeout(350);
  const sourceOnlyAerial=await page.locator('#scene').screenshot({
    path:out+'/07-source-only-measured-roadbed-aerial.png',timeout:90000});
  const srcOnly=PNG.sync.read(sourceOnlyAerial);
  check(srcOnly.width===a.width&&srcOnly.height===a.height,
    'Source-only aerial evidence size changed');
  let onlyDifferent=0;
  for(let y=230;y<a.height;y+=2)for(let x=2;x<a.width;x+=2){
    const i=(y*a.width+x)*4;
    if(Math.max(...[0,1,2].map(j=>Math.abs(a.data[i+j]-srcOnly.data[i+j])))>18)
      onlyDifferent++;
  }
  report.sourceOnlyPixelDifferenceOver18=onlyDifferent;
  check(onlyDifferent>60,
    'Removing all fake DCM road bands was not visible in fixed aerial evidence: '+onlyDifferent);
  // Third matching FID 24700 close-up: source-only vs source+inferred
  // asphalt at EXACTLY the same camera, not merely the wide aerial.
  await page.locator('#roadbedFocus').click();
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.camera?.[1]===70,
    null,{timeout:45000});
  report.sourceOnlyCoreCamera=await page.evaluate(()=>window.PatrolMetricFlightQA.camera);
  check(report.sourceOnlyCoreCamera.every((v,i)=>
    Math.abs(v-report.sourceCoreCamera[i])<1e-8),
    'Source-only FID24700 camera drift from normal source mode');
  const sourceOnlyCore=await page.locator('#scene').screenshot({
    path:out+'/08-source-only-FID24700-core.png',timeout:90000});
  const onlyCore=PNG.sync.read(sourceOnlyCore);
  check(onlyCore.width===src.width&&onlyCore.height===src.height,
    'Source-only FID24700 size differs from matched camera');
  let coreWithoutGuessedRoads=0;
  for(let y=210;y<src.height;y+=2)for(let x=2;x<src.width;x+=2){
    const i=(y*src.width+x)*4;
    if(Math.max(...[0,1,2].map(j=>Math.abs(src.data[i+j]-onlyCore.data[i+j])))>18)
      coreWithoutGuessedRoads++;
  }
  report.coreWithoutGuessedRoadsPixelsOver18=coreWithoutGuessedRoads;
  check(coreWithoutGuessedRoads>30,
    'Unsurveyed road bands did not change fixed FID24700 core view: '+
      coreWithoutGuessedRoads);

  // Bounded, original-code surface preview: this is artist-authored
  // and has NO rights to claim real NYC brick/glass facade truth.
  await page.goto(base+'/assets/nyc/nyc-true-scale-flight.html?materials=preview',
    {waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.PatrolMetricFlightQA?.ready&&
    window.PatrolMetricFlightQA.frames>12,null,{timeout:60000});
  report.materialPreview=await page.evaluate(()=>window.PatrolMetricFlightQA);
  check(report.materialPreview.materialPreview===true&&
    report.materialPreview.materialPreviewBuildings===118&&
    report.materialPreview.materialPreviewWallTriangles>300,
    'FID material opt-in preview missing or did not bind all 118 buildings');
  check(report.materialPreview.materialEvidence==='visual-proxy-only-not-as-built',
    'Artist preview deceptively claims real NYC material evidence');
  check(report.materialPreview.sourceBuildingCount===report.initial.sourceBuildingCount&&
    report.materialPreview.streetSegments===report.initial.streetSegments&&
    report.materialPreview.officialRoadbedTriangles===207&&
    report.materialPreview.triangles===report.initial.triangles,
    'Material shader changed measured source geometry or triangle budget');
  check(report.materialPreview.glError===0,'Material shader WebGL2 error');
  await page.locator('#aerial').click();
  await page.waitForTimeout(350);
  const previewAerial=await page.locator('#scene').screenshot({
    path:out+'/09-original-material-preview-aerial.png',timeout:90000});
  const materialImage=PNG.sync.read(previewAerial);
  check(materialImage.width===a.width&&materialImage.height===a.height,
    'Material preview screenshot changes the fixed camera framebuffer');
  let materialsDelta=0;
  for(let y=180;y<a.height;y+=2)for(let x=2;x<a.width;x+=2){
    const i=(y*a.width+x)*4;
    if(Math.max(...[0,1,2].map(j=>Math.abs(a.data[i+j]-materialImage.data[i+j])))>18)
      materialsDelta++;
  }
  report.materialPreviewPixelsDifferentOver18=materialsDelta;
  check(materialsDelta>100,
    'Original brick/glass/stone previews not visible at same aerial pose: '+
      materialsDelta);
  check(report.errors.length===0,'Browser errors '+report.errors.join('; '));
  report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}
finally{
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
