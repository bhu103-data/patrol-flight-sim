// Runtime loader for the bounded NYC OTI 2022 Times Square surface layers.
// Only official 2D planimetrics are fetched: roadbed, plaza and sidewalk.
// They are visual geometry only, never route permission, elevation or collision.
import {wgs84ToMeters} from './times-square-metered-massing.mjs';

export const OTI_SURFACE_SCHEMA='patrol-nyc-oti-surfaces-2022-runtime-v1';
export const OTI_SURFACE_BBOX=Object.freeze([-73.9900,40.7552,-73.9822,40.7610]);
export const OTI_SURFACE_TERMS='https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje';
export const OTI_SURFACE_CAPTURE_RULES='https://github.com/CityOfNewYork/nyc-planimetrics/blob/main/Capture_Rules.md';
export const OTI_SURFACE_LAYERS=Object.freeze({
  roadbeds:{
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20',
    minimumFeatures:70
  },
  plazas:{
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Plaza_2022/FeatureServer/16',
    minimumFeatures:10
  },
  sidewalks:{
    url:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22',
    minimumFeatures:40
  }
});
const PAGE_SIZE=200,MAX_FEATURES=2000;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const round=n=>+n.toFixed(3);

export function otiSurfaceQueryUrl(kind,offset=0,bbox=OTI_SURFACE_BBOX){
  const layer=OTI_SURFACE_LAYERS[kind];
  if(!layer||!Number.isSafeInteger(offset)||offset<0||offset>=MAX_FEATURES||
     !Array.isArray(bbox)||bbox.length!==4||!bbox.every(finite)||
     bbox[0]>=bbox[2]||bbox[1]>=bbox[3])
    throw Error('Invalid NYC OTI surface layer, offset or WGS84 query bounds');
  const url=new URL(layer.url+'/query');
  for(const [key,value] of Object.entries({
    where:'1=1',geometry:bbox.join(','),geometryType:'esriGeometryEnvelope',
    inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,SOURCE_ID,FEATURE_CODE,SUB_FEATURE_CODE,STATUS',
    orderByFields:'OBJECTID',resultOffset:String(offset),
    resultRecordCount:String(PAGE_SIZE),returnGeometry:'true',f:'geojson'
  }))url.searchParams.set(key,value);
  return url.toString();
}

function cleanRing(sourceRing,origin){
  if(!Array.isArray(sourceRing)||sourceRing.length<4)
    throw Error('NYC OTI polygon ring has fewer than four closed coordinates');
  const points=[];
  for(const coordinate of sourceRing){
    const p=wgs84ToMeters(coordinate,origin);
    const previous=points.at(-1);
    if(!previous||Math.hypot(p[0]-previous[0],p[1]-previous[1])>0.001)
      points.push([round(p[0]),round(p[1])]);
  }
  if(points.length>3&&Math.hypot(
    points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<0.02)
    points.pop();
  if(points.length<3)throw Error('NYC OTI polygon ring collapsed after coordinate cleanup');
  if(points.some(p=>!p.every(finite)))throw Error('Non-finite NYC OTI local metre vertex');
  return points;
}

export function parseOtiSurfaceCollection(kind,collection,origin){
  if(!OTI_SURFACE_LAYERS[kind]||collection?.type!=='FeatureCollection'||
     !Array.isArray(collection.features)||!origin||
     !finite(origin.lon)||!finite(origin.lat))
    throw Error('Invalid NYC OTI GeoJSON collection or local metre origin');
  const seen=new Set(),features=[];
  for(const feature of collection.features){
    const properties=feature?.properties||{};
    const objectId=Number(properties.OBJECTID);
    if(!Number.isSafeInteger(objectId)||objectId<=0)
      throw Error('NYC OTI feature is missing its stable OBJECTID');
    if(seen.has(objectId))continue;
    const geometry=feature.geometry;
    if(geometry?.type!=='Polygon'&&geometry?.type!=='MultiPolygon')
      throw Error('Unsupported NYC OTI geometry for OBJECTID '+objectId);
    const sourcePolygons=geometry.type==='Polygon'
      ?[geometry.coordinates]:geometry.coordinates;
    if(!Array.isArray(sourcePolygons)||!sourcePolygons.length)
      throw Error('Empty NYC OTI polygon for OBJECTID '+objectId);
    const polygons=[];
    for(const rings of sourcePolygons){
      if(!Array.isArray(rings)||!rings.length)
        throw Error('Empty NYC OTI polygon ring set for OBJECTID '+objectId);
      const parsed=rings.map(ring=>cleanRing(ring,origin));
      polygons.push(parsed);
    }
    const subtype=Number(properties.SUB_FEATURE_CODE);
    if(!Number.isSafeInteger(subtype))
      throw Error('NYC OTI feature has no numeric SUB_FEATURE_CODE: '+objectId);
    seen.add(objectId);
    features.push({
      objectId,
      sourceId:properties.SOURCE_ID??null,
      featureCode:Number.isSafeInteger(Number(properties.FEATURE_CODE))
        ?Number(properties.FEATURE_CODE):null,
      subtype,
      status:String(properties.STATUS??'').slice(0,30),
      sourceLayer:kind,
      polygons
    });
  }
  if(!features.length)throw Error('NYC OTI '+kind+' source returned no usable polygons');
  return features.sort((a,b)=>a.objectId-b.objectId);
}

function summarize(features){
  const subtypes={};
  let polygons=0,rings=0,vertices=0,holes=0;
  for(const feature of features){
    for(const polygon of feature.polygons){
      polygons++;rings+=polygon.length;holes+=Math.max(0,polygon.length-1);
      for(const ring of polygon)vertices+=ring.length;
    }
    const key=String(feature.subtype);
    subtypes[key]=(subtypes[key]||0)+1;
  }
  return {features:features.length,polygons,rings,holes,vertices,subtypes};
}

async function requestPage(url,fetcher){
  let lastError=null;
  for(let attempt=0;attempt<3;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetcher(url,{signal:controller.signal});
      if(!response.ok){
        if(response.status===429||response.status>=500)
          throw Error('Temporary NYC OTI HTTP '+response.status);
        throw Error('NYC OTI HTTP '+response.status);
      }
      const data=await response.json();
      if(data?.error)throw Error('NYC OTI service error '+JSON.stringify(data.error));
      if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))
        throw Error('NYC OTI did not return GeoJSON FeatureCollection');
      return data;
    }catch(error){
      lastError=error;
      if(attempt===2)break;
      await new Promise(resolve=>setTimeout(resolve,(attempt+1)*900));
    }finally{
      clearTimeout(timer);
    }
  }
  throw Error('NYC OTI query failed after retries: '+String(lastError));
}

