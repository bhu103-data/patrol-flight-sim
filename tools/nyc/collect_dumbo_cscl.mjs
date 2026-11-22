/**
 * Read-only NYC OTI 2026 CSCL extraction for the same source metre frame as
 * PR #238. Writes a downloadable evidence snapshot, NOT a runtime HTTP tile.
 * URL: https://data.cityofnewyork.us/City-Government/Centerline/inkn-q76z
 * Never invents road lines and never treats a centerline as a curb or sidewalk.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const bbox={west:-73.9945,south:40.6988,east:-73.9845,north:40.7048};
const columns=['the_geom','physicalid','full_street_name','streetwidth',
  'number_travel_lanes','number_total_lanes','trafdir','rw_type','status',
  'boroughcode','from_level_code','to_level_code','modified_date'];
const endpoint='https://data.cityofnewyork.us/resource/inkn-q76z.json';
const query=new URLSearchParams({
  '$select':columns.join(','),
  '$where':`within_box(the_geom,${bbox.north},${bbox.west},${bbox.south},${bbox.east}) AND boroughcode='3'`,
  '$order':'physicalid ASC',
  '$limit':'1000'
});
const url=endpoint+'?'+query;
const response=await fetch(url,{headers:{Accept:'application/json'},
  signal:AbortSignal.timeout(35000)});
if(!response.ok)
  throw Error('NYC OTI current CSCL API '+response.status+': '+
    (await response.text()).slice(0,2000));
const raw=await response.json();
if(!Array.isArray(raw)||raw.length<8||raw.length>=1000)
  throw Error('Current NYC street source empty or truncated: '+raw?.length);
const seen=new Set(),records=[],rejected=[];
for(const r of raw){
  const id=Number(r.physicalid);
  if(!Number.isSafeInteger(id)||id<=0||seen.has(id)){
    rejected.push({id:r.physicalid,reason:'invalid/duplicate physical ID'});
    continue;
  }
  seen.add(id);
  const multi=r.the_geom?.coordinates;
  if(r.the_geom?.type!=='MultiLineString'||!Array.isArray(multi)){
    rejected.push({id,reason:'not WGS84 MultiLineString'});
    continue;
  }
  const paths=[];
  for(const line of multi){
    if(!Array.isArray(line)||line.length<2)continue;
    const coords=line.map(p=>{
      if(!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite))
        throw Error('Invalid CSCL vertex for physicalid '+id);
      if(p[0]<-75||p[0]>-73||p[1]<40||p[1]>41.5)
        throw Error('Projected/invalid WGS84 in CSCL physicalid '+id);
      return [p[0],p[1]];
    });
    paths.push(coords);
  }
  if(!paths.length){rejected.push({id,reason:'empty lines'});continue;}
  const n=r.full_street_name||'';
  records.push({physicalid:id,name:n,trafdir:r.trafdir??null,
    status:r.status??null,roadwayType:r.rw_type===undefined?null:Number(r.rw_type),
    widthSourceFeet:r.streetwidth===undefined?null:Number(r.streetwidth),
    travelLanes:r.number_travel_lanes===undefined?null:Number(r.number_travel_lanes),
    totalLanes:r.number_total_lanes===undefined?null:Number(r.number_total_lanes),
    fromLevelCode:r.from_level_code??null,toLevelCode:r.to_level_code??null,
    modifiedDate:r.modified_date??null,paths});
}
if(records.length<8)
  throw Error('Too few source street polylines after validation: '+records.length);
const names=Array.from(new Set(records.map(r=>r.name))).sort();
const output={
  role:'OFFICIAL_STREET_CENTERLINE_SOURCE_NOT_CURB_WIDTH_SURVEY',
  attribution:'NYC Office of Technology and Innovation (OTI) — NYC Street Centerline (CSCL)',
  dataset:'inkn-q76z',
  canonicalDatasetUrl:'https://data.cityofnewyork.us/City-Government/Centerline/inkn-q76z',
  sourceEndpoint:endpoint,
  query:query.toString(),
  terms:'https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje',
  extractionDateUTC:new Date().toISOString(),
  crs:'EPSG:4326',
  bbox,
  reportedRows:raw.length,acceptedRows:records.length,rejected,
  observedNames:names,
  caveats:[
    'Street lines from the official road-bed centerline, NOT measured asphalt boundaries',
    'Socrata API source fields can change; reject rather than invent road names or positions',
    'Open-data streetwidth is reported as a source attribute; do not infer lane width or curb geometry',
    'Some feature paths can extend outside selection bbox; clip for display at the bbox boundary',
    'The target scene uses exact true-metre WGS84 geodesy, NOT PATROL compressed XY',
    'No 2026 street furniture, bridge deck elevations, sidewalks or valid collision networks are inferred'
  ],
  records
};
const json=JSON.stringify(output,null,2)+'\n';
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/nyc-dumbo-cscl-source-snapshot.json',json);
const sha=createHash('sha256').update(json).digest('hex');
const summary={acceptedRows:records.length,rejected:rejected.length,rawRows:raw.length,
  streetNames:names,sha256:sha,source:output.canonicalDatasetUrl,
  fieldCount:columns.length,bytes:Buffer.byteLength(json),
  bbox,topFive:records.slice(0,5).map(r=>({id:r.physicalid,name:r.name,
    vertices:r.paths.reduce((n,p)=>n+p.length,0)}))};
writeFileSync('artifacts/nyc-dumbo-cscl-summary.json',
  JSON.stringify(summary,null,2)+'\n');
console.log('OFFICIAL_NYC_CSCL_SOURCE '+JSON.stringify(summary));
