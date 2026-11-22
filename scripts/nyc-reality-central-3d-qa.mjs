// PATROL centralized REALITY QA: actual integrated flight map and fixed in-game cameras.
// This is not a real-world camera match or native GPU frame-time benchmark.
// Do NOT call successful functional smoke "photorealistic NYC".
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const BASE=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const OUT='artifacts/nyc-reality-central-3d';
await mkdir(OUT,{recursive:true});
const SOURCE_COMMIT=process.env.GITHUB_SHA||'unverified-local-checkout';
const CAMERA_SITES=[
  {id:'01-brooklyn-bridgehead',label:'Brooklyn Bridge · Deck View',zoom:68,asset:'bridge/truss/cables + BQE'},
  {id:'02-dumbo-warehouses',label:'DUMBO · Warehouse Blocks',zoom:42,asset:'building geometry/roof/LOD'},
  {id:'03-liberty',label:'Statue of Liberty',zoom:42,asset:'statue/pedestal/orientation'},
  {id:'04-times-square-signals',label:'Times Square Street Level',zoom:42,asset:'real street/crosswalk/signal/facade'},
  {id:'05-times-square-led',label:'44th Street LED Canyon',zoom:42,asset:'LED mounting & materials'},
  {id:'06-lower-manhattan-skyline',label:'Lower Manhattan · Window Facades',zoom:42,asset:'high-rise roofs/facades'},
  {id:'07-harbor-shoreline-ships',label:'Lower Manhattan Waterfront',zoom:42,asset:'shoreline/piers/boat silhouettes'}
];
const report={passed:false,referenceAcceptance:'NOT_TESTED_BY_THIS_SCRIPT',
  sourceCommit:SOURCE_COMMIT,sites:[],errors:[],warnings:[],glb:[],
  mainMapLoadMs:null,crossMap:{},definition:{
    screenshots:'1280x720 unedited native PATROL #glCanvas, overlays hidden during capture',
    camera:'existing in-game Scenic Views presets, angle=0, exact zoom per record, noon/clear/season=1',
    authenticCameraMatch:'BLOCKED: legacy game X/Z is compressed and does not have a verified GPS↔camera/FOV registration',
    frame:'requestAnimationFrame wall-clock cadence in CI Chromium SwiftShader, NOT GPU execution time nor native hardware FPS',
    triangles:'WebGL2 TRIANGLES draw submissions per camera sample, not unique triangles, not authored mesh count',
    GLB:'enabled manifest files decoded from actual repository bytes and browser HTTP statuses; loader success only if independently confirmed',
    sourceLicenses:'manifest and notices claims are recorded but not recertified as external permissions'
  }};
