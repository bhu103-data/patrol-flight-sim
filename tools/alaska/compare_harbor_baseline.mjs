/** Paired browser capture of the unchanged 6d50bfd baseline and this PR.
 * Both pages use the same served assets, viewport and opt-in harbor spawn.
 * Screenshot differences are evidence, not an automated realism verdict.
 */
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const root='http://127.0.0.1:8765';
const baselineSha='6d50bfda4b2d3837e550751ede49b200b140bc72';
// Add the SAME QA-only camera hook to both documents in temporary copies.
 // Neither the actual game source nor the benchmark geometry is changed.
 function cameraQAPage(input,output){
   let html=readFileSync(input,'utf8');
   const marker='  window.PatrolSpaceBridge = {getState: () => ({';
   if(html.split(marker).length!==2)throw Error('QA bridge anchor missing: '+input);
   const hook=`  window.PatrolHarborNearQA = () => {
     if(!selectedMap.alaska)throw Error('Near QA requires Alaska');
     window.__patrolQaHold=true;
     // Derive a cabin-facing camera from the ACTUAL terrain-grounded
     // obstacle positions so shore-pad placement cannot shift it away.
     const cabins=alaskaObstacles.filter(o=>o.name==='harbor building');
     if(cabins.length!==6)throw Error('Missing cabins in near QA');
     const [first,second]=cabins;
     const targetX=(first.x+second.x)*.5;
     const targetZ=(first.z+second.z)*.5;
     const targetY=(first.top+second.top)*.5-1.1;
     plane.pos=[first.x-5,Math.max(first.top,second.top)+4,
       Math.min(first.z,second.z)-14];
     const dx=targetX-plane.pos[0],dz=targetZ-plane.pos[2];
     plane.yaw=Math.atan2(dx,dz);
     plane.pitch=Math.atan2(targetY-plane.pos[1],Math.hypot(dx,dz));
     plane.bank=0; plane.speed=0; plane.throttle=0; plane.vsi=0;
     camInitialized=false;
   };
 `;
   html=html.replace(marker,hook+marker);
   const movement=/    }else{\r?\n      flightStep=advanceFlight\(dt\);\r?\n    }/g;
   const sites=[...html.matchAll(movement)];
   if(sites.length!==1)throw Error('QA flight freeze anchor missing: '+input);
   const eol=html.includes('\r\n')?'\r\n':'\n';
   html=html.replace(movement,[
     '    }else if(window.__patrolQaHold){',
     '      flightStep={basis:getPlaneBasis(),boundaryAssist:false};',
     '    }else{','      flightStep=advanceFlight(dt);','    }'
   ].join(eol));
   writeFileSync(output,html);
 }
 cameraQAPage('alaska-baseline.html','alaska-qa-baseline.html');
 cameraQAPage('index.html','alaska-qa-updated.html');
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
  const after=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  await page.evaluate(()=>{
    if(typeof window.PatrolHarborNearQA!=='function')
      throw Error('Near camera hook missing');
    window.PatrolHarborNearQA();
  });
  await page.waitForTimeout(950);
  await page.screenshot({path:'artifacts/alaska-pr92-'+label+'-near.png'});
  const near=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  records[label]={...state.flight,after,near,pageErrors:errors};
  if(errors.length)throw Error(label+' JS errors: '+errors.join('; '));
  await page.close();
}
try{
  await capture('baseline','alaska-qa-baseline.html');
  await capture('updated','alaska-qa-updated.html');
  const old=records.baseline.after,newer=records.updated.after;
  const displacement=Math.hypot(...old.position.map((p,i)=>p-newer.position[i]));
  const yawDelta=Math.abs(old.yaw-newer.yaw);
  const nearPos=records.baseline.near.position;
  const updatedNearPos=records.updated.near.position;
  const nearDrift=Math.hypot(...nearPos.map((v,i)=>v-updatedNearPos[i]));
  records.cameraDrift={displacement,yawDelta,nearDrift};
  if(nearDrift>.5)throw Error('Near-view QA pose is not identical');
  console.log('Alaska paired screenshot state:',JSON.stringify(records));
  if(displacement>9||yawDelta>.20)
    throw Error('Baseline/updated harbor camera moved too far for visual comparison');
  writeFileSync('artifacts/alaska-pr92-camera.json',JSON.stringify(records,null,2));
}finally{await browser.close();}
