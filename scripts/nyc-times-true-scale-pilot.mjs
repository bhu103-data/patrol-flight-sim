/**
 * Times Square metre-scale GIS pilot, not a replacement for the flight map.
 * Source 1: public NYC Building Footprints (FID/HEIGHTROOF) snapshot already
 * checked into this repo. Source 2: live NYC DCP official DCM street centerlines.
 * Both become the SAME local east/north metre coordinate system.
 * Output is an inspectable artifact, not invented driving lanes or road widths.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export const ORIGIN=[-73.9864883,40.756421]; // One Times Square reference
export const BBOX=[-73.9900,40.7552,-73.9822,40.7610];
export const ROAD_SOURCE='https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/DCM_Street_Center_Line/FeatureServer/0';
export const BUILDING_SOURCE='https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0';
export const NYC_TERMS='https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje';

export function metresPerDegree(latitude=ORIGIN[1]){
  const r=latitude*Math.PI/180;
  return [111412.84*Math.cos(r)-93.5*Math.cos(3*r)+.118*Math.cos(5*r),
    111132.92-559.82*Math.cos(2*r)+1.175*Math.cos(4*r)];
}
export function toLocalMeters(coord,origin=ORIGIN){
  if(!Array.isArray(coord)||coord.length<2||
    !Number.isFinite(coord[0])||!Number.isFinite(coord[1]))
    throw Error('Invalid WGS84 coordinate');
  const [east,north]=metresPerDegree(origin[1]);
  return [(coord[0]-origin[0])*east,(coord[1]-origin[1])*north];
}
export function area(poly){
  return Math.abs(poly.reduce((v,p,i)=>{
    const b=poly[(i+1)%poly.length];
    return v+p[0]*b[1]-b[0]*p[1];
  },0))/2;
}
function round(n,p=3){return +n.toFixed(p);}
function mappedLine(line){
  if(!Array.isArray(line)||line.length<2) return null;
  const points=line.map(p=>toLocalMeters(p).map(v=>round(v)));
  return points.every(p=>p.every(Number.isFinite))?points:null;
}
/**
 * ArcGIS intersects returns entire crossing street segments; clip only the
 * *preview* coordinates to our WGS84 query envelope. Never warp/stretch data.
 * Liang-Barsky preserves exact inside geometry and splits disjoint pieces.
 */
