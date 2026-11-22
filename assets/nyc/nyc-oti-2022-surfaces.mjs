/**
 * Runtime-only fetch and triangulation of authentic NYC OTI 2022 planimetrics.
 * No source data is checked into this repository by this module.
 * Display offsets are not surveyed elevations; lines are not traffic rules.
 */
import earcut,{deviation} from './vendor/earcut-3.0.2.mjs';
import {wgs84ToMeters} from './times-square-metered-massing.mjs';

export const OTI_2022_BBOX=Object.freeze([-73.9900,40.7552,-73.9822,40.7610]);
export const OTI_2022_LAYERS=Object.freeze({
  roadbed:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20',
  plaza:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Plaza_2022/FeatureServer/16',
  sidewalk:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Sidewalk_2022/FeatureServer/22',
  curb:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_2022/FeatureServer/4',
  curbCut:'https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Curb_Cut_2022/FeatureServer/5'
});
const SOURCE_TERMS='https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje';
const FIELDS='OBJECTID,SOURCE_ID,FEATURE_CODE,SUB_FEATURE_CODE,STATUS';
const PAGE_SIZE=200;
const MAX_PAGES=10;
export const OTI_2022_MINIMUMS=Object.freeze({
  roadbedFeatures:70,plazaFeatures:5,sidewalkFeatures:40,
  curbFeatures:150,curbCutFeatures:150,roadbedTriangles:8000,
  sidewalkTriangles:7000,curbSegments:2000,curbCutSegments:1000
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const equalPoint=(a,b)=>Math.abs(a[0]-b[0])<1e-12&&Math.abs(a[1]-b[1])<1e-12;

export function officialLayerQuery(kind,offset=0){
  const base=OTI_2022_LAYERS[kind];
  if(!base)throw new Error('Unknown NYC OTI layer '+kind);
  if(!Number.isSafeInteger(offset)||offset<0)throw new Error('Invalid OTI result offset');
  const url=new URL(base+'/query');
  for(const [key,value] of Object.entries({
    where:'1=1',geometry:OTI_2022_BBOX.join(','),
    geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',
    spatialRel:'esriSpatialRelIntersects',outFields:FIELDS,
    orderByFields:'OBJECTID',resultOffset:String(offset),
    resultRecordCount:String(PAGE_SIZE),returnGeometry:'true',f:'geojson'
  }))url.searchParams.set(key,value);
  return url.toString();
}

async function fetchLayer(kind,fetcher){
  const features=[],ids=new Set();
  for(let page=0;page<MAX_PAGES;page++){
    const offset=page*PAGE_SIZE,controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    let response,data;
    try{
      response=await fetcher(officialLayerQuery(kind,offset),{signal:controller.signal});
      if(!response?.ok)throw new Error('NYC OTI '+kind+' HTTP '+(response?.status??'unknown'));
      data=await response.json();
    }finally{clearTimeout(timer);}
    if(data?.error)throw new Error('NYC OTI '+kind+' service error '+JSON.stringify(data.error));
    if(data?.type!=='FeatureCollection'||!Array.isArray(data.features))
      throw new Error('NYC OTI '+kind+' did not return GeoJSON');
    for(const feature of data.features){
      const id=Number(feature?.properties?.OBJECTID);
      if(!Number.isSafeInteger(id))throw new Error('NYC OTI '+kind+' has missing OBJECTID');
      if(ids.has(id))throw new Error('NYC OTI '+kind+' repeated OBJECTID '+id);
      ids.add(id);features.push(feature);
    }
    if(data.features.length<PAGE_SIZE)return {type:'FeatureCollection',features};
  }
  throw new Error('NYC OTI '+kind+' pagination exceeded '+(PAGE_SIZE*MAX_PAGES)+' records');
}

function polygonSets(geometry){
  if(geometry?.type==='Polygon')return [geometry.coordinates];
  if(geometry?.type==='MultiPolygon')return geometry.coordinates;
  throw new Error('Expected official Polygon/MultiPolygon geometry');
}
function lineParts(geometry){
  if(geometry?.type==='LineString')return [geometry.coordinates];
  if(geometry?.type==='MultiLineString')return geometry.coordinates;
  throw new Error('Expected official LineString/MultiLineString geometry');
}
function checkedLocalPoint(pair,origin){
  if(!Array.isArray(pair)||pair.length<2||!finite(pair[0])||!finite(pair[1])||
     Math.abs(pair[0])>180||Math.abs(pair[1])>90)
    throw new Error('Invalid official OTI WGS84 coordinate');
  return wgs84ToMeters([pair[0],pair[1]],origin);
}
function checkedRings(rings,origin){
  if(!Array.isArray(rings)||!rings.length)throw new Error('Missing official polygon rings');
  return rings.map((raw,index)=>{
    if(!Array.isArray(raw)||raw.length<4)throw new Error('Invalid official polygon ring');
    const points=raw.map(p=>checkedLocalPoint(p,origin));
    if(equalPoint(points[0],points[points.length-1]))points.pop();
    if(points.length<3)throw new Error('Official polygon ring has fewer than 3 vertices');
    if(index===0&&points.length>30000)throw new Error('Oversized official exterior ring');
    return points;
  });
}
function pushVertex(out,east,north,y,center,color){
  const x=east-center.east,z=center.north-north;
  out.push(x,y,z,0,1,0,color[0],color[1],color[2],2);
}
function appendPolygonFeature(out,feature,origin,center,y,color,stats){
  const objectId=Number(feature?.properties?.OBJECTID);
  if(!Number.isSafeInteger(objectId))throw new Error('Invalid polygon source OBJECTID');
  let featurePolygons=0;
  for(const rings of polygonSets(feature.geometry)){
    const local=checkedRings(rings,origin),flat=[],holes=[];
    let vertexCount=0;
    for(let r=0;r<local.length;r++){
      if(r)holes.push(vertexCount);
      for(const [east,north] of local[r]){
        flat.push(east,north);vertexCount++;
      }
    }
    const triangles=earcut(flat,holes,2);
    const error=deviation(flat,holes,2,triangles);
    if(triangles.length<3||triangles.length%3||!finite(error)||error>0.0005)
      throw new Error('Earcut source-area/hole verification failed for OTI OBJECTID '+objectId);
    let accepted=0;
    for(let i=0;i<triangles.length;i+=3){
      const ia=triangles[i],ib=triangles[i+1],ic=triangles[i+2];
      const a=[flat[ia*2],flat[ia*2+1]],
        b=[flat[ib*2],flat[ib*2+1]],c=[flat[ic*2],flat[ic*2+1]];
      const area=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
      if(area<1e-7){stats.degenerateTriangles++;continue;}
      for(const p of [a,b,c])pushVertex(out,p[0],p[1],y,center,color);
      accepted++;stats.triangles++;
    }
    if(!accepted)throw new Error('OTI polygon produced no nondegenerate triangles '+objectId);
    featurePolygons++;stats.polygons++;stats.rings+=local.length;
    stats.sourceIds.push(objectId);
  }
  return featurePolygons;
}
function appendLineFeature(out,feature,origin,center,y,color,stats){
  const objectId=Number(feature?.properties?.OBJECTID);
  if(!Number.isSafeInteger(objectId))throw new Error('Invalid line source OBJECTID');
  let accepted=0;
  for(const raw of lineParts(feature.geometry)){
    if(!Array.isArray(raw)||raw.length<2)throw new Error('Invalid official OTI line part');
    const points=raw.map(p=>checkedLocalPoint(p,origin));
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<.001)continue;
      pushVertex(out,a[0],a[1],y,center,color);
      pushVertex(out,b[0],b[1],y,center,color);
      accepted++;stats.segments++;
    }
  }
  if(accepted)stats.sourceIds.push(objectId);
}

