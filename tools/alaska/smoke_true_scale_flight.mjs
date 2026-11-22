/**
 * Real browser / actual WebGL2 proof for the north-up, metre-scale Tracy Arm
 * geometry. This DOES NOT certify photo-realism, native GPU FPS, engine physics
 * or a verified source vertical datum.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[],failedAssets=[];
const native=process.env.PATROL_ALASKA_IFSAR5M==='1';
const fine=process.env.PATROL_ALASKA_5M==='1';
if(native&&fine)throw Error('Choose one isolated Alaska source profile per browser run');
const prefix=native?'alaska-true-scale-ifsar5m':
  fine?'alaska-true-scale-five-metre':'alaska-true-scale-source-flight';
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{
  if(r.url().includes('/assets/alaska/') && r.status()>=400)
    failedAssets.push(r.url()+' '+r.status());
});
const result={kind:'Actual Chromium WebGL2 SwiftShader software rendering, not native GPU',
  source:native?'USGS native OPR IfSAR 5m, NAVD88/GEOID09 index metadata':
    fine?'USGS 3DEP dynamic ~5m local sample':'USGS 3DEP original 256x256, WGS84 north-up',
  images:[]};
try{
  const query=native?'?alaskaSource=ifsar5m':fine?'?alaskaDetail=5m':'';
  const p=await page.goto('http://127.0.0.1:8765/tracy-arm-true-scale.html'+query,
    {waitUntil:'domcontentloaded',timeout:30000});
  if(p?.status()!==200)throw Error('Pilot html not served');
  await page.waitForFunction(()=>{
    const s=window.PatrolTrueScaleQA?.();
    return s?.active && s.frames>=6 || document.getElementById('status')?.textContent?.startsWith('Terrain pilot failed:');
  },null,{timeout:120000});
  const start=await page.evaluate(()=>window.PatrolTrueScaleQA());
  const profilePass=native
    ? start.detailMode==='source-native-ifsar5m-lod15m'&&
      start.cells===512*960&&start.triangles===980098&&
      start.sourceCellCount===1536*2880&&
      start.sourceSpacingMeters?.every(x=>x>4.8&&x<5.2)&&
      start.meshSpacingMeters?.every(x=>x>14.4&&x<15.6)&&
      start.sourceVerticalDatum==='NAVD88 / GEOID09'&&
      start.sourceVerticalCrs==='EPSG:5703'&&
      start.sourceProject==='Alaska_Mid_Accuracy_DEM_Summer_2015'&&
      start.workunit==='AK_IFSAR_Sum_L4_C353_2010'&&
      start.sourceCoverageValidFraction===1&&
      start.sourceTileSha256?.length===2&&start.sourceTileSha256.every(x=>/^[a-f0-9]{64}$/.test(x))&&
      start.sourcePeak>1800&&start.sourcePeak<2000
    : fine
      ? start.detailMode==='source-5m-local'&&start.cells===65536&&
        start.triangles===130050&&start.terrainPeak>500&&start.terrainPeak<1000
      : start.detailMode==='coarse-30m'&&start.cells===65536&&
        start.triangles===130050&&start.terrainPeak===1836;
  if(!start.active||start.contextLost||!profilePass||
     start.detailWarning||start.gpuErrors.length||!start.bounds||!start.photoReady||!start.officialSourceExtentCorrected)
    throw Error('Wrong active georeferenced 3D source terrain '+JSON.stringify(start));
  const width=start.bounds.maxE-start.bounds.minE,
    height=start.bounds.maxN-start.bounds.minN;
  if(fine?(width<1150||width>1250||height<1200||height>1300||
     start.sourceSpacingMeters.some(x=>x<=4.4||x>=5.3)):
    (width<7500||width>7900||height<14000||height>14700))
    throw Error('Source geometry is not corresponding verified metre-scale tile '+
      JSON.stringify({width,height,spacing:start.sourceSpacingMeters}));
  if(!fine && (start.bbox[1]!==57.822||start.bbox[3]!==57.952))
    throw Error('Source pixels not at USGS actual export extent');
  if((fine||native) && start.sourceSpacingMeters.some(x=>x<=4.4||x>=5.3))
    throw Error('5m source actual resolution differs from declared request');
  if(native&&start.meshSpacingMeters.some(x=>x<=14.4||x>=15.6))
    throw Error('Native 5m source is not rendered at declared 15m LOD');
  if(Math.abs(start.origin[0]+133.2)>.001||Math.abs(start.origin[1]-57.887)>.001)
    throw Error('Incorrect true source WGS84 origin');
  await page.screenshot({path:'artifacts/'+prefix+'-start.png'});
  result.images.push(prefix+'-start.png');
  // Screenshot can advance many frames. Capture the counter *after* the
  // screenshot; otherwise the wait may already be true before the key press.
  const beforeMovementFrames=await page.evaluate(()=>window.PatrolTrueScaleQA().frames);
  await page.locator('#scene').focus({timeout:10000});
  await page.keyboard.down('w');
  await page.waitForFunction(startFrames=>window.PatrolTrueScaleQA().frames>=startFrames+8,
    beforeMovementFrames,{timeout:120000});
  await page.keyboard.up('w');
  const after=await page.evaluate(()=>window.PatrolTrueScaleQA());
  const distance=Math.hypot(after.camera[0]-start.camera[0],
    after.camera[2]-start.camera[2]);
  if(distance<7||after.contextLost||after.gpuErrors.length)
    throw Error('Source-metre flight camera did not move or GL lost: '+
      JSON.stringify({distance,after}));
  await page.screenshot({path:'artifacts/'+prefix+'-after.png'});
  result.images.push(prefix+'-after.png');
  if(errors.length||failedAssets.length)
    throw Error('Browser errors '+JSON.stringify({errors,failedAssets}));
  Object.assign(result,{pass:true,start,after,distanceMetres:distance,
    sourceExtentMetres:{eastWest:width,southNorth:height},
    errors,failedAssets});
  writeFileSync('artifacts/'+prefix+'.json',JSON.stringify(result,null,2));
  console.log('PASS real-coordinate WebGL2 '+(native?'native 5m IfSAR / 15m full-area LOD':
      fine?'~5m local source tile':'~30m full source')+' flightable USGS mesh: '+
    JSON.stringify({terrainTriangles:start.triangles,peakMetres:start.terrainPeak,
      sourcePeakMetres:start.sourcePeak,sourceCells:start.sourceCellCount,
      sourceSpacing:start.sourceSpacingMeters,meshSpacing:start.meshSpacingMeters,
      extent:result.sourceExtentMetres,cameraMovementMetres:distance,
      frames:[start.frames,after.frames],gpuErrors:after.gpuErrors}));
}finally{
  await page.close();
  await browser.close();
}
