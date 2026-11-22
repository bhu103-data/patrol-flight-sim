// Real PATROL WebGL2 / no source rehosting. Screenshots from identical game camera.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';

const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const output='artifacts/nyc-liberty-production-lod';
await mkdir(output,{recursive:true});
const report={head:'opt-in CC0 on top of reviewed #103 + #130',backend:'SwiftShader',
  scenarios:[],visualAcceptance:'not an architectural survey'};
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
function imageStats(bytes){
  const img=PNG.sync.read(bytes),colors=new Set();let black=0,sampled=0;
  for(let y=0;y<img.height;y+=8)for(let x=0;x<img.width;x+=8){
    const p=(y*img.width+x)*4,rr=img.data[p],gg=img.data[p+1],bb=img.data[p+2];
    colors.add(((rr>>4)<<8)|((gg>>4)<<4)|(bb>>4));
    if(rr+gg+bb<25)black++;
    sampled++;
  }
  assert.ok(img.width>=800&&img.height>=500&&colors.size>=30&&black/sampled<.95,
    'blank/corrupt actual game screenshot');
  return {width:img.width,height:img.height,colorBins:colors.size,blackFraction:black/sampled};
}
async function run(label,query,{rejectCandidate=false}={}){
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const errors=[],downloads=[],loadTimes={};
  page.on('pageerror',err=>errors.push('pageerror:'+err.message));
  page.on('response',r=>{
    if(/\/assets\/nyc\/(scenario\/liberty|statue-of-liberty)\.glb/.test(r.url())){
      downloads.push({url:r.url(),status:r.status()});
    }
  });
  page.on('requestfailed',r=>{
    if(r.url().includes('/assets/nyc/scenario/liberty.glb')&&!rejectCandidate)
      errors.push('GLB network failure: '+r.url());
  });
  if(rejectCandidate)await page.route('**/assets/nyc/scenario/liberty.glb',
    r=>r.abort('failed'));
  const first=Date.now();
  try{
    await page.goto(base+'/index.html?'+query,{waitUntil:'domcontentloaded',timeout:40000});
    assert.equal(await page.locator('input[name=flightMap]:checked').inputValue(),'manhattan');
    await page.locator('#startFlight').click();
    await page.waitForFunction(()=>{
      const overlay=document.getElementById('loadOverlay');
      return !!(overlay?.classList.contains('done') &&
        document.getElementById('titleOverlay')?.hidden &&
        document.getElementById('glCanvas')?.width>=500);
    },null,{timeout:180000});
    loadTimes.flightSceneMs=Date.now()-first;
    await page.keyboard.press('h');
    await page.waitForFunction(()=>!document.querySelector('#hotelViews')?.hidden,
      null,{timeout:20000});
    await page.locator('#hotelTarget').selectOption({label:'Statue of Liberty'});
    if(label==='optin'){
      await page.waitForFunction(()=>window.PatrolLibertyLodQA?.lod==='near-cc0',
        null,{timeout:60000});
    }else{
      await page.waitForTimeout(1100);
    }
    const runtime=await page.evaluate(()=>{
      const gl=document.querySelector('#glCanvas').getContext('webgl2');
      return {ready:!!gl&&!gl.isContextLost(),
        glError:gl?.getError(),lod:window.PatrolLibertyLodQA||null,
        view:document.querySelector('#hotelTarget')?.selectedOptions?.[0]?.text};
    });
    assert.equal(runtime.ready,true,'WebGL2 unavailable or lost');
    assert.equal(runtime.glError,0,'WebGL error');
    assert.equal(runtime.view,'Statue of Liberty');
    if(label==='optin'){
      assert.equal(runtime.lod?.lod,'near-cc0','Audited CC0 model not actually drawn');
      assert.equal(runtime.lod?.nearTriangles,15900);
      assert.equal(runtime.lod?.textureReady,true,'texture atlas failed');
      assert.ok(runtime.lod?.midTriangles>0,'original GLB fallback unavailable');
      assert.ok(downloads.some(x=>x.url.endsWith('/scenario/liberty.glb')&&x.status===200));
    }else{
      assert.ok(!runtime.lod,'Default and rollback must not show staged CC0');
      assert.ok(!downloads.some(x=>x.url.endsWith('/scenario/liberty.glb')),
        'CC0 file fetched without explicit opt-in or on forced fallback');
    }
    await page.addStyleTag({content:'body.lod-qa *{visibility:hidden!important} body.lod-qa #glCanvas{visibility:visible!important}'});
    await page.evaluate(()=>document.body.classList.add('lod-qa'));
    const png=await page.locator('#glCanvas').screenshot({
      path:output+'/'+label+'-statue.png',timeout:75000,animations:'disabled'
    });
    const pixels=imageStats(png);
    assert.equal(errors.length,0,errors.join('\n'));
    report.scenarios.push({label,download:downloads,loadTimes,runtime,pixels});
    return png;
  }finally{
    await page.close();
  }
}
function differences(a,b){
  const x=PNG.sync.read(a),y=PNG.sync.read(b);
  assert.equal(x.width,y.width);assert.equal(x.height,y.height);
  // Statue is near the center of the shared Scenic View camera.
  const x0=Math.floor(x.width*.34),x1=Math.floor(x.width*.66);
  const y0=Math.floor(x.height*.14),y1=Math.floor(x.height*.84);
  let different=0,total=0;
  for(let iy=y0;iy<y1;iy+=3)for(let ix=x0;ix<x1;ix+=3){
    const p=(iy*x.width+ix)*4;
    const delta=Math.abs(x.data[p]-y.data[p])+
      Math.abs(x.data[p+1]-y.data[p+1])+
      Math.abs(x.data[p+2]-y.data[p+2]);
    if(delta>30)different++;
    total++;
  }
  return {roi:[x0,y0,x1,y1],fraction:different/total,samples:total};
}
try{
  const defaultPng=await run('default','nycLibertyLodQA=1');
  const pilotPng=await run('optin','nycLibertyCC0=1&nycLibertyLodQA=1');
  report.visualDiff=differences(defaultPng,pilotPng);
  assert.ok(report.visualDiff.fraction>.07,
    'CC0 model produced no visible source-dependent change: '+JSON.stringify(report.visualDiff));
  await run('rollback','nycLibertyCC0=1&nycModels=legacy&nycLibertyLodQA=1');
  report.status='PASS';
  console.log('NYC Liberty production optin WebGL PASS '+JSON.stringify(report));
}catch(e){
  report.status='FAIL';report.error=String(e);
  console.error('NYC Liberty production optin WebGL FAIL '+JSON.stringify(report));
  process.exitCode=1;
}finally{
  await writeFile(output+'/report.json',JSON.stringify(report,null,2));
  await browser.close();
}
