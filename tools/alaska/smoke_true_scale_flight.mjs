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
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{
  if(r.url().includes('/assets/alaska/') && r.status()>=400)
    failedAssets.push(r.url()+' '+r.status());
});
const result={kind:'Actual Chromium WebGL2 SwiftShader software rendering, not native GPU',
  source:'USGS 3DEP baked 256x256, WGS84 north-up; vertical datum unverified',
  images:[]};
try{
  const p=await page.goto('http://127.0.0.1:8765/tracy-arm-true-scale.html',
    {waitUntil:'domcontentloaded',timeout:30000});
  if(p?.status()!==200)throw Error('Pilot html not served');
  await page.waitForFunction(()=>{
    const s=window.PatrolTrueScaleQA?.();
    return s?.active && s.frames>=6 || document.getElementById('status')?.textContent?.startsWith('Terrain pilot failed:');
  },null,{timeout:120000});
  const start=await page.evaluate(()=>window.PatrolTrueScaleQA());
  if(!start.active||start.contextLost||start.cells!==65536||
     start.triangles!==130050||start.terrainPeak!==1836||
     start.gpuErrors.length||!start.bounds)
    throw Error('Wrong active georeferenced 3D source terrain '+JSON.stringify(start));
  const width=start.bounds.maxE-start.bounds.minE,
    height=start.bounds.maxN-start.bounds.minN;
  if(width<7500||width>7900||height<7900||height>8200)
    throw Error('Source geometry is not surveyed-scale metres '+JSON.stringify({width,height}));
  if(Math.abs(start.origin[0]+133.2)>.001||Math.abs(start.origin[1]-57.887)>.001)
    throw Error('Incorrect true source WGS84 origin');
  await page.screenshot({path:'artifacts/alaska-true-scale-source-flight-start.png'});
  result.images.push('alaska-true-scale-source-flight-start.png');
  await page.keyboard.down('w');
  await page.waitForFunction(startFrames=>window.PatrolTrueScaleQA().frames>=startFrames+5,
    start.frames,{timeout:120000});
  await page.keyboard.up('w');
  const after=await page.evaluate(()=>window.PatrolTrueScaleQA());
  const distance=Math.hypot(after.camera[0]-start.camera[0],
    after.camera[2]-start.camera[2]);
  if(distance<7||after.contextLost||after.gpuErrors.length)
    throw Error('Source-metre flight camera did not move or GL lost: '+
      JSON.stringify({distance,after}));
  await page.screenshot({path:'artifacts/alaska-true-scale-source-flight-after.png'});
  result.images.push('alaska-true-scale-source-flight-after.png');
  if(errors.length||failedAssets.length)
    throw Error('Browser errors '+JSON.stringify({errors,failedAssets}));
  Object.assign(result,{pass:true,start,after,distanceMetres:distance,
    sourceExtentMetres:{eastWest:width,southNorth:height},
    errors,failedAssets});
  writeFileSync('artifacts/alaska-true-scale-source-flight.json',JSON.stringify(result,null,2));
  console.log('PASS real-coordinate WebGL2 flightable 256x256 USGS mesh: '+
    JSON.stringify({terrainTriangles:start.triangles,peakMetres:start.terrainPeak,
      extent:result.sourceExtentMetres,cameraMovementMetres:distance,
      frames:[start.frames,after.frames],gpuErrors:after.gpuErrors}));
}finally{
  await page.close();
  await browser.close();
}
