/**
 * NYC OTI 2022 planimetric ROADBED polygons: authoritative SHAPES only.
 * Not a 2026 field survey, material/texture, elevation model or gameplay lane map.
 * Do not turn centerline ROW width into a guessed asphalt rectangle.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {BBOX,ORIGIN,toLocalMeters} from './nyc-times-true-scale-pilot.mjs';

export const ROADBED_SOURCE=
  'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20';
export const SOURCE_TERMS=
  'https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje';
export const SOURCE_RULES=
  'https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md';
const round=n=>+n.toFixed(3);
function ringInMetres(ring){
  if(!Array.isArray(ring)||ring.length<4||ring.length>30000)return null;
  const out=[];
  for(const point of ring){
    if(!Array.isArray(point)||point.length<2||
      !Number.isFinite(point[0])||!Number.isFinite(point[1])||
      point[0]<-75||point[0]>-72||point[1]<39||point[1]>42)return null;
    const p=toLocalMeters(point).map(round);
    if(!out.length||Math.hypot(p[0]-out.at(-1)[0],p[1]-out.at(-1)[1])>.001)
      out.push(p);
  }
  if(out.length<4)return null;
  if(Math.hypot(out[0][0]-out.at(-1)[0],out[0][1]-out.at(-1)[1])>.002)
    out.push(out[0]);
  const area=Math.abs(out.slice(0,-1).reduce((s,p,i)=>{
    const q=out[i+1];return s+p[0]*q[1]-q[0]*p[1];
  },0))*.5;
  return area>.05?out:null;
}
export function parseRoadbedPolygons(collection){
  if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))
    throw Error('No official OTI roadbed FeatureCollection');
  const seen=new Set(),features=[];
  for(const f of collection.features){
    const prop=f?.properties||{},objectId=prop.OBJECTID;
    if(!Number.isSafeInteger(objectId)||seen.has(objectId))continue;
    const geometry=f.geometry;
    if(geometry?.type!=='Polygon'&&geometry?.type!=='MultiPolygon')continue;
    const sourcePolys=geometry.type==='Polygon'
      ?[geometry.coordinates]:geometry.coordinates;
    if(!Array.isArray(sourcePolys))continue;
    const polygons=[];
    for(const rings of sourcePolys){
      if(!Array.isArray(rings)||!rings.length)continue;
      const parsed=rings.map(ringInMetres);
      // Never fill a source hole just because the triangulation is difficult:
      // reject the polygon instead of silently flattening the cutout.
      if(parsed.some(p=>p===null))continue;
      polygons.push(parsed);
    }
    if(!polygons.length)continue;
    seen.add(objectId);
    const code=Number(prop.SUB_FEATURE_CODE);
    features.push({objectId,
      sourceId:prop.SOURCE_ID??null,
      subtype:Number.isSafeInteger(code)?code:null,
      status:String(prop.STATUS??'').slice(0,30),
      polygons});
  }
  if(!features.length)throw Error('Official OTI roadbed query returned no valid polygons');
  return features.sort((a,b)=>a.objectId-b.objectId);
}
function queryUrl(offset){
  const url=new URL(ROADBED_SOURCE+'/query');
  const params={
    where:'1=1',geometry:BBOX.join(','),geometryType:'esriGeometryEnvelope',
    inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,SOURCE_ID,FEATURE_CODE,SUB_FEATURE_CODE,STATUS',
    orderByFields:'OBJECTID',resultOffset:String(offset),
    resultRecordCount:'200',returnGeometry:'true',f:'geojson'
  };
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
  return url.toString();
}
export async function fetchOfficialRoadbeds(fetcher=fetch){
  const features=[],seen=new Set();
  for(let offset=0;offset<2000;offset+=200){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    let data;
    try{
      const res=await fetcher(queryUrl(offset),{signal:controller.signal});
      if(!res.ok)throw Error('Official OTI roadbed HTTP '+res.status+' page '+offset);
      data=await res.json();
    }finally{clearTimeout(timer);}
    if(data?.error)throw Error('Official OTI roadbed service error '+JSON.stringify(data.error));
    if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))
      throw Error('Official OTI roadbed query did not return GeoJSON');
    for(const f of data.features){
      const id=f?.properties?.OBJECTID;
      if(Number.isSafeInteger(id)&&!seen.has(id)){seen.add(id);features.push(f);}
    }
    if(data.features.length<200)break;
    if(offset===1800)throw Error('OTI roadbed query hit conservative 2000-feature cap');
  }
  if(features.length<5)throw Error('Too few authentic roadbed polygons: '+features.length);
  return {type:'FeatureCollection',features};
}
export function roadbedOverlaySvg(source,roadbeds){
  if(!source?.projection||source.projection.originLonLat.join(',')!==ORIGIN.join(','))
    throw Error('Reference sources use different origins; cannot overlay');
  const [[left,bottom],[right,top]]=[
    toLocalMeters([BBOX[0],BBOX[1]]),toLocalMeters([BBOX[2],BBOX[3]])
  ];
  const width=right-left,height=top-bottom;
  const buildingShapes=source.buildings.map(b=>{
    const coords=b.outline.map(p=>p[0]+','+(-p[1])).join(' ');
    return '<polygon points="'+coords+'" fill="#798793" opacity=".55"/>';
  }).join('\n');
  const roadShapes=roadbeds.flatMap(feature=>feature.polygons.map(rings=>{
    const path=rings.map(ring=>ring.map((p,i)=>
      (i?'L':'M')+p[0]+' '+(-p[1])).join(' ')+' Z').join(' ');
    const col=feature.subtype===350010?'#d8ac61':
      feature.subtype===350020?'#9b83ad':'#6bb99d';
    return '<path d="'+path+'" fill="'+col+'" stroke="#31564e" '+
      'stroke-width=".3" fill-rule="evenodd"/>';
  })).join('\n');
  const centers=source.roads.flatMap(r=>r.lines.map(line=>
    '<polyline points="'+line.map(p=>p[0]+','+(-p[1])).join(' ')+
    '" fill="none" stroke="#eee6c9" stroke-width=".8" opacity=".8"/>')).join('\n');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="'+
    Math.round(1200*height/width)+'" viewBox="'+
    [round(left),round(-top),round(width),round(height)].join(' ')+'">'+
    '<rect x="'+round(left)+'" y="'+round(-top)+'" width="'+round(width)+
    '" height="'+round(height)+'" fill="#10202b"/><clipPath id="tile">'+
    '<rect x="'+round(left)+'" y="'+round(-top)+'" width="'+round(width)+
    '" height="'+round(height)+'"/></clipPath><g clip-path="url(#tile)">'+
    buildingShapes+roadShapes+centers+'</g></svg>';
}
export async function run(){
  const ref=JSON.parse(readFileSync('artifacts/nyc-true-scale/source.json','utf8'));
  const records=await fetchOfficialRoadbeds();
  const roadbeds=parseRoadbedPolygons(records);
  const counts={
    features:roadbeds.length,
    polygons:roadbeds.reduce((n,r)=>n+r.polygons.length,0),
    rings:roadbeds.reduce((n,r)=>n+r.polygons.reduce((t,p)=>t+p.length,0),0),
    vertices:roadbeds.reduce((n,r)=>n+r.polygons.reduce((t,p)=>
      t+p.reduce((v,ring)=>v+ring.length,0),0),0),
    intersections:roadbeds.filter(x=>x.subtype===350010).length,
    roadbeds:roadbeds.filter(x=>x.subtype===350000).length
  };
  const result={
    schema:'patrol-nyc-oti-roadbed-planimetric-2022-v1',
    role:'SOURCE_GEOMETRY_REFERENCE_NOT_GAMEPLAY',
    source:ROADBED_SOURCE,terms:SOURCE_TERMS,captureRules:SOURCE_RULES,
    referenceImageryYear:2022,
    warning:'Roadbed polygons from 2022 imagery are not current 2026 paved materials, elevation, legal traffic or curb ramps. Do not treat as game collision without QA.',
    projection:ref.projection,counts,roadbeds
  };
  const out='artifacts/nyc-roadbed-source';
  mkdirSync(out,{recursive:true});
  writeFileSync(out+'/roadbed.json',JSON.stringify(result,null,2));
  writeFileSync(out+'/overlay.svg',roadbedOverlaySvg(ref,roadbeds));
  console.log('NYC official roadbed polygons',JSON.stringify(counts));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  run().catch(e=>{console.error(e);process.exitCode=1;});
