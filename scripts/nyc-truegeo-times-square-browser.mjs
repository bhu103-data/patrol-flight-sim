// Browser evidence for the *actual* independent, true-coordinate WebGL2
// building preview; unlike the old compressed PATROL game, no fictional roads
// or landmark proxies are overlaid. Not a native GPU FPS benchmark.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';

const out='artifacts/nyc-truegeo-times-square';
await mkdir(out,{recursive:true});
const report={passed:false,errors:[],screenshots:[],metrics:{}};
const fail=(ok,message)=>{if(!ok)throw Error(message);};
const browser=await chromium.launch({headless:true,args:[
  '--use-gl=angle','--use-angle=swiftshader',
  '--enable-webgl','--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},
  deviceScaleFactor:1});
page.on('pageerror',e=>report.errors.push(e.stack||String(e)));
page.on('console',message=>{
  if(message.type()==='error')report.errors.push('console: '+message.text());
});
function quality(bytes){
  const png=PNG.sync.read(bytes);
  const bins=new Set();let nearBlack=0,opaque=0;
  for(let i=0;i<png.data.length;i+=4){
    const [r,g,b,a]=png.data.subarray(i,i+4);
    if(r<20&&g<20&&b<20)nearBlack++;
    if(a===255)opaque++;
    bins.add((r>>4)*256+(g>>4)*16+(b>>4));
  }
  return {width:png.width,height:png.height,
    bins:bins.size,nearBlackFraction:nearBlack/(png.width*png.height),
    opaqueFraction:opaque/(png.width*png.height)};
}
try{
  const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
  const response=await page.goto(base+'/truegeo-times-square-preview.html',
    {waitUntil:'networkidle',timeout:60000});
  fail(response?.ok(),'Preview did not load over actual HTTP');
  await page.waitForFunction(()=>document.querySelector('#status')
    ?.textContent?.includes('118 true-position buildings'),{timeout:60000});
  const status=await page.locator('#status').innerText();
  fail(status.includes('120 official FIDs'),'Unexpected source count '+status);
  fail(status.includes('2 hole/multiring exclusions'),
    'The two courtyard records were not excluded explicitly');
  fail(status.includes('2104 triangles'),'Source geometry/triangles unexpectedly changed');
  const glStatus=await page.evaluate(()=>{
    const c=document.querySelector('#scene');
    const gl=c?.getContext('webgl2');
    return {webgl2:Boolean(gl),error:gl?.getError()??-1,
      canvas:[c.width,c.height]};
  });
  fail(glStatus.webgl2&&glStatus.error===0,'Real WebGL2 failed: '+JSON.stringify(glStatus));
  await page.waitForTimeout(700);
  let one=await page.locator('#scene').screenshot(
    {path:out+'/01-truegeo-aerial.png'});
  const q1=quality(one);
  fail(q1.width===1280&&q1.height===720&&q1.bins>65,
    'The source buildings were not rendered as diverse visible pixels: '+JSON.stringify(q1));
  report.screenshots.push('01-truegeo-aerial.png');
  await page.mouse.move(640,400);
  await page.mouse.down();
  await page.mouse.move(1020,500,{steps:12});
  await page.mouse.up();
  await page.waitForTimeout(350);
  let two=await page.locator('#scene').screenshot(
    {path:out+'/02-truegeo-rotated.png'});
  const q2=quality(two);
  const a=PNG.sync.read(one).data,b=PNG.sync.read(two).data;
  let differing=0;
  for(let i=0;i<a.length;i+=4)
    if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),
      Math.abs(a[i+2]-b[i+2]))>24)differing++;
  const differenceFraction=differing/(1280*720);
  fail(differenceFraction>.005,'Orbit camera did not change real source geometry view');
  const glAfter=await page.evaluate(()=>
    document.querySelector('#scene').getContext('webgl2').getError());
  fail(glAfter===0,'Second camera WebGL2 error '+glAfter);
  report.screenshots.push('02-truegeo-rotated.png');
  report.metrics={status,renderer:await page.evaluate(()=>document
    .querySelector('#scene').getContext('webgl2')
    .getParameter(document.querySelector('#scene').getContext('webgl2').RENDERER)),
    webgl:glStatus,first:q1,second:q2,differenceFraction};
  fail(report.errors.length===0,'Browser exceptions: '+report.errors.join('; '));
  report.passed=true;
}catch(error){
  report.errors.push(error.stack||String(error));
  process.exitCode=1;
  try{await page.screenshot({path:out+'/ERROR.png',fullPage:true});}catch{}
}finally{
  await writeFile(out+'/truegeo-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
