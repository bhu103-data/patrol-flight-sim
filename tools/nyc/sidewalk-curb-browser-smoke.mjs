// Independent native WebGL2 acceptance of real NYC sidewalk polygons and
// original OTI curb/cut lines in same metre frame as official roadbed/buildings.
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const output='artifacts/nyc-curb-sidewalk-source/';
const report={passed:false,errors:[],source:'NYC OTI planimetrics 2022, opt-in QA'};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('JS '+e.message));
  page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text());});
  const response=await page.goto('http://127.0.0.1:8765/preview.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(!response?.ok())throw Error('Measured sidewalk viewer HTTP failed');
  await page.waitForFunction(()=>window.geoPilotQA?.ready||window.geoPilotQA?.error,
    null,{timeout:90000});
  const stats=await page.evaluate(()=>{
    const state=window.geoPilotQA,
      canvas=document.querySelector('#scene'),gl=canvas?.getContext('webgl2');
    return {...state,glVersion:gl?.getParameter(gl.VERSION),
      glError:gl?.getError(),contextLost:gl?.isContextLost(),
      canvas:[canvas?.width,canvas?.height]};
  });
  report.stats=stats;
  report.visualOnlyMask=true; // Source polygons remain intact in edges.json.
  if(!stats.ready||stats.error||stats.contextLost||stats.glError!==0||
    stats.sourceBuildings<100||stats.realPavementFeatures<50||
    stats.realSidewalkFeatures<5||stats.realSidewalkTriangles<100||
    !(stats.sidewalkVisualMaskSquareMetres>0.1)||
    !(stats.sidewalkDisplayBuildingOverlapSquareMetres<=1e-6)||
    stats.realCurbFeatures<5||stats.realCurbCuts<5||
    stats.realCurbLineVertices<1000||stats.canvas[0]<1000)
    throw Error('Source-curb WebGL geometry acceptance failure '+
      JSON.stringify(stats));
  await page.waitForTimeout(300);
  const first=await page.screenshot({path:output+'sidewalk-curb-aerial.png'});
  await page.mouse.move(640,375);await page.mouse.down();
  await page.mouse.move(930,520,{steps:8});await page.mouse.up();
  await page.waitForTimeout(350);
  const orbit=await page.screenshot({path:output+'sidewalk-curb-orbit.png'});
  report.firstHash=createHash('sha256').update(first).digest('hex');
  report.orbitHash=createHash('sha256').update(orbit).digest('hex');
  if(report.firstHash===report.orbitHash)
    throw Error('Camera orbit did not change real source pixels');
  if(report.errors.length)throw Error(report.errors.join('; '));
  report.passed=true;
}catch(error){report.errors.push(String(error.stack||error));process.exitCode=1}
finally{
  writeFileSync(output+'browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  await browser.close();
}
