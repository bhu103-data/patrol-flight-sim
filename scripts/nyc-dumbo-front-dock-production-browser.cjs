'use strict';
// Same original PATROL Manhattan game, same in-game DUMBO Front/Dock camera.
// Off/on is a UI/geometry audit, NOT a licensed-photo six-DoF registration.
// Frame timing uses software SwiftShader and must NOT be described as GPU FPS.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('/tmp/patrol-browser/node_modules/playwright');
const {PNG}=require('/tmp/patrol-browser/node_modules/pngjs');
const root='http://127.0.0.1:8137/index.html';
const output=path.resolve('artifacts/nyc-dumbo-front-dock-live');
fs.mkdirSync(output,{recursive:true});
const report={
  schema:'patrol-nyc-dumbo-2022-official-roadbed-2026-dot-live-qa-v1',
  camera:'DUMBO · Front Dock Real Road',
  source:'NYC OTI 2022 Roadbed FeatureServer/20; NYC DOT June 2026 planned Front/Dock bike route',
  render:'Chromium WebGL2 SwiftShader SOFTWARE (no native GPU latency)',
  snapshots:[],errors:[],passed:false,perf:{}
};
function samplePNG(buffer){
  const p=PNG.sync.read(buffer);
  const codes=new Set(),counts={bright:0,green:0,pixels:0};
  for(let y=85;y<p.height-35;y+=5)for(let x=75;x<p.width-35;x+=5){
    const i=(y*p.width+x)*4;
    const r=p.data[i],g=p.data[i+1],b=p.data[i+2];
    codes.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
    if(r+g+b>150)counts.bright++;
    if(g>r*1.15&&g>b*.94&&g>45)counts.green++;
    counts.pixels++;
  }
  return {width:p.width,height:p.height,palette:codes.size,...counts};
}
function difference(a,b){
  const p=PNG.sync.read(a),q=PNG.sync.read(b);
  assert.equal(p.width,q.width);
  assert.equal(p.height,q.height);
  let n=0,roi=0,count=0,roiCount=0;
  for(let y=0;y<p.height;y+=4)for(let x=0;x<p.width;x+=4){
    const at=(y*p.width+x)*4;
    const d=Math.abs(p.data[at]-q.data[at])+
      Math.abs(p.data[at+1]-q.data[at+1])+
      Math.abs(p.data[at+2]-q.data[at+2]);
    if(d>52)n++;count++;
    if(y>p.height*.17&&y<p.height*.78&&x>p.width*.18&&x<p.width*.81){
      roiCount++;
      if(d>52)roi++;
    }
  }
  return {changed:n,samples:count,roadCameraChanged:roi,roadCameraSamples:roiCount};
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle',
    '--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox'
  ]});
  try{
    const imgs=[];
    for(const mode of ['off','on']){
      const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
      page.on('pageerror',e=>report.errors.push(mode+' page: '+String(e)));
      page.on('console',m=>{
        if(m.type()==='error'&&/WebGL|shader|DUMBO|official|source/i.test(m.text()))
          report.errors.push(mode+' console: '+m.text().slice(0,400));
      });
      await page.addInitScript(()=>{
        try{localStorage.setItem('patrol.nyc.oneTimes.nextCreative','500')}catch{}
      });
      await page.goto(root+'?nycDumboRoadbed='+mode,
        {waitUntil:'domcontentloaded',timeout:45000});
      assert.equal(await page.locator('input[name=flightMap]:checked').inputValue(),
        'manhattan','Actual Manhattan map must load first');
      await page.locator('#startFlight').click({timeout:15000});
      await page.waitForFunction(()=>{
        const a=document.getElementById('loadOverlay'),
          c=document.getElementById('glCanvas');
        return a?.classList.contains('done')&&c?.width>=500 &&
          document.getElementById('titleOverlay')?.hidden;
      },null,{timeout:180000});
      await page.waitForFunction(()=>window.PatrolDumboRoadQA!==undefined,
        null,{timeout:55000});
      await page.keyboard.press('h');
      await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
        null,{timeout:25000});
      await page.locator('#hotelTarget').selectOption({label:report.camera});
      await page.waitForTimeout(550);
      const geometry=await page.evaluate(()=>{
        const canvas=document.querySelector('#glCanvas'),
          g=canvas?.getContext('webgl2');
        return {camera:document.querySelector('#hotelTarget')?.selectedOptions?.[0]?.text,
          qa:window.PatrolDumboRoadQA,
          width:canvas?.width,height:canvas?.height,
          webgl2:!!g,contextLost:g?.isContextLost()??true,
          glError:g?.getError()??-1};
      });
      report.perf[mode]={geometry};
      assert.equal(geometry.camera,report.camera,'Actual game source camera');
      assert(geometry.webgl2&&!geometry.contextLost);
      assert.equal(geometry.glError,0);
      if(mode==='on'){
        assert(geometry.qa?.enabled,'Official source rendering absent');
        assert(geometry.qa.officialTriangles>=40,
          'Source geometry cannot all be filtered by old city collisions');
        assert(geometry.qa.bikePaintQuads>0,'2026 planned bike treatment not on road');
        assert(geometry.qa.signalHeads===2,'2026 photographed traffic signals not rendered');
        assert(geometry.qa.triangles<1100,'Keep low bounded geometry budget');
        assert(geometry.qa.additionalDrawCalls===0);
        assert(geometry.qa.newTextures===0);
      }else assert(!geometry.qa?.enabled,'Default opt-out must preserve old city');
      const samples=await page.evaluate(async()=>{
        const t=[];
        await new Promise(resolve=>{
          const step=x=>{
            t.push(x);
            if(t.length<31)requestAnimationFrame(step);
            else resolve();
          };
          requestAnimationFrame(step);
        });
        const delta=t.slice(1).map((v,i)=>v-t[i]).sort((a,b)=>a-b);
        return {samples:delta.length,p50ms:delta[Math.floor(delta.length*.5)],
          p95ms:delta[Math.floor(delta.length*.95)]};
      });
      report.perf[mode].softwareRaf=samples;
      const png=await page.locator('#glCanvas').screenshot({
        path:path.join(output,'front-dock-'+mode+'.png'),timeout:45000,
        animations:'disabled'});
      const summary=samplePNG(png);
      assert(summary.palette>25&&summary.bright>100,
        'Black or empty production game screenshot');
      report.snapshots.push({mode,...summary});
      imgs.push(png);
      if(mode==='on'){
        // This exact original aircraft game, not the #248 standalone pilot:
        // aircraft control must change actual native plane state in flight.
        await page.keyboard.press('h');
        await page.locator('#glCanvas').focus();
        const before=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
        assert(before?.playing&&Array.isArray(before.position),'Real aircraft state missing');
        await page.keyboard.down('w');
        let movementObserved=false;
        try{
          await page.waitForFunction(start=>{
            const now=window.PatrolSpaceBridge?.getState?.();
            return now?.playing&&Array.isArray(now.position)&&
              Math.hypot(...now.position.map((v,i)=>v-start.position[i]))>.02 &&
              Math.abs(now.pitch-start.pitch)>.005;
          },before,{polling:350,timeout:25000});
          movementObserved=true;
        }finally{await page.keyboard.up('w')}
        assert(movementObserved,'W key never moved native original flight plane');
        const after=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
        report.flightControl={
          observed:true,input:'W',before:before.position,after:after.position,
          pitchDelta:Math.abs(after.pitch-before.pitch)};
        await page.locator('#flightMenuBtn').click({force:true});
        await page.waitForFunction(()=>!document.querySelector('#titleOverlay')?.hidden,
          null,{timeout:15000});
        const startMap=async map=>{
          await page.locator('input[name=flightMap][value='+map+']').check({force:true});
          await page.locator('#startFlight').click({force:true});
          await page.waitForFunction(()=>{
            const a=document.querySelector('#loadOverlay'),
              b=document.querySelector('#titleOverlay');
            return a?.classList.contains('done')&&b?.hidden;
          },null,{timeout:150000});
          const state=await page.evaluate(()=>{
            const g=document.querySelector('#glCanvas')?.getContext('webgl2');
            return {state:window.PatrolSpaceBridge?.getState?.(),glError:g?.getError()};
          });
          assert.equal(state.state?.map,map,'Selected map switching failed');
          assert(state.state?.playing,'Airplane did not resume after changing maps');
          assert.equal(state.glError,0);
          return {map,playing:true,glError:0};
        };
        const coast=await startMap('coast');
        await page.locator('#flightMenuBtn').click({force:true});
        const back=await startMap('manhattan');
        report.crossMap={coast,back};
      }
      await page.close();
    }
    report.difference=difference(imgs[0],imgs[1]);
    assert(report.difference.roadCameraChanged>120,
      'Official roadbed does not change the actual DUMBO camera image sufficiently');
    assert.equal(report.errors.length,0);
    report.passed=true;
  }catch(error){
    report.failure=String(error);
    report.errors.push(String(error.stack||error));
    process.exitCode=1;
  }finally{
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    console.log('NYC_DUMBO_OFFICIAL_ROAD_QA '+JSON.stringify(report));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1});
