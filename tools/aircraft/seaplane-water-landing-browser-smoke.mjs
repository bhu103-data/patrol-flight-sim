// Browser-integrated touchdown test: real WebGL, real published GLB and real
// flight physics, with a controlled safe-water final approach fixture.
// An instrumented copy of index.html exists ONLY in this test request;
// the shipped game is never patched with debug hooks.
import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

const base=process.env.PATROL_TEST_URL||'http://127.0.0.1:8766/';
const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const anchor='  window.PatrolSpaceBridge = {';
if(!html.includes(anchor))throw new Error('PATROL physics hook location changed');

const fixture=[
  '  // Test-only fixture, not part of the shipped PATROL source.',
  '  window.PatrolSeaplaneSmoke={',
  '    stageSafeWaterApproach:()=>{',
  '      if(!flying||selectedAircraft!=="seaplane"||!waterborne)return {ok:false,why:"not afloat"};',
  '      const [x,,z]=plane.pos,yaw=plane.yaw;',
  '      if(!usableFloatWater(x,z,yaw))return {ok:false,why:"unsafe pontoon footprint"};',
  '      waterborne=false;grounded=false;gearDown=false;brakes=false;',
  '      plane.afterburner=false;plane.speed=14.5;',
  '      plane.pitch=-.045;plane.bank=0;plane.rollAnim=0;',
  '      plane.pos[1]=WATER_H+FLOAT_CLEARANCE+1.10;',
  '      return {ok:true,x,z,yaw,altitude:plane.pos[1],waterHeight:WATER_H};',
  '    },',
  '    read:()=>({waterborne,grounded,crashed:Boolean(crash),',
  '      valid:usableFloatWater(plane.pos[0],plane.pos[2],plane.yaw),',
  '      speed:plane.speed,altitude:plane.pos[1]})',
  '  };'
].join('\n');
const injected=html.replace(anchor,fixture+'\n'+anchor);
const serverOrigin=new URL(base).origin;
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
mkdirSync('artifacts',{recursive:true});
const results=[];
try {
  for(const map of ['alaska','manhattan']){
    const page=await browser.newPage({viewport:{width:1040,height:680}});
    const errors=[],glbResponses=[],glbConsole=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{
      if(m.type()==='error')errors.push(m.text());
      if(m.text().includes('[PATROL] Blender Cessna 185 loaded'))
        glbConsole.push(m.text());
    });
    page.on('response',res=>{
      if(res.url().includes('cessna185-floats.glb'))
        glbResponses.push(res.status());
    });
    await page.route('**/*',async route=>{
      const u=new URL(route.request().url());
      if(u.origin===serverOrigin&&(u.pathname==='/'||u.pathname==='/index.html'))
        await route.fulfill({status:200,contentType:'text/html;charset=UTF-8',body:injected});
      else await route.continue();
    });
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:35000});
    await page.locator('input[name="flightMap"][value="'+map+'"]').check({force:true});
    await page.locator('input[name="aircraft"][value="seaplane"]').check({force:true});
    await page.locator('input[name="waterStart"]').check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const title=document.querySelector('#titleOverlay');
      const load=document.querySelector('#loadOverlay');
      return !!(title?.hidden && load?.classList.contains('done') &&
        window.PatrolSeaplaneSmoke?.read()?.waterborne);
    },null,{timeout:150000,polling:500});
    await page.waitForFunction(()=>window.PatrolSpaceBridge?.getState?.()?.aircraft==='seaplane',
      null,{timeout:20000});
    const before=await page.evaluate(()=>{
      return {status:document.querySelector('#gearStatus')?.textContent,
        flight:window.PatrolSpaceBridge.getState(),
        physics:window.PatrolSeaplaneSmoke.read()};
    });
    if(!before.status.includes('WATER TAXI'))throw new Error(map+' no initial water taxi: '+JSON.stringify(before));
    if(!glbResponses.includes(200)||!glbConsole.length)
      throw new Error(map+' no published Blender asset: '+JSON.stringify({glbResponses,glbConsole}));
    const staged=await page.evaluate(()=>window.PatrolSeaplaneSmoke.stageSafeWaterApproach());
    if(!staged?.ok)throw new Error(map+' invalid approach fixture: '+JSON.stringify(staged));
    await page.waitForFunction(()=>{
      const q=window.PatrolSeaplaneSmoke.read();
      return q.waterborne || q.crashed;
    },null,{timeout:120000,polling:400});
    const after=await page.evaluate(()=>{
      return {status:document.querySelector('#gearStatus')?.textContent,
        flight:window.PatrolSpaceBridge.getState(),
        physics:window.PatrolSeaplaneSmoke.read(),
        webglLost:document.querySelector('#glCanvas')?.getContext('webgl2')?.isContextLost()};
    });
    if(after.physics.crashed||!after.physics.waterborne||!after.physics.valid||
       !after.flight.playing||!/FLOATS · (WATER TAXI|ON STEP|DOCKING BRAKE)/.test(after.status)||
       after.webglLost||Math.abs(after.physics.altitude-(staged.waterHeight+1.50))>0.12)
      throw new Error(map+' failed controlled safe-water touchdown: '+JSON.stringify({staged,after}));
    await page.screenshot({path:'artifacts/cessna185-'+map+'-touchdown.png',animations:'disabled'});
    // G toggles the real docking brake in the shipped game, unlike
    // B which only brakes while held. Complete the water landing lifecycle.
    await page.keyboard.press('g');
    await page.waitForFunction(()=>{
      const q=window.PatrolSeaplaneSmoke.read();
      return q.crashed || (q.waterborne && q.speed<0.25);
    },null,{timeout:120000,polling:500});
    const docked=await page.evaluate(()=>({
      hud:document.querySelector('#gearStatus')?.textContent,
      flight:window.PatrolSpaceBridge.getState(),
      physics:window.PatrolSeaplaneSmoke.read()
    }));
    if(docked.physics.crashed||!docked.physics.waterborne||
       !docked.physics.valid||docked.physics.speed>=.25||
       !docked.hud?.includes('DOCKING BRAKE')||!docked.flight.playing)
      throw new Error(map+' failed docking brake/stop after touchdown: '+JSON.stringify(docked));
    await page.screenshot({path:'artifacts/cessna185-'+map+'-docked.png',animations:'disabled'});
    if(errors.length)throw new Error(map+' browser errors: '+JSON.stringify(errors.slice(0,8)));
    results.push({map,loadedBlenderGLB:true,initialWaterTaxi:true,
      stagedApproach:staged,touchdown:after,docked,errors:[]});
    await page.close();
  }
  console.log('PASS C185 genuine WebGL + real-physics water touchdown: '+JSON.stringify(results));
}finally{
  writeFileSync('artifacts/cessna185-water-touchdown-report.json',
    JSON.stringify(results,null,2));
  await browser.close();
}