async function fetchLayer(kind,origin,fetcher,bbox){
  const raw=[],seen=new Set();
  let complete=false;
  for(let offset=0;offset<MAX_FEATURES;offset+=PAGE_SIZE){
    const page=await requestPage(otiSurfaceQueryUrl(kind,offset,bbox),fetcher);
    for(const feature of page.features){
      const id=Number(feature?.properties?.OBJECTID);
      if(Number.isSafeInteger(id)&&!seen.has(id)){
        seen.add(id);raw.push(feature);
      }
    }
    if(page.features.length<PAGE_SIZE&&!page.exceededTransferLimit){
      complete=true;break;
    }
  }
  if(!complete)throw Error('NYC OTI '+kind+' query exceeded the '+MAX_FEATURES+' feature guard');
  const parsed=parseOtiSurfaceCollection(kind,{type:'FeatureCollection',features:raw},origin);
  const minimum=OTI_SURFACE_LAYERS[kind].minimumFeatures;
  if(parsed.length<minimum)
    throw Error('NYC OTI '+kind+' returned '+parsed.length+
      ' features; expected at least '+minimum+' in the bounded Times Square tile');
  return parsed;
}

export async function fetchOfficialOtiSurfaces({origin,fetcher=fetch,bbox=OTI_SURFACE_BBOX}={}){
  if(!origin||!finite(origin.lon)||!finite(origin.lat))
    throw Error('NYC OTI runtime surfaces require the exact Times Square local WGS84 origin');
  const started=performance.now();
  const [roadbeds,plazas,sidewalks]=await Promise.all([
    fetchLayer('roadbeds',origin,fetcher,bbox),
    fetchLayer('plazas',origin,fetcher,bbox),
    fetchLayer('sidewalks',origin,fetcher,bbox)
  ]);
  const counts={
    roadbeds:summarize(roadbeds),
    plazas:summarize(plazas),
    sidewalks:summarize(sidewalks)
  };
  return {
    schema:OTI_SURFACE_SCHEMA,
    role:'VISUAL_SOURCE_ONLY_NOT_COLLISION_OR_ROUTE_PERMISSION',
    imageryYear:2022,
    origin:{lon:origin.lon,lat:origin.lat},
    bboxLonLat:[...bbox],
    projection:'WGS84 transformed to local tangent east/north metres at the supplied massing origin',
    terms:OTI_SURFACE_TERMS,
    captureRules:OTI_SURFACE_CAPTURE_RULES,
    sources:Object.fromEntries(Object.entries(OTI_SURFACE_LAYERS)
      .map(([kind,layer])=>[kind,layer.url])),
    counts,
    roadbeds,plazas,sidewalks,
    loadMilliseconds:round(performance.now()-started),
    caveat:'2022 2D planimetrics for this bounded Times Square tile only; not 2026 road access, surveyed elevation, lane markings, curb-ramp height, collision or complete NYC coverage.'
  };
}
