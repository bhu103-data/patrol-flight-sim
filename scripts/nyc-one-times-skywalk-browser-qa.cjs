'use strict';
// Production index.html Manhattan scenic view, NOT another metric preview.
// Two same-scenic-camera screenshots: ?nycSkywalk=off vs =on.
// The public architectural photo is LINKED in docs; do not redistribute it.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('/tmp/patrol-browser/node_modules/playwright');
const {PNG}=require('/tmp/patrol-browser/node_modules/pngjs');
const ROOT='http://127.0.0.1:8129/index.html';
const dir=path.resolve('artifacts/nyc-one-times-skywalk');
fs.mkdirSync(dir,{recursive:true});
const report={source:'One Times Square: NYC roof FID 57216 + DeSimone 2026 55-ft deck',
  head:process.env.GITHUB_SHA||null,render:'SwiftShader WebGL2 (software, NOT native GPU)',
  passed:false,errors:[],frames:{},screenshots:[],environment:'same Manhattan north high-oblique Roof Close camera / 1280x720'};
function pixels(buf){
  const image=PNG.sync.read(buf);
  let colors=new Set(),luminous=0,n=0;
  for(let y=0;y<image.height;y+=8)for(let x=0;x<image.width;x+=8){
    const i=(y*image.width+x)*4;
    const r=image.data[i],g=image.data[i+1],b=image.data[i+2];
    colors.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
    if(r+g+b>80)luminous++;
    n++;
  }
  return {width:image.width,height:image.height,colors:colors.size,
    nonblackFraction:luminous/n};
}
function compare(a,b){
  const x=PNG.sync.read(a),y=PNG.sync.read(b);
  assert(x.width===y.width&&x.height===y.height);
  let changed=0,total=0,regionChanged=0,regionTotal=0;
  for(let row=0;row<x.height;row+=4)for(let col=0;col<x.width;col+=4){
    const i=(row*x.width+col)*4;
    const diff=Math.abs(x.data[i]-y.data[i])+
      Math.abs(x.data[i+1]-y.data[i+1])+
      Math.abs(x.data[i+2]-y.data[i+2]);
    if(diff>52)changed++;
    total++;
    if(row<x.height*.62&&col>x.width*.23&&col<x.width*.80){
      regionTotal++;
      if(diff>52)regionChanged++;
    }
  }
  return {changedSamples:changed,totalSamples:total,
    upperCenterChangedSamples:regionChanged,upperCenterSamples:regionTotal};
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-gpu-sandbox'
  ]});
  try{
    const imgs=[];
    for(const mode of ['off','on']){
      const page=await browser.newPage({
        viewport:{width:1280,height:720},deviceScaleFactor:1});
      page.on('pageerror',e=>report.errors.push(mode+': '+String(e)));
      page.on('console',m=>{
        if(m.type()==='error'&&/WebGL|shader|unhandled|uncaught|skywalk/i.test(m.text()))
          report.errors.push(mode+': console '+m.text().slice(0,300));
      });
      // Both source screenshots use identical original creative edition.
      await page.addInitScript(()=>{
        try{localStorage.setItem('patrol.nyc.oneTimes.nextCreative','500')}catch{}
      });
      await page.goto(ROOT+'?nycSkywalk='+mode,
        {waitUntil:'domcontentloaded',timeout:45000});
      assert.equal(await page.locator('input[name=flightMap]:checked').inputValue(),
        'manhattan','Manhattan must remain the actual production map');
      await page.locator('#startFlight').click({timeout:15000});
      await page.waitForFunction(()=>{
        const a=document.getElementById('loadOverlay'),canvas=document.getElementById('glCanvas');
        return a?.classList.contains('done')&&canvas?.width>=500 &&
          document.getElementById('titleOverlay')?.hidden;
      },null,{timeout:180000,polling:1000});
      await page.keyboard.press('h');
      await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
        null,{timeout:25000});
      await page.locator('#hotelTarget').selectOption({label:'One Times Square · Roof Close'});
      await page.waitForTimeout(1300);
      const q=await page.evaluate(()=>{
        const c=document.getElementById('glCanvas');
        const g=c?.getContext('webgl2');
        const view=document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text;
        return {ready:!!g&&!g.isContextLost(),glError:g?.getError(),
          width:c?.width||0,height:c?.height||0,
          view,skywalk:window.PatrolNycSkywalkQA||null};
      });
      assert(q.ready&&q.width>=500&&q.height>=300,'Live game WebGL missing');
      assert.equal(q.glError,0,'WebGL error');
      assert.equal(q.view,'One Times Square · Roof Close');
      assert.equal(q.skywalk?.enabled,mode==='on');
      if(mode==='on'){
        assert(q.skywalk.triangles>100&&q.skywalk.triangles<600);
        assert.equal(q.skywalk.realCantileverFeet,55);
        assert.equal(q.skywalk.addedDrawCalls,0);
        assert.equal(q.skywalk.newTextures,0);
      }else assert.equal(q.skywalk.triangles,0);
      report.frames[mode]={...q};
      // Repeated actual requestAnimationFrame intervals. These are software
      // browser presentation timings, not native GPU execution times.
      const pacing=await page.evaluate(async()=>{
        const marks=[];
        await new Promise(resolve=>{
          const step=t=>{
            marks.push(t);
            if(marks.length<41)requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });
        const deltas=marks.slice(1).map((t,i)=>t-marks[i])
          .filter(x=>x>=0).sort((a,b)=>a-b);
        return {samples:deltas.length,p50ms:deltas[Math.floor(deltas.length*.50)],
          p95ms:deltas[Math.floor(deltas.length*.95)]};
      });
      report.frames[mode].softwareRAF=pacing;
      const file=path.join(dir,mode+'-one-times-same-camera.png');
      const screenshot=await page.locator('#glCanvas').screenshot({
        path:file,timeout:45000,animations:'disabled'});
      const summary=pixels(screenshot);
      assert(summary.colors>30&&summary.nonblackFraction>.06,
        'Black or nearly blank image in '+mode);
      report.screenshots.push({mode,...summary});
      imgs.push(screenshot);
      await page.close();
    }
    report.difference=compare(imgs[0],imgs[1]);
    assert(report.difference.changedSamples>150 &&
      report.difference.upperCenterChangedSamples>90,
      'North roof close-up must show spatially significant visible source-backed Skywalk geometry');
    assert.equal(report.errors.length,0,'Browser console/page errors');
    report.passed=true;
  }catch(error){
    report.failure=String(error);
    report.errors.push(String(error.stack||error));
    process.exitCode=1;
  }finally{
    fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
    console.log('NYC source Skywalk production camera QA '+JSON.stringify(report));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
