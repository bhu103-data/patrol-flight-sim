/** Actual 1280x800 WebGL2 proof of authentic 2014 NYC MN05 rooftop and facade source
 * data, independent of modern roadbed/aircraft, due UNKNOWN Z datum.
 */
import {chromium} from 'playwright';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const report={passed:false,errors:[],shots:[]};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 '--disable-gpu-sandbox'
]});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push('JavaScript: '+e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text());});
 const loaded=await page.goto('http://127.0.0.1:8766/mn05-authentic-roof-facade-preview.html',
   {waitUntil:'domcontentloaded',timeout:60000});
 if(!loaded?.ok())throw Error('Source roofs and facades WebGL preview not served');
 await page.waitForFunction(()=>window.patrolSourceRoofQA?.ready||
   window.patrolSourceRoofQA?.error,null,{timeout:90000});
 const info=await page.evaluate(()=>{
  const s=window.patrolSourceRoofQA,canvas=document.getElementById('roofCanvas'),
    gl=canvas?.getContext('webgl2');
  return {...s,camera:s.camera?.(),glError:s.glError?.(),
    glVersion:gl?.getParameter(gl.VERSION),contextLost:gl?.isContextLost(),
    canvas:[canvas?.width,canvas?.height]};
 });
 report.data=info;
 if(!info.ready||info.error||info.sourceRooftopMeshes<1000||info.sourceFacadeMeshes<1000||
    info.sourceRoofTriangles<8000||info.sourceFacadeTriangles<2000||
    info.sourceRoofFacadeTriangles<12000||!info.requiresVerticalDatum||
    info.glError!==0||info.contextLost||info.canvas[0]<1200||
    info.canvas[1]<700||info.sourceRawZFeetRange[1]<=info.sourceRawZFeetRange[0])
   throw Error('Official 2014 cached roof/facade source geometry invalid '+JSON.stringify(info));
 await page.waitForTimeout(400);
 const shot=async file=>{
  const pixels=await page.locator('#roofCanvas').screenshot({
   path:'artifacts/nyc-official-mn05/'+file+'.png',
   animations:'allow',timeout:90000});
  report.shots.push(file);
  return createHash('sha256').update(pixels).digest('hex');
 };
 const original=await shot('2014-authentic-roof-facade-aerial');
 await page.mouse.move(650,370);
 await page.mouse.down();
 await page.mouse.move(865,555,{steps:12});
 await page.mouse.up();
 await page.waitForTimeout(420);
 const rotated=await shot('2014-authentic-roof-facade-rotated');
 if(original===rotated)throw Error('Rotating camera did not change actual source roof/facade pixels');
 if(report.errors.length)throw Error(report.errors.join('; '));
 report.originalHash=original;report.rotatedHash=rotated;
 report.caveat='Only original NYC DCP 2014 Brep cached roof and facade source, local X/Z metres; vertical original Rhino Z has UNKNOWN reference datum, arbitrary preview baseline; not 2026 surveyed photoreal or integrated PATROL game.';
 report.passed=true;
}catch(err){report.error=String(err.stack||err);process.exitCode=1;}
finally{
 writeFileSync('artifacts/nyc-official-mn05/source-roof-facade-browser-report.json',
   JSON.stringify(report,null,2));
 await browser.close();
 console.log('NYC original 2014 rooftop and facade WebGL2 source QA',JSON.stringify(report));
}
