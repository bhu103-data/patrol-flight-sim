// Bounded one-off NYC OTI snapshot builder. This file is NOT connected to gameplay.
import {writeFile} from 'node:fs/promises';
const bbox=[-73.9815,40.7485,-73.9765,40.7520];
const endpoint='https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/BUILDING_view/FeatureServer/0/query';
const max=120;
function area(points){return points.reduce((s,p,i)=>{const q=points[(i+1)%points.length];return s+p[0]*q[1]-q[0]*p[1]},0)/2}
export function normalize(features){
 const seen=new Set(),out=[];
 for(const f of features){
  const a=f.properties||{},id=Number(a.DOITT_ID),heightFt=Number(a.HEIGHT_ROOF);
  const ring=f.geometry?.type==='Polygon'?f.geometry.coordinates?.[0]:null;
  if(!Number.isSafeInteger(id)||id<=0||seen.has(id)||!Number.isFinite(heightFt)||heightFt<=0||heightFt>1800||!Array.isArray(ring)||ring.length<4||ring.length>80)continue;
  const poly=ring.slice(0,-1);
  if(poly.length<3||poly.some(p=>!Array.isArray(p)||p.length<2||!p.slice(0,2).every(Number.isFinite)))continue;
  if(poly.some(([lon,lat])=>lon<bbox[0]-.001||lon>bbox[2]+.001||lat<bbox[1]-.001||lat>bbox[3]+.001))continue;
  if(Math.abs(area(poly))<1e-10||f.geometry.coordinates.length!==1)continue;
  seen.add(id);out.push({id,heightFt,roofHeightSource:'HEIGHT_ROOF',roofSetback:'authored-approximation',ring:poly.map(p=>p.slice(0,2))});
  if(out.length>=max)break;
 }
 return out.sort((a,b)=>a.id-b.id);
}
export async function snapshot(fetcher=fetch){
 const records=[];
 for(let offset=0;offset<500;offset+=100){
  const q=new URLSearchParams({where:'FEATURE_CODE=2100 AND HEIGHT_ROOF > 0',geometry:bbox.join(','),geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'DOITT_ID,HEIGHT_ROOF,FEATURE_CODE',returnGeometry:'true',outSR:'4326',f:'geojson',resultRecordCount:'100',resultOffset:String(offset),orderByFields:'DOITT_ID ASC'});
  const response=await fetcher(endpoint+'?'+q);
  if(!response.ok)throw new Error('NYC OTI HTTP '+response.status);
  const data=await response.json();
  if(data.error||!Array.isArray(data.features))throw new Error('Invalid NYC OTI response');
  records.push(...data.features);
  if(data.features.length<100)break;
 }
 const buildings=normalize(records);
 if(!buildings.length)throw new Error('No verified building polygons; refusing empty replacement');
 return {schema:'patrol-nyc-murray-hill-visual-only-v1',source:endpoint,sourceDataset:'https://data.cityofnewyork.us/City-Government/BUILDING/5zhs-2jue',bboxWgs84:bbox,featureCode:2100,units:'longitude latitude / height feet',viewOnly:true,collision:false,roofSteps:'authored approximation, not city-measured',buildings};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const out=process.argv[2];if(!out)throw Error('Usage: node scripts/nyc-murray-hill-footprints.mjs <output.json>');
 await writeFile(out,JSON.stringify(await snapshot())+'\n');
 console.log('Wrote official-source bounded snapshot:',out);
}