// WebGL2 functional screenshot QA for the isolated true-metre NYC reference pilot.
// This is NOT photographic fidelity, real street alignment, or native GPU FPS QA.
// Serve repo root: python3 -m http.server 8765 --bind 127.0.0.1
// Run: PATROL_BASE_URL=http://127.0.0.1:8765 node scripts/nyc-metric-pilot-browser-qa.mjs
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';

const base=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const out='artifacts/nyc-metric-pilot';
await mkdir(out,{recursive:true});
const errors=[],warnings=[],captures=[];
const browser=await chromium.launch({headless:true,args:[
  '--no-sandbox','--disable-dev-shm-usage','--ignore-gpu-blocklist',
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader'
]});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{if(msg.type()==='error')warnings.push(msg.text());});
page.on('requestfailed',r=>errors.push('Failed request '+r.url()));
function check(ok,message){if(!ok)throw new Error(message);}
function describe(bytes){
  const img=PNG.sync.read(bytes),buckets=new Set();
  let dark=0,nonBackground=0,samples=0,mean=0;
  const rgb=[];
  for(let y=8;y<img.height;y+=8)for(let x=8;x<img.width;x+=8){
    const i=(y*img.width+x)*4,r=img.data[i],g=img.data[i+1],b=img.data[i+2];
    const v=(r+g+b)/3;
    rgb.push([r,g,b]);mean+=v;
    if(r+g+b<24)dark++;
    if(Math.abs(r-18)+Math.abs(g-27)+Math.abs(b-38)>44)nonBackground++;
    buckets.add(((r>>4)<<8)|((g>>4)<<4)|(b>>4));samples++;
  }
  return {width:img.width,height:img.height,colorBins:buckets.size,
    nearBlackFraction:dark/samples,nonBackgroundFraction:nonBackground/samples,
    meanLuma:mean/samples,rgb};
}
let report;
try{
  const response=await page.goto(base+'/nyc-times-square-metric-pilot.html',{
    waitUntil:'domcontentloaded',timeout:60000});
  check(response?.ok(),'1:1 pilot HTML unavailable');
  await page.waitForFunction(()=>{
    const t=document.getElementById('status')?.textContent||'';
    if(t.includes('failed')||t.includes('unavailable'))throw Error(t);
    return /\d+\s*\/\s*120 official building footprints/.test(t);
  },null,{timeout:60000});
  const state=await page.evaluate(async()=>{
    const gl=document.getElementById('scene')?.getContext('webgl2');
    const source=await (await fetch('/assets/nyc/times-square-footprints.json')).json();
    const mod=await import('/assets/nyc/nyc-metric-geometry-pilot.js');
    const result=mod.buildMetricFootprintMesh(source),stats=result.stats;
    return {status:document.getElementById('status').textContent,
      width:document.getElementById('scene').width,
      height:document.getElementById('scene').height,
      webgl2:Boolean(gl),glError:gl?.getError(),renderer:gl?.getParameter(gl.RENDERER),
      accepted:stats.acceptedBuildings,rejected:stats.rejectedBuildings,
      triangles:stats.triangles,metresPerWorldUnit:stats.metresPerWorldUnit,
      xSpan:stats.maxX-stats.minX,zSpan:stats.maxZ-stats.minZ,
      maxHeight:stats.maxHeight,source:stats.source,rejects:stats.rejects};
  });
  check(state.webgl2&&state.glError===0,'Browser WebGL2 missing or GL error');
  check(state.accepted+state.rejected===120&&state.accepted>=115,
    'Most official Times Square footprints not rendered: '+JSON.stringify(state));
  check(state.metresPerWorldUnit===1&&state.triangles>100,
    'True-metre or polygon mesh broken');
  check(state.xSpan>100&&state.zSpan>150&&state.maxHeight>80,
    'Model spans not plausibly in physical metres');
  await page.waitForTimeout(1250);
  const a=await page.locator('#scene').screenshot({
    path:out+'/01-metre-baseline-east-south.png',timeout:75000});
  const first=describe(a);
  check(first.width===1280&&first.height===720,'Camera capture changed resolution');
  check(first.colorBins>=20&&first.nonBackgroundFraction>.05,
    'Source-footprint viewer renders a blank or near-uniform canvas: '+JSON.stringify(first));
  captures.push({name:'01-metre-baseline-east-south.png',
    pixels:Object.fromEntries(Object.entries(first).filter(([k])=>k!=='rgb'))});
  await page.mouse.move(730,430);
  await page.mouse.down();
  await page.mouse.move(350,355,{steps:16});
  await page.mouse.up();
  await page.waitForTimeout(900);
  const b=await page.locator('#scene').screenshot({
    path:out+'/02-metre-baseline-orbit.png',timeout:75000});
  const second=describe(b);
  let different=0;
  for(let i=0;i<first.rgb.length;i++){
    const p=first.rgb[i],q=second.rgb[i];
    if(Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])+Math.abs(p[2]-q[2])>48)
      different++;
  }
  const changedFraction=different/first.rgb.length;
  check(second.colorBins>=20&&second.nonBackgroundFraction>.05,
    'Orbit image lacks real footprint scene');
  check(changedFraction>.02,
    'Pointer-orbit changed too few real scene pixels: '+changedFraction);
  captures.push({name:'02-metre-baseline-orbit.png',
    pixels:Object.fromEntries(Object.entries(second).filter(([k])=>k!=='rgb'))});
  check(errors.length===0,'JS errors: '+errors.join('; '));
  check(warnings.length===0,'Browser console errors: '+warnings.join('; '));
  report={passed:true,state,captures,changedFraction,errors,warnings,
    limitation:'Source-footprint layout and flat official HEIGHTROOF extrusions only. NO roadbed, 2026 facades, current signage, fixed photo match or native GPU performance.'};
}catch(e){
  report={passed:false,error:e.stack||String(e),captures,errors,warnings};
  try{await page.screenshot({path:out+'/FAILED.png',timeout:10000})}catch{}
}finally{
  await writeFile(out+'/browser-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(!report.passed)process.exitCode=1;
