// Opt-in source-exact OTI 2022 DUMBO paved ROADBED triangles from PR #259.
// A 2022 roadbed boundary is neither a 2026 lane/signal map nor an NYC centerline.
// Project every source vertex through WGS84 into the SAME district metric frame
// as dumbo-oti-metric.mjs; never fit roads into PATROL's compressed street mesh.
import {M_PER_DEG_LAT,M_PER_DEG_LON,toLocalMeters,signedArea} from './dumbo-oti-metric.mjs';

export const ROADBED_SOURCE='https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20';
const rad=Math.PI/180;
function sourceDegreeScale(latitude){
  const p=latitude*rad;
  return {lon:111412.84*Math.cos(p)-93.5*Math.cos(3*p)+.118*Math.cos(5*p),
    lat:111132.92-559.82*Math.cos(2*p)+1.175*Math.cos(4*p)};
}

export function sourceRoadToWgs84(point,origin){
  if(!Array.isArray(point)||point.length!==2||point.some(v=>!Number.isFinite(v))||
    !Number.isFinite(origin?.lon)||!Number.isFinite(origin?.lat))
    throw Error('Invalid official roadbed local-meter vertex/origin');
  const scale=sourceDegreeScale(origin.lat);
  return [origin.lon+point[0]/scale.lon, origin.lat+point[1]/scale.lat];
}
export function sourceRoadToDistrictMeters(point,origin){
  const [lon,lat]=sourceRoadToWgs84(point,origin);
  return toLocalMeters(lon,lat); // X east; Z south, same one-origin district projection
}

// Source triangle vertices were rounded to 0.001 m by #259's existing offline
// exporter. This can collapse ultra-thin triangles: omit those from WebGL,
// retain the full unmodified source JSON and report the discarded count/area.
export function prepareOfficialDumboRoadbed(source){
  if(source?.schema!=='patrol-nyc-dumbo-front-dock-oti-roadbed-2022-v1'||
     source?.source!==ROADBED_SOURCE||source?.year!==2022||
     Math.abs(source?.origin?.lon-(-73.992042))>1e-9||
     Math.abs(source?.origin?.lat-40.702634)>1e-9||
     !Array.isArray(source.triangles)||
     source.triangles.length<100||source.triangles.length>3000||
     !Number.isFinite(source.areaSquareMetres)||source.areaSquareMetres<=0)
    throw Error('Unexpected NYC OTI 2022 roadbed source snapshot');
  const clip=source.clipMetres;
  if(!Array.isArray(clip)||clip.length!==4||clip.some(v=>!Number.isFinite(v))||
    !(clip[0]<clip[2]&&clip[1]<clip[3]))
    throw Error('Unexpected official source clip bounds');
  let skippedDegenerate=0,originalAreaM2=0,discardedAreaM2=0;
  const triangles=[],ids=new Set();
  for(const record of source.triangles){
    if(!Number.isSafeInteger(record.id)||![350000,350010].includes(record.sub)||
       !Array.isArray(record.v)||record.v.length!==3)
      throw Error('Invalid roadbed feature ID, type or triangle topology');
    for(const p of record.v){
      if(!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v))||
         p[0]<clip[0]-.01||p[0]>clip[2]+.01||
         p[1]<clip[1]-.01||p[1]>clip[3]+.01)
        throw Error('Roadbed triangle exceeds official source clip');
    }
    const a=Math.abs(signedArea(record.v));
    originalAreaM2+=a;
    if(a<=1e-8){skippedDegenerate++;discardedAreaM2+=a;continue}
    const points=record.v.map(p=>sourceRoadToDistrictMeters(p,source.origin));
    if(points.some(p=>p.some(n=>!Number.isFinite(n))))
      throw Error('Roadbed projected coordinate not finite');
    triangles.push({id:record.id,sub:record.sub,points});
    ids.add(record.id);
  }
  if(triangles.length<100||
     Math.abs(originalAreaM2-source.areaSquareMetres)>2)
    throw Error('Roadbed area or projected triangle count does not reconcile');
  return {year:2022,source:ROADBED_SOURCE,triangles,
    stats:{sourceTriangles:source.triangles.length,
      renderedTriangles:triangles.length,skippedDegenerate,
      originalAreaM2,discardedAreaM2,featureIds:ids.size,
      officialAreaM2:source.areaSquareMetres,
      unit:'metres',referenceFrame:'DUMBO_ORIGIN X=east Z=south',
      sourcePrecisionMetres:0.001,
      note:'2022 paved polygon subset only; no lane directions, 2026 signals, bridges or elevation'}};
}
