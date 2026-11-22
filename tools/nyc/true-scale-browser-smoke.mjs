/** Actual WebGL2 screenshot of the official-source metre-scale pilot.
 * The preview is separate from the compressed PATROL flight map.
 */
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const response=await page.goto('http://127.0.0.1:8765/preview.html',
    {waitUntil:'domcontentloaded',timeout:30000});
  if(response?.status()!==200)throw Error('Pilot preview HTML is unavailable');
  await page.waitForFunction(()=>window.geoPilotQA?.ready||window.geoPilotQA?.error,
    null,{timeout:90000});
  const stats=await page.evaluate(()=>{
    const state=window.geoPilotQA;
    const canvas=document.getElementById('scene');
    const gl=canvas?.getContext('webgl2');
    return {...state,contextLost:gl?.isContextLost(),glError:gl?.getError(),
      canvas:[canvas?.width,canvas?.height]};
  });
  if(stats.error||!stats.ready||stats.contextLost||stats.glError||
     stats.sourceBuildings<100||stats.sourceRoads<20||
     stats.buildingTriangles<300||stats.streetVertices<100||
     stats.officialRoadbed2022?.features<70||
     stats.officialRoadbed2022?.triangles<7000||
     stats.officialPedestrian2022?.plazas<5||
     stats.officialPedestrian2022?.sidewalks<40||
     stats.officialPedestrian2022?.curb<150||
     stats.officialPedestrian2022?.curbCuts<150||
     !stats.officialPedestrian2022?.noSurveyedVerticalDatum){
    throw Error('Real metre WebGL source preview failed '+JSON.stringify(stats));
  }
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  await page.screenshot({path:'artifacts/nyc-true-scale/live-webgl.png'});
  if(errors.length)throw Error(errors.join('; '));
  console.log('NYC source metre frame live WebGL2 PASS',JSON.stringify(stats));
}finally{await browser.close();}
