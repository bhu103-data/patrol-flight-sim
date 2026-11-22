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
const fine=process.env.PATROL_ALASKA_5M==='1';
const prefix=fine?'alaska-true-scale-five-metre':'alaska-true-scale-source-flight';
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{
  if(r.url().includes('/assets/alaska/') && r.status()>=400)
    failedAssets.push(r.url()+' '+r.status());
});
const result={kind:'Actual Chromium WebGL2 SwiftShader software rendering, not native GPU',
  source:'USGS 3DEP baked 256x256, WGS84 north-up; vertical datum unverified',
  images:[]};
try{
  const p=await page.goto('http://127.0.0.1:8765/tracy-arm-true-scale.html'+
    (fine?'?alaskaDetail=5m':''),
    {waitUntil:'domcontentloaded',timeout:30000});
  if(p?.status()!==200)throw Error('Pilot html not served');
  await page.waitForFunction(()=>{
    const s=window.PatrolTrueScaleQA?.();
    return s?.active && s.frames>=6 || document.getElementById('status')?.textContent?.startsWith('Terrain pilot failed:');
  },null,{timeout:120000});
  const start=await page.evaluate(()=>window.PatrolTrueScaleQA());
  if(!start.active||start.contextLost||start.cells!==65536||
     start.triangles!==130050||
     (fine?(start.detailMode!=='source-5m-local'||start.terrainPeak<500||start.terrainPeak>1000):
       (start.detailMode!=='coarse-30m'||start.terrainPeak!==1836))||
     start.detailWarning||start.gpuErrors.length||!start.bounds||!start.photoReady)
    throw Error('Wrong active georeferenced 3D source terrain '+JSON.stringify(start));
  const width=start.bounds.maxE-start.bounds.minE,
    height=start.bounds.maxN-start.bounds.minN;
  if(fine?(width<1150||width>1250||height<1200||height>1300||
     start.sourceSpacingMeters.some(x=>x<=4.4||x>=5.3)):
    (width<7500||width>7900||height<7900||height>8200))
    throw Error('Source geometry is not corresponding verified metre-scale tile '+
      JSON.stringify({width,height,spacing:start.sourceSpacingMeters}));
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
  console.log('PASS real-coordinate WebGL2 '+(fine?'~5m local':'~30m full')+' flightable USGS mesh: '+
    JSON.stringify({terrainTriangles:start.triangles,peakMetres:start.terrainPeak,
      extent:result.sourceExtentMetres,cameraMovementMetres:distance,
      frames:[start.frames,after.frames],gpuErrors:after.gpuErrors}));
}finally{
  await page.close();
  await browser.close();
}