export function clipLineToBbox(points){
  const [x0,y0]=toLocalMeters([BBOX[0],BBOX[1]]);
  const [x1,y1]=toLocalMeters([BBOX[2],BBOX[3]]);
  const output=[];let active=[];
  function flush(){if(active.length>=2)output.push(active);active=[];}
  for(let i=0;i<points.length-1;i++){
    const a=points[i],b=points[i+1];
    const dx=b[0]-a[0],dy=b[1]-a[1];
    let lo=0,hi=1,inside=true;
    for(const [p,q] of [[-dx,a[0]-x0],[dx,x1-a[0]],
                         [-dy,a[1]-y0],[dy,y1-a[1]]]){
      if(Math.abs(p)<1e-12){if(q<0){inside=false;break;}continue;}
      const t=q/p;
      if(p<0)lo=Math.max(lo,t);
      else hi=Math.min(hi,t);
      if(lo>hi){inside=false;break;}
    }
    if(!inside){flush();continue;}
    const start=[round(a[0]+lo*dx),round(a[1]+lo*dy)];
    const end=[round(a[0]+hi*dx),round(a[1]+hi*dy)];
    if(Math.hypot(start[0]-end[0],start[1]-end[1])<.001)continue;
    if(active.length&&Math.hypot(active.at(-1)[0]-start[0],
      active.at(-1)[1]-start[1])>.005)flush();
    if(!active.length)active.push(start);
    active.push(end);
    if(hi<1-1e-10)flush();
  }
  flush();return output;
}
export function buildingsInMeters(snapshot){
  if(!Array.isArray(snapshot?.features))throw Error('Missing vetted NYC building FIDs');
  const ids=new Set(),out=[];
  for(const f of snapshot.features){
    if(!Number.isSafeInteger(f.fid)||ids.has(f.fid)||
       !Number.isFinite(f.heightFt)||f.heightFt<=0||f.heightFt>2500)continue;
    if(!Array.isArray(f.rings)||f.rings.length!==1)continue;
    const ring=f.rings[0];
    if(!Array.isArray(ring)||ring.length<4||ring.length>100)continue;
    const open=ring.slice(0,-1),coords=open.map(p=>toLocalMeters(p));
    if(coords.length<3||area(coords)<2)continue;
    ids.add(f.fid);
    out.push({fid:f.fid,heightMeters:round(f.heightFt*.3048,2),
      outline:coords.map(p=>p.map(x=>round(x)))});
  }
  if(out.length<100)throw Error('Expected at least 100 valid source building outlines, got '+out.length);
  return out;
}
export function roadsInMeters(geojson){
  if(geojson?.type!=='FeatureCollection'||!Array.isArray(geojson.features))
    throw Error('No official DCM FeatureCollection');
  const ids=new Set(),out=[];
  for(const f of geojson.features){
    const p=f.properties||{},id=p.OBJECTID;
    if(!Number.isSafeInteger(id)||ids.has(id))continue;
    const shape=f.geometry;
    if(shape?.type!=='LineString'&&shape?.type!=='MultiLineString')continue;
    const lines=(shape.type==='LineString'?[shape.coordinates]:shape.coordinates)
      .map(mappedLine).filter(Boolean).flatMap(clipLineToBbox);
    if(!lines.length)continue;
    ids.add(id);
    const widthRaw=String(p.Streetwidth??'').trim();
    const numericWidth=+widthRaw;
    // DCM width is published as an attribute; never assume it means paved
    // drivable width, and never infer lane count from it.
    const streetWidthFeet=widthRaw&&Number.isFinite(numericWidth)&&numericWidth>0
      ?round(numericWidth,2):null;
    out.push({objectId:id,streetName:String(p.Street_NM||'').trim().slice(0,100),
      featureStatus:String(p.Feat_status||'').slice(0,60),
      buildStatus:String(p.Build_Status||'').slice(0,60),
      paperStreet:String(p.Paper_ST||'').slice(0,32),
      streetWidthFeet,lines});
  }
  if(!out.length)throw Error('Official DCM query returned no valid street lines');
  return out.sort((a,b)=>a.objectId-b.objectId);
}
function queryUrl(offset){
  const u=new URL(ROAD_SOURCE+'/query');
  for(const [k,v] of Object.entries({
    where:'1=1',geometry:BBOX.join(','),geometryType:'esriGeometryEnvelope',
    inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,Street_NM,Streetwidth,Feat_status,Build_Status,Paper_ST',
    orderByFields:'OBJECTID',resultOffset:String(offset),
    resultRecordCount:'200',returnGeometry:'true',f:'geojson'
  }))u.searchParams.set(k,v);
  return u.toString();
}
export async function fetchOfficialRoads(fetcher=fetch){
  const result=[],seen=new Set();
  for(let offset=0;offset<2000;offset+=200){
    const controller=new AbortController();
    const time=setTimeout(()=>controller.abort(),45000);
    let data;
    try{
      const response=await fetcher(queryUrl(offset),{signal:controller.signal});
      if(!response.ok)throw Error('Official DCM HTTP '+response.status+' offset '+offset);
      data=await response.json();
    }finally{clearTimeout(time);}
    if(data.error)throw Error('Official DCM ArcGIS error '+JSON.stringify(data.error));
    if(!Array.isArray(data.features))throw Error('Official DCM returned non-feature response');
    for(const f of data.features){
      const id=f?.properties?.OBJECTID;
      if(Number.isSafeInteger(id)&&!seen.has(id)){seen.add(id);result.push(f);}
    }
    if(data.features.length<200)break;
    if(offset>=1800)throw Error('DCM query exceeded bounded 2000-record pilot');
  }
  if(result.length<5)throw Error('Official DCM query returned too few intersecting streets: '+result.length);
  return {type:'FeatureCollection',features:result};
}
function boundsOf(buildings,roads){
  const points=[
    ...buildings.flatMap(b=>b.outline),
    ...roads.flatMap(r=>r.lines.flat())
  ];
  return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),
    Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
