/**
 * Source-only audit: NYC OTI 2022 SIDEWALK/CURB/CURB_CUT polygons and lines
 * around Brooklyn Front St / Dock St. Do not paint them in the PATROL world:
 * there is no verified vertical datum, curb face height or 2026 as-built data.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
export const BBOX=Object.freeze([-73.99270,40.70215,-73.98955,40.70309]);
export const ROAD_ORIGIN=Object.freeze({lon:-73.992042,lat:40.702634});
export const SOURCE_TERMS='https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje';
export const LAYERS=Object.freeze({
  sidewalk:{id:22,required:true,kind:'polygon',
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22'},
  curb:{id:4,required:true,kind:'line',
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_2022/FeatureServer/4'},
  curbCut:{id:5,required:false,kind:'line',
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5'}
});
const PAGE=150,MAX_PAGES=14;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const validPoint=p=>Array.isArray(p)&&p.length>=2&&
  finite(p[0])&&finite(p[1])&&p[0]>-75&&p[0]<-72&&p[1]>39&&p[1]<42;
export function makeOfficialQuery(name,offset=0){
  const layer=LAYERS[name];
  if(!layer||!Number.isSafeInteger(offset)||offset<0||offset>=PAGE*MAX_PAGES||offset%PAGE)
    throw Error('Invalid bounded OTI query or page offset');
  const uri=new URL(layer.url+'/query');
  const params={where:'1=1',geometry:BBOX.join(','),
    geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',
    spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,SOURCE_ID,SUB_FEATURE_CODE,STATUS',
    orderByFields:'OBJECTID',resultRecordCount:String(PAGE),
    resultOffset:String(offset),returnGeometry:'true',f:'geojson'};
  for(const [key,val] of Object.entries(params))uri.searchParams.set(key,val);
  return uri.toString();
}
export function inspectOfficialFeature(feature,kind){
  const id=feature?.properties?.OBJECTID,geom=feature?.geometry;
  if(!Number.isSafeInteger(id)||id<1||!geom)throw Error('Missing official object ID/geometry');
  const polygonTypes=['Polygon','MultiPolygon'],lineTypes=['LineString','MultiLineString'];
  if(!(kind==='polygon'?polygonTypes:lineTypes).includes(geom.type))
    throw Error('Unexpected official geometry type for '+id);
  const polygons=geom.type==='Polygon'?[geom.coordinates]:
    geom.type==='MultiPolygon'?geom.coordinates:null;
  const lines=geom.type==='LineString'?[geom.coordinates]:
    geom.type==='MultiLineString'?geom.coordinates:null;
  const rings=polygons?polygons.flat():lines;
  if(!Array.isArray(rings)||!rings.length||rings.length>1200)
    throw Error('Unbounded official geometry '+id);
  let vertices=0;
  for(const ring of rings){
    if(!Array.isArray(ring)||ring.length<(polygons?4:2)||
       ring.length>50000||!ring.every(validPoint))throw Error('Invalid source coordinates '+id);
    if(polygons&&Math.hypot(ring[0][0]-ring.at(-1)[0],
      ring[0][1]-ring.at(-1)[1])>1e-9)throw Error('Unclosed source sidewalk ring '+id);
    vertices+=ring.length;
  }
  return {objectId:id,sourceId:feature.properties.SOURCE_ID??null,
    subtype:feature.properties.SUB_FEATURE_CODE??null,
    status:String(feature.properties.STATUS??'').slice(0,64),
    geometry:geom,ringCount:rings.length,vertices};
}
export async function fetchOfficialLayer(name,fetcher=fetch){
  const layer=LAYERS[name];if(!layer)throw Error('Unknown OTI layer');
  const features=[],ids=new Set();
  for(let page=0;page<MAX_PAGES;page++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
    let response;
    try{response=await fetcher(makeOfficialQuery(name,page*PAGE),{signal:controller.signal})}
    finally{clearTimeout(timer)}
    if(!response?.ok)throw Error(name+' ArcGIS HTTP '+response?.status);
    const data=await response.json();
    if(data?.type!=='FeatureCollection'||!Array.isArray(data.features)||
       data.features.length>PAGE||data.error)throw Error(name+' invalid ArcGIS page');
    for(const raw of data.features){
      const feature=inspectOfficialFeature(raw,layer.kind);
      if(ids.has(feature.objectId))throw Error(name+' repeated ID across source pages');
      ids.add(feature.objectId);
      features.push(feature);
    }
    if(data.features.length<PAGE){
      if(layer.required&&!features.length)throw Error(name+' official source returned no features');
      return {name,layerUrl:layer.url,kind:layer.kind,features,
        records:features.length,uniqueIds:ids.size,
        sourceVertices:features.reduce((s,f)=>s+f.vertices,0),
        pages:page+1};
    }
  }
  throw Error(name+' OTI source pagination exceeded bounded page limit');
}
export async function collect({fetcher=fetch,out='artifacts/nyc-dumbo-front-dock-pedestrian-source'}={}){
  const results={schema:'patrol-dumbo-front-dock-oti-pedestrian-source-only-v1',
    sourceVintage:2022,retrievedAtUTC:new Date().toISOString(),
    bboxWgs84:BBOX,sourceRoadOrigin:ROAD_ORIGIN,
    terms:SOURCE_TERMS,notForGameplay:true,
    limitation:'Source polygons/lines only. No surveyed height, curb face, walkable clearance, 2026 status, collision or material.',
    layers:{}};
  for(const key of Object.keys(LAYERS))results.layers[key]=await fetchOfficialLayer(key,fetcher);
  mkdirSync(out,{recursive:true});
  const summary={schema:results.schema,sourceVintage:results.sourceVintage,
    bboxWgs84:BBOX,sourceRoadOrigin:ROAD_ORIGIN,terms:SOURCE_TERMS,
    totals:Object.fromEntries(Object.entries(results.layers).map(([k,v])=>
      [k,{records:v.records,vertices:v.sourceVertices,pages:v.pages,layerUrl:v.layerUrl}])),
    limitations:results.limitation};
  writeFileSync(out+'/source.json',JSON.stringify(results));
  writeFileSync(out+'/audit.json',JSON.stringify(summary,null,2));
  return summary;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
  collect().then(x=>console.log('DUMBO_OTI_PEDESTRIAN_SOURCE '+JSON.stringify(x)))
    .catch(e=>{console.error(e);process.exitCode=1});
}