function check(ok,message){if(!ok)throw new Error(message);}
const glbManifest=JSON.parse(await readFile('assets/nyc/scenario-manifest.json','utf8'));
for(const [name,record] of Object.entries(glbManifest.landmarks)){
  const entry={name,enabled:record.enabled,targetHeightGame:record.target_height,
    minTriangles:record.min_triangles,claimedLicense:record.license||null};
  try{
    const bytes=await readFile(join('assets/nyc',record.file));
    const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    check(bytes.byteLength>=20&&v.getUint32(0,true)===0x46546c67,'not GLB');
    const jlen=v.getUint32(12,true),part=v.getUint32(16,true);
    check(part===0x4e4f534a&&20+jlen<=bytes.length,'GLB JSON chunk invalid');
    const gltf=JSON.parse(bytes.subarray(20,20+jlen).toString('utf8'));
    let triangles=0,primitives=0;
    for(const mesh of gltf.meshes||[])for(const p of mesh.primitives||[]){
      const n=p.indices!==undefined?gltf.accessors[p.indices]?.count:
        gltf.accessors[p.attributes?.POSITION]?.count;
      if(p.mode===undefined||p.mode===4){triangles+=Math.floor((n||0)/3);primitives++;}
    }
    Object.assign(entry,{present:true,bytes:bytes.length,triangles,primitives,
      meshes:gltf.meshes?.length||0,nodes:gltf.nodes?.length||0,
      materials:gltf.materials?.length||0,textures:gltf.textures?.length||0,
      images:gltf.images?.length||0});
  }catch(e){entry.present=false;entry.readError=String(e)}
  if(entry.enabled&&!entry.present)report.errors.push('Enabled GLB missing: '+name);
  if(entry.enabled&&entry.triangles<entry.minTriangles)
    report.errors.push('Enabled GLB below minimum triangles: '+name);
  report.glb.push(entry);
}
const responses=[],pageErrors=[],consoleErrors=[];
let browser;
try{
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
    '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await page.addInitScript(()=>{
    // Probe actual WebGL commands without changing game mesh generation or render state.
    window.__centralDraw={calls:0,triangles:0,lines:0};
    const P=WebGL2RenderingContext.prototype;
    const arrays=P.drawArrays,elements=P.drawElements;
    P.drawArrays=function(mode,first,count,...rest){
      if(mode===this.TRIANGLES){window.__centralDraw.calls++;window.__centralDraw.triangles+=Math.floor(count/3);}
      if(mode===this.LINES)window.__centralDraw.lines+=Math.floor(count/2);
      return arrays.call(this,mode,first,count,...rest);
    };
    P.drawElements=function(mode,count,type,offset,...rest){
      if(mode===this.TRIANGLES){window.__centralDraw.calls++;window.__centralDraw.triangles+=Math.floor(count/3);}
      if(mode===this.LINES)window.__centralDraw.lines+=Math.floor(count/2);
      return elements.call(this,mode,count,type,offset,...rest);
    };
  });
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('response',r=>{
    if(/\.glb(\?|$)/i.test(r.url()))responses.push({url:r.url(),status:r.status(),ok:r.ok()});
  });
  const started=Date.now();
  const res=await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  check(res?.ok(),'The real flight-map launcher is not available');
  const startMap=async map=>{
    await page.locator('input[name="flightMap"][value="'+map+'"]').check({force:true});
    await page.locator('#startFlight').click({force:true,timeout:20000});
    await page.waitForFunction(()=>{
      const overlay=document.getElementById('loadOverlay'),title=document.getElementById('titleOverlay');
      return title?.hidden&&overlay?.classList.contains('done');
    },null,{timeout:150000});
    const result=await page.evaluate(()=>({
      state:window.PatrolSpaceBridge?.getState?.(),
      webgl2:!!document.getElementById('glCanvas')?.getContext('webgl2'),
      glError:document.getElementById('glCanvas')?.getContext('webgl2')?.getError()
    }));
    check(result.state?.map===map&&result.state.playing&&result.webgl2&&result.glError===0,
      'Map/flying/WebGL mismatch: '+map+' '+JSON.stringify(result));
    return result;
  };
  const main=await startMap('manhattan');
  report.mainMapLoadMs=Date.now()-started;
  report.mainMapState=main;
  // Avoid fake simulated reference cameras: choose only actual game Scenic Views.
  await page.evaluate(()=>{
    for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
      const select=document.getElementById(id);
      if(!select)throw new Error('Environment input missing '+id);
      select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  // SOURCE-OBSERVED QA GAP: the named Waterfront hotel camera is blocked by
  // foreground box towers on this compressed city. Capture the actual open-water
  // flight spawn *also*, before the tourist cameras; do not claim a boat is visible
  // merely because the preset contains the word Waterfront.
  await page.addStyleTag({content:
    'body.central-photo *{visibility:hidden!important}'+
    'body.central-photo #glCanvas{visibility:visible!important}'});
  await page.waitForTimeout(1400);
  const harborFlight=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  await page.evaluate(()=>document.body.classList.add('central-photo'));
  let portBytes;
  try{
    portBytes=await page.locator('#glCanvas').screenshot({
      path:OUT+'/00-harbor-spawn-airborne.png',timeout:85000,animations:'allow'});
  }finally{
    await page.evaluate(()=>document.body.classList.remove('central-photo'));
  }
  const port=PNG.sync.read(portBytes),colors=new Set();
  let n=0,blueWaterSamples=0,nearBlack=0;
  for(let y=0;y<port.height;y+=12)for(let x=0;x<port.width;x+=12){
    const k=(y*port.width+x)*4,r=port.data[k],
      g=port.data[k+1],b=port.data[k+2];
    colors.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));n++;
    if(b>r+10&&b>g+3)blueWaterSamples++;
    if(r+g+b<28)nearBlack++;
  }
  report.harborSpawn={camera:'actual unchanged real-game airborne spawn',
    aircraftState:harborFlight,pixels:{width:port.width,height:port.height,
    colorBins:colors.size,waterColorFraction:+(blueWaterSamples/n).toFixed(3),
    blackFraction:+(nearBlack/n).toFixed(3)},
    screenshot:'00-harbor-spawn-airborne.png',
    note:'Independent water/shoreline camera coverage. Ship identity, physical hull, berth and shore registration still require human review.'};
  check(colors.size>30&&nearBlack/n<.94&&blueWaterSamples/n>.08,
    'Open-water source camera is missing/blank: '+JSON.stringify(report.harborSpawn));
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
    null,{timeout:20000});
  await page.addStyleTag({content:
    'body.central-photo *{visibility:hidden!important}'+
    'body.central-photo #glCanvas{visibility:visible!important}'});
  for(const site of CAMERA_SITES){
    const available=await page.locator('#hotelTarget option').allTextContents();
    check(available.includes(site.label),'Missing fixed scenic camera: '+site.label);
    await page.locator('#hotelTarget').selectOption({label:site.label});
    await page.locator('#hotelAngle').evaluate(el=>{
      el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
    });
    await page.locator('#hotelZoom').evaluate((el,value)=>{
      el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));
    },site.zoom);
    await page.waitForTimeout(1450);
    // Both mean and P95 from the same physical browser and unchanged fixed camera.
    const perf=await page.evaluate(()=>new Promise(resolve=>{
      const rec=[],before={...window.__centralDraw};let prev=null,ended=false;
      const done=()=>{
        if(ended)return;ended=true;clearTimeout(timer);
        const sorted=rec.slice().sort((a,b)=>a-b);
        const sum=rec.reduce((a,b)=>a+b,0);
        const now={...window.__centralDraw};
        resolve({samples:rec.length,meanFrameMs:rec.length?+(sum/rec.length).toFixed(2):null,
          p95FrameMs:sorted.length?+sorted[Math.ceil(.95*sorted.length)-1].toFixed(2):null,
          trianglesSubmitted:now.triangles-before.triangles,
          drawCalls:now.calls-before.calls,
          trianglesSubmittedPerSample:rec.length?Math.round((now.triangles-before.triangles)/rec.length):null,
          linesSubmitted:now.lines-before.lines});
      };
      const timer=setTimeout(done,35000);
      const sample=ts=>{
        if(ended)return;
        if(prev!==null&&ts>prev&&ts-prev<5000)rec.push(ts-prev);
        prev=ts;
        if(rec.length>=28)done();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }));
    check(perf.samples>=8,'Too few real rAF performance samples at '+site.label);
    const gpu=await page.evaluate(()=>{
      const canvas=document.getElementById('glCanvas'),gl=canvas?.getContext('webgl2');
      return {webgl2:!!gl&&!gl.isContextLost(),error:gl?.getError()??null,
        width:canvas?.width,height:canvas?.height,
        maxTextureSize:gl?.getParameter(gl.MAX_TEXTURE_SIZE),
        gpuTimerExtensionAvailable:!!gl?.getExtension('EXT_disjoint_timer_query_webgl2'),
        cameraName:document.getElementById('hotelTarget')?.selectedOptions?.[0]?.textContent,
        zoom:document.getElementById('hotelZoom')?.value,
        angle:document.getElementById('hotelAngle')?.value};
    });
    check(gpu.webgl2&&gpu.error===0&&gpu.cameraName===site.label,
      'Actual WebGL/shot camera invalid: '+JSON.stringify(gpu));
    await page.evaluate(()=>document.body.classList.add('central-photo'));
    let png;
    try{
      png=await page.locator('#glCanvas').screenshot({
        path:OUT+'/'+site.id+'.png',timeout:85000,animations:'allow'});
    }finally{
      await page.evaluate(()=>document.body.classList.remove('central-photo'));
    }
    const img=PNG.sync.read(png);const bins=new Set();
    let black=0,n=0;
    for(let y=0;y<img.height;y+=12)for(let x=0;x<img.width;x+=12){
      const i=(y*img.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
      bins.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
      if(r+g+b<28)black++;n++;
    }
    const pixels={width:img.width,height:img.height,colorBins:bins.size,
      nearlyBlackFraction:+(black/n).toFixed(4)};
    check(pixels.colorBins>24&&pixels.nearlyBlackFraction<.96,'Blank screenshot '+site.id);
    report.sites.push({...site,actualGameCamera:gpu,frame:perf,pixels,
      screenshot:site.id+'.png',realWorldMatch:'NOT CERTIFIED — no matching geographic camera/permissioned reference',
      assetVisible:'NOT CERTIFIED from color/GL-only tests'});
    console.log('[central-3d] '+site.id+' '+JSON.stringify({perf,pixels}));
  }
  // Flight-control regression in the unchanged real game (not the #248 freecam).
  await page.locator('#resumeFlight').click({force:true});
  const before=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  await page.locator('#glCanvas').focus();
  // High-latency software WebGL may take >4 s to produce *one* game frame.
  // A fixed 1100ms keypress can observe ZERO simulation updates and give a
  // false negative. Hold key until the real aircraft state changes, with a
  // hard bound; no mocked motion or hand-edited state can satisfy this test.
  const controlStarted=Date.now();
  let movementObserved=false;
  await page.keyboard.down('w');
  try{
    await page.waitForFunction(beforeState=>{
      const after=window.PatrolSpaceBridge?.getState?.();
      if(!after?.playing||!beforeState?.position)return false;
      return Math.hypot(...after.position.map((v,i)=>v-beforeState.position[i]))>.02 &&
        Math.abs(after.pitch-beforeState.pitch)>.005;
    },before,{polling:250,timeout:25000});
    movementObserved=true;
  }catch(error){
    console.warn('[central-3d] Flight control not observed within 25s',
      String(error).slice(0,300));
  }finally{
    await page.keyboard.up('w');
  }
  const heldMs=Date.now()-controlStarted;
  const after=await page.evaluate(()=>window.PatrolSpaceBridge?.getState?.());
  const positionDelta=before?.position&&after?.position
    ?Math.hypot(...before.position.map((v,i)=>v-after.position[i])):0;
  const pitchDelta=Math.abs((after?.pitch||0)-(before?.pitch||0));
  report.crossMap.flightControl={before,after,positionDelta,pitchDelta,input:'KeyW held until real movement or 25000ms',heldMs,movementObserved};
  check(before?.playing&&after?.playing&&positionDelta>.02,
    'Real flight no longer responds/moves after Scenic Views '+JSON.stringify(report.crossMap.flightControl));
  // Unchanged launcher cross-map regression. Chongqing has a separate HTML entry;
  // same-page Coast is the precise map-switch test and is not falsely labeled CQ.
  await page.locator('#flightMenuBtn').click({force:true});
  check(await page.locator('#titleOverlay').evaluate(el=>!el.hidden),'Flight menu did not reopen');
  const coastStarted=Date.now();
  const coast=await startMap('coast');
  report.crossMap.coast={loadMs:Date.now()-coastStarted,...coast};
  await page.locator('#flightMenuBtn').click({force:true});
  const backStarted=Date.now();
  const back=await startMap('manhattan');
  report.crossMap.backToManhattan={loadMs:Date.now()-backStarted,...back};
  report.httpGlb=responses;
  report.consoleErrors=consoleErrors;
  report.pageErrors=pageErrors;
  check(pageErrors.length===0&&consoleErrors.length===0,
    'Real-game browser JS errors '+JSON.stringify({pageErrors,consoleErrors}));
  check(report.errors.length===0,'GLB manifest errors '+JSON.stringify(report.errors));
  report.passed=true;
}catch(e){
  report.errors.push(e.stack||String(e));
}finally{
  report.httpGlb=report.httpGlb||responses;
  report.pageErrors=report.pageErrors||pageErrors;
  report.consoleErrors=report.consoleErrors||consoleErrors;
  await writeFile(OUT+'/central-report.json',JSON.stringify(report,null,2));
  if(browser)await browser.close();
}
console.log('[central-3d-final] '+JSON.stringify({
  passed:report.passed,sourceCommit:report.sourceCommit,mainMapLoadMs:report.mainMapLoadMs,
  sites:report.sites.map(s=>({id:s.id,meanFrameMs:s.frame.meanFrameMs,
    p95FrameMs:s.frame.p95FrameMs,trianglesSubmittedPerSample:s.frame.trianglesSubmittedPerSample})),
  GLBs:report.glb.map(g=>({name:g.name,enabled:g.enabled,triangles:g.triangles,bytes:g.bytes})),
  errorCount:report.errors.length},null,2));
if(!report.passed)process.exitCode=1;
