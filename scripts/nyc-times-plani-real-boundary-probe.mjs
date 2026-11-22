// Read-only official OTI 2022 planimetrics audit. NEVER a gameplay import.
// Actual 2022 roadbed polygon (20), pavement edge lines (14), plaza polygons
// (16) are independent, historical sources; do not call them a 2026 curb map.
// All coordinates become the *same* East/North metre frame as building FIDs
// and 2026 CSCL. 2022 plans may disagree with 2026 traffic and plaza edits.
// Copyright / derivative / redistributability still needs signoff.
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {toLocalMeters} from '../assets/nyc/times-square-metric-massing.js';
import {makeUrl as csclUrl,checkFeatureCollection}
  from './nyc-times-cscl-roadbed-probe.mjs';

export const BBOX=[-73.989,40.7555,-73.9825,40.7602];
const prefix='https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/';
export const SOURCES=Object.freeze([
  {kind:'roadbed',url:prefix+'Roadbed_2022/FeatureServer/20',
    geom:'Polygon',codes:[350000,350010]},
  {kind:'pavementEdge',url:prefix+'Pavement_Edge_2022/FeatureServer/14',
    geom:'LineString',codes:[226000]},
  {kind:'plaza',url:prefix+'Plaza_2022/FeatureServer/16',
    geom:'Polygon',codes:[]}
]);
const inBounds=point=>Array.isArray(point)&&point.length>=2&&
  Number.isFinite(point[0])&&Number.isFinite(point[1])&&
  point[0]>-74.2&&point[0]<-73.6&&point[1]>40.4&&point[1]<41;
