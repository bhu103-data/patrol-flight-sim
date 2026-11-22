'use strict';
// Browser screenshot smoke for the EXPERIMENTAL 1:1 Times Square geometry viewer.
// A successful WebGL frame is NOT a claim of photorealistic fidelity.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('/tmp/patrol-browser/node_modules/playwright');
const {PNG}=require('/tmp/patrol-browser/node_modules/pngjs');
const url=process.env.PATROL_TEST_URL||'http://127.0.0.1:8127/nyc-reality.html';
const dir=path.resolve('artifacts/nyc-reality');
fs.mkdirSync(dir,{recursive:true});
const report={url,source:'2026-11-20 bundled municipal polygons',geometryStatus:'UNVERIFIED',
  visualFidelity:'NOT PHOTOREALISTIC',screenshots:[],errors:[],failedRequests:[]};
function pixels(buf){
  const img=PNG.sync.read(buf),colors=new Set();
  let nearBlack=0,samples=0;
  for(let y=0;y<img.height;y+=12)for(let x=0;x<img.width;x+=12){
    const i=(y*img.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
    colors.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
    if(r+g+b<25)nearBlack++;
    samples++;
  }
  return {width:img.width,height:img.height,colorBuckets:colors.size,
    nearBlackFraction:nearBlack/samples};
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
    '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox'
  ]});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',error=>report.errors.push(String(error).slice(0,350)));
  page.on('requestfailed',req=>report.failedRequests.push(req.url()));
  async function shot(name){
    await page.waitForTimeout(500);
    const image=await page.locator('#stage').screenshot({
      path:path.join(dir,name+'.png'),timeout:45000,animations:'disabled'
    });
    const result=pixels(image);
    assert.ok(result.width>=640&&result.height>=360);
    assert.ok(result.colorBuckets>=12&&result.nearBlackFraction<.97,
      'Empty WebGL screenshot: '+name+' '+JSON.stringify(result));
    report.screenshots.push({name,...result});
  }
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForFunction(()=>
      document.querySelector('#metrics')?.textContent?.includes('118 / 120 municipal footprints shown'),
      null,{timeout:90000});
    await page.waitForFunction(()=>window.PatrolRealityStreetStatus?.status==='loaded',
      null,{timeout:90000});
    const state=await page.evaluate(()=>{
      const canvas=document.querySelector('#stage'),gl=canvas.getContext('webgl2');
      return {webgl2:!!gl,contextLost:gl?.isContextLost()||false,
        width:canvas.width,height:canvas.height,
        limits:document.querySelector('#limits')?.textContent||'',
        roads:window.PatrolRealityStreetStatus,
        roadStatus:document.querySelector('#roadStatus')?.textContent||'',
        error:document.querySelector('#error')?.textContent||''};
    });
    assert.ok(state.webgl2&&!state.contextLost&&state.width>=600);
    assert.match(state.limits,/street centerlines only/);
    assert.ok(state.roads.count>=30&&state.roads.lines>=40,
      'Too few verified official DCM street centerlines');
    assert.ok(state.roads.built>0&&state.roads.built<state.roads.count,
      'Built vs recorded source status disappeared');
    assert.match(state.roadStatus,/not lanes or curbs/);
    assert.equal(state.error,'');
    report.state=state;
    await page.addStyleTag({content:'#panel,#status{visibility:hidden!important}'});
    await shot('01-aerial-true-meters');
    await page.evaluate(()=>document.querySelector('#street').click());
    await shot('02-street-height-provisional');
    assert.equal(report.screenshots.length,2);
    assert.equal(report.errors.length,0,'Browser JS errors: '+report.errors.join(' | '));
    assert.equal(report.failedRequests.length,0,'Asset requests failed');
    report.geometryStatus='PASS';
    console.log('[NYC REALITY PILOT] geometry/browser PASS, photorealism NOT tested');
  }catch(error){
    report.geometryStatus='FAIL';
    report.error=String(error);
    console.error('[NYC REALITY PILOT] '+JSON.stringify(report,null,2));
    process.exitCode=1;
  }finally{
    fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
