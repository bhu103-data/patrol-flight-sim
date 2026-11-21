// Real checked-out PATROL native WebGL2 Manhattan harbor smoke.
// Screenshots are from index.html. Source mesh-upload telemetry confirms
// the added NYC ferry was created; off-camera ship draw NOT assumed.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8899').replace(/\/$/,'');
const dest='artifacts/nyc-ic16019-ferry';
await mkdir(dest,{recursive:true});
const errors=[],logs=[],requests=[],started=Date.now();
let report={passed:false,frame:'Lower Manhattan Waterfront',shipVisibleConfirmed:false};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle',
 '--use-angle=swiftshader','--enable-unsafe-swiftshader'
]});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 // Inject at document start to observe the *real* game mesh uploader.
 await page.addInitScript(()=>{
   window.__ferryAudit={positionBytes:0,vertexUploads:0,exactTriangleDraws:0,
     interceptedWebGL2:true};
   const origBuffer=WebGL2RenderingContext.prototype.bufferData;
   WebGL2RenderingContext.prototype.bufferData=function(target,data,usage,...rest){
     if(target===this.ARRAY_BUFFER && data instanceof Float32Array &&
         data.byteLength===3150*9*4){
       window.__ferryAudit.positionBytes=data.byteLength;
       window.__ferryAudit.vertexUploads++;
     }
     return origBuffer.call(this,target,data,usage,...rest);
   };
   const origDraw=WebGL2RenderingContext.prototype.drawArrays;
   WebGL2RenderingContext.prototype.drawArrays=function(mode,first,count){
     if(mode===this.TRIANGLES && count===3150*3)
       window.__ferryAudit.exactTriangleDraws++;
     return origDraw.call(this,mode,first,count);
   };
 });
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{
   logs.push(m.text());if(m.type()==='error')errors.push('console '+m.text());
 });
 page.on('response',r=>{
   if(r.url().includes('cessna185-floats.glb'))
     requests.push({code:r.status(),url:r.url()});
 });
 const entry=await page.goto(base+'/index.html',
   {waitUntil:'domcontentloaded',timeout:45000});
 if(!entry?.ok())throw Error('PATROL entrypoint HTTP error');
 await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
 await page.locator('#startFlight').click({timeout:15000});
 await page.waitForFunction(()=>{
   const overlay=document.getElementById('loadOverlay');
   return document.getElementById('titleOverlay')?.hidden&&
     overlay?.classList.contains('done');
 },null,{timeout:140000});
 for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
   await page.locator('#'+id).selectOption(value);
 }
 await page.keyboard.press('h');
 await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
   null,{timeout:20000});
 await page.locator('#hotelTarget').selectOption({label:'Lower Manhattan Waterfront'});
 await page.locator('#hotelZoom').evaluate(el=>{
   el.value='42';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await page.waitForTimeout(2200);
 const state=await page.evaluate(()=>{
   const c=document.getElementById('glCanvas'),gl=c?.getContext('webgl2');
   return {webgl2:!!gl,contextLost:gl?.isContextLost(),
     glError:gl?.getError(),canvas:{w:c?.width,h:c?.height},
     flight:window.PatrolSpaceBridge?.getState?.(),
     camera:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.text,
     upload:window.__ferryAudit};
 });
 if(!state.webgl2||state.contextLost||state.glError!==0)
   throw Error('Real game WebGL2 invalid '+JSON.stringify(state));
 if(state.camera!=='Lower Manhattan Waterfront')
   throw Error('Fixed camera missing: '+state.camera);
 if(state.upload.positionBytes!==3150*9*4||state.upload.vertexUploads<3)
   throw Error('NYC 3150-triangle twin-hull original builder not GPU-uploaded '+
     JSON.stringify(state.upload));
 const raw=await page.locator('#glCanvas').screenshot({
   path:dest+'/manhattan-waterfront-live-webgl2.png',timeout:65000
 });
 const image=PNG.sync.read(raw),bins=new Set();
 let dark=0,n=0;
 for(let y=0;y<image.height;y+=8)for(let x=0;x<image.width;x+=8){
   const p=(y*image.width+x)*4,r=image.data[p],
      g=image.data[p+1],b=image.data[p+2];
   bins.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
   if(r+g+b<27)dark++;n++;
 }
 const screenshot={w:image.width,h:image.height,bins:bins.size,
   darkFraction:+(dark/n).toFixed(4)};
 if(screenshot.bins<42||screenshot.darkFraction>.92)
   throw Error('Near-black or flat city shot: '+JSON.stringify(screenshot));
 if(errors.length)throw Error('Browser exceptions: '+errors.join('; '));
 report={passed:true,sourceCommit:process.env.GITHUB_SHA||null,state,screenshot,
   errors,warnings:logs.filter(t=>/warn/i.test(t)).slice(0,12),
   shipVisibleConfirmed:state.upload.exactTriangleDraws>0,
   shipDraws:state.upload.exactTriangleDraws,
   important:'Mesh was uploaded in the actual game; fixed camera may NOT show ferry. This is NOT an in-frame silhouette comparison.',
   shader:'Original PATROL WebGL2, with no Three.js or external runtime downloads',
   browser:'Ubuntu CI Chromium SwiftShader; Windows Chrome hardware rendering not tested',
   elapsedMs:Date.now()-started};
}catch(error){
 report={...report,passed:false,error:String(error.stack||error),errors,
   recentLogs:logs.slice(-15),elapsedMs:Date.now()-started};
 process.exitCode=1;
}finally{
 await writeFile(dest+'/nyc-ferry-live-webgl2-report.json',JSON.stringify(report,null,2)+'\n');
 await browser.close();
}
console.log('NYC FERRY ACTUAL WEBGL2 QA: '+JSON.stringify(report,null,2));
