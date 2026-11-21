// PATROL NYC WebGL smoke and screenshots; run after Playwright Chromium install.
// Start: python3 -m http.server 8765 --bind 127.0.0.1
// Test: node scripts/nyc-road-browser-smoke.mjs
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/nyc';await mkdir(out,{recursive:true});
const errors=[],warnings=[];
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')warnings.push(message.text());});
page.on('requestfailed',req=>{
 if(req.url().includes('/assets/nyc/nyc-street-network.js'))
   errors.push('NYC street module failed: '+req.url());
});
const check=(v,s)=>{if(!v)throw Error(s);};
let result;
try{
 const res=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 check(res?.ok(),'NYC launcher did not respond');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({force:true});
 // Terrain generation is asynchronous. Require the game overlay to complete.
 await page.waitForFunction(()=>{
  const title=document.getElementById('titleOverlay');
  const load=document.getElementById('loadOverlay');
  return title?.hidden&&load?.classList.contains('done');
 },null,{timeout:120000});
 await page.waitForTimeout(1800);
 const state=await page.evaluate(()=>{
  const glCanvas=document.getElementById('glCanvas');
  const gl=glCanvas?.getContext('webgl2');
  return {
   canvasW:glCanvas?.width||0,canvasH:glCanvas?.height||0,
   webgl:Boolean(gl&&!gl.isContextLost()),
   selected:document.querySelector('input[name="flightMap"]:checked')?.value,
   menuHidden:document.getElementById('titleOverlay')?.hidden
  };
 });
 check(state.webgl,'NYC WebGL2 context lost');
 check(state.canvasW>300&&state.canvasH>200,'NYC canvas is unexpectedly small');
 check(state.selected==='manhattan'&&state.menuHidden,'NYC map did not start');
 await page.screenshot({path:out+'/00-harbor.png',fullPage:true});
 await page.waitForTimeout(3500);
 await page.screenshot({path:out+'/01-city-loaded.png',fullPage:true});
 // The previous smoke test photographed only the spawn harbor. Explicitly
 // visit the Brooklyn Bridge camera so bridgehead, nearby parcels and road
 // clipping are visible in CI artifacts rather than being inferred from code.
 const bridgeShortcut=page.locator('#bridgeShortcutButton');
 check(await bridgeShortcut.isVisible(),'Brooklyn Bridge camera button missing');
 await bridgeShortcut.click();
 await page.waitForFunction(()=>{
   const panel=document.getElementById('hotelViews');
   const target=document.getElementById('hotelTarget');
   return panel&&!panel.hidden&&
     target?.options[target.selectedIndex]?.textContent==='Brooklyn Bridge · Deck View';
 },null,{timeout:12000});
 await page.waitForTimeout(1800);
 const bridge=await page.evaluate(()=>{
   const gl=document.getElementById('glCanvas')?.getContext('webgl2');
   const target=document.getElementById('hotelTarget');
   return {camera:target?.options[target.selectedIndex]?.textContent,
     webgl:Boolean(gl&&!gl.isContextLost()),
     graphicsError:gl?.getError()??null};
 });
 check(bridge.webgl&&bridge.graphicsError===0,
   'Brooklyn Bridge view lost WebGL: '+JSON.stringify(bridge));
 await page.screenshot({path:out+'/02-brooklyn-bridgehead.png',fullPage:true});
 check(errors.length===0,'NYC critical JS errors: '+errors.join('; '));
 result={passed:true,state,bridge,
   screenshots:['00-harbor.png','01-city-loaded.png','02-brooklyn-bridgehead.png'],warnings};
}catch(e){
 result={passed:false,error:e.stack||String(e),errors,warnings};
 try{await page.screenshot({path:out+'/FAILED.png',fullPage:true});}catch{}
}finally{
 await writeFile(out+'/smoke-report.json',JSON.stringify(result,null,2));
 await browser.close();
}
process.stdout.write(JSON.stringify(result,null,2)+'\n');
if(!result.passed)process.exitCode=1;
