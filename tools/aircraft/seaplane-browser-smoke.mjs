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
    if(!state.webgl||state.contextLost||state.width<500||
      state.flight?.aircraft!=='seaplane'||state.flight?.map!==map)
      throw new Error('Invalid floatplane scene '+map+': '+JSON.stringify(state));
    if(!responses.includes(200)||
      !messages.some(x=>x.includes('[PATROL] Blender Cessna 185 loaded')))
      throw new Error('Blender GLB not activated on '+map+': '+JSON.stringify({responses,messages:messages.slice(-20)}));
    await page.screenshot({path:'artifacts/cessna185-'+map+'-webgl.png',animations:'disabled'});
    report.maps.push({map,...state,glb:true});
    await page.close();
  }
  console.log('PASS global C185 Blender floatplane WebGL2: '+JSON.stringify(report));
}finally{
  writeFileSync('artifacts/cessna185-browser-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
