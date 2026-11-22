// Real independent browser QA of official NYC OTI pavement polygons;
// not a frame-rate benchmark or production flight-map acceptance.
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const root='http://127.0.0.1:8765';
const result={passed:false,errors:[],source:'NYC OTI 2022 official roadbed polygons'};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',e=>result.errors.push('JS: '+e.message));
  page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
  const response=await page.goto(root+'/preview.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(!response?.ok())throw Error('Measured-source preview not served');
  await page.waitForFunction(()=>window.geoPilotQA?.ready||window.geoPilotQA?.error,
    null,{timeout:90000});
  const state=await page.evaluate(()=>{
    const g=window.geoPilotQA,canvas=document.getElementById('scene'),
      gl=canvas?.getContext('webgl2');
    return {...g,glVersion:gl?.getParameter(gl.VERSION),
      glError:gl?.getError(),contextLost:gl?.isContextLost(),
      canvas:[canvas?.width,canvas?.height]};
  });
  result.state=state;
  if(!state.ready||state.error||state.glError!==0||state.contextLost||
     state.realPavementFeatures<50||state.realPavementTriangles<1000||
     state.sourceBuildings<100||state.sourceRoads<20||
     state.canvas[0]<1000||state.canvas[1]<700)
    throw Error('Source-measured geometry was not rendered '+JSON.stringify(state));
  await page.waitForTimeout(300);
  const original=await page.screenshot({path:'artifacts/nyc-roadbed-source/real-roadbed-webgl.png'});
  await page.mouse.move(620,350);
  await page.mouse.down();
  await page.mouse.move(870,500,{steps:8});
  await page.mouse.up();
  await page.waitForTimeout(320);
  const orbit=await page.screenshot({path:'artifacts/nyc-roadbed-source/real-roadbed-orbit.png'});
  result.originalHash=createHash('sha256').update(original).digest('hex');
  result.orbitHash=createHash('sha256').update(orbit).digest('hex');
  if(result.originalHash===result.orbitHash)
    throw Error('Mouse orbit did not change actual WebGL2 pixels');
  if(result.errors.length)throw Error('Browser errors '+result.errors.join('; '));
  result.passed=true;
}catch(error){result.errors.push(String(error.stack||error));process.exitCode=1}
finally{
  writeFileSync('artifacts/nyc-roadbed-source/browser-report.json',
    JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
  await browser.close();
}