export function makeSvg(buildings,roads){
  const [left,bottom,right,top]=boundsOf(buildings,roads);
  const pad=15,width=right-left+2*pad,height=top-bottom+2*pad;
  // Real metre viewBox in both axes; no one-axis image stretch.
  const shapes=buildings.map(b=>'<polygon points="'+b.outline.map(p=>
    p[0]+','+(-p[1])).join(' ')+'" fill="#b0b5bc" fill-opacity=".78" stroke="#606a72" stroke-width=".55"/>').join('\n');
  const lines=roads.flatMap(r=>r.lines.map(line=>
    '<polyline points="'+line.map(p=>p[0]+','+(-p[1])).join(' ')+
    '" stroke="'+(/^(y|yes|true|1)$/i.test(r.paperStreet)?'#d98a57':'#55c8f5')+
    '" stroke-width="2" stroke-linejoin="round" fill="none"/>')).join('\n');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+
    [round(left-pad),round(-top-pad),round(width),round(height)].join(' ')+
    '" width="1280" height="'+Math.max(500,Math.round(1280*height/width))+'">'+
    '<rect x="'+(left-pad)+'" y="'+(-top-pad)+'" width="'+width+'" height="'+height+'" fill="#111a22"/>'+
    shapes+lines+'<circle cx="0" cy="0" r="4" fill="#ffe07e"/></svg>';
}
export async function run(){
  const source=JSON.parse(readFileSync('assets/nyc/times-square-footprints.json','utf8'));
  const buildings=buildingsInMeters(source);
  const officialGeo=await fetchOfficialRoads();
  const roads=roadsInMeters(officialGeo);
  const bboxLocal=boundsOf(buildings,roads).map(v=>round(v,2));
  const packageData={
    schema:'patrol-nyc-times-square-metre-source-pilot-v1',
    assetRole:'GEOREFERENCED_SOURCE_QA_ONLY_NOT_IN_GAME',
    sourceDateBuildings:source.retrieved,
    sourceDateRoads:new Date().toISOString(),
    source:{buildings:BUILDING_SOURCE,streets:ROAD_SOURCE,terms:NYC_TERMS},
    projection:{type:'local tangent east/north metres',originLonLat:ORIGIN,
      bboxLonLat:BBOX,scaleMetresPerGameUnit:null,heightUnit:'metres'},
    caveats:['Centerlines are NOT drivable roadbed polygons or curb lines',
      'Streetwidth is source attribute, NOT verified lane or pavement width',
      'Official 3-D massing, terrain, glass facades and traffic not yet integrated',
      'Some DCM records may represent paper/record streets',
      'Existing compressed PATROL coordinates intentionally NOT used'],
    counts:{inputBuildingRecords:source.features.length,buildings:buildings.length,
      omittedBuildings:source.features.length-buildings.length,roadFeatures:roads.length,
      roadLines:roads.reduce((n,r)=>n+r.lines.length,0)},
    boundsMetres:bboxLocal,buildings,roads
  };
  mkdirSync('artifacts/nyc-true-scale',{recursive:true});
  writeFileSync('artifacts/nyc-true-scale/source.json',JSON.stringify(packageData,null,2));
  writeFileSync('artifacts/nyc-true-scale/plan.svg',makeSvg(buildings,roads));
  console.log('NYC 1:1 source pilot',JSON.stringify({
    counts:packageData.counts,boundsMetres:bboxLocal,
    origin:ORIGIN,source:ROAD_SOURCE,readyForDefaultGame:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  run().catch(error=>{console.error(error);process.exitCode=1;});
}
