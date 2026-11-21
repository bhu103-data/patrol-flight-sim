// Isolated PR #97 pedestrian/low-fly browser QA; no production HTML writes.
// Both images use THE SAME branch, camera, assets and lighting. The fallback
// disables only cornerWarehouse rendering in an intercepted browser response.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/dumbo-warehouse-qa';
await mkdir(out,{recursive:true});
const cameraSpecs=[
 {name:'DUMBO A · Street QA',zoom:72,variant:0},
 {name:'DUMBO A · Low Flight QA',zoom:54,variant:0},
 {name:'DUMBO B · Street QA',zoom:72,variant:1},
 {name:'DUMBO B · Low Flight QA',zoom:54,variant:1}
];
const viewInsertion=[
 // Camera centers are GETTERS: the real accepted parcel, not a guessed lot.
 "{name:'DUMBO A · Street QA',get x(){return globalThis.__PATROL_DUMBO_QA__?.sites?.[0]?.x??285},get z(){return globalThis.__PATROL_DUMBO_QA__?.sites?.[0]?.z??-330},height:1.7,bearing:90,radius:15,rise:1.5,detail:'QA-only street-facing original and brick arch'}",
 "{name:'DUMBO A · Low Flight QA',get x(){return globalThis.__PATROL_DUMBO_QA__?.sites?.[0]?.x??285},get z(){return globalThis.__PATROL_DUMBO_QA__?.sites?.[0]?.z??-330},height:18,bearing:152,radius:28,rise:8,detail:'QA-only overhead roofline and voids'}",
 "{name:'DUMBO B · Street QA',get x(){return globalThis.__PATROL_DUMBO_QA__?.sites?.[1]?.x??372},get z(){return globalThis.__PATROL_DUMBO_QA__?.sites?.[1]?.z??-285},height:1.7,bearing:90,radius:15,rise:1.5,detail:'QA-only second warehouse street-facing'}",
 "{name:'DUMBO B · Low Flight QA',get x(){return globalThis.__PATROL_DUMBO_QA__?.sites?.[1]?.x??372},get z(){return globalThis.__PATROL_DUMBO_QA__?.sites?.[1]?.z??-285},height:18,bearing:65,radius:28,rise:8,detail:'QA-only second roofline and corners'}"
].join(',\n')+',\n';
const results={version:'DUMBO_WAREHOUSE_REAL_PARCEL_QA_V1',
 noProductionModification:true,lighting:'clear summer noon',viewport:[1280,720],
 cameras:cameraSpecs,attempts:{},comparisons:[],passed:false};
