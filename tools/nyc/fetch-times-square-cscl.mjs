/** Bounded NYC CSCL extraction for the standalone Times Square metric pilot.
 * Download only during explicit QA. Runtime game makes NO API calls.
 * Source: https://data.cityofnewyork.us/d/inkn-q76z
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

export const SOURCE='https://data.cityofnewyork.us/resource/inkn-q76z.json';
export const BBOX=Object.freeze({west:-73.9902,east:-73.9824,
  south:40.7548,north:40.7605});
export const OUT='artifacts/nyc-metric-pilot/cscl-centerlines.json';
const allowedKeys=['physicalid','the_geom','full_street_name','rw_type',
  'trafdir','streetwidth','number_travel_lanes','number_park_lanes',
  'from_level_code','to_level_code','modified_date','boroughcode'];
export function requestUrl(){
  const u=new URL(SOURCE);
  u.searchParams.set('$where','within_box(the_geom,'+
    [BBOX.north,BBOX.west,BBOX.south,BBOX.east].join(',')+')');
  u.searchParams.set('$select',allowedKeys.join(','));
  u.searchParams.set('$order','physicalid');
  u.searchParams.set('$limit','2000');
  return u.toString();
}
const finitePoint=p=>Array.isArray(p)&&p.length>=2&&
  Number.isFinite(p[0])&&Number.isFinite(p[1])&&
  Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
export function normalizeCSCL(rows){
  if(!Array.isArray(rows))throw new TypeError('CSCL response must be an array');
  if(rows.length===2000)throw Error('CSCL response reaches 2,000 cap: incomplete extraction');
  const segments=[],rejects=[],ids=new Set();
  for(const r of rows){
    const id=String(r?.physicalid??'').trim();
    if(!/^\d+$/.test(id)||ids.has(id)){
      rejects.push({id,reason:'missing or duplicate physicalid'});continue;
    }
    ids.add(id);
    if(r?.the_geom?.type!=='MultiLineString'||
       !Array.isArray(r?.the_geom?.coordinates)){
      rejects.push({id,reason:'missing MultiLineString geometry'});continue;
    }
    const parts=r.the_geom.coordinates.filter(p=>Array.isArray(p)&&
      p.length>=2&&p.length<=256&&p.every(finitePoint));
    if(!parts.length){
      rejects.push({id,reason:'no finite polyline parts'});continue;
    }
    segments.push({physicalid:id,
      name:typeof r.full_street_name==='string'?r.full_street_name:'',
      rwType:r.rw_type??null,trafdir:r.trafdir??null,
      streetwidthRaw:r.streetwidth??null,
      numberTravelLanesRaw:r.number_travel_lanes??null,
      numberParkLanesRaw:r.number_park_lanes??null,
      fromLevelCode:r.from_level_code??null,
      toLevelCode:r.to_level_code??null,
      modifiedDate:r.modified_date??null,
      boroughCode:r.boroughcode??null,parts
    });
  }
  return {segments,rejects};
}
export async function downloadCSCL(fetcher=fetch){
  const url=requestUrl();
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetcher(url,{
        headers:{Accept:'application/json','User-Agent':'PATROL-NYC-Metric-QA/0.1 (github.com/bhu103-data/patrol-flight-sim)'},
        signal:AbortSignal.timeout(40000)
      });
      if(!response.ok)throw Error('Official CSCL HTTP '+response.status);
      const data=await response.json();
      const normalized=normalizeCSCL(data);
      if(normalized.segments.length<15)
        throw Error('Too few Times Square official centerlines: '+
          normalized.segments.length+'; refuse empty/mislocated evidence');
      const names=new Set(normalized.segments.map(s=>s.name).filter(Boolean));
      if(names.size<8)throw Error('Unexpectedly few named Times Square streets');
      return {
        sourceDataset:'NYC Street Centerline (CSCL) / inkn-q76z',
        sourcePage:'https://data.cityofnewyork.us/d/inkn-q76z',
        endpoint:SOURCE,queryUrl:url,fetchedUtc:new Date().toISOString(),
        boundsWGS84:BBOX,
        coordinateSystem:'WGS84 longitude/latitude; no in-game compression',
        disclaimer:'CSCL CENTERLINES only; NOT measured curb, pavement, sidewalk or pedestrian plaza edges',
        inputRows:data.length,segments:normalized.segments,rejections:normalized.rejects
      };
    }catch(error){
      last=error;
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
    }
  }
  throw Error('Could not verify real NYC CSCL data (no fictional fallback): '+last);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await downloadCSCL();
    mkdirSync(dirname(OUT),{recursive:true});
    writeFileSync(OUT,JSON.stringify(result));
    console.log('PATROL NYC official CSCL snapshot',
      JSON.stringify({rows:result.inputRows,segments:result.segments.length,
        rejected:result.rejections.length,
        names:new Set(result.segments.map(s=>s.name)).size,
        endpoint:result.endpoint,bbox:result.boundsWGS84}));
  }catch(e){console.error(e.stack||String(e));process.exitCode=1;}
}
