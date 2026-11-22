/** Actual WebGL2 city-geography proof, separate from fictional PATROL map.
 * Uses official source polygons baked in repo; no network tiles, video or AI.
 * Chromium SwiftShader is functional QA only and NOT native hardware FPS.
 */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';

const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
const images='artifacts';mkdirSync(images,{recursive:true});
const headSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.PR_HEAD_SHA && process.env.PR_HEAD_SHA!==headSha)
  throw Error('Checkout does not match authored PR head: '+headSha);
const report={headSha,triggerSha:process.env.GITHUB_SHA||null,
  source:'NYC OTI BUILDING_view original WGS84',screenshots:[]};
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(/dumbo-oti-true-scale-source|dumbo-true-scale-geodesy/.test(r.url()))
    responses.push({url:r.url().split('/').at(-1),status:r.status()});});
  const response=await page.goto('http://127.0.0.1:8765/nyc-dumbo-true-scale.html',
    {waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>window.PatrolDumboTrueScaleQA?.ready===true,
    null,{timeout:30000});
  const meta=await page.evaluate(()=>window.PatrolDumboTrueScaleQA);
  assert.equal(meta.crs,'EPSG:4326');
  assert.deepEqual(meta.sourceFids,[1080628,1031082,1051309]);
  assert.equal(meta.worldUnits,'metres');
  assert.equal(meta.sourceSpaceUncompressed,true);
  assert.equal(meta.buildings[0].heightMetres,36.8808);
  assert.equal(meta.buildings[1].heightMetres,25.423368);
  assert.equal(meta.buildings[2].heightMetres,26.3652);
  const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const d01=distance(meta.buildings[0].eastNorth,meta.buildings[1].eastNorth);
  const d02=distance(meta.buildings[0].eastNorth,meta.buildings[2].eastNorth);
  assert.ok(d01>100&&d01<220&&d02>100&&d02<250,
    'Actual NYC building separations must not inherit fictional lot spacing');
  async function shot(name,azimuth,elevation,distanceMetres){
    await page.evaluate(([a,e,d])=>
      window.PatrolDumboTrueScaleQA.setCamera(a,e,d),
      [azimuth,elevation,distanceMetres]);
    await page.waitForTimeout(400);
    const state=await page.evaluate(()=>window.PatrolDumboTrueScaleQA.getState());
    const exactTriangleCount=meta.buildings.reduce((sum,b)=>
      sum+2*(b.faceCount+2)+b.faceCount,0);
    assert.equal(state.meshTriangles,exactTriangleCount,
      'Render exactly original wall polygons and triangulated roofs, not extra box faces');
    assert.ok(state.gridSegments>=10,'Metre scale reference grid must show');
    assert.equal(state.glError,0,'WebGL2 must have no GL errors');
    assert.equal(state.contextLost,false,'3D context must not be lost');
    assert.ok(state.viewport[0]>600&&state.viewport[1]>350);
    const file=images+'/nyc-true-dumbo-'+name+'.png';
    await page.screenshot({path:file});
    report.screenshots.push({name,file,...state});
  }
  await shot('overview',.55,.40,445);
  await shot('street-axis',-.25,.21,280);
  await shot('birdseye',1.03,1.10,390);
  assert.deepEqual(responses.map(x=>x.status),[200,200],
    'Both original WGS84 data and geodesy source must load from local files');
  assert.deepEqual(errors,[],'No browser JS errors');
  report.passed=true;report.buildings=meta.buildings;
  report.realBuildingDistancesMetres={firstSecond:d01,firstThird:d02};
  report.responses=responses;report.pageErrors=errors;
  await page.close();
}catch(e){report.passed=false;report.failure=e.stack;throw e;}
finally{
  writeFileSync(images+'/nyc-true-dumbo-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
console.log(JSON.stringify(report));
