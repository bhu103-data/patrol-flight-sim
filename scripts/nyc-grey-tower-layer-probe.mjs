// Diagnostic only: identify who actually draws the foreground grey tower
// by temporarily omitting ONE render mesh group at a frozen scenic camera.
// Rendering switches are debug-gated and never change game city geometry.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/nyc-visual-provenance';
await mkdir(dir,{recursive:true});
const report={passed:false,errors:[],warnings:[],camera:'44th Street LED Canyon',
  focusRois:{leftWall:[0,0,460,720],centerWall:[460,0,900,720],
    rightLed:[900,0,1280,720],fullFrame:[0,0,1280,720]},
  hypothesis:'unknown',comparison:{},renders:[]};
const check=(ok,why)=>{if(!ok)throw Error(why)};
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
let page=null;
const screenshots={};
const groups=['none','procedural','landscape','scenery','gis','street','roadChunks','hero','park','screens','lights','landmarks'];
function compare(ref,next){
  const a=screenshots[ref],b=screenshots[next];
  check(a&&b&&a.width===b.width&&a.height===b.height,'Incompatible source images');
  const result={};
  for(const [region,[x0,y0,x1,y1]] of Object.entries(report.focusRois)){
    let pixels=0,changed24=0,changed45=0,meanAbs=0;
    for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){
      const i=(y*a.width+x)*4;
      const dr=Math.abs(a.data[i]-b.data[i]);
      const dg=Math.abs(a.data[i+1]-b.data[i+1]);
      const db=Math.abs(a.data[i+2]-b.data[i+2]);
      const delta=Math.max(dr,dg,db);
      meanAbs+=(dr+dg+db)/3;
      if(delta>=24)changed24++;
      if(delta>=45)changed45++;
      pixels++;
    }
    result[region]={samples:pixels,
      changed24Fraction:Number((changed24/pixels).toFixed(4)),
      changed45Fraction:Number((changed45/pixels).toFixed(4)),
      meanAbsRgb:Number((meanAbs/pixels).toFixed(2)),
      note:'A/B only; changing hidden meshes can reveal other occluded meshes'};
  }
  return result;
}
try{
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('JS '+e.message));
  page.on('requestfailed',r=>{
    if(r.url().includes('/assets/nyc/')&&r.failure()?.errorText?.includes('ERR_'))
      report.errors.push('NYC asset '+r.url());
  });
  const url=base+'/index.html?nycVisualProbe=1';
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  check(response?.ok(),'Game URL did not load');
  await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
  await page.locator('#startFlight').click({force:true});
  await page.waitForFunction(()=>{
    const title=document.getElementById('titleOverlay');
    const load=document.getElementById('loadOverlay');
    return title?.hidden&&load?.classList.contains('done');
  },null,{timeout:120000});
  await page.evaluate(()=>{
    for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
      const el=document.getElementById(id);
      if(!el)throw Error('Missing '+id);
      el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  await page.waitForFunction(()=>{
    const s=window.__patrolNycVisualProbe?.stats();
    return s?.city && s?.proceduralTriangles>0 &&
      s?.sceneryTriangles>0 && s?.gisTriangles>0 &&
      typeof window.__patrolNycVisualProbe?.setGisSkippedFids==='function';
  },null,{timeout:60000});
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
    null,{timeout:15000});
  await page.locator('#hotelZoom').evaluate(el=>{
    el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#hotelTarget').selectOption({label:report.camera});
  await page.addStyleTag({content:
    'body.patrol-qa-scene-only * {visibility:hidden!important} '+
    'body.patrol-qa-scene-only #glCanvas {visibility:visible!important}'});
  await page.waitForTimeout(1200);
  report.initial=await page.evaluate(()=>window.__patrolNycVisualProbe.stats());
  check(report.initial.city&&report.initial.proceduralTriangles>0,
    'Did not load live Manhattan background building mesh');
  async function capture(name,hidden){
    const state=await page.evaluate(mode=>
      window.__patrolNycVisualProbe.setHidden(mode),hidden);
    check(state.hidden===hidden&&state.city,
      'Render gate did not select intended scene category '+hidden);
    await page.waitForTimeout(650);
    const render=await page.evaluate(()=>{
      const gl=document.getElementById('glCanvas')?.getContext('webgl2');
      return {valid:Boolean(gl&&!gl.isContextLost()),glError:gl?.getError(),
        selected:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent};
    });
    check(render.valid&&render.glError===0&&render.selected===report.camera,
      'Camera/WebGL mismatch: '+JSON.stringify(render));
    await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
    let img;
    try{
      img=await page.locator('#glCanvas').screenshot({
        path:dir+'/'+name+'.png',timeout:90000});
    }finally{
      await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
    }
    const png=PNG.sync.read(img);
    check(png.width===1280&&png.height===720,'Unexpected camera frame size');
    screenshots[name]=png;
    report.renders.push({name,hidden,stats:await page.evaluate(()=>
      window.__patrolNycVisualProbe.stats())});
  }
  for(const group of groups)await capture('44th-'+group,group);
  await capture('44th-restored','none');
  for(const group of groups.slice(1))
    report.comparison[group]=compare('44th-none','44th-'+group);
  report.restored=compare('44th-none','44th-restored');
  const baselineStats=await page.evaluate(()=>{
    const api=window.__patrolNycVisualProbe;
    if(typeof api?.setGisSkippedFids!=='function')
      throw Error('Opt-in per-FID GIS rebuild API is unavailable');
    return api.setGisSkippedFids([]);
  });
  check(Array.isArray(baselineStats.sourceFids)&&baselineStats.sourceFids.length>0,
    'GIS source FID inventory is unavailable');
  const sourceFids=baselineStats.sourceFids.slice();
  report.gisSourceFids=sourceFids;
  report.fidScanMethod='paired 1280x720 Playwright PNGs; baseline→skip→restore per FID; only pixels stable between baseline and restore count';
  const captureFidFrame=async()=>{
    const state=await page.evaluate(()=>{
      const gl=document.getElementById('glCanvas')?.getContext('webgl2');
      return {valid:Boolean(gl&&!gl.isContextLost()),glError:gl?.getError(),
        selected:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent};
    });
    check(state.valid&&state.glError===0&&state.selected===report.camera,
      'FID PNG capture has invalid WebGL/camera state: '+JSON.stringify(state));
    await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
    let bytes;
    try{
      bytes=await page.locator('#glCanvas').screenshot({timeout:90000});
    }finally{
      await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));
    }
    const png=PNG.sync.read(bytes);
    check(png.width===1280&&png.height===720,
      'Per-FID Playwright screenshot must be exact 1280x720');
    return {png,glError:state.glError};
  };
  const measureStableRoi=(before,skipped,restored,roi)=>{
    const [x0,y0,x1,y1]=roi;
    let samples=0,stable=0,changed24=0,changed45=0,meanAbs=0,restore45=0;
    for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){
      const i=(y*before.width+x)*4;
      const maxDiff=(a,b)=>Math.max(
        Math.abs(a.data[i]-b.data[i]),
        Math.abs(a.data[i+1]-b.data[i+1]),
        Math.abs(a.data[i+2]-b.data[i+2]));
      const restoreDelta=maxDiff(before,restored);
      samples++;
      if(restoreDelta>=24){if(restoreDelta>=45)restore45++;continue;}
      stable++;
      const delta=maxDiff(before,skipped);
      const rgb=(Math.abs(before.data[i]-skipped.data[i])+
        Math.abs(before.data[i+1]-skipped.data[i+1])+
        Math.abs(before.data[i+2]-skipped.data[i+2]))/3;
      meanAbs+=rgb;
      if(delta>=24)changed24++;
      if(delta>=45)changed45++;
    }
    return {
      samples,stableSamples:stable,
      stableFraction:Number((stable/Math.max(1,samples)).toFixed(4)),
      changed24Fraction:Number((changed24/Math.max(1,stable)).toFixed(4)),
      changed45Fraction:Number((changed45/Math.max(1,stable)).toFixed(4)),
      meanAbsRgb:Number((meanAbs/Math.max(1,stable)).toFixed(2)),
      restoreDrift45Fraction:Number((restore45/Math.max(1,samples)).toFixed(4)),
      mask:'only same-pixel baseline→restored max RGB delta < 24',
      note:'Dynamic cars/LED pixels that fail the restore-stability test are excluded'
    };
  };
  report.fidScan=[];
  let bestFidFrame=null;
  for(let index=0;index<sourceFids.length;index++){
    const fid=sourceFids[index];
    await page.evaluate(()=>window.__patrolNycVisualProbe.setGisSkippedFids([]));
    await page.waitForTimeout(120);
    const before=await captureFidFrame();
    const skippedStats=await page.evaluate(id=>
      window.__patrolNycVisualProbe.setGisSkippedFids([id]),fid);
    check(skippedStats.skippedDiagnosticFids===1 &&
      Array.isArray(skippedStats.sourceFids) &&
      !skippedStats.sourceFids.includes(fid) &&
      skippedStats.sourceFids.length===sourceFids.length-1,
      'Diagnostic did not remove exactly source FID '+fid);
    await page.waitForTimeout(650);
    const skipped=await captureFidFrame();
    const restoredStats=await page.evaluate(()=>
      window.__patrolNycVisualProbe.setGisSkippedFids([]));
    check(restoredStats.skippedDiagnosticFids===0 &&
      JSON.stringify(restoredStats.sourceFids)===JSON.stringify(sourceFids),
      'Diagnostic did not restore the exact original GIS source FID list');
    await page.waitForTimeout(650);
    const restored=await captureFidFrame();
    const regions={};
    for(const [region,roi] of Object.entries(report.focusRois))
      regions[region]=measureStableRoi(before.png,skipped.png,restored.png,roi);
    const result={fid,skippedDiagnosticFids:skippedStats.skippedDiagnosticFids,
      sourceFidsBefore:sourceFids.length,sourceFidsAfter:skippedStats.sourceFids.length,
      glErrors:[before.glError,skipped.glError,restored.glError],regions};
    report.fidScan.push(result);
    if(!bestFidFrame ||
       regions.leftWall.changed45Fraction>
         bestFidFrame.result.regions.leftWall.changed45Fraction){
      bestFidFrame={fid,result,baseline:before.png,skipped:skipped.png,restored:restored.png};
    }
  }
  report.fidScan.sort((a,b)=>
    b.regions.leftWall.changed45Fraction-a.regions.leftWall.changed45Fraction);
  report.fidScanHypothesis=report.fidScan[0] &&
    report.fidScan[0].regions.leftWall.stableFraction>=.60 &&
    report.fidScan[0].regions.leftWall.changed45Fraction>=.035
      ?'Highest-impact stable left-wall GIS source FID: '+report.fidScan[0].fid
      :'INCONCLUSIVE: no single GIS source FID has a stable >=3.5% left-wall pixel effect';
  report.fidScanTop=report.fidScan.slice(0,10);
  report.fidScanGlErrors=report.fidScan.filter(x=>x.glErrors.some(e=>e!==0));
  report.fidScanStableGate=report.fidScan.every(x=>
    x.regions.leftWall.stableFraction>=.60 &&
    x.glErrors.every(e=>e===0) &&
    x.skippedDiagnosticFids===1 &&
    x.sourceFidsAfter===x.sourceFidsBefore-1);
  check(report.fidScan.length===sourceFids.length && sourceFids.length>0,
    'Per-FID PNG scan did not cover every rendered source FID');
  check(report.fidScanGlErrors.length===0,'WebGL errors during per-FID PNG scan');
  check(report.fidScanStableGate,
    'Per-FID PNG scan did not maintain stable control pixels and exact restore');
  if(bestFidFrame){
    const top=bestFidFrame.result.regions.leftWall;
    const name='44th-skip-fid-'+bestFidFrame.fid;
    await writeFile(dir+'/'+name+'.png',PNG.sync.write(bestFidFrame.skipped));
    await writeFile(dir+'/44th-fid-scan-baseline.png',
      PNG.sync.write(bestFidFrame.baseline));
    report.screenshots.push({name,hidden:'none',skippedFid:bestFidFrame.fid});
    report.fidScanBest={fid:bestFidFrame.fid,leftWall:top};
  }
  await capture('44th-fid-scan-restored','none');
  report.fidScanRestored=compare('44th-none','44th-fid-scan-restored');
  report.rankedByRoi=Object.keys(report.focusRois).map(region=>{
    const ranked=Object.entries(report.comparison).map(([layer,regions])=>({
      layer,...regions[region]
    })).sort((a,b)=>b.changed45Fraction-a.changed45Fraction);
    return {region,ranked};
  });
  const left=report.rankedByRoi.find(row=>row.region==='leftWall')?.ranked||[];
  const center=report.rankedByRoi.find(row=>row.region==='centerWall')?.ranked||[];
  report.ranked=left;
  const best=left[0];
  report.hypothesis=best?.changed45Fraction>=.035
    ?'Left-wall source layer: '+best.layer
    :'INCONCLUSIVE: left-wall ROI did not react to tested render groups';
  report.ambiguous=report.restored.leftWall.changed45Fraction>.025 ||
    (left[1]&&left[1].changed45Fraction>=best.changed45Fraction*.87);
  report.centerHypothesis=center[0]?.changed45Fraction>=.035
    ?'Center-wall source layer: '+center[0].layer:'INCONCLUSIVE';
  check(report.errors.length===0,'Browser errors: '+report.errors.join('; '));
  check(report.fidScan.length===baselineStats.sourceFids.length && report.fidScan.length>0,
    'Per-FID GIS occlusion scan did not cover every rendered source FID');
  check(report.fidScanGlErrors.length===0,'WebGL errors during per-FID GIS scan');
  check(best&&best.changed45Fraction>=.035,
    'Left-wall ROI did not react to any probed mesh source; another render group remains uninstrumented');
  report.passed=true;
}catch(e){
  report.errors.push(e.stack||String(e));
  process.exitCode=1;
}finally{
  await writeFile(dir+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
