import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='artifacts/nyc-official-bk02';mkdirSync(out,{recursive:true});
const report={passed:false,errors:[],screenshots:[]};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-webgl',
 '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
 '--disable-gpu-sandbox'
]});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text());});
 const base=process.env.PATROL_BASE_URL||'http://127.0.0.1:8765';
 const response=await page.goto(base+'/dumbo-2014-source-preview.html',
  {waitUntil:'domcontentloaded',timeout:90000});
 if(!response?.ok())throw Error('Official BK02 source preview HTTP failed');
 await page.waitForFunction(()=>window.PatrolDumbo2014SourceQA?.ready&&
  window.PatrolDumbo2014SourceQA.frames>12,null,{timeout:120000});
 report.data=await page.evaluate(()=>window.PatrolDumbo2014SourceQA);
 const q=report.data;
 if(q.sourceFacadePatches<=50||q.sourceRoofPatches<=10||
   q.sourceTriangles<=500||q.otiBuildings!==48||q.glError!==0||
   q.contextLost||q.sourceVerticalDatumVerified!==false)
   throw Error('BK02 source geometry failed bounded WebGL QA '+JSON.stringify(q));
 const capture=async name=>{
  const bytes=await page.locator('#scene').screenshot({
   path:out+'/'+name+'.png',timeout:90000});
  const png=PNG.sync.read(bytes);let nonBackground=0;
  for(let i=0;i<png.data.length;i+=4)
   if(Math.max(Math.abs(png.data[i]-14),Math.abs(png.data[i+1]-23),
      Math.abs(png.data[i+2]-33))>18)nonBackground++;
  const hash=createHash('sha256').update(bytes).digest('hex');
  report.screenshots.push({name,sha256:hash,width:png.width,height:png.height,
    nonBackgroundPixels:nonBackground});
  if(nonBackground<2000)throw Error(name+' source mesh screenshot appears blank');
  return hash;
 };
 const oblique=await capture('01-bk02-2014-source-oblique');
 await page.keyboard.press('t');await page.waitForTimeout(400);
 const overhead=await capture('02-bk02-2014-source-overhead');
 await page.mouse.move(600,360);await page.mouse.down();
 await page.mouse.move(850,520,{steps:14});await page.mouse.up();
 await page.waitForTimeout(400);
 const rotated=await capture('03-bk02-2014-source-rotated');
 if(oblique===overhead||oblique===rotated||overhead===rotated)
  throw Error('Camera changes did not produce distinct real source geometry frames');
 if(report.errors.length)throw Error(report.errors.join('; '));
 report.passed=true;
 report.caveat='2014 municipal BK02 Rhino cached roof/facade meshes only; vertical datum is unverified; no 2026 as-built claim, no PATROL gameplay integration or native-GPU FPS acceptance.';
}catch(err){report.error=String(err.stack||err);process.exitCode=1;}
finally{
 writeFileSync(out+'/browser-report.json',JSON.stringify(report,null,2));
 await browser.close();
 console.log('NYC BK02 2014 real source geometry WebGL QA',JSON.stringify(report));
}
