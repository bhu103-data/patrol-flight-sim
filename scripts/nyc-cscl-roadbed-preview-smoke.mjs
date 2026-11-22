// Browser A/B of genuine OTI 2026 CSCL paved-width attributes in a *source*
// metric-only city preview. This is a visual QA, not photographed roads,
// sidewalk edge geometry, playable lanes or native GPU performance.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const dir='artifacts/nyc-cscl-roadbed';
const base=process.env.CSCL_PREVIEW_URL||'http://127.0.0.1:8766';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({
  headless:true,args:['--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--disable-gpu-sandbox']
});
let report={passed:false,errors:[],warnings:[],captures:[],
  limitation:'only screened symmetric official streetwidth envelopes, not source roadbed boundaries'};
const old=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const now=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
for(const page of [old,now]){
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.warnings.push(m.text());});
  page.on('requestfailed',r=>report.errors.push(r.url()+': '+r.failure()?.errorText));
}
try{
  const first=await old.goto(base+'/nyc-metric-pilot.html',{waitUntil:'domcontentloaded'});
  assert.equal(first?.status(),200);
  await old.waitForFunction(()=>window.__patrolMetricQa?.ready===true);
  await old.click('#fly');
  const baseState=await old.evaluate(()=>window.__patrolMetricQa);
  assert.equal(baseState.csclQa,null);
  assert.equal(baseState.stats.renderedBuildings,118);
  const before=await old.screenshot({path:dir+'/01-lowflight-source-buildings-no-road.png'});

  const second=await now.goto(base+'/nyc-metric-pilot.html?roadbed=1',
    {waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(second?.status(),200);
  await now.waitForFunction(()=>window.__patrolMetricQa?.csclQa?.vehicleRoads>=20,null,{timeout:45000});
  await now.click('#fly');
  const withRoad=await now.evaluate(()=>window.__patrolMetricQa);
  assert.equal(withRoad.webgl2,true);
  assert.equal(withRoad.errors,0);
  assert.equal(withRoad.csclQa.vehicleRoads,49);
  assert.equal(withRoad.csclQa.nonVehicleLines,7);
  assert.equal(withRoad.csclQa.unverifiedVehicleWidth,0);
  assert.ok(withRoad.csclQa.roadTriangles>=100,'Expected true source polyline segments');
  assert.equal(withRoad.stats.renderedBuildings,118);
  const after=await now.screenshot({path:dir+'/02-lowflight-source-width-screening.png'});
  const a=PNG.sync.read(before),b=PNG.sync.read(after);
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  let changed=0;
  for(let y=180;y<a.height;y++)for(let x=430;x<a.width;x++){
    const i=(y*a.width+x)*4;
    const diff=Math.max(Math.abs(a.data[i]-b.data[i]),
      Math.abs(a.data[i+1]-b.data[i+1]),
      Math.abs(a.data[i+2]-b.data[i+2]));
    if(diff>=12)changed++;
  }
  // Reject a broken/no-op optional road visual; the identical base camera
  // hides toolbar/status text by comparing x>=430 only.
  assert.ok(changed>120,'No visible source width bands in same-camera A/B: '+changed);
  await now.click('#top');
  const top=await now.evaluate(()=>window.__patrolMetricQa);
  assert.equal(top.errors,0);
  await now.screenshot({path:dir+'/03-overhead-source-width-screening.png'});
  report={...report,passed:true,stats:withRoad.csclQa,
    sourceBuildings:withRoad.stats.renderedBuildings,
    sameCameraChangedPixels:changed,
    captures:[
      '01-lowflight-source-buildings-no-road.png',
      '02-lowflight-source-width-screening.png',
      '03-overhead-source-width-screening.png'
    ],
    renderer:'Chromium ANGLE SwiftShader / software WebGL2',
    cameras:[baseState.eye,withRoad.eye,top.eye]};
  assert.deepEqual(report.errors,[]);
  assert.deepEqual(report.warnings,[]);
  console.log('CSCL metric width-screening A/B WebGL2 PASS',JSON.stringify(report));
}catch(e){
  report.errors.push(String(e.stack||e));
  console.error('CSCL browser visual audit failed',e);
}finally{
  await writeFile(dir+'/browser-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
if(!report.passed)process.exitCode=1;
