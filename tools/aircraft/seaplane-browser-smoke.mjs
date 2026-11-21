// Chromium WebGL2 verification for the globally-selectable C185 floatplane.
// Screenshots are captured from the actual PATROL scene, not Blender previews.
// Run against the checked-out game with playwright and a local http.server.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const home=process.env.PATROL_TEST_URL||'http://127.0.0.1:8766/';
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
const report={maps:[],errors:[]};
mkdirSync('artifacts',{recursive:true});
try {
  for(const map of ['manhattan','alaska']){
    const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
    const messages=[],responses=[];
    page.on('console',msg=>{
      messages.push(msg.text());
      if(msg.type()==='error')report.errors.push(map+': '+msg.text().slice(0,180));
    });
    page.on('pageerror',err=>report.errors.push(map+': '+String(err).slice(0,180)));
    page.on('response',res=>{
      if(res.url().includes('cessna185-floats.glb'))
        responses.push(res.status());
    });
    await page.goto(home,{waitUntil:'domcontentloaded',timeout:35000});
    await page.locator('input[name="flightMap"][value="'+map+'"]').check({force:true});
    await page.locator('input[name="aircraft"][value="seaplane"]').check({force:true});
    // Launch directly afloat; verify the new universal docking/float option.
    await page.locator('input[name="waterStart"]').check({force:true});
    await page.locator('#startFlight').click({timeout:15000});
    await page.waitForFunction(()=>{
      const menu=document.getElementById('titleOverlay'),
        load=document.getElementById('loadOverlay');
      return !!(menu?.hidden && load?.classList.contains('done'));
    },null,{timeout:150000});
    await page.waitForFunction(()=>
      window.PatrolSpaceBridge?.getState?.()?.aircraft==='seaplane',
    null,{timeout:40000});
    await page.waitForTimeout(1500);
    const state=await page.evaluate(()=>{
      const c=document.getElementById('glCanvas'),
        ctx=c?.getContext('webgl2');
      return {
        flight:window.PatrolSpaceBridge?.getState?.(),
        width:c?.width,height:c?.height,
        contextLost:ctx?.isContextLost(),
        webgl:!!ctx,
        menuClosed:document.getElementById('titleOverlay')?.hidden
      };
    });
    const waterStatus=await page.locator('#gearStatus').textContent();
    if(!waterStatus?.includes('WATER TAXI') && !waterStatus?.includes('DOCKING BRAKE'))
      throw new Error('Floatplane did not initialize afloat on '+map+': '+waterStatus);
    if(state.flight.altitude>16||state.flight.altitude<12)
      throw new Error('Floatplane pontoon waterline is invalid on '+map+': '+state.flight.altitude);
    report.maps.push({map,waterStatus,waterStart:true});
    if(!state.webgl||state.contextLost||state.width<500||
      state.flight?.aircraft!=='seaplane'||state.flight?.map!==map)
      throw new Error('Invalid floatplane scene '+map+': '+JSON.stringify(state));
    if(!responses.includes(200)||
      !messages.some(x=>x.includes('[PATROL] Blender Cessna 185 loaded')))
      throw new Error('Blender GLB not activated on '+map+': '+JSON.stringify({responses,messages:messages.slice(-20)}));
    await page.screenshot({path:'artifacts/cessna185-'+map+'-webgl.png',animations:'disabled'});
    report.maps.push({map,...state,glb:true});
    if(map==='alaska'){
      // Real keyboard, real flight loop: accelerate both pontoons on water,
      // rotate above on-step speed, then observe climb from actual camera.
      await page.keyboard.down('Shift');
      await page.keyboard.down('w');
      // Software WebGL on CI may render at one frame per wall-clock second.
      // Wait for simulated physics, not a fixed 4.4 seconds of wall time.
      await page.waitForFunction(()=>{
        const s=window.PatrolSpaceBridge?.getState?.();
        return !!(s?.playing && s.speed>17.5 && s.altitude>15.0);
      },null,{timeout:180000,polling:750});
      await page.keyboard.up('w');
      await page.keyboard.up('Shift');
      const climbed=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
      const status=await page.locator('#gearStatus').textContent();
      if(!climbed?.playing||climbed.aircraft!=='seaplane'||
         climbed.speed<17.5||climbed.altitude<15.0||
         status?.includes('WATER TAXI'))
        throw new Error('Floatplane failed water takeoff rotation: '+JSON.stringify({climbed,status}));
      await page.screenshot({path:'artifacts/cessna185-alaska-liftoff.png',animations:'disabled'});
      report.maps.push({map:'alaska-water-takeoff',...climbed,status,glb:true});
    }
    await page.close();
  }
  console.log('PASS global C185 Blender floatplane WebGL2: '+JSON.stringify(report));
}finally{
  writeFileSync('artifacts/cessna185-browser-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
