import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const output='artifacts/nyc-oti-surfaces-runtime';
await mkdir(output,{recursive:true});
const report={
  passed:false,errors:[],browserErrors:[],screenshots:[],
  source:'NYC OTI 2022 Roadbed_2022 + Plaza_2022 + Sidewalk_2022',
  checks:{},metrics:{}
};
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=swiftshader','--enable-webgl','--no-sandbox'
]});
async function openScene(url,label){
  const page=await browser.newPage({
    viewport:{width:1280,height:720},deviceScaleFactor:1
  });
  page.on('pageerror',error=>report.browserErrors.push(label+': '+String(error)));
  const response=await page.goto(url,{waitUntil:'domcontentloaded'});
  if(!response?.ok())throw Error(label+' scene HTTP '+response?.status());
  await page.waitForFunction(
    ()=>window.PatrolMetricFlightQA?.ready===true,{timeout:90000}
  );
  await page.waitForTimeout(900);
  const qa=await page.evaluate(()=>window.PatrolMetricFlightQA);
  if(!qa?.renderer?.includes('WebGL2'))throw Error(label+' did not create WebGL2');
  if(qa.glError!==0)throw Error(label+' WebGL error '+qa.glError);
  return {page,qa};
}
function pixelDifference(a,b){
  const A=PNG.sync.read(a),B=PNG.sync.read(b);
  if(A.width!==B.width||A.height!==B.height)
    throw Error('A/B screenshot dimensions differ');
  let changed=0,total=A.width*A.height,absolute=0;
  for(let i=0;i<A.data.length;i+=4){
    const d=Math.max(
      Math.abs(A.data[i]-B.data[i]),
      Math.abs(A.data[i+1]-B.data[i+1]),
      Math.abs(A.data[i+2]-B.data[i+2])
    );
    absolute+=d;
    if(d>18)changed++;
  }
  return {
    width:A.width,height:A.height,
    changedPixelFraction:changed/total,
    meanAbsoluteChannelDifference:absolute/(total*3)
  };
}
try{
  const on=await openScene(
    base+'/assets/nyc/nyc-true-scale-flight.html',
    'official-oti-surfaces-on'
  );
  const qa=on.qa;
  report.checks.fullSurfaceSourceLoaded=qa.officialSurfaceDataReady===true;
  if(!report.checks.fullSurfaceSourceLoaded)
    throw Error('Live OTI surfaces did not load: '+String(qa.officialSurfaceDataError));
  const counts=qa.officialSurfaceDataCounts||{};
  report.metrics.sourceCounts=counts;
  report.metrics.mesh={
    buildings:qa.sourceBuildingCount,
    dcmStreetFeatures:qa.sourceStreetCount,
    dcmStreetSegments:qa.streetSegments,
    roadbedPolygons:qa.officialRoadbedPolygons,
    plazaPolygons:qa.officialPlazaPolygons,
    sidewalkPolygons:qa.officialSidewalkPolygons,
    holesPreserved:qa.officialSurfaceHoles,
    surfaceVertices:qa.officialSurfaceVertices,
    surfaceTriangles:qa.officialSurfaceTriangles,
    totalTriangles:qa.triangles,
    maxTriangulationAreaError:qa.officialSurfaceMaxAreaError,
    guessedRoadBandSegments:qa.illustrativeRoadBandSegments,
    referenceYear:qa.officialSurfaceReferenceYear,
    loadMilliseconds:qa.officialSurfaceDataLoadMilliseconds,
    origin:qa.officialSurfaceDataOrigin,
    bbox:qa.officialSurfaceDataBbox
  };
  if(qa.officialRoadbedPolygons<70||qa.officialPlazaPolygons<10||
     qa.officialSidewalkPolygons<40)
    throw Error('Incomplete official source polygon inventory');
  if(qa.officialSurfaceHoles<20)
    throw Error('Interior rings were not preserved by the runtime polygon parser');
  if(qa.illustrativeRoadBandSegments!==0)
    throw Error('Guessed DCM-width road bands remained under the official surface mesh');
  if(qa.officialSurfaceMaxAreaError>.001)
    throw Error('Earcut polygon area deviation exceeded 0.1%');
  if(!Array.isArray(qa.camera)||qa.camera.length!==3||
     !qa.camera.every(Number.isFinite))
    throw Error('Invalid source-on fixed camera');
  const onCamera=[...qa.camera];
  const onStreetPath=output+'/01-oti-full-surfaces-street.png';
  await on.page.locator('#scene').screenshot({path:onStreetPath});
  report.screenshots.push('01-oti-full-surfaces-street.png');
  await on.page.locator('#aerial').click();
  await on.page.waitForTimeout(350);
  await on.page.locator('#scene').screenshot({
    path:output+'/02-oti-full-surfaces-aerial.png'
  });
  report.screenshots.push('02-oti-full-surfaces-aerial.png');
  await on.page.close();

  const off=await openScene(
    base+'/assets/nyc/nyc-true-scale-flight.html?surfaces=off&roadbed=off',
    'official-oti-surfaces-off'
  );
  if(off.qa.officialSurfaceDataReady!==false)
    throw Error('Source-off control unexpectedly loaded official OTI layers');
  if(off.qa.illustrativeRoadBandSegments<1)
    throw Error('Source-off control did not restore the clearly labelled DCM visual fallback');
  const offCamera=off.qa.camera;
  const cameraError=Math.max(...onCamera.map((x,i)=>Math.abs(x-offCamera[i])));
  if(cameraError>1e-6)
    throw Error('Source-on/off camera registration mismatch '+cameraError);
  const offStreetPath=output+'/03-source-off-same-camera.png';
  await off.page.locator('#scene').screenshot({path:offStreetPath});
  report.screenshots.push('03-source-off-same-camera.png');
  const diff=pixelDifference(
    await readFile(onStreetPath),await readFile(offStreetPath)
  );
  report.metrics.sameCameraAB={camera:onCamera,cameraMaxError:cameraError,...diff};
  if(diff.changedPixelFraction<.005)
    throw Error('Official surface source-on/off screenshots are not measurably different');
  report.checks.sameCameraAB=true;
  report.checks.webgl2NoErrors=true;
  report.checks.fullRoadbedPlazaSidewalkLayers=true;
  report.checks.interiorHolesPreserved=true;
  report.checks.noGuessedRoadBandsUnderSourceGeometry=true;
  if(report.browserErrors.length)
    throw Error('Browser page errors: '+report.browserErrors.join('; '));
  report.passed=true;
}catch(error){
  report.errors.push(String(error?.stack||error));
  process.exitCode=1;
}finally{
  await writeFile(output+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
