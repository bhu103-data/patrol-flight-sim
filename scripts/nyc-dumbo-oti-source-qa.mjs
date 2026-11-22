// Bounded, read-only NYC OTI DUMBO footprint source QA.
// Run: node scripts/nyc-dumbo-oti-source-qa.mjs
// Only certified source coordinates and building height values are exported;
// NOTHING is attached to PATROL's fictional compressed map at this stage.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const service='https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/BUILDING_view/FeatureServer/0/query';
const bbox=[-73.9935,40.6995,-73.9855,40.7045]; // WGS84, DUMBO / Brooklyn
const now=new Date().toISOString();
const params=new URLSearchParams({
 where:'HEIGHT_ROOF > 10 AND BIN >= 3000000 AND BIN < 4000000',
 geometry:bbox.join(','),geometryType:'esriGeometryEnvelope',
 spatialRel:'esriSpatialRelIntersects',inSR:'4326',
 outSR:'4326',outFields:'OBJECTID,BIN,HEIGHT_ROOF,GROUND_ELEVATION,BASE_BBL',
 returnGeometry:'true',resultRecordCount:'1500',f:'geojson'
});
const sourceUrl=service+'?'+params;
function ringArea(ring){
 return ring.reduce((s,a,i)=>{const b=ring[(i+1)%ring.length];return s+a[0]*b[1]-a[1]*b[0]},0)*.5;
}
function within(point,box,margin=.0008){
 return point[0]>=box[0]-margin&&point[0]<=box[2]+margin&&
   point[1]>=box[1]-margin&&point[1]<=box[3]+margin;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let response,error;
for(let attempt=0;attempt<3;attempt++){
 try{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),18000);
  try{response=await fetch(sourceUrl,{
    headers:{'Accept':'application/geo+json,application/json'},
    signal:controller.signal,
  });}finally{clearTimeout(timeout)}
  if(!response.ok)throw Error('ArcGIS HTTP '+response.status);
  break;
 }catch(ex){error=String(ex);if(attempt<2)await sleep(500*(attempt+1))}
}
assert.ok(response?.ok, 'Official NYC OTI service unreachable: '+error);
const data=await response.json();
assert.equal(data.type,'FeatureCollection','ArcGIS must return GeoJSON');
assert.ok(Array.isArray(data.features)&&data.features.length>=12,
  'Expected multiple real DUMBO polygons; got '+data.features?.length);
assert.ok(data.features.length<1500,
  'Potential truncated query: source has more features than requested cap');

const selected=[],seen=new Set(),reasons={};
const skip=reason=>{reasons[reason]=(reasons[reason]||0)+1};
for(const f of data.features){
 const p=f?.properties||{};
 const fid=Number(p.OBJECTID??p.objectid),bin=Number(p.BIN??p.bin);
 const ft=Number(p.HEIGHT_ROOF??p.height_roof);
 if(!Number.isSafeInteger(fid)||fid<1||seen.has(fid)){skip('invalid-or-duplicate-id');continue}
 seen.add(fid);
 if(!Number.isSafeInteger(bin)||bin<3000000||bin>=4000000){
  skip('not-brooklyn');continue
 }
 if(!Number.isFinite(ft)||ft<12||ft>300){skip('invalid-height');continue}
 const g=f.geometry;
 let shell;
 if(g?.type==='Polygon'&&g.coordinates?.length===1)
   shell=g.coordinates[0];
 else if(g?.type==='MultiPolygon'&&g.coordinates?.length===1&&
   g.coordinates[0]?.length===1)shell=g.coordinates[0][0];
 else {skip('complex-or-holed-polygon');continue}
 if(!Array.isArray(shell)||shell.length<4||shell.length>48){
  skip('ring-length');continue
 }
 const ring=shell.slice(0,-1).map(c=>c.slice(0,2));
 if(ring.length<3||ring.some(p=>p.length!==2||!p.every(Number.isFinite)||
   !within(p,bbox))){skip('out-of-bounds-vertex');continue}
 const area=Math.abs(ringArea(ring));
 if(area<2e-10||area>1e-6){skip('degenerate-or-too-large');continue}
 const center=ring.reduce((sum,p)=>[sum[0]+p[0]/ring.length,
   sum[1]+p[1]/ring.length],[0,0]);
 if(!within(center,bbox,0)){skip('outside-center');continue}
 selected.push({fid,bin,heightRoofFt:Math.round(ft*100)/100,
   groundElevationFt:Number.isFinite(Number(p.GROUND_ELEVATION))
     ?Number(p.GROUND_ELEVATION):null,
   wgs84:ring.map(p=>p.map(v=>Math.round(v*1e7)/1e7)),
   centroid:center.map(v=>Math.round(v*1e7)/1e7),
   polygonAreaDegrees2:area});
}
selected.sort((a,b)=>{
 const da=(a.centroid[0]+73.989)**2+(a.centroid[1]-40.702)**2;
 const db=(b.centroid[0]+73.989)**2+(b.centroid[1]-40.702)**2;
 return da-db||a.fid-b.fid;
});
assert.ok(selected.length>=8,'Insufficient verified historic DUMBO footprint candidates: '+selected.length);
const pilot=selected.slice(0,48);
const output={
 schema:'patrol-nyc-oti-dumbo-source-v1',retrievedAt:now,
 provider:'New York City Office of Technology and Innovation (OTI)',
 dataset:'BUILDING_view',datasetId:'5zhs-2jue',
 service:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/BUILDING_view/FeatureServer/0',
 sourceQuery:{bboxWGS84:bbox,where:params.get('where'),
  outFields:params.get('outFields'),sourceUrl,
  returnGeometry:'GeoJSON WGS84'},
 licensing:'NYC Open Data Terms; cite dataset and verify required notices before shipping',
 assetRole:'SOURCE_CANDIDATES_ONLY_NOT_IN_GAME',
 statement:'Actual municipal footprint polygons and source HEIGHT_ROOF in feet. No PATROL x/z calibration, collision shape or game mesh is asserted by this file.',
 results:{returned:data.features.length,eligible:selected.length,
  exported:pilot.length,rejected:reasons},
 candidates:pilot
};
await mkdir('artifacts/nyc-dumbo-oti',{recursive:true});
await writeFile('artifacts/nyc-dumbo-oti/official-dumbo-source-pilot.json',
  JSON.stringify(output,null,2)+'\n');
await writeFile('artifacts/nyc-dumbo-oti/summary.txt',
  ['NYC official BUILDING_view DUMBO source QA',now,
    'Source: '+service,'Features returned: '+data.features.length,
    'Selected: '+pilot.length,'Eligible: '+selected.length,
    'Only source WGS84 rings and roof heights; not runtime game shapes.',
    'See official-dumbo-source-pilot.json for FIDs, bounds and rejection reasons.',
    'No Google imagery/models, no purchased datasets, no API keys'].join('\n')+'\n');
console.log(JSON.stringify({passed:true,returned:data.features.length,
  eligible:selected.length,exported:pilot.length,rejected:reasons,
  source:'NYC OTI / BUILDING_view',assetRole:output.assetRole},null,2));
