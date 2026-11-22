// Standalone NYC Reality pilot only; NOT a roadbed, driving lane or flight collision source.
// Reuses NYC DCP official Digital City Map Street Center Line data (see PR #234).
// Use exactly the same WGS84 ECEF->ENU metres as our 1:1 building footprints.
import {lonLatToENU, NYC_REALITY_ORIGIN} from './nyc-reality-projection.mjs';

export const NYC_DCM_SOURCE =
  'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/ArcGIS/rest/services/DCM_Street_Center_Line/FeatureServer/0';
export const NYC_DCM_TERMS = 'https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje';
export const NYC_STREET_BBOX = Object.freeze([-73.9900, 40.7552, -73.9822, 40.7610]);

export function officialStreetQuery(offset=0) {
  if(!Number.isInteger(offset)||offset<0||offset>=2000||offset%200!==0)
    throw RangeError('Unbounded or invalid DCM page');
  const u=new URL(NYC_DCM_SOURCE+'/query');
  for(const [key,value] of Object.entries({
    where:'1=1',geometry:NYC_STREET_BBOX.join(','),
    geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',
    spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,Street_NM,Streetwidth,Feat_status,Build_Status,Paper_ST',
    orderByFields:'OBJECTID',resultOffset:String(offset),
    resultRecordCount:'200',returnGeometry:'true',f:'geojson'
  }))u.searchParams.set(key,value);
  return u.toString();
}

function validPoint(p) {
  return Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&
    Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
}
function near(a,b) {
  return Math.hypot(a[0]-b[0],a[1]-b[1])<1e-10;
}
// Clip intersecting source polyline segments; never stretch the official line.
export function clipWGS84Line(line,bbox=NYC_STREET_BBOX) {
  if(!Array.isArray(line)||line.length<2||line.some(p=>!validPoint(p)))
    throw TypeError('Invalid official DCM line coordinates');
  const [xmin,ymin,xmax,ymax]=bbox,results=[];
  let active=[];
  const flush=()=>{if(active.length>1)results.push(active);active=[];};
  for(let i=0;i<line.length-1;i++){
    const a=line[i],b=line[i+1],dx=b[0]-a[0],dy=b[1]-a[1];
    let t0=0,t1=1,inside=true;
    for(const [p,q] of [[-dx,a[0]-xmin],[dx,xmax-a[0]],
                        [-dy,a[1]-ymin],[dy,ymax-a[1]]]){
      if(Math.abs(p)<1e-14){if(q<0){inside=false;break;}continue;}
      const t=q/p;
      if(p<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);
      if(t0>t1){inside=false;break;}
    }
    if(!inside||t1-t0<1e-10){flush();continue;}
    const start=[a[0]+t0*dx,a[1]+t0*dy];
    const end=[a[0]+t1*dx,a[1]+t1*dy];
    if(near(start,end))continue;
    if(active.length&&!near(active[active.length-1],start))flush();
    if(active.length===0)active.push(start);
    active.push(end);
    if(t1<1-1e-10)flush();
  }
  flush();
  return results;
}
export function projectDCMRoads(collection,origin=NYC_REALITY_ORIGIN) {
  if(collection?.type!=='FeatureCollection'||!Array.isArray(collection.features))
    throw TypeError('Expected official DCM GeoJSON FeatureCollection');
  const seen=new Set(),records=[];
  for(const f of collection.features){
    const p=f.properties||{},id=p.OBJECTID;
    if(!Number.isSafeInteger(id)||seen.has(id))continue;
    const shape=f.geometry;
    if(!['LineString','MultiLineString'].includes(shape?.type))continue;
    seen.add(id);
    const lines=shape.type==='LineString'?[shape.coordinates]:shape.coordinates;
    if(!Array.isArray(lines))throw TypeError('Invalid DCM geometry');
    const metreLines=lines.flatMap(line=>clipWGS84Line(line).map(clipped=>
      clipped.map(([lon,lat])=>{
        const [east,north]=lonLatToENU(lon,lat,0,origin);
        return [east,north];
      })));
    if(!metreLines.length)continue;
    const featureStatus=String(p.Feat_status||'');
    const buildStatus=String(p.Build_Status||'');
    const paperStreet=String(p.Paper_ST||'');
    // "Improved" city streets use solid source-centerline ink; records/unknowns
    // remain visible but dashed. No claim of paved width, curb, driving lanes.
    const built=featureStatus==='City_St'&&buildStatus==='Improved'&&
      !/^(y|yes|true|1)$/i.test(paperStreet);
    records.push({
      objectId:id, name:String(p.Street_NM||'').slice(0,120),
      featureStatus,buildStatus,paperStreet,built,
      metreLines
    });
  }
  if(records.length<5)
    throw Error('Too few valid DCM street centerlines; refusing invented fallback');
  records.sort((a,b)=>a.objectId-b.objectId);
  return {
    records, totalLines:records.reduce((sum,r)=>sum+r.metreLines.length,0),
    source:NYC_DCM_SOURCE, origin, kind:'WGS84 DCM street centerlines, not roadbeds',
    builtCount:records.filter(r=>r.built).length
  };
}
// Select a pedestrian-height QA camera ON an official built street centerline,
// rather than inventing a game-space street address or flying through a wall.
export function chooseOfficialStreetCamera(records,streetName='7 Avenue') {
  if(!Array.isArray(records))throw TypeError('Missing verified street records');
  const options=records.filter(r=>r.built&&r.name===streetName)
    .flatMap(r=>r.metreLines.map(line=>{
      const a=line[0],b=line.at(-1);
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const centre=[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
      return {objectId:r.objectId,streetName,vertices:line,
        length,distance:Math.hypot(centre[0],centre[1])};
    })).filter(r=>r.length>30&&r.distance<260)
    .sort((a,b)=>a.distance-b.distance||a.objectId-b.objectId);
  const s=options[0];
  if(!s)throw Error('No source-verified built street segment for camera');
  const a=s.vertices[0],b=s.vertices.at(-1);
  const lerp=(f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
  const start=lerp(.15),end=lerp(.85);
  return {objectId:s.objectId,streetName,
    eye:[start[0],2.3,-start[1]],
    look:[end[0],2.3,-end[1]],
    source:'NYC official DCM centreline; not curb/roadbed'};
}

export async function fetchOfficialDCM(fetcher=fetch) {
  const features=[],ids=new Set();
  for(let offset=0;offset<2000;offset+=200){
    const response=await fetcher(officialStreetQuery(offset));
    if(!response.ok)throw Error('NYC DCM HTTP '+response.status);
    const json=await response.json();
    if(json.error)throw Error('NYC DCM ArcGIS '+JSON.stringify(json.error));
    if(json.type!=='FeatureCollection'||!Array.isArray(json.features))
      throw TypeError('Invalid NYC DCM response');
    for(const f of json.features){
      const id=f.properties?.OBJECTID;
      if(Number.isSafeInteger(id)&&!ids.has(id)){
        ids.add(id);features.push(f);
      }
    }
    if(json.features.length<200)break;
    if(offset===1800)throw Error('DCM data exceeds bounded 2000 record window');
  }
  return projectDCMRoads({type:'FeatureCollection',features});
}
