// Independent real-WebGL2 QA for metre-scale Times Square source massing.
// Never opens or mutates the production PATROL map/flight controls.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=(process.env.PATROL_BASE_URL||'http://127.0.0.1:8765').replace(/\/$/,'');
const output='artifacts/nyc-metric-reference';
await mkdir(output,{recursive:true});
const result={passed:false,errors:[],reference:'WGS84 metres, Times Square'};
const check=(yes,msg)=>{if(!yes)throw Error(msg)};
const browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
]});
try{
  const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
  page.on('pageerror',e=>result.errors.push('JS: '+e.message));
  page.on('response',r=>{
    if(r.status()>=400)result.errors.push('HTTP '+r.status()+' '+r.url());
  });
  const response=await page.goto(root+'/assets/nyc/times-square-metered-preview.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  check(response?.ok(),'Metric preview HTTP error');
  await page.waitForFunction(()=>
    document.getElementById('status')?.textContent?.includes('source buildings shown'),
    null,{timeout:60000});
  result.status=await page.locator('#status').textContent();
  result.metadata=await page.locator('#metadata').textContent();
  const state=await page.evaluate(()=>{
    const canvas=document.getElementById('scene');
    const gl=canvas?.getContext('webgl2');
    return {glVersion:gl?.getParameter(gl.VERSION)||null,
      drawingBufferWidth:gl?.drawingBufferWidth,
      drawingBufferHeight:gl?.drawingBufferHeight,
      webgl2:Boolean(gl&&!gl.isContextLost()),
      error:gl?.getError()};
  });
  Object.assign(result,state);
  check(state.webgl2&&state.error===0,'Live WebGL2 context invalid');
  check(state.drawingBufferWidth>=1000&&state.drawingBufferHeight>=600,
    'Metric canvas did not render at capture size');
  const number=Number(result.status.match(/^(\d+) source buildings shown/)?.[1]);
  result.buildings=number;
  check(number>=100&&number<=120,'Unexpected source geometry coverage');
  check(result.status.includes('270.6m tallest source roof'),
    'Real source HEIGHTROOF values appear compressed');
  check(result.metadata.includes('holes/courtyards skipped: 2'),
    'Polygon-hole fallback should be explicit');
  await page.waitForTimeout(400);
  const first=await page.locator('#scene').screenshot({
    path:output+'/01-metric-massing.png',timeout:90000});
  const png=PNG.sync.read(first);
  let nonBackground=0;
  for(let y=50;y<png.height;y+=3)for(let x=0;x<png.width;x+=3){
    const i=(y*png.width+x)*4;
    if(png.data[i]>70&&png.data[i+1]>85&&png.data[i+2]>95)
      nonBackground++;
  }
  result.visibleMaterialSamples=nonBackground;
  check(nonBackground>1000,'Massing renders blank or without visible geometry');
  await page.mouse.move(770,380);
  await page.mouse.down();
  await page.mouse.move(1010,480,{steps:6});
  await page.mouse.up();
  await page.waitForTimeout(350);
  const second=await page.locator('#scene').screenshot({
    path:output+'/02-metric-massing-orbit.png',timeout:90000});
  result.firstPngHash=createHash('sha256').update(first).digest('hex');
  result.orbitPngHash=createHash('sha256').update(second).digest('hex');
  check(result.firstPngHash!==result.orbitPngHash,
    'Pointer orbit did not change real scene pixels');
  check(result.errors.length===0,'Browser error: '+result.errors.join('; '));
  result.passed=true;
}catch(e){result.errors.push(e.stack||String(e));process.exitCode=1}
finally{
  await writeFile(output+'/report.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
  await browser.close();
}
