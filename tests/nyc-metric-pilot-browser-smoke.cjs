'use strict';
// Test the ACTUAL standalone metric reference viewer (not the old PATROL index).
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('/tmp/patrol-browser/node_modules/playwright');
const {PNG}=require('/tmp/patrol-browser/node_modules/pngjs');
const url='http://127.0.0.1:8127/nyc-times-square-metric-pilot.html';
const dir=path.resolve('artifacts/nyc-metric-pilot');
fs.mkdirSync(dir,{recursive:true});
function sample(buffer){
  const p=PNG.sync.read(buffer),colors=new Set();
  let nonbackground=0,sampled=0;
  // Ignore the opaque HUD at the upper left; verify real 3-D canvas pixels.
  for(let y=115;y<p.height-40;y+=5)for(let x=530;x<p.width-40;x+=5){
    const i=(y*p.width+x)*4;
    const r=p.data[i],g=p.data[i+1],b=p.data[i+2];
    colors.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
    if(r>62&&g>62&&b>62)nonbackground++;
    sampled++;
  }
  return {width:p.width,height:p.height,paletteCount:colors.size,
    highLumaSamples:nonbackground,totalSamples:sampled};
}
(async()=>{
  const report={url,geometry:null,images:[],errors:[],status:'PENDING'};
  const browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox'
  ]});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('pageerror: '+String(e)));
  page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text())});
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:35000});
    await page.waitForFunction(()=>{
      const s=document.querySelector('#status')?.textContent||'';
      return s.includes('official building footprints')||
        s.includes('failed')||s.includes('unavailable');
    },null,{timeout:60000});
    const geometry=await page.evaluate(()=>{
      const canvas=document.querySelector('#scene'),gl=canvas.getContext('webgl2');
      return {status:document.querySelector('#status')?.textContent,
        width:canvas.width,height:canvas.height,webgl2:!!gl,
        contextLost:gl?.isContextLost()??true,glError:gl?.getError()??null};
    });
    report.geometry=geometry;
    assert(geometry.webgl2&&!geometry.contextLost,'WebGL2 required');
    assert(geometry.status.includes('118 / 120 official building footprints'),
      'Unexpected source footprint count: '+geometry.status);
    assert(geometry.status.includes('2,104 triangles'),
      'Unexpected triangulation: '+geometry.status);
    assert.equal(geometry.glError,0,'WebGL error after render');
    assert(geometry.width>=1000&&geometry.height>=600,'Canvas did not size');
    await page.waitForTimeout(700);
    const before=await page.screenshot({path:path.join(dir,'real-enu-before.png')});
    const beforeStats=sample(before);
    report.images.push({name:'real-enu-before.png',...beforeStats});
    assert(beforeStats.paletteCount>12,'Viewer screenshot is blank');
    assert(beforeStats.highLumaSamples>150,
      'Expected physical building polygons visible outside HUD');
    await page.mouse.move(890,430);
    await page.mouse.down();
    await page.mouse.move(1140,370,{steps:12});
    await page.mouse.up();
    await page.waitForTimeout(600);
    const after=await page.screenshot({path:path.join(dir,'real-enu-orbit.png')});
    const afterStats=sample(after);
    report.images.push({name:'real-enu-orbit.png',...afterStats});
    assert(afterStats.paletteCount>12,'Orbit screenshot is blank');
    let changed=0;
    const a=PNG.sync.read(before),b=PNG.sync.read(after);
    for(let y=110;y<a.height-20;y+=5)for(let x=520;x<a.width-20;x+=5){
      const i=(y*a.width+x)*4;
      if(Math.abs(a.data[i]-b.data[i])+
        Math.abs(a.data[i+1]-b.data[i+1])+
        Math.abs(a.data[i+2]-b.data[i+2])>40)changed++;
    }
    report.changedSamplesAfterOrbit=changed;
    assert(changed>400,'Orbit did not change 3-D image sufficiently');
    assert.deepEqual(report.errors,[],'Console or page errors');
    report.status='PASS';
    console.log('NYC 1:1 metric viewer WebGL2 PASS '+JSON.stringify(report));
  }catch(e){
    report.status='FAIL';report.failure=String(e);
    console.error('NYC 1:1 metric viewer WebGL2 FAIL '+JSON.stringify(report));
    process.exitCode=1;
  }finally{
    fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
