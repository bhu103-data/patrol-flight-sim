/** Fixed 1280x800 WebGL2 proof for the bounded 2014 NYC MN05 current-building
 * facade/roof preview. Uses original cached Rhino Brep meshes only.
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
try{
  const page=await browser.newPage({
    viewport:{width:1280,height:800},
    deviceScaleFactor:1
  });
  page.on('pageerror',e=>report.errors.push('JavaScript: '+e.message));
  page.on('console',m=>{
    if(m.type()==='error')report.errors.push('console: '+m.text());
  });
  const loaded=await page.goto(
    'http://127.0.0.1:8766/current-2014-facade-preview.html',
    {waitUntil:'domcontentloaded',timeout:60000}
  );
  if(!loaded?.ok())throw Error('Current 2014 facade preview was not served');
  await page.waitForFunction(
    ()=>window.patrolCurrentFacadePreviewQA?.ready===true||
       window.patrolCurrentFacadePreviewQA?.error,
    null,{timeout:90000}
  );
  const info=await page.evaluate(()=>{
    const s=window.patrolCurrentFacadePreviewQA;
    const canvas=document.getElementById('previewCanvas');
    const gl=canvas?.getContext('webgl2');
    return {
      ...s,
      glError:s?.glError?.(),
      glVersion:gl?.getParameter(gl.VERSION),
      contextLost:gl?.isContextLost(),
      canvas:[canvas?.width,canvas?.height]
    };
  });
  report.data=info;
  if(!info.ready||info.error||info.candidateBuildings!==24||
     info.facadeFaces<100||info.facadeTriangles<100||
     info.roofTriangles<100||info.verticalDatumStatus!=='NOT_CERTIFIED'||
     info.runtimeImportAllowed!==false||info.glError!==0||
     info.contextLost||info.canvas[0]<1200||info.canvas[1]<700){
    throw Error('Original NYC facade/roof WebGL preview failed bounded QA '+JSON.stringify(info));
  }
  await page.waitForTimeout(450);
  const screenshot=async name=>{
    const pixels=await page.locator('#previewCanvas').screenshot({
      path:'artifacts/nyc-official-mn05/'+name+'.png',
      animations:'allow',timeout:90000
    });
    report.shots.push(name);
    return createHash('sha256').update(pixels).digest('hex');
  };
  const aerial=await screenshot('current-2014-facade-aerial');
  await page.screenshot({
    path:'artifacts/nyc-official-mn05/current-2014-facade-full.png',
    fullPage:false,animations:'allow',timeout:90000
  });
  report.shots.push('current-2014-facade-full');
  await page.mouse.move(620,360);
  await page.mouse.down();
  await page.mouse.move(865,535,{steps:14});
  await page.mouse.up();
  await page.waitForTimeout(450);
  const rotated=await screenshot('current-2014-facade-rotated');
  if(aerial===rotated)throw Error('Camera rotation did not change rendered facade/roof pixels');
  if(report.errors.length)throw Error(report.errors.join('; '));
  report.aerialHash=aerial;
  report.rotatedHash=rotated;
  report.caveat='Original 2014 NYC DCP MN05 cached Brep facade/roof meshes for 24 matched current building candidates; heights are relative to source FootPrint Surface Z. No facade textures/windows or 2026 as-built claim. Vertical datum remains uncertified; preview only, never runtime.';
  report.passed=true;
}catch(err){
  report.error=String(err.stack||err);
  process.exitCode=1;
}finally{
  writeFileSync(
    'artifacts/nyc-official-mn05/current-2014-facade-preview-report.json',
    JSON.stringify(report,null,2)
  );
  await browser.close();
  console.log('NYC 2014 current facade/roof WebGL2 QA',JSON.stringify(report));
}
