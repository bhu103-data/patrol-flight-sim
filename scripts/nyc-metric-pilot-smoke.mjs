// Actual Chromium/WebGL2 proof for the standalone source-faithful NYC massing.
// This is not a real-GPU performance or accurate street/facade certification.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const base=process.env.METRIC_BASE_URL||'http://127.0.0.1:8766';
const folder='artifacts/nyc-metric-pilot';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({
  headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-gpu-sandbox']
});
const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
const errors=[],warnings=[],views=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')warnings.push(m.text());});
page.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));
let passed=false;
try{
  const response=await page.goto(base+'/nyc-metric-pilot.html',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(response?.status(),200);
  await page.waitForFunction(()=>window.__patrolMetricQa?.ready===true,null,{timeout:45000});
  const before=await page.evaluate(()=>window.__patrolMetricQa);
  assert.equal(before.webgl2,true);
  assert.equal(before.errors,0);
  assert.equal(before.stats.sourceRecords,120);
  assert.equal(before.stats.renderedBuildings,118);
  assert.equal(before.stats.skippedBuildings,2);
  assert.equal(before.stats.totalTriangles,2101);
  assert.equal(before.stats.metersPerWorldUnit,1);
  assert.equal(before.stats.roofTriangles>0,true);
  for(const [key,name] of [
    ['street','01-times-square-street-metric-source.png'],
    ['fly','02-times-square-lowflight-metric-source.png'],
    ['top','03-times-square-overhead-metric-source.png']
  ]){
    await page.click('#'+key);
    await page.waitForTimeout(350);
    const state=await page.evaluate(()=>window.__patrolMetricQa);
    assert.equal(state.errors,0);
    assert.equal(state.webgl2,true);
    const bytes=await page.screenshot({path:folder+'/'+name});
    const p=PNG.sync.read(bytes),bins=new Set();
    for(let y=40;y<p.height;y+=6)for(let x=40;x<p.width;x+=6){
      const i=(y*p.width+x)*4;
      bins.add([p.data[i]>>4,p.data[i+1]>>4,p.data[i+2]>>4].join(':'));
    }
    assert.ok(bins.size>16,'Potentially flat/blank '+name+': '+bins.size+' bins');
    views.push({name,frame:state.frame,camera:{eye:state.eye,target:state.target},
      coarseRgbBins:bins.size,webgl2:state.webgl2,error:state.errors});
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(warnings,[]);
  passed=true;
  console.log('NYC metric official source WebGL2 PASS',JSON.stringify({stats:before.stats,views}));
}catch(e){
  errors.push(String(e.stack||e));
  console.error('NYC metric WebGL2 QA FAILED',e);
}finally{
  await writeFile(folder+'/report.json',JSON.stringify({passed,errors,warnings,
    stats:await page.evaluate(()=>window.__patrolMetricQa?.stats||null).catch(()=>null),
    views,source:'assets/nyc/times-square-footprints.json',
    limitation:'not road/facade/flight calibrated; SwiftShader is not native GPU'},null,2));
  await browser.close();
}
if(!passed)process.exitCode=1;
