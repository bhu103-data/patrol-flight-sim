/**
 * Exact-head WebGL2 regression: original true-metre lowflight unaffected,
 * and explicit ?realEdges=1 adds real OTI sidewalk + curb/cut shapes.
 * SwiftShader is NOT a native hardware GPU FPS certification.
 */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const out='artifacts/nyc-true-scale/';
const report={passed:false,errors:[],warnings:[],snapshots:[],
  note:'Source-only 2022 street planimetrics, not verified 2026 curb heights'};
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
let base,enabled;
const shot=async(page,name)=>{
  await page.waitForTimeout(350);
  const png=await page.locator('#scene').screenshot({
    path:out+name+'.png',timeout:90000,animations:'allow'});
  report.snapshots.push(name+'.png');
  return png;
};
const open=async(url)=>{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')report.warnings.push(e.text());});
  const response=await page.goto('http://127.0.0.1:8765/'+url,
    {waitUntil:'domcontentloaded',timeout:60000});
  if(!response?.ok())throw Error('Source preview HTTP error for '+url);
  await page.waitForFunction(()=>window.geoPilotQA?.ready||window.geoPilotQA?.error,
    null,{timeout:90000});
  return page;
};
function deltaPixels(first,second){
  const a=PNG.sync.read(first),b=PNG.sync.read(second);
  if(a.width!==b.width||a.height!==b.height)throw Error('Camera image size mismatch');
  let changed=0;
  for(let y=0;y<a.height;y+=2)for(let x=0;x<a.width;x+=2){
    const k=(y*a.width+x)*4;
    if(Math.abs(a.data[k]-b.data[k])+Math.abs(a.data[k+1]-b.data[k+1])+
       Math.abs(a.data[k+2]-b.data[k+2])>30)changed++;
  }
  return changed;
}
try{
  base=await open('preview.html');
  const baseline=await base.evaluate(()=>window.geoPilotQA);
  if(!baseline.ready||baseline.officialStreetEdges2022!==null||
     baseline.officialRoadbed2022?.features<70||
     !baseline.noInventedStreetSurface||!baseline.sourceRoadSpawn)
    throw Error('Default measured lowflight changed by optional layer');
  const baselinePng=await shot(base,'01-official-lowflight-baseline');
  enabled=await open('preview.html?realEdges=1');
  const props=await enabled.evaluate(()=>({
    ready:window.geoPilotQA?.ready,error:window.geoPilotQA?.error,
    edges:window.geoPilotQA?.officialStreetEdges2022,
    roadbed:window.geoPilotQA?.officialRoadbed2022,
    flightSpawn:window.geoPilotQA?.sourceRoadSpawn,
    noInventedStreetSurface:window.geoPilotQA?.noInventedStreetSurface
  }));
  if(!props.ready||props.error||!props.noInventedStreetSurface||
     props.edges?.year!==2022||props.edges?.sourceOnly!==true||
     props.edges.sidewalkFeatures<25||props.edges.sidewalkTriangles<1000||
     props.edges.curbFeatures<100||props.edges.curbCuts<100||
     props.edges.curbLineVertices<1000||
     props.roadbed?.features<70||!props.flightSpawn)
    throw Error('Wrong real curb/sidewalk lowflight source '+JSON.stringify(props));
  report.source=props;
  const overlayPng=await shot(enabled,'02-optional-real-edges-aerial');
  report.changedCanvasPixelSamples=deltaPixels(baselinePng,overlayPng);
  if(report.changedCanvasPixelSamples<450)
    throw Error('No visibly rendered measured sidewalk/curb geometry on WebGL canvas');
  await enabled.click('#toggleFlight');
  const original=await enabled.evaluate(()=>window.geoPilotQA.getFlight());
  if(!original.mode||original.collision||original.position[1]!==8)
    throw Error('Real source street lowflight spawn was lost '+JSON.stringify(original));
  await shot(enabled,'03-sidewalk-curb-lowflight-street');
  await enabled.keyboard.down('e');
  try{
    await enabled.waitForFunction(initial=>
      window.geoPilotQA.getFlight().position[1]>initial+.5,
      original.position[1],{timeout:45000,polling:200});
  }finally{await enabled.keyboard.up('e');}
  const climbed=await enabled.evaluate(()=>window.geoPilotQA.getFlight());
  await enabled.keyboard.down('w');
  try{await enabled.waitForTimeout(1700);}
  finally{await enabled.keyboard.up('w');}
  const moved=await enabled.evaluate(()=>window.geoPilotQA.getFlight());
  const displacement=Math.hypot(moved.position[0]-climbed.position[0],
    moved.position[2]-climbed.position[2]);
  if(climbed.collision||moved.collision||displacement<.30||
     moved.position.some(n=>!Number.isFinite(n)))
    throw Error('Real-edge overlay damaged lowflight anti-wall collision');
  report.flight={original,climbed,moved,displacement};
  await shot(enabled,'04-sidewalk-curb-lowflight-moved');
  await enabled.click('#toggleFlight');
  const ended=await enabled.evaluate(()=>window.geoPilotQA.getFlight());
  if(ended.mode)throw Error('Cannot return from source street to aerial view');
  report.graphics=await enabled.evaluate(()=>{
    const canvas=document.querySelector('#scene'),gl=canvas?.getContext('webgl2');
    return {version:gl?.getParameter(gl.VERSION),lost:gl?.isContextLost(),
      error:gl?.getError(),width:canvas?.width,height:canvas?.height};
  });
  if(report.graphics.lost||report.graphics.error!==0||
     report.graphics.width<1000||report.graphics.height<700||
     report.errors.length||report.warnings.length)
    throw Error('WebGL2 error '+JSON.stringify(report.graphics));
  report.baseHash=createHash('sha256').update(baselinePng).digest('hex');
  report.overlayHash=createHash('sha256').update(overlayPng).digest('hex');
  report.passed=true;
}catch(error){
  report.errors.push(String(error.stack||error));
  if(enabled)try{await enabled.screenshot({path:out+'FAILED-edges.png'});}catch{}
}finally{
  writeFileSync(out+'real-edge-lowflight-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
if(!report.passed)process.exitCode=1;
