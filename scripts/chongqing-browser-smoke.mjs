// Real Chromium WebGL check for the standalone Chongqing PATROL level.
// With a local HTTP server running: node scripts/chongqing-browser-smoke.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=(process.env.CHONGQING_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const dir='artifacts/chongqing';
await mkdir(dir,{recursive:true});
const errors=[],warnings=[];
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',err=>errors.push(err.message));
page.on('console',msg=>{if(msg.type()==='error')warnings.push(msg.text());});
page.on('requestfailed',req=>{
  if(req.url().includes('/assets/chongqing/')||req.url().includes('three.module.js'))
    errors.push('Failed core request: '+req.url()+' '+(req.failure()?.errorText||''));
});
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const screenshots=[];
async function capture(name){
  const state=await page.evaluate(()=>{
    const canvas=document.getElementById('world');
    const gl=canvas?.getContext('webgl2');
    return {
      width:canvas?.width||0,height:canvas?.height||0,
      webgl:Boolean(gl&&!gl.isContextLost()),
      game:window.PatrolSpaceBridge?.getState?.()
    };
  });
  check(state.webgl,'Missing WebGL2 context at '+name);
  check(state.width>300&&state.height>200,'Empty canvas at '+name);
  check(state.game?.map==='chongqing'&&state.game?.playing,'Game did not start at '+name);
  check(state.game.position.every(Number.isFinite),'Nonfinite pilot position at '+name);
  await page.screenshot({path:dir+'/'+name+'.png',fullPage:true});
  screenshots.push({name,width:state.width,height:state.height,altitude:state.game.altitude});
}
let report;
try{
  const response=await page.goto(base+'/chongqing.html?quality=low&time=night',{
    waitUntil:'domcontentloaded',timeout:60000
  });
  check(response?.ok(),'Chongqing HTTP page unavailable');
  await page.locator('#loading').waitFor({state:'detached',timeout:105000});
  await page.waitForTimeout(900);
  await capture('00-spawn');
  for(const [key,name] of [['1','01-hongyadong'],['2','02-raffles'],['3','03-liziba']]){
    await page.keyboard.press(key);
    await page.waitForTimeout(1100);
    await capture(name);
  }
  await page.keyboard.press('2');
  await page.waitForTimeout(250);
  const before=await page.evaluate(()=>window.PatrolSpaceBridge.getState().altitude);
  await page.keyboard.down('Space');await page.waitForTimeout(2100);await page.keyboard.up('Space');
  const after=await page.evaluate(()=>window.PatrolSpaceBridge.getState().altitude);
  check(after>before+18,'Flight was blocked above 300 units: '+before+' -> '+after);
  await capture('04-high-rise-climb');
  for(const id of ['questHotpot','questFerry','questRaffles','questLiziba','qualityBtn'])
    check(await page.locator('#'+id).count()===1,'Missing game HUD #'+id);
  check(!errors.length,'Uncaught runtime error: '+errors.join('; '));
  report={passed:true,climb:{before,after},screenshots,warnings};
}catch(e){
  report={passed:false,error:e.stack||String(e),errors,warnings};
  try{await page.screenshot({path:dir+'/FAILED.png',fullPage:true});}catch{}
}finally{
  await writeFile(dir+'/smoke-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(!report.passed)process.exitCode=1;
