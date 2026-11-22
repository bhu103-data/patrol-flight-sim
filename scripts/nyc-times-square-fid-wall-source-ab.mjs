// Exact-current PATROL Manhattan 44th Street GIS source-FID A/B.
// All changes are opt-in diagnostics. No production building or collision edits.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';

const root=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/nyc-fid-wall-source-ab';
await mkdir(dir,{recursive:true});
const report={
  passed:false,errors:[],warnings:[],sourceCommit:process.env.GITHUB_SHA||null,
  camera:'44th Street LED Canyon',viewport:[1280,720],
  rois:{leftWall:[0,0,460,720],centerWall:[460,0,900,720],
    rightLed:[900,0,1280,720],fullFrame:[0,0,1280,720]},
  screenshots:[],fidScan:[],fidScanTop:[],fidScanAmbiguous:true,
  method:'paired same-camera Playwright PNGs: baseline -> one source FID omitted -> exact FID restore; only baseline/restored stable pixels count'
};
const check=(ok,message)=>{if(!ok)throw Error(message)};
const maxDelta=(a,b,i)=>Math.max(
  Math.abs(a.data[i]-b.data[i]),
  Math.abs(a.data[i+1]-b.data[i+1]),
  Math.abs(a.data[i+2]-b.data[i+2])
);
function measureStable(before,omitted,restored,roi){
  const [x0,y0,x1,y1]=roi;
  let samples=0,stable=0,changed24=0,changed45=0,meanAbs=0,
    restore24=0,restore45=0;
  for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){
    const i=(y*before.width+x)*4;
    const restoreDelta=maxDelta(before,restored,i);
    samples++;
    if(restoreDelta>=24){
      restore24++;
      if(restoreDelta>=45)restore45++;
      continue;
    }
    stable++;
    const delta=maxDelta(before,omitted,i);
    meanAbs+=(Math.abs(before.data[i]-omitted.data[i])+
      Math.abs(before.data[i+1]-omitted.data[i+1])+
      Math.abs(before.data[i+2]-omitted.data[i+2]))/3;
    if(delta>=24)changed24++;
    if(delta>=45)changed45++;
  }
  return {
    samples,stableSamples:stable,
    stableFraction:Number((stable/Math.max(1,samples)).toFixed(4)),
    changed24Fraction:Number((changed24/Math.max(1,stable)).toFixed(4)),
    changed45Fraction:Number((changed45/Math.max(1,stable)).toFixed(4)),
    meanAbsRgb:Number((meanAbs/Math.max(1,stable)).toFixed(2)),
    restoreDrift24Fraction:Number((restore24/Math.max(1,samples)).toFixed(4)),
    restoreDrift45Fraction:Number((restore45/Math.max(1,samples)).toFixed(4)),
    mask:'baseline/restored max RGB delta < 24'
  };
}
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
let page=null;
async function captureFrame(){
  const state=await page.evaluate(()=>{
    const canvas=document.getElementById('glCanvas');
    const gl=canvas?.getContext('webgl2');
    return {webgl2:Boolean(gl&&!gl.isContextLost()),glError:gl?.getError(),
      camera:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent};
  });
  check(state.webgl2&&state.glError===0&&state.camera===report.camera,
    'Invalid WebGL2/camera state: '+JSON.stringify(state));
  await page.evaluate(()=>document.body.classList.add('patrol-qa-scene-only'));
  let bytes;
  try{bytes=await page.locator('#glCanvas').screenshot({timeout:90000});}
  finally{await page.evaluate(()=>document.body.classList.remove('patrol-qa-scene-only'));}
  const png=PNG.sync.read(bytes);
  check(png.width===1280&&png.height===720,'Unexpected Playwright camera screenshot dimensions');
  return png;
}
async function waitForPaint(){
  await page.evaluate(()=>new Promise(resolve=>
    requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function checkpoint(){
  report.completedFids=report.fidScan.length;
  await writeFile(dir+'/report.partial.json',JSON.stringify(report,null,2));
}
try{
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('JS '+e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push('console '+m.text());});
  page.on('requestfailed',r=>{
    if(r.url().includes('/assets/nyc/')&&r.failure()?.errorText?.includes('ERR_'))
      report.errors.push('NYC asset '+r.url());
  });
  const response=await page.goto(root+'/index.html?nycFidProbe=1',
    {waitUntil:'domcontentloaded',timeout:60000});
  check(response?.ok(),'PATROL main page failed to load');
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
      if(!el)throw Error('Missing environment selector '+id);
      el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  await page.waitForFunction(()=>{
    const api=window.__patrolNycFidProbe;
    return typeof api?.setSkippedFids==='function';
  },null,{timeout:60000});
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
    null,{timeout:15000});
  await page.locator('#hotelZoom').evaluate(el=>{
    el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.locator('#hotelTarget').selectOption({label:report.camera});
  await page.waitForTimeout(1000);

  const baselineStats=await page.evaluate(()=>
    window.__patrolNycFidProbe.setSkippedFids([]));
  const fids=baselineStats.sourceFids;
  check(Array.isArray(fids)&&fids.length>0,'No actual rendered GIS source FIDs');
  check(baselineStats.skippedDiagnosticFids===0,'Baseline unexpectedly skips a source FID');
  report.baseline={sourceBuildings:baselineStats.sourceBuildings,
    sourceFids:fids,sourceCount:fids.length};
  await waitForPaint();
  const baseline=await captureFrame();
  const baselineControl=await captureFrame();
  report.baselineControl={};
  for(const [name,roi] of Object.entries(report.rois))
    report.baselineControl[name]=measureStable(baseline,baselineControl,baselineControl,roi);
  report.fidScanStableGate=report.baselineControl.leftWall.stableFraction>=.60;
  check(report.fidScanStableGate,
    'Baseline/restore-control left-wall stable pixels fell below 60%');

  for(let index=0;index<fids.length;index++){
    const fid=fids[index];
    const omittedStats=await page.evaluate(id=>
      window.__patrolNycFidProbe.setSkippedFids([id]),fid);
    check(omittedStats.skippedDiagnosticFids===1&&
      omittedStats.sourceBuildings===baselineStats.sourceBuildings-1&&
      !omittedStats.sourceFids.includes(fid)&&
      omittedStats.sourceFids.length===fids.length-1,
      'Did not remove exactly one rendered source building: '+fid);
    await waitForPaint();
    const omitted=await captureFrame();
    const regions={};
    for(const [name,roi] of Object.entries(report.rois))
      regions[name]=measureStable(baseline,omitted,baselineControl,roi);
    const restoredStats=await page.evaluate(()=>
      window.__patrolNycFidProbe.setSkippedFids([]));
    check(restoredStats.skippedDiagnosticFids===0&&
      restoredStats.sourceBuildings===baselineStats.sourceBuildings&&
      JSON.stringify(restoredStats.sourceFids)===JSON.stringify(fids),
      'Failed to restore exact source-FID inventory after '+fid);
    await waitForPaint();
    report.fidScan.push({fid,removedExactlyOneSourceBuilding:true,
      sourceCountBefore:fids.length,sourceCountAfter:omittedStats.sourceFids.length,
      regions});
    if((index+1)%10===0){
      const restoredCheckpoint=await captureFrame();
      const stability=measureStable(baseline,baselineControl,restoredCheckpoint,report.rois.leftWall);
      report.restoreCheckpoints=report.restoreCheckpoints||[];
      report.restoreCheckpoints.push({completedFids:index+1,
        restoreDrift24Fraction:stability.restoreDrift24Fraction});
    }
    if((index+1)%5===0)await checkpoint();
  }
  report.fidScan.sort((a,b)=>
    b.regions.leftWall.changed45Fraction-a.regions.leftWall.changed45Fraction);
  report.fidScanTop=report.fidScan.slice(0,12);
  const top=report.fidScan[0],runner=report.fidScan[1];
  check(!!top,'FID scan produced no ranked source objects');

  // Full paired verification is reserved for the highest-impact FID only.
  const before=await captureFrame();
  const omittedStats=await page.evaluate(id=>
    window.__patrolNycFidProbe.setSkippedFids([id]),top.fid);
  check(omittedStats.skippedDiagnosticFids===1&&
    omittedStats.sourceBuildings===baselineStats.sourceBuildings-1,
    'Top FID verification did not omit exactly one building');
  await waitForPaint();
  const omitted=await captureFrame();
  const restoredStats=await page.evaluate(()=>
    window.__patrolNycFidProbe.setSkippedFids([]));
  check(restoredStats.skippedDiagnosticFids===0&&
    restoredStats.sourceBuildings===baselineStats.sourceBuildings&&
    JSON.stringify(restoredStats.sourceFids)===JSON.stringify(fids),
    'Top FID verification failed to restore the exact inventory');
  await waitForPaint();
  const restored=await captureFrame();
  const robustRegions={};
  for(const [name,roi] of Object.entries(report.rois))
    robustRegions[name]=measureStable(before,omitted,restored,roi);
  report.fidScanBest={...top,robustRegions};
  report.finalRestoreStable=robustRegions.leftWall.stableFraction>=.60&&
    robustRegions.leftWall.restoreDrift24Fraction<.40;
  check(report.finalRestoreStable,'Final exact FID restore was not visually stable');

  const margin=top&&runner?
    top.regions.leftWall.changed45Fraction-runner.regions.leftWall.changed45Fraction:0;
  report.fidScanMargin=Number(margin.toFixed(4));
  report.fidScanAmbiguous=!runner||
    margin<Math.max(.005,top.regions.leftWall.changed45Fraction*.10);
  report.fidScanHypothesis=report.fidScanAmbiguous||
    top.regions.leftWall.changed45Fraction<.035||
    robustRegions.leftWall.changed45Fraction<.025
      ?'INCONCLUSIVE: no uniquely dominant source FID has a stable >=3.5% left-wall effect'
      :'Highest-impact single source FID in the left-wall ROI: '+top.fid;
  const name='44th-skip-fid-'+top.fid;
  await writeFile(dir+'/44th-fid-baseline.png',PNG.sync.write(before));
  await writeFile(dir+'/'+name+'.png',PNG.sync.write(omitted));
  await writeFile(dir+'/44th-fid-restored.png',PNG.sync.write(restored));
  report.screenshots=['44th-fid-baseline.png',name+'.png','44th-fid-restored.png'];

  check(report.errors.length===0,'Browser errors: '+report.errors.join('; '));
  report.passed=true;
}catch(error){
  report.errors.push(error.stack||String(error));
  process.exitCode=1;
}finally{
  await writeFile(dir+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
