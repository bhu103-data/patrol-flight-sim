// Actual game, not a mock: only permitted fighter & C185 must launch in Chromium WebGL2.
// Captures screenshot, screenshot luminance, source GLB fetch and browser errors.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_TEST_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/aircraft-two-choice-review';
await mkdir(out,{recursive:true});
// Set PATROL_WEBGL_NATIVE=1 on the user's own Windows PC to test installed
// Chrome with real GPU (no SwiftShader). The default stays reproducible CI.
const nativeMode=process.env.PATROL_WEBGL_NATIVE==='1';
const browser=await chromium.launch(nativeMode
  ?{headless:false,channel:'chrome',args:['--enable-webgl']}
  :{headless:true,args:[
    '--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-gpu-sandbox'
  ]});
const results=[];
function inspectPNG(data){
 const png=PNG.sync.read(data),counts=new Map();
 let black=0,white=0,visible=0,sum=0;
 for(let i=0;i<png.data.length;i+=4){
   const r=png.data[i],g=png.data[i+1],b=png.data[i+2];
   const l=(r+g+b)/3;
   if(l<12)black++;if(l>247)white++;if(l>22)visible++;
   if((i/4)%47===0){
     const k=[r,g,b].map(v=>Math.round(v/16)).join(',');
     counts.set(k,(counts.get(k)||0)+1);
   }
   sum+=l;
 }
 const pixels=png.width*png.height;
 return {width:png.width,height:png.height,pixels,blackFraction:+(black/pixels).toFixed(4),
  whiteFraction:+(white/pixels).toFixed(4),visibleFraction:+(visible/pixels).toFixed(4),
  averageLuma:+(sum/pixels).toFixed(1),colorBins:counts.size};
}
try{
 for(const craft of ['fighter','seaplane']){
   const page=await browser.newPage({viewport:{width:1152,height:720},deviceScaleFactor:1});
   const errors=[],logs=[],fetches=[];
   page.on('pageerror',error=>errors.push('PAGE '+error.message));
   page.on('console',msg=>{
     logs.push(msg.text());if(msg.type()==='error')errors.push('CONSOLE '+msg.text());
   });
   page.on('response',res=>{
     if(res.url().includes('/assets/aircraft/cessna185-floats.glb'))
       fetches.push({status:res.status(),bytes:Number(res.headers()['content-length']||0)});
   });
   try{
     const response=await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:35000});
     if(!response?.ok())throw Error('Actual game entry returned HTTP '+response?.status());
     const options=await page.locator('input[name="aircraft"]').evaluateAll(
       radios=>radios.map(r=>r.value));
     if(JSON.stringify(options)!==JSON.stringify(['fighter','seaplane']))
       throw Error('Unexpected player options: '+JSON.stringify(options));
     const context=await page.evaluate(()=>!!document.getElementById('glCanvas')?.getContext('webgl2'));
     if(!context)throw Error('Browser cannot initialize WebGL2');
     await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
     await page.locator('input[name="aircraft"][value="'+craft+'"]').check({force:true});
     await page.locator('#startFlight').click({timeout:15000});
     await page.waitForFunction(()=>document.getElementById('titleOverlay')?.hidden&&
       document.getElementById('loadOverlay')?.classList.contains('done'),
       null,{timeout:135000});
     await page.waitForFunction(expected=>{
       const s=window.PatrolSpaceBridge?.getState?.();
       return s?.playing&&s?.aircraft===expected;
     },craft,{timeout:20000});
     if(craft==='seaplane'){
       await page.waitForFunction(()=>{
         const s=document.querySelector('#aircraftName')?.textContent;
         return s==='Cessna 185 Floatplane';
       },null,{timeout:30000});
       await page.waitForFunction(()=>{
         return [...document.querySelectorAll('#aircraftName')].some(el=>
           el.textContent==='Cessna 185 Floatplane');
       },null,{timeout:30000});
       // Require the official original GLB to replace the procedural C185 fallback.
       await page.waitForTimeout(2500);
       if(!fetches.some(x=>x.status===200&&x.bytes>=179472)||
           !logs.some(x=>x.includes('[PATROL] Blender Cessna 185 loaded')))
         throw Error('Original C185 GLB not confirmed: '+JSON.stringify({fetches,logs:logs.slice(-20)}));
     }
     const state=await page.evaluate(()=>({
       aircraftName:document.getElementById('aircraftName')?.textContent,
       flight:window.PatrolSpaceBridge?.getState?.(),
       glLost:document.getElementById('glCanvas')?.getContext('webgl2')?.isContextLost(),
       menuError:document.getElementById('menuError')?.hidden?null:
         document.getElementById('menuError')?.textContent,
       crashVisible:!document.getElementById('crashOverlay')?.hidden,
       gpuRenderer:(()=>{
         const gl=document.getElementById('glCanvas')?.getContext('webgl2');
         const ext=gl?.getExtension('WEBGL_debug_renderer_info');
         return gl?(ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):
           gl.getParameter(gl.RENDERER)):null;
       })()
     }));
     if(state.glLost||state.menuError||state.crashVisible||state.flight?.aircraft!==craft)
       throw Error('Invalid real flight '+JSON.stringify(state));
     if(nativeMode&&/swiftshader|llvmpipe|software/i.test(state.gpuRenderer||''))
       throw Error('Native Chrome fell back to software WebGL: '+state.gpuRenderer);
     const path=out+'/actual-game-nyc-'+craft+'-webgl2.png';
     const png=await page.locator('#glCanvas').screenshot({path,timeout:60000});
     const pixels=inspectPNG(png);
     if(pixels.blackFraction>.88||pixels.whiteFraction>.92||
       pixels.visibleFraction<.27||pixels.colorBins<40)
       throw Error('Blank/dark or low-information gameplay screenshot '+JSON.stringify(pixels));
     if(errors.length)throw Error('Page/console exceptions: '+errors.join('\n'));
     results.push({craft,pass:true,options,webgl2:true,shot:path,pixels,
       sourceGLBfetches:fetches,flight:state.flight,renderer:nativeMode?'Installed Chrome requested, inspect gpuRenderer':'SwiftShader software WebGL2, NOT local Windows GPU',gpuRenderer:state.gpuRenderer});
   }catch(error){results.push({craft,pass:false,error:String(error),errors,logs:logs.slice(-15)});}
   finally{await page.close()}
 }
}finally{await browser.close()}
const report={runtimeOnlyTwo:results.every(r=>r.pass),checkedAt:new Date().toISOString(),
 localNativeChromeRequested:nativeMode,
 realWindowsChromeVerified:nativeMode&&process.platform==='win32'&&results.every(r=>r.pass),
 environment:nativeMode?'Installed Chrome, host OS '+process.platform+'; inspect renderer for true GPU':
   'Ubuntu GitHub Actions headless Chromium SwiftShader WebGL2; actual game, not user Windows machine',
 screenshots:results.map(r=>r.shot).filter(Boolean),results};
await writeFile(out+'/active-two-aircraft-browser-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.runtimeOnlyTwo)process.exitCode=1;