const browser=await chromium.launch({headless:true,args:[
 '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader'
]});
function inspect(bytes){
 const img=PNG.sync.read(bytes),colors=new Set();
 let black=0,n=0;
 for(let y=0;y<img.height;y+=8)for(let x=0;x<img.width;x+=8){
  const i=(y*img.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
  colors.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));
  if(r+g+b<22)black++;
  n++;
 }
 return {width:img.width,height:img.height,colorBins:colors.size,
  nearBlackFraction:black/Math.max(n,1)};
}
function diff(a,b){
 const x=PNG.sync.read(a),y=PNG.sync.read(b);
 if(x.width!==y.width||x.height!==y.height)throw Error('Unmatched frames');
 let count=0,changed=0,totalDelta=0;
 // Center and lower frame: building facade, not skyline/HUD or sun.
 const bounds=[Math.floor(x.width*.15),Math.floor(x.width*.85),
  Math.floor(x.height*.16),Math.floor(x.height*.90)];
 for(let yy=bounds[2];yy<bounds[3];yy+=3)
  for(let xx=bounds[0];xx<bounds[1];xx+=3){
   const i=(yy*x.width+xx)*4;
   const d=Math.max(Math.abs(x.data[i]-y.data[i]),
    Math.abs(x.data[i+1]-y.data[i+1]),
    Math.abs(x.data[i+2]-y.data[i+2]));
   if(d>12)changed++;
   totalDelta+=d;
   count++;
  }
 return {bounds,samples:count,changedFraction:changed/count,
  meanMaxChannelDelta:totalDelta/count};
}
async function captureVariant(variant){
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const failures=[],captures={};
 page.on('pageerror',e=>failures.push('js: '+e.message));
 page.on('console',m=>{if(m.type()==='error')failures.push('console: '+m.text());});
 await page.route('**/index.html',async route=>{
  const response=await route.fetch();
  if(!response.ok())throw Error('Cannot fetch original game HTML');
  let html=await response.text();
  const start='const NYC_SCENIC_VIEWS=[';
  if(html.split(start).length!==2)throw Error('Scenic view injection anchor changed');
  html=html.replace(start,start+'\n'+viewInsertion);
  const builder='function buildCityBuildings(parcels,local=false) {';
  const at=html.indexOf(builder);
  const sitesAnchor='    for(const lot of parcels){';
  const atSites=html.indexOf(sitesAnchor,at);
  if(at<0||atSites<at||atSites-at>2500)
   throw Error('Production warehouse parcel loop changed');
  const instrumentation=
   "    if(!local && parcels.length>=32){\n"+
   "      const sites=[...warehouseStyles.entries()].map(([lot,kind])=>({"+
   "variant:kind,x:lot[0],z:lot[1],w:lot[2],d:lot[3],h:lot[4],"+
   "destroyed:!!lot[6],official:!!lot[7]})).sort((a,b)=>a.variant-b.variant);\n"+
   "      if(!globalThis.__PATROL_DUMBO_QA__||sites.length>=globalThis.__PATROL_DUMBO_QA__.sites.length)"+
   " globalThis.__PATROL_DUMBO_QA__={sites,parcelCount:parcels.length};\n"+
   "    }\n";
  html=html.slice(0,atSites)+instrumentation+html.slice(atSites);
  // Report the ACTUAL scenic eye: a roof-collision clamp may raise a
  // supposed street-level view several floors above the sidewalk.
  const heightLine='const height=Math.max(ground+view.height+view.rise*lerp(1.2,0.68,zoom),navigationSurface(x,z)+3);';
  if(html.split(heightLine).length!==2)throw Error('Scene camera height anchor changed');
  html=html.replace(heightLine,heightLine+"\n    if(view.name?.startsWith('DUMBO ') && globalThis.__PATROL_DUMBO_QA__)"+
   "globalThis.__PATROL_DUMBO_QA__.lastCamera={label:view.name,eye:[x,height,z],"+
   "ground,groundAtEye:sampleTerrainHeight(x,z),"+
   "navigationHeight:navigationSurface(x,z),target:[view.x,ground+view.height,view.z]};");
  if(variant==='fallback'){
   const marker='const cornerWarehouse=warehouseStyles.has(lot);';
   if(html.split(marker).length!==2)throw Error('Warehouse rollback anchor changed');
   html=html.replace(marker,'const cornerWarehouse=false; // QA-only fallback, original geometry');
  }
  await route.fulfill({response,body:html,contentType:'text/html; charset=utf-8',
   headers:{...response.headers(),'cache-control':'no-store'}});
 });
 try{
  const response=await page.goto(base+'/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  if(!response?.ok())throw Error('Game unavailable');
  await page.locator('input[name="flightMap"][value="manhattan"]').check({force:true});
  await page.locator('#startFlight').click({force:true});
  await page.waitForFunction(()=>{
   const title=document.getElementById('titleOverlay');
   return title?.hidden&&document.getElementById('loadOverlay')?.classList.contains('done');
  },null,{timeout:120000});
  await page.waitForFunction(()=>globalThis.__PATROL_DUMBO_QA__?.sites?.length===2,
    null,{timeout:45000});
  const parcels=await page.evaluate(()=>globalThis.__PATROL_DUMBO_QA__);
  if(parcels.sites.length!==2||parcels.sites.some(s=>s.destroyed||s.official||
      s.x<205||s.x>435||s.z< -415||s.z> -195))
   throw Error('Real parcels unsuitable: '+JSON.stringify(parcels));
  await page.evaluate(()=>{
   for(const [id,value] of [['skyTime','12'],['skySeason','1'],['skyWeather','Clear']]){
    const el=document.getElementById(id);
    if(!el)throw Error('Missing environment control '+id);
    el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));
   }
  });
  await page.keyboard.press('h');
  await page.waitForFunction(()=>!document.getElementById('hotelViews')?.hidden,
   null,{timeout:15000});
  await page.addStyleTag({content:
   'body.dumbo-qa-pixels * {visibility:hidden!important} '+
   'body.dumbo-qa-pixels #glCanvas {visibility:visible!important}'});
  for(let i=0;i<cameraSpecs.length;i++){
   const cam=cameraSpecs[i];
   await page.locator('#hotelTarget').selectOption({label:cam.name});
   await page.locator('#hotelZoom').evaluate((el,n)=>{
    el.value=String(n);el.dispatchEvent(new Event('input',{bubbles:true}));
   },cam.zoom);
   await page.locator('#hotelAngle').evaluate(el=>{
    el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));
   });
   await page.waitForTimeout(1150);
   const info=await page.evaluate(()=>{
    const gl=document.getElementById('glCanvas')?.getContext('webgl2');
    return {label:document.querySelector('#hotelTarget option:checked')?.textContent,
      zoom:document.getElementById('hotelZoom')?.value,
      webgl:!!gl&&!gl.isContextLost(),error:gl?.getError()??null};
   });
   if(!info.webgl||info.error!==0||info.label!==cam.name)
    throw Error('Camera/WebGL invalid '+JSON.stringify(info));
   const actualCamera=await page.evaluate(()=>globalThis.__PATROL_DUMBO_QA__?.lastCamera);
   if(!actualCamera||actualCamera.label!==cam.name||
      !actualCamera.eye.every(Number.isFinite)||
      !Number.isFinite(actualCamera.groundAtEye))
    throw Error('Missing actual 3D QA eye '+JSON.stringify(actualCamera));
   // An actual pedestrian cannot be twenty units above the ground after
   // the scenic eye snaps on top of a neighboring roof.
   if(cam.name.includes('Street') &&
     actualCamera.eye[1]-actualCamera.groundAtEye>7.5)
    throw Error('Street camera elevated onto rooftop, not pedestrian level: '+
     JSON.stringify(actualCamera));
   info.actualCamera=actualCamera;
   const name=String(i).padStart(2,'0')+'-'+variant+'.png';
   await page.evaluate(()=>document.body.classList.add('dumbo-qa-pixels'));
   let bytes;
   try{bytes=await page.locator('#glCanvas').screenshot({
    path:out+'/'+name,animations:'allow',timeout:75000});
   }finally{await page.evaluate(()=>document.body.classList.remove('dumbo-qa-pixels'));}
   const stats=inspect(bytes);
   if(stats.colorBins<28||stats.nearBlackFraction>.97||
       stats.width<640||stats.height<360)
    throw Error('Empty/broken actual WebGL screenshot '+name+' '+JSON.stringify(stats));
   captures[name]={bytes,stats,info};
   console.log('[PATROL DUMBO QA] '+name+' '+JSON.stringify(stats));
  }
  if(failures.length)throw Error('Browser exceptions: '+failures.join(' | ').slice(0,700));
  return {sites:parcels.sites,parcelCount:parcels.parcelCount,captures,
   pageErrors:failures};
 }finally{await page.close();}
}
try{
 const control=await captureVariant('fallback');
 const candidate=await captureVariant('candidate');
 const equal=JSON.stringify(control.sites)===JSON.stringify(candidate.sites);
 if(!equal)throw Error('A/B selected different parcels!');
 results.sites=candidate.sites;
 results.parcelCount=candidate.parcelCount;
 for(let i=0;i<cameraSpecs.length;i++){
  const controlKey=String(i).padStart(2,'0')+'-fallback.png';
  const newKey=String(i).padStart(2,'0')+'-candidate.png';
  const a=control.captures[controlKey],b=candidate.captures[newKey];
  const delta=diff(a.bytes,b.bytes);
  const result={camera:cameraSpecs[i].name,
   fallback:a.stats,candidate:b.stats,delta};
  results.comparisons.push(result);
  // Moderate material change expected at each source-selected site. Avoid
  // declaring a pass just because the environment itself continues moving.
  if(delta.changedFraction<.003)
   throw Error('Warehouse is invisible at fixed camera: '+JSON.stringify(result));
 }
 results.passed=true;
}catch(error){
 results.error=error.stack||String(error);
}finally{
 await writeFile(out+'/report.json',JSON.stringify(results,null,2));
 await browser.close();
}
console.log(JSON.stringify(results,null,2));
if(!results.passed)process.exitCode=1;
