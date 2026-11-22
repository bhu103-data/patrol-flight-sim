// Actual GitHub Chromium screenshot QA of municipal pedestrian polygons
// displayed with official 2022 roadbed + DCM streets + OTI building outlines.
// This is NOT a photo, 3D façade or playable city.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const output='artifacts/nyc-oti-pedestrian-source';
await mkdir(output,{recursive:true});
const report={passed:false,errors:[],screenshots:[],metrics:{}};
const browser=await chromium.launch({headless:true});
try{
  const source=JSON.parse(await readFile(output+'/pedestrian-surfaces.json','utf8'));
  if(source.role!=='SOURCE_GEO_REFERENCE_ONLY_NOT_ENABLED_IN_GAME'||
     !source.counts?.plaza?.features||!source.counts?.sidewalk?.features)
    throw Error('Official plaza + sidewalk source missing');
  const page=await browser.newPage({viewport:{width:1280,height:1000},
    deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(String(e)));
  const url=(process.env.PATROL_PEDESTRIAN_BASE_URL||
    'http://127.0.0.1:8765').replace(/\/$/,'')+'/pedestrian-roadbed-overlay.svg';
  const response=await page.goto(url,{waitUntil:'load'});
  if(!response?.ok())throw Error('Official overlay HTTP unavailable');
  const count=await page.evaluate(()=>{
    const svg=document.querySelector('svg');
    if(!svg)return null;
    const paths=[...svg.querySelectorAll('path')];
    return {viewBox:svg.getAttribute('viewBox'),
      plaza:paths.filter(p=>p.getAttribute('fill')==='#d4a05a').length,
      sidewalk:paths.filter(p=>p.getAttribute('fill')==='#d2cfb6').length,
      roadbed:paths.filter(p=>p.getAttribute('fill')==='#3f807d').length,
      background:svg.querySelector('rect')?.getAttribute('fill')};
  });
  if(!count||count.plaza!==source.counts.plaza.polygons||
     count.sidewalk!==source.counts.sidewalk.polygons||
     count.roadbed<20)throw Error('Real polygon counts missing: '+
       JSON.stringify(count));
  const bytes=await page.locator('svg').screenshot(
    {path:output+'/plaza-sidewalk-roadbed-real-metre.png'});
  const png=PNG.sync.read(bytes);
  let colored=0,light=0;
  for(let i=0;i<png.data.length;i+=4){
    const r=png.data[i],g=png.data[i+1],b=png.data[i+2];
    if(r>70&&g>70&&b>60)colored++;
    if(r>110&&g>100&&b>80)light++;
  }
  const visibility=colored/(png.width*png.height);
  if(visibility<.02||light<1000)throw Error('Official source polygons not visible');
  report.screenshots.push('plaza-sidewalk-roadbed-real-metre.png');
  report.metrics={count,pixels:{width:png.width,height:png.height,
    coloredFraction:visibility,lightPixels:light},
    caveat:'Web/SVG source outline QA; no in-game road/sidewalk collisions or hardware FPS'};
  if(report.errors.length)throw Error(report.errors.join('; '));
  report.passed=true;
}catch(e){
  report.errors.push(String(e.stack||e));process.exitCode=1;
}finally{
  await writeFile(output+'/browser-report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  await browser.close();
}
