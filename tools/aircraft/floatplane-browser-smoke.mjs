// Live WebGL2 Cessna 185 cross-map smoke test; optional visual snapshots in CI.
// Validates real GLB publication and that a safe-water launch can taxi and rotate.
// No artificial flight-state injection; all controls are real keyboard events.
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';

const base=process.env.PATROL_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
mkdirSync('artifacts',{recursive:true});
const results=[];

async function testMap(map,exercise){
  const page=await browser.newPage({viewport:{width:1152,height:720}});
  const errors=[],requests=[],log=[];
  page.on('pageerror',e=>errors.push('JavaScript: '+e.message));
  page.on('console',msg=>{
    const m=msg.text();log.push(m);
    if(msg.type()==='error')errors.push('Console: '+m);
  });
  page.on('response',response=>{
    if(response.url().includes('/assets/aircraft/cessna185-floats.glb'))
      requests.push(response.status());
  });
  try{
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    if(!(await page.evaluate(()=>!!document.querySelector('#glCanvas')?.getContext('webgl2'))))
      throw Error('No WebGL2 in Chromium');
    await page.locator('input[name="flightMap"][value="'+map+'"]').check({force:true});
    await page.locator('input[name="aircraft"][value="seaplane"]').check({force:true});
    const waterStart=page.locator('#waterStart');
    if(!(await waterStart.isVisible()))throw Error('Global water-start control not visible');
    await waterStart.check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const error=document.getElementById('menuError');
      const title=document.getElementById('titleOverlay');
      const load=document.getElementById('loadOverlay');
      return (error&&!error.hidden)||(title?.hidden&&load?.classList.contains('done'));
    },null,{timeout:130000});
    const state=await page.evaluate(()=>({
      menuError:document.querySelector('#menuError')?.hidden?null:
        document.querySelector('#menuError')?.textContent,
      aircraft:document.querySelector('#aircraftName')?.textContent,
      floats:document.querySelector('#gearStatus')?.textContent,
      isCrashOpen:!document.querySelector('#crashOverlay')?.hidden,
      glLost:document.querySelector('#glCanvas')?.getContext('webgl2')?.isContextLost()
    }));
    if(state.menuError||state.glLost||state.isCrashOpen||
       state.aircraft!=='Cessna 185 Floatplane'||
       !/FLOATS · WATER TAXI 0/.test(state.floats))
      throw Error('Water start not stable: '+JSON.stringify(state));
    await page.waitForFunction(()=>{
      return document.querySelector('#gearStatus')?.textContent?.includes('WATER TAXI');
    },null,{timeout:15000});
    // Guard the actual GLB, not an unreported procedural fallback.
    await page.waitForTimeout(3500);
    if(!requests.includes(200)||!log.some(m=>m.includes('[PATROL] Blender Cessna 185 loaded')))
      throw Error('Real Blender C185 GLB did not load: '+JSON.stringify({requests,log:log.slice(-10)}));
    await page.screenshot({path:'artifacts/floatplane-'+map+'-afloat.png'});
    if(exercise){
      // Keep the flight canvas focused; wait for simulated velocity, not
      // a fixed wall-clock duration on CPU/software WebGL renderers.
      await page.locator('#glCanvas').focus();
      await page.keyboard.down('Shift');
      try{
        await page.waitForFunction(()=>{
          const label=document.querySelector('#gearStatus')?.textContent||'';
          const taxi=label.match(/WATER TAXI (\d+)/);
          return (taxi && Number(taxi[1])>=2)||label.includes('ON STEP')||
            !document.querySelector('#crashOverlay')?.hidden;
        },null,{timeout:35000});
      }catch(error){
        const label=await page.locator('#gearStatus').textContent();
        await page.screenshot({path:'artifacts/floatplane-'+map+'-taxi-timeout.png'});
        throw Error('C185 taxi never accelerated (last HUD '+label+'): '+error.message);
      }
      const taxi=(await page.locator('#gearStatus').textContent())||'';
      if(!(/WATER TAXI [2-9]/.test(taxi)||/WATER TAXI [1-9]\d+/.test(taxi)||
            taxi.includes('ON STEP')))
        throw Error('Floatplane water taxi not confirmed: '+taxi);
      await page.screenshot({path:'artifacts/floatplane-'+map+'-taxi.png'});
      await page.keyboard.down('w');
      // Software SwiftShader can render at only a few frames per second.
      // PATROL intentionally caps per-frame dt, so 3s of simulated power-up
      // may require much longer wall-clock time in headless Chromium.
      const getFlight=()=>page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
      try{
        await page.waitForFunction(()=>{
          const state=window.PatrolSpaceBridge?.getState?.();
          const crashed=!!document.querySelector('#crashOverlay:not([hidden])');
          // Do not count the water-to-air HUD transition as a real takeoff:
          // real altitude and live flight state must both be confirmed.
          return crashed || (state && !state.playing) ||
            (state?.playing && state.altitude>=18.5 && state.climb>0);
        },null,{timeout:95000});
      }catch(error){
        const flight=await getFlight();
        const label=await page.locator('#gearStatus').textContent();
        await page.screenshot({path:'artifacts/floatplane-'+map+'-takeoff-timeout.png'});
        throw Error('C185 failed to gain height (HUD '+label+', state '+
          JSON.stringify(flight)+'): '+error.message);
      }
      await page.keyboard.up('w');
      await page.keyboard.up('Shift');
      // Release the throttle and let at least one more rendered frame pass.
      // Early shoreline collisions must not pass the flight acceptance gate.
      await page.waitForTimeout(1300);
      const after=(await page.locator('#gearStatus').textContent())||'';
      const flight=await getFlight();
      await page.screenshot({path:'artifacts/floatplane-'+map+'-airborne.png'});
      if(!flight?.playing || flight.aircraft!=='seaplane' ||
         flight.altitude<17.5 || !after.includes('WATER LANDING'))
        throw Error('C185 did not sustain airborne flight: '+JSON.stringify({after,flight}));
    }
    if(errors.length)throw Error(errors.join('\n'));
    results.push({map,aircraft:state.aircraft,waterStart:state.floats,
      blenderGLB:requests.includes(200),takeoff:exercise});
    console.log('PASS floatplane WebGL2: '+JSON.stringify(results.at(-1)));
  }finally{
    await page.close();
  }
}

try{
  await testMap('manhattan',false);
  await testMap('alaska',true);
  console.log('C185 Browser verification complete '+JSON.stringify(results));
}finally{
  await browser.close();
}
