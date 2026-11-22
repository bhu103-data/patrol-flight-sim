// NYC OTI official 2022 planimetric ROADBED subset at Front St / Dock St.
// This offline-only tool is NOT allowed to fetch from the gameplay browser.
// Reuse requires City of New York Open Data Terms and source attribution:
// https://data.cityofnewyork.us/Transportation/NYC-Planimetric-Database-Roadbed/i36f-5ih7
// https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje
// 2022 boundaries are distinct from NYC DOT's June 2026 DUMBO bike plan.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const earcut=require('/tmp/patrol-roadbed/node_modules/earcut');
export const ORIGIN={lon:-73.992042,lat:40.702634}; // Front St/Dock St approx intersection
export const SOURCE='https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/Roadbed_2022/FeatureServer/20';
export const BBOX=[-73.99270,40.70215,-73.98955,40.70309];
export const CLIP=[-35,-23,190,23]; // east/north metres around one official 2022 corridor
const mLon=111412.84*Math.cos(ORIGIN.lat*Math.PI/180)-
  93.5*Math.cos(3*ORIGIN.lat*Math.PI/180)+
  .118*Math.cos(5*ORIGIN.lat*Math.PI/180);
const mLat=111132.92-559.82*Math.cos(2*ORIGIN.lat*Math.PI/180)+
  1.175*Math.cos(4*ORIGIN.lat*Math.PI/180);
const project=p=>{
  if(!Array.isArray(p)||p.length<2||p[0]<-75||p[0]>-72||p[1]<39||p[1]>42)
    throw Error('Non-NYC source vertex');
  return [(p[0]-ORIGIN.lon)*mLon,(p[1]-ORIGIN.lat)*mLat];
};
function ringArea(r){
  let sum=0;
  for(let i=0;i<r.length;i++){
    const p=r[i],q=r[(i+1)%r.length];
    sum+=p[0]*q[1]-p[1]*q[0];
  }
  return sum*.5;
}
function clipBy(poly,axis,edge,greater){
  const inside=p=>greater?p[axis]>=edge-1e-8:p[axis]<=edge+1e-8;
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],
      ain=inside(a),bin=inside(b);
    const hit=()=>{
      const d=b[axis]-a[axis],t=Math.abs(d)<1e-12?0:(edge-a[axis])/d;
      return [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])];
    };
    if(ain&&bin)out.push(b);
    else if(ain&&!bin)out.push(hit());
    else if(!ain&&bin){out.push(hit());out.push(b)}
  }
  return out;
}
function clipTriangle(t){
  let p=t;
  for(const [axis,edge,greater] of [[0,CLIP[0],true],[0,CLIP[2],false],
    [1,CLIP[1],true],[1,CLIP[3],false]]){
    if(p.length<3)return [];
    p=clipBy(p,axis,edge,greater);
  }
  return p;
}
async function fetchOfficial(){
  const uri=new URL(SOURCE+'/query');
  for(const [k,v] of Object.entries({
    where:'1=1',geometry:BBOX.join(','),geometryType:'esriGeometryEnvelope',
    inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,SOURCE_ID,SUB_FEATURE_CODE,STATUS',
    orderByFields:'OBJECTID',resultRecordCount:'150',
    resultOffset:'0',returnGeometry:'true',f:'geojson'
  }))uri.searchParams.set(k,v);
  const controller=new AbortController(),abort=setTimeout(()=>controller.abort(),45000);
  let response;
  try{response=await fetch(uri,{signal:controller.signal})}
  finally{clearTimeout(abort)}
  if(!response.ok)throw Error('NYC OTI '+response.status);
  const txt=await response.text();
  if(txt.length>25_000_000)throw Error('Source response exceeds bounded audit size');
  const data=JSON.parse(txt);
  if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||
     data.features.length<1||data.features.length>=150)
    throw Error('Expected fully paginated 2022 OTI FeatureCollection');
  return data;
}
export async function run(){
  const source=await fetchOfficial();
  const output=[],ids=new Set(),skipped=[];
  let area=0,observed=0;
  for(const feature of source.features){
    const id=feature.properties?.OBJECTID,sub=Number(feature.properties?.SUB_FEATURE_CODE);
    if(!Number.isSafeInteger(id)||ids.has(id))continue;
    ids.add(id);
    // Only actual ROADBED or INTERSECTION; other driveways, sidewalks,
    // shoulders and private courtyards must not become moving lanes.
    if(![350000,350010].includes(sub))continue;
    const geo=feature.geometry;
    const polys=geo?.type==='Polygon'?[geo.coordinates]:
      geo?.type==='MultiPolygon'?geo.coordinates:[];
    for(const rings of polys){
      if(!Array.isArray(rings)||!rings.length)continue;
      const flat=[],holes=[];
      try{
        for(let j=0;j<rings.length;j++){
          const ring=rings[j];
          if(!Array.isArray(ring)||ring.length<4||ring.length>20000)
            throw Error('Invalid official ring');
          if(j)holes.push(flat.length/2);
          for(const point of ring){
            const p=project(point);flat.push(...p);
          }
        }
        const indices=earcut(flat,holes,2);
        if(indices.length<3||indices.length%3)throw Error('No valid polygon triangulation');
        observed++;
        for(let k=0;k<indices.length;k+=3){
          const triangle=indices.slice(k,k+3).map(i=>flat.slice(i*2,i*2+2));
          const clipped=clipTriangle(triangle);
          if(clipped.length<3)continue;
          for(let c=1;c+1<clipped.length;c++){
            const t=[clipped[0],clipped[c],clipped[c+1]];
            const a=Math.abs(ringArea(t));
            if(a<.00002)continue;
            area+=a;
            output.push({id,sub,v:t.map(p=>p.map(n=>+n.toFixed(3)))});
          }
        }
      }catch(error){skipped.push({id,reason:error.message})}
    }
  }
  if(output.length<4||output.length>3000||!output.some(v=>v.sub===350000))
    throw Error('No bounded licensed roadbed area or over budget: '+output.length);
  const evidence={
    schema:'patrol-nyc-dumbo-front-dock-oti-roadbed-2022-v1',
    source:SOURCE,license:'NYC public Open Data; no external photos/tiles',
    terms:'https://data.cityofnewyork.us/stories/s/Terms-of-Use/k9k7-3cje',
    year:2022,origin:ORIGIN,queryBbox:BBOX,clipMetres:CLIP,
    note:'2022 2D pavement outline, no actual 2026 lane width, elevation, signal phase or curb height. Flat game-space visual pilot with uniform compression.',
    records:source.features.length,polygons:observed,
    areaSquareMetres:+area.toFixed(2),triangles:output
  };
  const dir='artifacts/nyc-dumbo-front-dock-source';
  mkdirSync(dir,{recursive:true});
  writeFileSync(dir+'/roadbed-2022.json',JSON.stringify(evidence));
  writeFileSync(dir+'/summary.json',JSON.stringify({
    source:SOURCE,query:dir,records:evidence.records,polygons:observed,
    triangles:output.length,areaSquareMetres:evidence.areaSquareMetres,
    objectIds:[...new Set(output.map(v=>v.id))],skipped
  },null,2));
  console.log('OTI_DUMBO_ROADBED_FETCH '+JSON.stringify({
    records:evidence.records,polygons:observed,triangles:output.length,
    areaSquareMetres:evidence.areaSquareMetres,uniqueFeatures:[...new Set(output.map(v=>v.id))].length,skipped:skipped.length
  }));
}
if(import.meta.url===new URL('file://'+process.argv[1]).href)
  run().catch(e=>{console.error(e.stack||e);process.exitCode=1});