export function makeUrl(source,offset=0){
  if(!SOURCES.some(s=>s.url===source.url)||!Number.isInteger(offset)||offset<0)
    throw Error('Only allow listed official OTI source and nonnegative page offset');
  const u=new URL(source.url+'/query');
  for(const [key,value] of Object.entries({
    where:'1=1',geometry:BBOX.join(','),
    geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',
    spatialRel:'esriSpatialRelIntersects',
    outFields:'OBJECTID,SOURCE_ID,FEATURE_CODE,SUB_FEATURE_CODE,STATUS',
    orderByFields:'OBJECTID',returnGeometry:'true',resultOffset:String(offset),
    resultRecordCount:'500',f:'geojson'
  }))u.searchParams.set(key,value);
  return u.toString();
}
const ringArea=ring=>ring.reduce((sum,a,i)=>{
  const b=ring[(i+1)%ring.length];
  return sum+a[0]*b[1]-b[0]*a[1];
},0)*.5;
function shape(f,kind){
  const g=f?.geometry;
  if(!g||!Array.isArray(g.coordinates))return null;
  const polygons=[];
  if(kind==='pavementEdge'){
    if(!['LineString','MultiLineString'].includes(g.type))return null;
    const lines=g.type==='LineString'?[g.coordinates]:g.coordinates;
    if(!lines.every(line=>Array.isArray(line)&&line.length>=2&&
      line.length<=12000&&line.every(inBounds)))return null;
    return lines.map(line=>line.map(p=>toLocalMeters(p[0],p[1])));
  }
  if(!['Polygon','MultiPolygon'].includes(g.type))return null;
  const members=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  if(!members.length||members.length>50)return null;
  for(const member of members){
    if(!Array.isArray(member)||!member.length||member.length>50)return null;
    const poly=[];
    for(const ring of member){
      if(!Array.isArray(ring)||ring.length<4||ring.length>12000||
        !ring.every(inBounds))return null;
      const out=ring.map(p=>toLocalMeters(p[0],p[1]));
      if(Math.abs(ringArea(out))<.005)return null;
      poly.push(out);
    }
    polygons.push(poly);
  }
  return polygons;
}
export function normalizeGeoJSON(source,data){
  if(!SOURCES.some(s=>s.url===source?.url)||
    data?.type!=='FeatureCollection'||!Array.isArray(data.features))
    throw Error('Expected listed official source and valid GeoJSON FeatureCollection');
  const records=[],rejected=[],seen=new Set();
  for(const f of data.features){
    const p=f.properties||{},id=p.OBJECTID;
    if(!Number.isSafeInteger(id)||seen.has(id)){
      rejected.push({id,reason:'invalid-or-duplicate-object-id'});continue;
    }
    seen.add(id);
    const coords=shape(f,source.kind);
    if(!coords){rejected.push({id,reason:'invalid-geometry'});continue;}
    const subtype=Number(p.SUB_FEATURE_CODE),type=Number(p.FEATURE_CODE);
    records.push({
      id,sourceId:p.SOURCE_ID??null,featureCode:Number.isFinite(type)?type:null,
      subFeatureCode:Number.isFinite(subtype)?subtype:null,
      sourceStatus:String(p.STATUS??''),
      roadbedVsIntersection:source.kind==='roadbed'?(
        subtype===350000?'roadbed':subtype===350010?'intersection': 'other') :null,
      // Do not fill holes or invent a carriageway from lines.
      coordinatesMetres:coords
    });
  }
  return {records,rejected};
}
async function fetchSource(source,fetcher){
  const features=[],seen=new Set();
  for(let offset=0;offset<6000;offset+=500){
    const response=await fetcher(makeUrl(source,offset),{
      signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error(source.kind+' OTI HTTP '+response.status);
    const data=await response.json();
    if(data.error||!Array.isArray(data.features))
      throw Error(source.kind+' ArcGIS error '+JSON.stringify(data.error||data));
    for(const f of data.features){
      const id=f?.properties?.OBJECTID;
      if(Number.isSafeInteger(id)&&!seen.has(id)){
        seen.add(id);features.push(f);
      }
    }
    if(data.features.length<500)break;
    if(offset===5500)throw Error(source.kind+' source exceeded 6000 bounded records');
  }
  return normalizeGeoJSON(source,{type:'FeatureCollection',features});
}
const insideRing=(p,ring)=>{
  let inPoly=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&
      p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inPoly=!inPoly;
  }
  return inPoly;
};
export function pointInsidePolygon(p,member){
  return Array.isArray(member)&&member.length>0&&
    insideRing(p,member[0])&&!member.slice(1).some(hole=>insideRing(p,hole));
}
function polygonsIndex(records){
  const out=[];
  for(const record of records)for(const member of record.coordinatesMetres){
    const xs=member[0].map(p=>p[0]),zs=member[0].map(p=>p[1]);
    out.push({
      id:record.id,type:record.roadbedVsIntersection,
      areaBounds:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)],
      member
    });
  }
  return out;
}
const covered=(p,index)=>{
  for(const item of index){
    const b=item.areaBounds;
    if(p[0]<b[0]||p[0]>b[2]||p[1]<b[1]||p[1]>b[3])continue;
    if(pointInsidePolygon(p,item.member))return true;
  }
  return false;
};
export function audit2022RoadbedCoverage(csclRecords,roadbeds,plazas,stepMetres=2){
  if(!Array.isArray(csclRecords)||!Array.isArray(roadbeds)||
     !Array.isArray(plazas)||!(stepMetres>0&&stepMetres<=10))
    throw Error('Expected vetted source records and positive sample spacing');
  const motor=csclRecords.filter(r=>r.constructedVehicleCandidate);
  const roads=polygonsIndex(roadbeds.filter(r=>['roadbed','intersection'].includes(r.roadbedVsIntersection)));
  const pedestrian=polygonsIndex(plazas);
  let pts=0,roadMatches=0,plazaMatches=0;
  const perSegment=[];
  for(const rec of motor){
    let samples=0,hits=0;
    for(const line of rec.lines)for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i],dist=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(!Number.isFinite(dist)||dist<.05)continue;
      const n=Math.max(1,Math.ceil(dist/stepMetres));
      for(let k=0;k<n;k++){
        const t=(k+.5)/n,p=[a[0]+(b[0]-a[0])*t,
          a[1]+(b[1]-a[1])*t];
        // Only samples in the shared pilot bounds. Source polygons from
        // spatial intersection queries may extend beyond the pilot bounds.
        if(p[0]<-350||p[0]>400||p[1]<-120||p[1]>460)continue;
        samples++;pts++;
        if(covered(p,roads)){hits++;roadMatches++;}
        if(covered(p,pedestrian))plazaMatches++;
      }
    }
    perSegment.push({id:rec.id,name:rec.name,samples,
      insideHistoricRoadbed:hits,
      hitFraction:samples?+(hits/samples).toFixed(4):null});
  }
  return {motorRecords:motor.length,samples:pts,
    insideHistoric2022Roadbed:roadMatches,
    onHistoricPlaza:plazaMatches,
    coverageFraction:pts?+(roadMatches/pts).toFixed(4):null,
    missed:perSegment.filter(x=>x.samples>0&&x.hitFraction<.8)
      .sort((a,b)=>a.hitFraction-b.hitFraction),
    perSegment,
    warning:'2022 ortho roadbed and 2026 CSCL are separate source vintages; no coverage rate alone certifies 2026 traffic.'};
}
export async function run(fetcher=fetch){
  const folder='artifacts/nyc-plani-boundary';
  await mkdir(folder,{recursive:true});
  const result={passed:false,sourceVintages:{orthoManhattan:'2022-03-18',
    digitization:'2022–2023',liveCscl:'2026-11-07'},
    input:BBOX,licenseApprovedForGame:false,
    codeAffectsPlayableFlight:false,
    rightsReviewRequired:true,errors:[],collections:[],coverage:null};
  try{
    const sets=[];
    for(const source of SOURCES){
      const data=await fetchSource(source,fetcher);
      const summary={kind:source.kind,url:source.url,valid:data.records.length,
        rejected:data.rejected.length,featureCodes:{},subFeatureCodes:{}};
      for(const r of data.records){
        summary.featureCodes[r.featureCode]=(summary.featureCodes[r.featureCode]||0)+1;
        summary.subFeatureCodes[r.subFeatureCode]=(summary.subFeatureCodes[r.subFeatureCode]||0)+1;
      }
      result.collections.push(summary);
      sets.push(data);
    }
    const response=await fetcher(csclUrl(),{signal:AbortSignal.timeout(45000)});
    if(!response.ok)throw Error('Modern official CSCL HTTP '+response.status);
    const live=await response.json();
    if(live.error)throw Error('Modern CSCL ArcGIS error '+JSON.stringify(live.error));
    const cscl=checkFeatureCollection(live);
    result.coverage=audit2022RoadbedCoverage(cscl.accepted,sets[0].records,
      sets[2].records);
    result.centerlines={total:cscl.accepted.length,
      rejected:cscl.rejects.length,
      motorCandidates:cscl.accepted.filter(r=>r.constructedVehicleCandidate).length};
    if(sets[0].records.length<10||sets[1].records.length<10||
       result.centerlines.motorCandidates<20||
       result.coverage.samples<80)
      throw Error('Missing or unexpectedly sparse actual source geometry: '+JSON.stringify({
        layers:result.collections,centerlines:result.centerlines,
        sampleCount:result.coverage.samples
      }));
    result.passed=true;
    // Ephemeral CI artifacts only, never the flight map or permanent source.
    await writeFile(folder+'/source-geometry-temporary.json',JSON.stringify({
      sourceVintages:result.sourceVintages,bounds:BBOX,
      licenseApprovedForGame:false,
      roadbeds:sets[0].records,pavementEdges:sets[1].records,
      plazas:sets[2].records
    }));
    console.log('NYC 2022 actual geometry source audit',JSON.stringify({
      collections:result.collections,centerlines:result.centerlines,
      roadbedMatch:result.coverage.coverageFraction,
      lowMatch:result.coverage.missed.slice(0,12)
    }));
  }catch(e){result.errors.push(String(e.stack||e));
    console.error('NYC historical source polygon audit failed',e);
  }finally{
    await writeFile(folder+'/report.json',JSON.stringify(result,null,2));
  }
  if(!result.passed)process.exitCode=1;
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  await run();