function assertUniqueFeatures(collection,kind){
  if(!collection||collection.type!=='FeatureCollection'||!Array.isArray(collection.features))
    throw new Error('Missing official OTI '+kind+' FeatureCollection');
  const seen=new Set();
  for(const f of collection.features){
    const id=Number(f?.properties?.OBJECTID);
    if(!Number.isSafeInteger(id)||seen.has(id))throw new Error('Invalid/repeated '+kind+' OBJECTID');
    seen.add(id);
  }
  return collection.features;
}

/** Pure compiler: all returned coordinates are in the current viewer's one-metre scene frame. */
export function compileOfficialOti2022Surfaces({massing,center,collections,minimums=OTI_2022_MINIMUMS}){
  if(!massing?.origin||!finite(massing.origin.lon)||!finite(massing.origin.lat)||
     !center||!finite(center.east)||!finite(center.north))
    throw new Error('A valid current NYC massing origin and scene center are required');
  const roadbeds=assertUniqueFeatures(collections.roadbed,'roadbed'),
    plazas=assertUniqueFeatures(collections.plaza,'plaza'),
    sidewalks=assertUniqueFeatures(collections.sidewalk,'sidewalk'),
    curbs=assertUniqueFeatures(collections.curb,'curb'),
    curbCuts=assertUniqueFeatures(collections.curbCut,'curbCut');
  if(roadbeds.length<minimums.roadbedFeatures||plazas.length<minimums.plazaFeatures||
     sidewalks.length<minimums.sidewalkFeatures||curbs.length<minimums.curbFeatures||
     curbCuts.length<minimums.curbCutFeatures)
    throw new Error('Official OTI 2022 source coverage below the verified Times Square minimum');
  const roadbed=[],pedestrian=[],curbLines=[];
  const stats={
    roadbedFeatures:roadbeds.length,roadbedPolygons:0,roadbedTriangles:0,
    roadbedIntersections:0,sidewalkFeatures:sidewalks.length,sidewalkPolygons:0,
    sidewalkTriangles:0,plazaFeatures:plazas.length,plazaPolygons:0,
    plazaTriangles:0,curbFeatures:curbs.length,curbSegments:0,
    curbCutFeatures:curbCuts.length,curbCutSegments:0,degenerateTriangles:0,
    roadbedSourceIds:[],sidewalkSourceIds:[],plazaSourceIds:[],
    curbSourceIds:[],curbCutSourceIds:[]
  };
  for(const feature of roadbeds){
    const props=feature.properties||{},subtype=Number(props.SUB_FEATURE_CODE);
    const color=subtype===350010?[.245,.263,.275]:[.175,.192,.205];
    const before=stats.roadbedTriangles;
    const polys=appendPolygonFeature(roadbed,feature,massing.origin,center,-.075,color,{
      get triangles(){return stats.roadbedTriangles;},
      set triangles(v){stats.roadbedTriangles=v;},
      get polygons(){return stats.roadbedPolygons;},
      set polygons(v){stats.roadbedPolygons=v;},
      get rings(){return stats.roadbedRings||0;},
      set rings(v){stats.roadbedRings=v;},
      get degenerateTriangles(){return stats.degenerateTriangles;},
      set degenerateTriangles(v){stats.degenerateTriangles=v;},
      sourceIds:stats.roadbedSourceIds
    });
    if(!polys)throw new Error('Empty OTI roadbed source polygon');
    if(subtype===350010)stats.roadbedIntersections++;
    stats.roadbedPolygons+=0; // appendPolygonFeature updates via the stats adapter
    if(stats.roadbedTriangles===before)throw new Error('No roadbed triangles for OBJECTID '+props.OBJECTID);
  }
  const addPed=(records,kind,y,color,triangleKey,polygonKey,sourceKey)=>{
    for(const feature of records){
      const adapter={
        get triangles(){return stats[triangleKey];},set triangles(v){stats[triangleKey]=v;},
        get polygons(){return stats[polygonKey];},set polygons(v){stats[polygonKey]=v;},
        get rings(){return stats.pedestrianRings||0;},set rings(v){stats.pedestrianRings=v;},
        get degenerateTriangles(){return stats.degenerateTriangles;},
        set degenerateTriangles(v){stats.degenerateTriangles=v;},
        sourceIds:stats[sourceKey]
      };
      appendPolygonFeature(pedestrian,feature,massing.origin,center,y,color,adapter);
    }
  };
  addPed(sidewalks,'sidewalk',.10,[.57,.56,.50],'sidewalkTriangles','sidewalkPolygons','sidewalkSourceIds');
  addPed(plazas,'plaza',.12,[.64,.56,.43],'plazaTriangles','plazaPolygons','plazaSourceIds');
  const curbStats={segments:0,sourceIds:[]};
  for(const feature of curbs)appendLineFeature(curbLines,feature,massing.origin,center,.16,[.20,.79,.88],curbStats);
  stats.curbSegments=curbStats.segments;stats.curbSourceIds=curbStats.sourceIds;
  const cutStats={segments:0,sourceIds:[]};
  for(const feature of curbCuts)appendLineFeature(curbLines,feature,massing.origin,center,.18,[.98,.53,.27],cutStats);
  stats.curbCutSegments=cutStats.segments;stats.curbCutSourceIds=cutStats.sourceIds;
  if(stats.roadbedTriangles<minimums.roadbedTriangles||
     stats.sidewalkTriangles<minimums.sidewalkTriangles||
     stats.curbSegments<minimums.curbSegments||
     stats.curbCutSegments<minimums.curbCutSegments)
    throw new Error('Official OTI mesh geometry below the verified triangle/segment budget');
  return {
    schema:'patrol-nyc-oti-2022-full-surfaces-v1',
    mode:'LIVE_OFFICIAL_SOURCE_GEOMETRY_NOT_2026_AS_BUILT',
    imageryYear:2022,projection:{type:'WGS84 local east/north metres',
      originLonLat:[massing.origin.lon,massing.origin.lat],units:'metres'},
    bboxWGS84:OTI_2022_BBOX,sourceUrls:OTI_2022_LAYERS,sourceTerms:SOURCE_TERMS,
    counts:stats,
    roadbedInterleaved:new Float32Array(roadbed),
    pedestrianInterleaved:new Float32Array(pedestrian),
    curbInterleaved:new Float32Array(curbLines),
    caveats:[
      '2022 OTI planimetrics are not a November 2026 as-built survey.',
      'Roadbed polygons are surface outlines, not lane, direction, signal or traffic rules.',
      'Sidewalk/plaza/curb/curb-cut elevations are not surveyed; display Y offsets only separate layers.',
      'Curb source Z is not consumed as a height.',
      'The known 29.492 m² sidewalk/building source overlap is not silently deleted or repaired.',
      'No source geometry changes aircraft physics, collision, navigation or gameplay.'
    ],
    noSurveyedVerticalDatum:true,noGameplaySemantics:true,sourceDataStoredInRepository:false
  };
}

export async function fetchAndCompileOfficialOti2022Surfaces(massing,center,fetcher=fetch,minimums=OTI_2022_MINIMUMS){
  const kinds=['roadbed','plaza','sidewalk','curb','curbCut'];
  const pairs=await Promise.all(kinds.map(async kind=>[kind,await fetchLayer(kind,fetcher)]));
  const collections=Object.fromEntries(pairs);
  return compileOfficialOti2022Surfaces({massing,center,collections,minimums});
}
