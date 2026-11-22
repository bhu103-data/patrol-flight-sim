/** Real 2014 municipal rooftop source integrated with the ORIGINAL 1:1
 * low-flight preview, not PATROL default production Manhattan.
 * Strict no-fabrication source gate + actual Chromium/SwiftShader canvas A/B.
 */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {writeFileSync} from 'node:fs';
const out='artifacts/nyc-true-scale/';
const report={passed:false,errors:[],
  intendedSource:'2014 official NYC DCP MN05 saved Brep face roof meshes'};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('JS '+e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push('console '+m.text());});
  const nav=await page.goto('http://127.0.0.1:8767/preview.html?mn05Roofs=1',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(!nav?.ok())throw Error('1:1 source-flight preview not served');
  await page.waitForFunction(()=>window.geoPilotQA?.ready||window.geoPilotQA?.error,
    null,{timeout:120000});
  const sourceQA=await page.evaluate(()=>{
    const q=window.geoPilotQA,canvas=document.querySelector('#scene');
    const gl=canvas?.getContext('webgl2');
    return {
      ready:q?.ready,error:q?.error,sourceBuildings:q?.sourceBuildings,
      originalMunicipalRoadFeatures:q?.realRoadbedSource?.features,
      roofAvailable:q?.authenticMn05RoofSource?.available(),
      roofVisible:q?.authenticMn05RoofSource?.visible(),
      roofTriangles:q?.authenticMn05RoofSource?.sourceTriangles(),
      sourceBuildingFids:q?.authenticMn05RoofSource?.matched2022Fids(),
      roofSourceYear:q?.authenticMn05RoofSource?.sourceYear,
      verticalDatumVerified:q?.authenticMn05RoofSource?.sourceVerticalDatumVerified,
      sourceError:q?.authenticMn05RoofSource?.lastLoadError(),
      flight:q?.getFlight?.(),
      glError:gl?.getError(),contextLost:gl?.isContextLost(),
      framebuffer:[canvas?.width,canvas?.height]
    };
  });
  if(!sourceQA.ready||sourceQA.error||sourceQA.sourceBuildings<100||
     sourceQA.originalMunicipalRoadFeatures<50||!sourceQA.roofAvailable||
     !sourceQA.roofVisible||sourceQA.roofTriangles<100||
     sourceQA.sourceBuildingFids<3||sourceQA.roofSourceYear!==2014||
     sourceQA.verticalDatumVerified!==false||sourceQA.sourceError||
     sourceQA.glError!==0||sourceQA.contextLost||
     sourceQA.framebuffer[0]!==1280)
    throw Error('Original 2014 rooftop source not proven in actual 1:1 low-flight WebGL '+JSON.stringify(sourceQA));
  const canvas=page.locator('#scene');
  const toggle=page.locator('#mn05RoofToggle');
  await toggle.uncheck();
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const off=await canvas.screenshot({path:out+'real-mn05-roofs-lowflight-aerial-off.png'});
  await toggle.check();
  await page.waitForFunction(()=>window.geoPilotQA.authenticMn05RoofSource.visible(),
    null,{timeout:60000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const on=await canvas.screenshot({path:out+'real-mn05-roofs-lowflight-aerial-on.png'});
  const a=PNG.sync.read(off),b=PNG.sync.read(on);
  if(a.width!==b.width||a.height!==b.height)
    throw Error('A/B source camera framebuffer size drift');
  let changed=0;
  for(let i=0;i<a.data.length;i+=4){
    if((Math.abs(a.data[i]-b.data[i])+
       Math.abs(a.data[i+1]-b.data[i+1])+
       Math.abs(a.data[i+2]-b.data[i+2]))/3>6)changed++;
  }
  if(changed<80)throw Error('Authentic municipal rooftop mesh not visible in existing flyable city');
  // The SAME metre city flight + collision path must remain live, without
  // switching to the standalone proof viewer or synthetic fixed camera.
  const flying=await page.evaluate(()=>window.geoPilotQA.setFlight(true));
  if(flying!==true)throw Error('Original source-metre low-flight mode broken');
  await page.waitForTimeout(350);
  const before=await page.evaluate(()=>window.geoPilotQA.getFlight());
  if(before?.mode!==true||before.collision)
    throw Error('NYC low-flight source spawn is colliding with building after roof opt-in');
  await page.keyboard.down('e');await page.waitForTimeout(160);await page.keyboard.up('e');
  await page.waitForTimeout(160);
  const after=await page.evaluate(()=>window.geoPilotQA.getFlight());
  if(!after.mode||after.collision||after.position?.[1]<=before.position?.[1])
    throw Error('Original source-metre low-flight controls/collision failed');
  await canvas.screenshot({path:out+'real-mn05-roofs-lowflight-street.png'});
  if(report.errors.length)throw Error(report.errors.join('; '));
  report.passed=true;
  report.source={...sourceQA,changedPixelsAerial:changed,
    aerialChangedPercent:100*changed/(a.width*a.height),
    flightBefore:before,flightAfter:after,
    retainedExistingFlightControls:true,
    nativeGpuBenchmark:false};
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}
finally{
  writeFileSync(out+'real-mn05-roofs-lowflight-browser-report.json',
    JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  await browser.close();
}
