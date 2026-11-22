/** Real 2014 NYC municipal cached rooftop source WebGL2 matched-camera A/B.
 * Visual proof is browser-rendered, never an offline/AI-generated video.
 * SwiftShader intervals are software only, NOT native GPU benchmarking.
 */
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {writeFileSync} from 'node:fs';
const out='artifacts/nyc-official-mn05/';
const report={passed:false,errors:[],sourceYear:2014,
  provenance:'Original NYC DCP MN05 Rhino BrepFace.GetMesh(MeshType.Any) cached render triangles; 2022 roof heights are a diagnostic anchor'};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push('page: '+e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text());});
  const nav=await page.goto('http://127.0.0.1:8766/preview.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(!nav?.ok())throw Error('Official rooftop geometry viewer HTTP unavailable');
  await page.waitForFunction(()=>window.mn05RoofQA?.ready||window.mn05RoofQA?.error,
    null,{timeout:90000});
  const qa=await page.evaluate(()=>{
    const canvas=document.getElementById('viewer'),gl=canvas.getContext('webgl2');
    return {...window.mn05RoofQA,
      contextLost:gl?.isContextLost(),glError:gl?.getError(),
      glVersion:gl?.getParameter(gl.VERSION),
      canvas:[canvas.width,canvas.height]};
  });
  if(!qa.ready||qa.error||qa.sourceTriangles<10||qa.matchedFids<3||
     qa.displayOnly!==true||qa.originalZDatumVerified!==false||
     qa.contextLost||qa.glError!==0||qa.canvas[0]!==1280)
    throw Error('Actual original municipal rooftop WebGL evidence invalid '+JSON.stringify(qa));
  const toggle=page.locator('#showActualRoofs');
  await toggle.uncheck();
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const off=await page.locator('canvas').screenshot({path:out+'municipal-roof-off.png'});
  const offQA=await page.evaluate(()=>window.mn05RoofQA.trianglesDrawn());
  await toggle.check();
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const on=await page.locator('canvas').screenshot({path:out+'municipal-roof-on.png'});
  const onQA=await page.evaluate(()=>window.mn05RoofQA.trianglesDrawn());
  if(offQA!==0||onQA!==qa.sourceTriangles)
    throw Error('Roof source mesh is not actually toggling in WebGL draw path');
  const a=PNG.sync.read(off),b=PNG.sync.read(on);
  if(a.width!==b.width||a.height!==b.height)
    throw Error('A/B source screenshots not same camera framebuffer');
  let changed=0,total=0,sum=0;
  for(let i=0;i<a.data.length;i+=4){
    const d=(Math.abs(a.data[i]-b.data[i])+
      Math.abs(a.data[i+1]-b.data[i+1])+
      Math.abs(a.data[i+2]-b.data[i+2]))/3;
    sum+=d;total++;
    if(d>6)changed++;
  }
  report.graphics={...qa,roofOffTriangles:offQA,roofOnTriangles:onQA,
    pixelDeltaOver6:changed,changedPercent:100*changed/total,
    meanRgbDelta:sum/total};
  if(changed<75||report.graphics.changedPercent<.005)
    throw Error('Genuine rooftop source did not visibly modify game-size WebGL2 canvas');
  if(report.errors.length)throw Error(report.errors.join('; '));
  report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}
finally{
  writeFileSync(out+'roof-browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  await browser.close();
}
