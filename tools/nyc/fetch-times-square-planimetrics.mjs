/** Source-pinned NYC 2022 planimetric roadbed and sidewalk polygons.
 * Standalone QA only; no unlicensed tiles, street-width extrapolation or
 * production runtime requests. Critically, polygon interior rings/holes
 * are preserved and NEVER fan-triangulated.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BBOX} from './fetch-times-square-cscl.mjs';

export const DATASETS=Object.freeze({
  roadbed:Object.freeze({id:'i36f-5ih7',
    name:'NYC Planimetric Database: Roadbed',
    page:'https://data.cityofnewyork.us/d/i36f-5ih7',
    output:'artifacts/nyc-metric-pilot/roadbed-polygons.json'}),
  sidewalk:Object.freeze({id:'vfx9-tbb6',
    name:'NYC Planimetric Database: Sidewalk',
    page:'https://data.cityofnewyork.us/d/vfx9-tbb6',
    output:'artifacts/nyc-metric-pilot/sidewalk-polygons.json'})
});
export function urlFor(dataset){
  const spec=DATASETS[dataset];
  if(!spec)throw TypeError('Unknown official NYC planimetric dataset');
  const url=new URL('https://data.cityofnewyork.us/resource/'+spec.id+'.json');
  url.searchParams.set('$where','within_box(the_geom,'+
    [BBOX.north,BBOX.west,BBOX.south,BBOX.east].join(',')+')');
  // Refuse a truncated snapshot; never silently present the first 2000 rows
  // as the entire Times Square source layer.
  url.searchParams.set('$limit','2000');
  return url.toString();
}
const isPoint=p=>Array.isArray(p)&&p.length>=2&&
  Number.isFinite(p[0])&&Number.isFinite(p[1])&&
  p[0]>-75&&p[0]<-72&&p[1]>40&&p[1]<42;
function finiteClosedRing(ring){
  if(!Array.isArray(ring)||ring.length<4||ring.length>25000||
     !ring.every(isPoint))return false;
  const a=ring[0],b=ring.at(-1);
  return Math.hypot((a[0]-b[0])*84300,(a[1]-b[1])*110900)<.15;
}
export function normalizePlanimetricPolygons(rows,{maxVertices=200000}={}){
  if(!Array.isArray(rows))throw TypeError('Expected official NYC polygon JSON records');
  if(rows.length>=2000)throw Error('Official polygon query hit hard 2000 record cap');
  const records=[],rejections=[];
  let vertices=0,outerRings=0,innerRings=0;
  for(let index=0;index<rows.length;index++){
    const r=rows[index],geom=r?.the_geom;
    // Use stable extraction position only as an artifact-local index.
    // SOURCE_ID is not guaranteed globally unique by NYC Planimetrics.
    const id=String(r?.source_id??'missing')+':row:'+index;
    if(geom?.type!=='MultiPolygon'||!Array.isArray(geom.coordinates)){
      rejections.push({id,reason:'missing MultiPolygon'});continue;
    }
    const polygons=[];
    let valid=true,localVertexCount=0;
    for(const polygon of geom.coordinates){
      if(!Array.isArray(polygon)||!polygon.length||polygon.length>128||
         !polygon.every(finiteClosedRing)){
        valid=false;break;
      }
      const copy=polygon.map(ring=>ring.map(p=>[p[0],p[1]]));
      polygons.push(copy);
      localVertexCount+=copy.reduce((n,ring)=>n+ring.length,0);
    }
    if(!valid||!polygons.length){
      rejections.push({id,reason:'incomplete/invalid closed WGS84 polygon rings'});continue;
    }
    vertices+=localVertexCount;
    if(vertices>maxVertices)
      throw Error('Official polygons exceed bounded source vertex budget');
    outerRings+=polygons.length;
    innerRings+=polygons.reduce((n,p)=>n+p.length-1,0);
    records.push({rowId:id,sourceId:r?.source_id??null,
      status:r?.status??null,shapeAreaRaw:r?.shape_area??null,
      shapeLengthRaw:r?.shape_leng??null,polygons});
  }
  return {records,rejections,vertexCount:vertices,outerRings,innerRings};
}
export async function fetchPlanimetric(dataset,fetcher=fetch){
  const spec=DATASETS[dataset];if(!spec)throw TypeError('Unknown planimetric dataset');
  const url=urlFor(dataset);let last;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetcher(url,{
        headers:{Accept:'application/json',
          'User-Agent':'PATROL-NYC-Metric-QA/0.1 (github.com/bhu103-data/patrol-flight-sim)'},
        signal:AbortSignal.timeout(40000)});
      if(!response.ok)throw Error('Official '+dataset+' HTTP '+response.status);
      const rows=await response.json(),r=normalizePlanimetricPolygons(rows);
      if(r.records.length<3)
        throw Error('Too few real '+dataset+' polygons; no synthetic fallback');
      return {
        sourceDataset:spec.name,sourcePage:spec.page,queryUrl:url,
        sourceApi:'https://data.cityofnewyork.us/resource/'+spec.id+'.json',
        boundsWGS84:BBOX,fetchedUtc:new Date().toISOString(),
        sourceImagery:'NYC 2022 orthophotography; planimetric update 2022-2023 (not live 2026)',
        geometry:'WGS84 lon,lat MultiPolygon with holes preserved',
        caution:'Raw polygons only; no road traffic lanes, current curb grade, crossing, surface materials or flight collision proof',
        inputRows:rows.length,vertexCount:r.vertexCount,
        outerRings:r.outerRings,innerRings:r.innerRings,
        records:r.records,rejections:r.rejections
      };
    }catch(error){
      last=error;
      if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));
    }
  }
  throw Error('Official '+dataset+' data fetch/validation failed: '+last);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    for(const layer of ['roadbed','sidewalk']){
      const snapshot=await fetchPlanimetric(layer);
      const out=DATASETS[layer].output;
      mkdirSync(dirname(out),{recursive:true});
      writeFileSync(out,JSON.stringify(snapshot));
      console.log('PATROL official NYC polygon source '+layer,
        JSON.stringify({inputRows:snapshot.inputRows,
          retained:snapshot.records.length,
          rejected:snapshot.rejections.length,outerRings:snapshot.outerRings,
          innerRings:snapshot.innerRings,vertices:snapshot.vertexCount,
          queryUrl:snapshot.queryUrl}));
    }
  }catch(e){console.error(e.stack||String(e));process.exitCode=1;}
}
