/** Official 2022-era NYC planimetric curb lines, NO inferred road edges.
 * Bounded source probe and timestamped local QA snapshot, never game runtime.
 * https://data.cityofnewyork.us/d/5xvt-8cbk
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BBOX} from './fetch-times-square-cscl.mjs';

export const SOURCE='https://data.cityofnewyork.us/resource/5xvt-8cbk.json';
export const OUT='artifacts/nyc-metric-pilot/official-curbs.json';
export function requestCurbUrl(){
 const u=new URL(SOURCE);
 u.searchParams.set('$where','within_box(the_geom,'+
   [BBOX.north,BBOX.west,BBOX.south,BBOX.east].join(',')+')');
 u.searchParams.set('$limit','2000');
 return u.toString();
}
const coord=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&
 Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
export function normalizeCurbRecords(records){
 if(!Array.isArray(records))throw TypeError('NYC Curbs must be a JSON array');
 if(records.length>=2000)throw Error('NYC Curbs query hit 2000-row cap');
 const segments=[],rejected=[];
 for(let index=0;index<records.length;index++){
   const row=records[index];
   // Use the published source id when present. Its absence is not a reason
   // to fabricate a municipal identifier; retain the query's row offset.
   const id=String(row?.objectid??row?.object_id??row?.ogc_fid??'row:'+index);
   const geom=row?.the_geom;
   if(geom?.type!=='MultiLineString'||!Array.isArray(geom.coordinates)){
     rejected.push({id,reason:'invalid official MultiLineString'});continue;
   }
   const parts=geom.coordinates.filter(part=>Array.isArray(part)&&
     part.length>=2&&part.length<=1000&&part.every(coord));
   if(!parts.length){rejected.push({id,reason:'empty/invalid source curb segments'});continue;}
   segments.push({id,parts,status:row?.status??null,
     shapeLengthRaw:row?.shape_leng??null});
 }
 return {segments,rejected};
}
export async function downloadCurbs(fetcher=fetch){
 const url=requestCurbUrl();
 let last;
 for(let attempt=0;attempt<3;attempt++){
   try{
     const response=await fetcher(url,{
       headers:{Accept:'application/json',
         'User-Agent':'PATROL-NYC-Metric-QA/0.1 (github.com/bhu103-data/patrol-flight-sim)'},
       signal:AbortSignal.timeout(40000)});
     if(!response.ok)throw Error('Official curb API HTTP '+response.status);
     const rows=await response.json(),out=normalizeCurbRecords(rows);
     if(out.segments.length<15)
       throw Error('Official curb record count suspiciously low ('+
         out.segments.length+'); no fabricated fallback');
     return {sourceDataset:'NYC Planimetric Database: Curbs / 5xvt-8cbk',
       sourcePage:'https://data.cityofnewyork.us/d/5xvt-8cbk',
       endpoint:SOURCE,queryUrl:url,boundsWGS84:BBOX,
       fetchedUtc:new Date().toISOString(),inputRows:rows.length,
       coordinateSystem:'WGS84 lon,lat from NYC Open Data',
       captureVintage:'2022 imagery-based planimetric update; historical source, not a 2026 curb survey',
       disclaimer:'Official curb lines, NOT verified current roadbed/pavement, traffic lane, sidewalk or curb elevation',
       segments:out.segments,rejections:out.rejected};
   }catch(e){
     last=e;
     if(attempt<2)await new Promise(done=>setTimeout(done,1500*(attempt+1)));
   }
 }
 throw Error('Curb source retrieval/validation failed: '+last);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
   const snapshot=await downloadCurbs();
   mkdirSync(dirname(OUT),{recursive:true});
   writeFileSync(OUT,JSON.stringify(snapshot));
   console.log('NYC official curb survey source QA',
     JSON.stringify({rows:snapshot.inputRows,valid:snapshot.segments.length,
       rejected:snapshot.rejections.length,
       sample:snapshot.segments.slice(0,2).map(s=>({id:s.id,parts:s.parts.length,
         points:s.parts.reduce((n,p)=>n+p.length,0)})),
       source:snapshot.sourcePage}));
 }catch(error){console.error(error.stack||String(error));process.exitCode=1;}
}
