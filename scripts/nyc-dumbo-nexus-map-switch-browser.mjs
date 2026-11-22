// Real PATROL launcher regression; no persisted app-source edits or mock maps.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/nyc-dumbo-nexus-map-switch';
await mkdir(dir,{recursive:true});
const report={pilot:'84 Front Street / BIN 3389054',scenarios:[],errors:[],passed:false,
  renderer:'Chromium SwiftShader software WebGL2, NOT native hardware FPS'};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',e=>report.errors.push('pageerror '+e.message));
page.on('requestfailed',r=>{
 if(r.url().startsWith(base))report.errors.push('local request failed '+r.url());
});
try{
 await page.route('**/index.html',async route=>{
   const response=await route.fetch();
   const html=await response.text(),marker='  function openFlightMenu() {';
   assert.equal(html.split(marker).length,2,'actual PATROL flight menu hook unavailable');
   const probe=[
    '  // QA-only introspection, injected into HTTP response not disk/Git.',
    '  window.__patrolDumboSwitchProbe=()=>({',
    '    name:selectedMap.name,isCity:!!selectedMap.city,isAlaska:!!selectedMap.alaska,',
    '    craft:selectedAircraft,flying:!!flying,loading:!!loading,',
    '    pos:[...plane.pos],webgl2:!!gl&&!gl.isContextLost(),glError:gl.getError()',
    '  });'
   ].join('\n');
   await route.fulfill({response,body:html.replace(marker,probe+'\n'+marker)});
 });
 const response=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:45000});
 assert.ok(response?.ok());
 for(const [map,expectedCity,expectedAlaska] of [
   ['manhattan',true,false],['alaska',false,true],['manhattan',true,false]
 ]){
   const menu=await page.locator('#titleOverlay').evaluate(e=>!e.hidden);
   if(!menu){
     await page.locator('#flightMenuBtn').evaluate(e=>e.click());
     await page.waitForFunction(()=>!document.getElementById('titleOverlay').hidden,
       null,{timeout:15000});
   }
   await page.locator('input[name="flightMap"][value="'+map+'"]').check({force:true});
   await page.locator('input[name="aircraft"][value="seaplane"]').check({force:true});
   const start=Date.now();
   await page.locator('#startFlight').click({force:true});
   await page.waitForFunction(()=>{
     const q=window.__patrolDumboSwitchProbe?.();
     return !!q?.flying && !q.loading &&
       !!document.getElementById('titleOverlay')?.hidden &&
       document.getElementById('loadOverlay')?.classList.contains('done');
   },null,{timeout:180000});
   await page.waitForTimeout(800);
   const state=await page.evaluate(()=>window.__patrolDumboSwitchProbe());
   assert.equal(state.isCity,expectedCity,map+' selectedMap.city wrong');
   assert.equal(state.isAlaska,expectedAlaska,map+' selectedMap.alaska wrong');
   assert.equal(state.craft,'seaplane',map+' aircraft changed');
   assert.equal(state.webgl2,true,'WebGL2 context unavailable on '+map);
   assert.equal(state.glError,0,'WebGL2 error on '+map);
   assert.ok(state.pos.every(Number.isFinite),'flight pose nonfinite');
   await page.addStyleTag({content:
      'body.patrol-switch-qa *{visibility:hidden!important}'+
      'body.patrol-switch-qa #glCanvas{visibility:visible!important}'});
   await page.evaluate(()=>document.body.classList.add('patrol-switch-qa'));
   const attempt=report.scenarios.filter(x=>x.map===map).length+1;
   const name=map+'-pass'+attempt+'.png';
   let screenshot;
   try{
     screenshot=await page.locator('#glCanvas').screenshot({
       path:dir+'/'+name,timeout:90000,animations:'disabled'
     });
   }finally{
     await page.evaluate(()=>document.body.classList.remove('patrol-switch-qa'));
   }
   assert.ok(screenshot.length>5000,'blank game image '+map);
   const row={map,name,loadMs:Date.now()-start,state,bytes:screenshot.length};
   report.scenarios.push(row);
   console.log('PATROL map transition passed: '+JSON.stringify(row));
 }
 assert.equal(report.scenarios.length,3);
 assert.equal(report.errors.length,0,report.errors.join('\n'));
 report.passed=true;
}catch(e){
 report.errors.push(e.stack||String(e));process.exitCode=1;
}finally{
 await writeFile(dir+'/report.json',JSON.stringify(report,null,2));
 await browser.close();
 console.log('PATROL live map switching QA '+JSON.stringify(report));
}
