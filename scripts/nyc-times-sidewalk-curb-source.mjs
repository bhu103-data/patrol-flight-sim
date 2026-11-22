/**
 * NYC OTI 2022 Sidewalk / Curb / Curb_Cut SOURCE-QA companion to PR #244.
 * Same 1:1 east/north local WGS84 frame, no invented curb height or roadway.
 * Source Z may be absent or unverified in feet; deliberately not consumed.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {BBOX,ORIGIN,toLocalMeters} from './nyc-times-true-scale-pilot.mjs';
import {parseRoadbedPolygons,SOURCE_TERMS} from './nyc-times-roadbed-polygon-source.mjs';
export const OFFICIAL_LAYERS=Object.freeze({
  sidewalk:{
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22',
    geometry:'polygon',idField:'OBJECTID',required:true
  },
  curb:{
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_2022/FeatureServer/4',
    geometry:'line',idField:'OBJECTID',required:true
  },
  curbCut:{
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5',
    geometry:'line',idField:'OBJECTID',required:false
  }
});
const round=n=>+n.toFixed(3);
function validWgs84(p){
  return Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite)&&
    p[0]>=-75&&p[0]<=-72&&p[1]>=39&&p[1]<=42;
}
function localLine(line){
  if(!Array.isArray(line)||line.length<2||line.length>30000)return null;
  if(!line.every(validWgs84))return null;
  const out=[];
  for(const p of line){
    const q=toLocalMeters(p).map(round);
    if(!out.length||Math.hypot(q[0]-out.at(-1)[0],q[1]-out.at(-1)[1])>.002)
      out.push(q);
  }
  return out.length>=2?out:null;
}
export function parseOfficialSidewalk(collection){
  // Retain the same strict polygon-ring / hole validation as roadbed #244.
  const polygons=parseRoadbedPolygons(collection);
  return polygons.map(({objectId,sourceId,subtype,status,polygons})=>({
    objectId,sourceId,subtype,status,polygons
  }));
}
export function parseOfficialCurbLines(collection,kind='curb'){
  if(kind!=='curb'&&kind!=='curbCut')throw Error('Unknown OTI curb feature kind');
  if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))
    throw Error('No official OTI '+kind+' FeatureCollection');
  const out=[],seen=new Set();
  for(const f of collection.features){
    const prop=f?.properties||{},id=prop.OBJECTID;
    if(!Number.isSafeInteger(id)||seen.has(id))continue;
    const type=f.geometry?.type;
    if(type!=='LineString'&&type!=='MultiLineString')continue;
    const originals=type==='LineString'
      ?[f.geometry.coordinates]:f.geometry.coordinates;
    if(!Array.isArray(originals))continue;
    const parts=originals.map(localLine).filter(Boolean);
    if(!parts.length)continue;
    seen.add(id);
    const subtype=Number(prop.SUB_FEATURE_CODE);
    out.push({objectId:id,sourceId:prop.SOURCE_ID??null,
      subtype:Number.isSafeInteger(subtype)?subtype:null,
      status:String(prop.STATUS??'').slice(0,30),parts,
      // This tracks that Z was present, but NEVER turns source Z into game
      // height: source vertical CRS/units are not validated here.
      sourceHasZ:originals.some(line=>line.some(p=>p?.length>=3))
    });
  }
  if(kind==='curb'&&!out.length)throw Error('No valid official curb polylines');
  return out.sort((a,b)=>a.objectId-b.objectId);
}
export function officialLayerQuery(kind,offset=0){
  const layer=OFFICIAL_LAYERS[kind];
  if(!layer||!Number.isSafeInteger(offset)||offset<0||offset>1950)
    throw Error('Unknown OTI layer or unsafe query offset');
  const url=new URL(layer.url+'/query');
  const opts={where:'1=1',geometry:BBOX.join(','),
    geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',
    spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,SOURCE_ID,FEATURE_CODE,SUB_FEATURE_CODE,STATUS',
    orderByFields:'OBJECTID',resultOffset:String(offset),
    resultRecordCount:'150',returnGeometry:'true',f:'geojson'};
  for(const [key,value] of Object.entries(opts))url.searchParams.set(key,value);
  return url.toString();
}
export async function fetchOfficialLayer(kind,fetcher=fetch){
  const layer=OFFICIAL_LAYERS[kind];
  if(!layer)throw Error('Unknown official OTI source layer');
  const collected=[],seen=new Set();
  for(let offset=0;offset<1950;offset+=150){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    let response;
    try{
      const res=await fetcher(officialLayerQuery(kind,offset),
        {signal:controller.signal});
      if(!res.ok)throw Error('Official OTI '+kind+' HTTP '+res.status+' page '+offset);
      response=await res.json();
    }finally{clearTimeout(timer);}
    if(response?.error)throw Error('Official OTI '+kind+' ArcGIS error '+JSON.stringify(response.error));
    if(response?.type!=='FeatureCollection'||!Array.isArray(response.features))
      throw Error('Official OTI '+kind+' returned non-GeoJSON');
    for(const f of response.features){
      const id=f?.properties?.OBJECTID;
      if(Number.isSafeInteger(id)&&!seen.has(id)){
        seen.add(id);collected.push(f);
      }
    }
    if(response.features.length<150)return {type:'FeatureCollection',features:collected};
  }
  throw Error('Official OTI '+kind+' exceeded bounded query pagination');
}
export function streetSurfaceSvg(sidewalks,curbs,cuts){
  const [[left,bottom],[right,top]]=[
    toLocalMeters([BBOX[0],BBOX[1]]),toLocalMeters([BBOX[2],BBOX[3]])
  ];
  const width=right-left,height=top-bottom;
  const pathFrom=rings=>rings.map(ring=>ring.map((p,i)=>
    (i?'L':'M')+p[0]+' '+(-p[1])).join(' ')+'Z').join(' ');
  const sidewalkPaths=sidewalks.flatMap(f=>f.polygons.map(rings=>
    '<path d="'+pathFrom(rings)+'" fill="#b8b2a0" fill-opacity=".55" '+
    'fill-rule="evenodd" stroke="#d0ccbd" stroke-width=".18"/>')).join('');
  const lines=(data,color,width)=>data.flatMap(f=>f.parts.map(part=>
    '<polyline fill="none" stroke="'+color+'" stroke-width="'+width+
    '" points="'+part.map(p=>p[0]+','+(-p[1])).join(' ')+'"/>')).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+
    Math.round(1200*height/width)+'" viewBox="'+
    [round(left),round(-top),round(width),round(height)].join(' ')+'">'+
    '<rect x="'+round(left)+'" y="'+round(-top)+'" width="'+round(width)+
    '" height="'+round(height)+'" fill="#10202b"/>'+
    '<clipPath id="tile"><rect x="'+round(left)+'" y="'+round(-top)+
    '" width="'+round(width)+'" height="'+round(height)+
    '"/></clipPath><g clip-path="url(#tile)">'+
    sidewalkPaths+lines(curbs,'#5fd0e3',1.0)+
    lines(cuts,'#ef8b5f',2.1)+'</g></svg>';
}
export async function run(){
  const snapshot=JSON.parse(readFileSync('artifacts/nyc-roadbed-source/roadbed.json','utf8'));
  if(snapshot?.schema!=='patrol-nyc-oti-roadbed-planimetric-2022-v1'||
    snapshot.projection?.originLonLat?.join(',')!==ORIGIN.join(','))
    throw Error('Roadbed and edge sources must have the same true-metre origin');
  const [sideSource,curbSource,cutSource]=await Promise.all([
    fetchOfficialLayer('sidewalk'),fetchOfficialLayer('curb'),
    fetchOfficialLayer('curbCut')
  ]);
  const sidewalks=parseOfficialSidewalk(sideSource);
  const curbs=parseOfficialCurbLines(curbSource,'curb');
  const curbCuts=parseOfficialCurbLines(cutSource,'curbCut');
  if(sidewalks.length<5||curbs.length<5)
    throw Error('Too few official NYC sidewalk / curb features in the bounded source');
  const counts={
    sidewalkFeatures:sidewalks.length,
    sidewalkPolygons:sidewalks.reduce((n,x)=>n+x.polygons.length,0),
    curbFeatures:curbs.length,
    curbSegments:curbs.reduce((n,x)=>n+x.parts.reduce((m,p)=>m+p.length-1,0),0),
    curbCuts:curbCuts.length,
    cornerCurbCuts:curbCuts.filter(x=>x.subtype===222700).length,
    midblockCurbCuts:curbCuts.filter(x=>x.subtype===222600).length,
    curbsWithUnverifiedZ:curbs.filter(x=>x.sourceHasZ).length
  };
  const result={schema:'patrol-nyc-oti-sidewalk-curb-metre-source-v1',
    role:'SOURCE_QA_ONLY_NOT_3D_CURB_HEIGHT_OR_GAME_TRAFFIC',
    projection:snapshot.projection,sourceImageryYear:2022,
    sources:Object.fromEntries(Object.entries(OFFICIAL_LAYERS).map(
      ([k,v])=>[k,v.url])),terms:SOURCE_TERMS,
    warning:'The shapes are 2022 aerial planimetrics. All surfaces shown at flat illustrative grade. Source Z, if any, is not used as metres or as a surveyed curb rise.',
    counts,sidewalks,curbs,curbCuts};
  mkdirSync('artifacts/nyc-curb-sidewalk-source',{recursive:true});
  writeFileSync('artifacts/nyc-curb-sidewalk-source/edges.json',
    JSON.stringify(result));
  writeFileSync('artifacts/nyc-curb-sidewalk-source/sidewalk-curb.svg',
    streetSurfaceSvg(sidewalks,curbs,curbCuts));
  console.log('NYC official 2022 sidewalks curbs curb cuts',JSON.stringify(counts));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  run().catch(e=>{console.error(e);process.exitCode=1;});
