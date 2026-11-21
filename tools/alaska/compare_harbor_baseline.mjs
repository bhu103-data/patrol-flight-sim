/** Paired browser capture of the unchanged 6d50bfd baseline and this PR.
 * Both pages use the same served assets, viewport and opt-in harbor spawn.
 * Screenshot differences are evidence, not an automated realism verdict.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const root='http://127.0.0.1:8765';
const baselineSha='6d50bfda4b2d3837e550751ede49b200b140bc72';
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
mkdirSync('artifacts',{recursive:true});
const records={baselineSha,headSha:process.env.GITHUB_SHA||null,viewport:[1280,800]};
async function capture(label,file){
  const page=await browser.newPage({
    viewport:{width:1280,height:800},deviceScaleFactor:1
  });
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(root+'/'+file+'?alaskaView=harbor',
    {waitUntil:'domcontentloaded',timeout:30000});
  if(response?.status()!==200)throw Error('HTTP error for '+label);
  if(!await page.evaluate(()=>Boolean(document.querySelector('#glCanvas')?.getContext('webgl2'))))
    throw Error('WebGL2 unavailable for '+label);
  await page.locator('input[name="flightMap"][value="alaska"]').check({force:true});
  await page.locator('#startFlight').click({timeout:15000});
  await page.waitForFunction(()=>{
    const err=document.getElementById('menuError');
    const load=document.getElementById('loadOverlay');
    const title=document.getElementById('titleOverlay');
    return (err&&!err.hidden)||(load?.classList.contains('done')&&title?.hidden);
  },null,{timeout:110000});
  const state=await page.evaluate(()=>({
    flight:window.PatrolSpaceBridge?.getState?.(),
    menuError:document.getElementById('menuError')?.hidden?null:
      document.getElementById('menuError')?.textContent,
    gpuLost:document.getElementById('glCanvas')?.getContext('webgl2')?.isContextLost()
  }));
  if(state.menuError||state.gpuLost||!state.flight?.playing||state.flight.map!=='alaska')
    throw Error(label+' failed to load: '+JSON.stringify(state));
  await page.evaluate(()=>{
    for(const [id,value] of [['skyTime','12'],['skyWeather','Clear']]){
      const control=document.getElementById(id);
      control.value=value;
      control.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  await page.waitForTimeout(1300);
  await page.addStyleTag({content:
    '#flightMap,#statusBar,#skySettings,#hudCanvas{visibility:hidden!important}'});
  await page.screenshot({path:'artifacts/alaska-pr92-'+label+'-harbor.png'});
  records[label]={...state.flight,
    after:await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.()),
    pageErrors:errors};
  if(errors.length)throw Error(label+' JS errors: '+errors.join('; '));
  await page.close();
}
try{
  await capture('baseline','alaska-baseline.html');
  await capture('updated','index.html');
  const old=records.baseline.after,newer=records.updated.after;
  const displacement=Math.hypot(...old.position.map((p,i)=>p-newer.position[i]));
  const yawDelta=Math.abs(old.yaw-newer.yaw);
  records.cameraDrift={displacement,yawDelta};
  console.log('Alaska paired screenshot state:',JSON.stringify(records));
  if(displacement>9||yawDelta>.20)
    throw Error('Baseline/updated harbor camera moved too far for visual comparison');
  writeFileSync('artifacts/alaska-pr92-camera.json',JSON.stringify(records,null,2));
}finally{await browser.close();}
