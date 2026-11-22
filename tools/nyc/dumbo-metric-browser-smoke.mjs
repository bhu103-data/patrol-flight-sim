// Real WebGL2 screenshot evidence for the independent, real-metric NYC OTI pilot.
// Browser CI uses software WebGL and is NOT native hardware performance proof.
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const url=process.env.PATROL_BASE_URL||'http://127.0.0.1:8765';
const output='artifacts/nyc-dumbo-metric';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
 '--enable-unsafe-swiftshader','--disable-gpu-sandbox'
]});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(url+'/tools/nyc/dumbo-metric-preview.html',
  {waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response.status(),200);
 await page.waitForFunction('window.__metricQa?.buildings===48',null,{timeout:30000});
 await page.waitForTimeout(900);
 const stats=await page.evaluate(()=>{
  const c=document.getElementById('render'),gl=c.getContext('webgl2');
  return {...window.__metricQa,error:gl.getError(),contextLost:gl.isContextLost(),
   width:c.width,height:c.height};
 });
 assert.equal(stats.buildings,48);
 assert.equal(stats.webgl2,true);assert.equal(stats.error,0);
 assert.equal(stats.contextLost,false);
 assert.ok(stats.triangles>500&&stats.triangles<4000);
 assert.equal(stats.roadTriangles,553,'rounded 2022 roadbed geometry is visible, 24 degenerate source triangles excluded');
 assert.equal(stats.buildingTriangles,1669,'original 48-building source geometry must be unchanged');
 assert.equal(stats.centerlineTriangles,590,'295 official source line segments must render without fabrication');
 assert.equal(stats.cscl.sourceRecords,404);
 assert.equal(stats.cscl.groundRecords,213);
 assert.equal(stats.cscl.excludedRecords,191);
 assert.equal(stats.cscl.segments,295);
 assert.equal(stats.cscl.streetNames,34);
 assert.equal(stats.cscl.conflicts.length,4);
 assert.ok(stats.cscl.networkLengthMetres>8000&&stats.cscl.networkLengthMetres<12000);
 assert.equal(stats.triangles,stats.roadTriangles+stats.buildingTriangles+stats.centerlineTriangles);
 assert.equal(stats.triangles,2812);
 assert.equal(stats.roadbed.year,2022);
 assert.equal(stats.roadbed.sourceTriangles,577);
 assert.equal(stats.roadbed.skippedDegenerate,24);
 assert.ok(Math.abs(stats.roadbed.originalAreaM2-3714.73)<.25);
 assert.match(stats.roadbed.note,/no lane directions/);
 assert.ok(stats.spanMeters[0]>100&&stats.spanMeters[1]>100);
 assert.equal(errors.length,0,'No page errors allowed: '+errors.join('; '));
 const image=await page.screenshot({path:output+'/01-oti-metric-oblique.png'});
 await page.keyboard.press('t');await page.waitForTimeout(300);
 await page.screenshot({path:output+'/02-oti-metric-plan.png'});
 await page.keyboard.press('r');
 await page.waitForTimeout(350);
 const roadImage=await page.screenshot({path:output+'/03-front-dock-2022-roadbed.png'});
 const roadPng=PNG.sync.read(roadImage);
 const first=PNG.sync.read(image);let changed=0;
 for(let i=0;i<Math.min(first.data.length,roadPng.data.length);i+=4*71){
   if(Math.abs(first.data[i]-roadPng.data[i])+
      Math.abs(first.data[i+1]-roadPng.data[i+1])+
      Math.abs(first.data[i+2]-roadPng.data[i+2])>35)changed++;
 }
 assert.ok(changed>600,'Road-focused camera did not change WebGL image: '+changed);
 const roadFocus=await page.evaluate(()=>window.__metricCamera?.roadFocus);
 assert.ok(Array.isArray(roadFocus)&&roadFocus.length===3&&
   roadFocus.every(Number.isFinite),'Road world coordinate target missing');
 await page.keyboard.press('c');
 await page.waitForTimeout(350);
 const conflictImage=await page.screenshot({path:output+'/04-cscl-source-conflicts.png'});
 const conflictFocus=await page.evaluate(()=>window.__metricCamera?.conflictFocus);
 assert.ok(Array.isArray(conflictFocus)&&conflictFocus.length===3&&
   conflictFocus.every(Number.isFinite),'Conflict 3D camera target missing');
 const conflictPng=PNG.sync.read(conflictImage);let conflictChanged=0;
 for(let i=0;i<Math.min(roadPng.data.length,conflictPng.data.length);i+=4*71){
   if(Math.abs(roadPng.data[i]-conflictPng.data[i])+
      Math.abs(roadPng.data[i+1]-conflictPng.data[i+1])+
      Math.abs(roadPng.data[i+2]-conflictPng.data[i+2])>35)conflictChanged++;
 }
 assert.ok(conflictChanged>600,
   'Conflict camera did not actually move: '+conflictChanged);
 const png=PNG.sync.read(image),colors=new Set(),stride=4*13;
 for(let i=0;i<png.data.length;i+=stride){
  colors.add([png.data[i],png.data[i+1],png.data[i+2]].join(','));
 }
 assert.ok(colors.size>75,'Suspicious near-blank preview: '+colors.size+' colors');
 const report={passed:true,source:'NYC OTI BUILDING_view 5zhs-2jue',
  captureMode:'swiftshader-functional-not-hardware-fps',stats,errors,
  sampledColors:colors.size,sourceBuildings:48,
  images:['01-oti-metric-oblique.png','02-oti-metric-plan.png','03-front-dock-2022-roadbed.png','04-cscl-source-conflicts.png'],
  roadFocus,roadCameraChangedSamples:changed,conflictFocus,
  conflictCameraChangedSamples:conflictChanged,
  limitation:'48 source OTI roofs, limited 2022 Front/Dock pavement and 295 source CSCL centerline segments; 4 unresolved cross-dataset footprint overlaps; no surveyed curbs, actual 2026 lanes, verified elevation/bridges or flight collisions'};
 await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');
 console.log('PATROL metric DUMBO browser QA:',JSON.stringify(report));
 await page.close();
}finally{await browser.close();}
