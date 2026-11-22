import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {writeFileSync} from 'node:fs';
const dir='artifacts/nyc-official-mn05/';
const report={passed:false,errors:[],sourceYear:2014,
 provenance:'NYC DCP 2014 MN05 BrepFace.GetMesh cached triangles; matched to 2026-11-20 official HEIGHTROOF footprints; relative-only vertical display'};
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push('page: '+e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text());});
 const nav=await page.goto('http://127.0.0.1:8766/preview.html',
   {waitUntil:'domcontentloaded',timeout:60000});
 if(!nav?.ok())throw Error('Official roof/facade preview HTTP unavailable');
 await page.waitForFunction(()=>window.mn05RoofFacadeQA?.ready||
   window.mn05RoofFacadeQA?.error,null,{timeout:90000});
 const info=await page.evaluate(()=>{
  const canvas=document.getElementById('viewer'),gl=canvas.getContext('webgl2');
  return {...window.mn05RoofFacadeQA,contextLost:gl?.isContextLost(),
   glError:gl?.getError(),glVersion:gl?.getParameter(gl.VERSION),
   canvas:[canvas.width,canvas.height]};
 });
 report.data=info;
 if(!info.ready||info.error||info.sourceYear!==2014||
    info.matchedFids<5||info.roofTriangles<100||info.facadeTriangles<100||
    info.sourceVerticalDatumVerified!==false||info.relativeHeightAnchor!==true||
    info.contextLost||info.glError!==0||info.canvas[0]!==1280||info.canvas[1]!==800)
  throw Error('Actual municipal roof/facade WebGL QA invalid '+JSON.stringify(info));
 const roof=page.locator('#roof'),facade=page.locator('#facade');
 const shot=async name=>{
  const b=await page.locator('canvas').screenshot({path:dir+name+'.png'});
  report.shots??=[];report.shots.push(name);return b;
 };
 await roof.check();await facade.check();
 const bothOn=await shot('roof-facade-on');
 const drawnOn=await page.evaluate(()=>({
  roof:window.mn05RoofFacadeQA.roofDrawn(),
  facade:window.mn05RoofFacadeQA.facadeDrawn()
 }));
 await roof.uncheck();await facade.uncheck();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 const bothOff=await shot('roof-facade-off');
 const drawnOff=await page.evaluate(()=>({
  roof:window.mn05RoofFacadeQA.roofDrawn(),
  facade:window.mn05RoofFacadeQA.facadeDrawn()
 }));
 await roof.check();await facade.uncheck();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 await shot('roof-only');
 await roof.uncheck();await facade.check();
 await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
 await shot('facade-only');
 if(drawnOn.roof!==info.roofTriangles||drawnOn.facade!==info.facadeTriangles||
    drawnOff.roof!==0||drawnOff.facade!==0)
  throw Error('Source roof/facade toggle did not affect actual WebGL draw counts');
 const a=PNG.sync.read(bothOff),b=PNG.sync.read(bothOn);
 let changed=0,sum=0,total=0;
 for(let i=0;i<a.data.length;i+=4){
  const d=(Math.abs(a.data[i]-b.data[i])+
   Math.abs(a.data[i+1]-b.data[i+1])+Math.abs(a.data[i+2]-b.data[i+2]))/3;
  sum+=d;total++;if(d>6)changed++;
 }
 report.graphics={...info,drawnOn,drawnOff,pixelDeltaOver6:changed,
  changedPercent:100*changed/total,meanRgbDelta:sum/total};
 if(changed<300||report.graphics.changedPercent<0.03)
  throw Error('Source roof/facade meshes do not visibly change the matched-camera preview');
 if(report.errors.length)throw Error(report.errors.join('; '));
 report.passed=true;
}catch(e){report.errors.push(e.stack||String(e));process.exitCode=1}
finally{
 writeFileSync(dir+'roof-facade-browser-report.json',JSON.stringify(report,null,2));
 console.log('NYC MN05 roof/facade WebGL2 QA',JSON.stringify(report));
 await browser.close();
}
