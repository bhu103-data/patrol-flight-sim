/** Real WebGL2 smoke for isolated, metre-scale NYC source footprint pilot.
 * Software renderer on CI proves execution only, never native GPU FPS.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const home=process.env.PATROL_BASE_URL||'http://127.0.0.1:8765';
const out='artifacts/nyc-metric-pilot';
mkdirSync(out,{recursive:true});
const errors=[],warnings=[];
const result={source:'NYC official BUILDING footprint snapshot 2026-11-20',
  mode:'Software CI WebGL2, not physical GPU P95 or real street/curb survey',
  branchHead:process.env.GITHUB_SHA||'local',passed:false,errors,warnings};
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox',
   '--disable-dev-shm-usage','--enable-webgl','--use-gl=angle',
   '--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',e=>{if(e.type()==='error')warnings.push(e.text())});
 const response=await page.goto(home+'/nyc-metric-pilot.html',
   {waitUntil:'domcontentloaded',timeout:25000});
 if(response?.status()!==200)throw Error('Metric pilot HTTP failed');
 await page.waitForFunction(()=>!!window.PatrolNycMetricQA,
   null,{timeout:60000});
 await page.waitForTimeout(750);
 const state=await page.evaluate(()=>{
   const audit=window.PatrolNycMetricQA();
   const gl=document.querySelector('canvas')?.getContext('webgl2');
   return {stats:audit.stats,rejections:audit.rejections,
     streetStats:audit.streetStats,curbStats:audit.curbStats,
     camera:audit.camera,contextLost:gl?.isContextLost(),
     webglError:gl?.getError(),canvas:[gl?.drawingBufferWidth,gl?.drawingBufferHeight]};
 });
 if(state.stats.inputFeatures!==120||
    state.stats.builtFeatures<110||
    state.stats.rejectedFeatures>10||
    state.stats.units!=='metres'||
    state.stats.maxHeightMetres<200||
    state.stats.triangles<1000||
    !state.streetStats||state.streetStats.records<15||
    state.streetStats.uniqueStreetNames<8||
    state.streetStats.edges<15||
    state.streetStats.totalLengthMetres<100||
    state.streetStats.noRoadEdgesOrPavement!==true||
    !state.curbStats||state.curbStats.records<15||
    state.curbStats.edges<15||
    state.curbStats.totalLengthMetres<100||
    state.curbStats.noRoadbedOrSidewalks!==true||
    state.contextLost||state.webglError!==0||
    state.canvas[0]!==1280||state.canvas[1]!==800)
    throw Error('Meter-scale scene audit not valid '+JSON.stringify(state));
 // Remove only the HTML QA overlay during scene-only evidence; the actual
 // game/viewer geometry and camera remain unchanged.
 await page.evaluate(()=>{
   document.querySelector('aside').style.visibility='hidden';
   document.querySelector('footer').style.visibility='hidden';
 });
 await page.locator('canvas').screenshot({path:out+'/times-square-metre-oblique.png'});
 // The real top-view control lives inside the overlay. Restore it for the
 // genuine click before hiding the panel again for the matched canvas shot.
 await page.evaluate(()=>document.querySelector('aside').style.visibility='visible');
 await page.locator('#top').click();
 await page.evaluate(()=>document.querySelector('aside').style.visibility='hidden');
 await page.waitForTimeout(400);
 const top=await page.evaluate(()=>window.PatrolNycMetricQA().camera);
 if(Math.abs(top.pitch-1.56)>.001||Math.abs(top.yaw)>.001)
    throw Error('North-up top camera cannot be selected');
 await page.locator('canvas').screenshot({path:out+'/times-square-metre-north-up.png'});
 result.passed=errors.length===0 && warnings.length===0;
 Object.assign(result,{state,topCamera:top,
   images:['times-square-metre-oblique.png',
     'times-square-metre-north-up.png']});
 if(!result.passed)throw Error('Pilot triggered browser JS errors or warnings');
 console.log('NYC metric 1:1 WebGL2 audit PASS',
   JSON.stringify(result).slice(0,2000));
}catch(e){
 result.passed=false;result.failure=String(e.stack||e);
 console.error('Metric 1:1 WebGL2 audit FAIL',result.failure);
 process.exitCode=1;
}finally{
 writeFileSync(out+'/report.json',JSON.stringify(result,null,2));
 if(browser)await browser.close();
}
