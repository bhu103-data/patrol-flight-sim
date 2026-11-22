/**
 * NYC DUMBO source-only 2D check: exact at-grade CSCL segments vs 2022 OTI
 * ROADBED triangles in one shared WGS84-derived metre frame. Roadbed coverage
 * is NOT roadway permission, height, signal timing or surveyed 2026 pavement.
 * Overlapping official triangles count ONCE, never sum the raw intersection
 * lengths (the source's overlapping 2022 polygons are documented in #270).
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {prepareOfficialDumboRoadbed} from './dumbo-roadbed-metric.mjs';
import {reconcileMetricStreets} from './dumbo-cscl-metric-reconcile.mjs';

const xyCross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-
  (b[1]-a[1])*(c[0]-a[0]);
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
const round=n=>+n.toFixed(4);
const finitePair=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
export function clipStreetToSourceTriangle(start,end,triangle){
  if(!finitePair(start)||!finitePair(end)||
     !Array.isArray(triangle)||triangle.length!==3||
     !triangle.every(finitePair))throw Error('Invalid metric triangle or centerline');
  const orient=Math.sign(xyCross(...triangle));
  if(!orient)return null;
  let lo=0,hi=1;
  for(let i=0;i<3;i++){
    const a=triangle[i],b=triangle[(i+1)%3];
    const begin=orient*xyCross(a,b,start);
    const finish=orient*xyCross(a,b,end);
    if(begin< -1e-8&&finish< -1e-8)return null;
    if(begin>=-1e-8&&finish>=-1e-8)continue;
    const t=limit(begin/(begin-finish),0,1);
    if(begin<0)lo=Math.max(lo,t);
    else hi=Math.min(hi,t);
    if(hi-lo<=1e-12)return null;
  }
  return hi-lo>1e-12?[lo,hi]:null;
}
export function mergeCoveredIntervals(intervals){
  const sorted=intervals.filter(x=>Array.isArray(x)&&x.length===2&&
    x.every(Number.isFinite)&&x[0]<=x[1])
    .sort((a,b)=>a[0]-b[0]);
  const out=[];
  for(const [a,b] of sorted){
    if(!out.length||a>out.at(-1)[1]+1e-9)out.push([a,b]);
    else out.at(-1)[1]=Math.max(out.at(-1)[1],b);
  }
  return out;
}
export function coveredStreetMetres(segment,roadbedTriangles){
  if(!Array.isArray(segment)||segment.length!==2||
     !segment.every(finitePair)||!Array.isArray(roadbedTriangles))
    throw Error('Invalid source street or official pavement triangles');
  const [a,b]=segment,len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(len<=1e-9)return {lineMetres:0,pavedMetres:0,
    uncoveredMetres:0,triangleIntersections:0};
  const bounds=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),
    Math.max(a[0],b[0]),Math.max(a[1],b[1])];
  const sections=[];let triangleIntersections=0;
  for(const row of roadbedTriangles){
    if(!row||!Array.isArray(row.points)||row.points.length!==3)
      throw Error('Expected official source roadbed triangle');
    const v=row.points;
    const xmin=Math.min(v[0][0],v[1][0],v[2][0]);
    const ymin=Math.min(v[0][1],v[1][1],v[2][1]);
    const xmax=Math.max(v[0][0],v[1][0],v[2][0]);
    const ymax=Math.max(v[0][1],v[1][1],v[2][1]);
    if(xmax<bounds[0]||xmin>bounds[2]||
       ymax<bounds[1]||ymin>bounds[3])continue;
    const clip=clipStreetToSourceTriangle(a,b,v);
    if(clip){sections.push(clip);triangleIntersections++;}
  }
  const covered=mergeCoveredIntervals(sections);
  const portion=limit(covered.reduce((s,[lo,hi])=>s+hi-lo,0),0,1);
  return {lineMetres:len,pavedMetres:len*portion,
    uncoveredMetres:len*(1-portion),triangleIntersections};
}
export function auditDumboStreetPavement(network,roadbed){
  if(network?.sourceCount!==404||network.segmentCount!==295||
     roadbed?.year!==2022||roadbed?.stats?.renderedTriangles!==553)
    throw Error('NYC DUMBO source sample or vintage changed: review before reuse');
  const byStreet=new Map();const byPhysicalId=new Map();
  let totalLineMetres=0,totalPavedMetres=0;
  const crossingSamples=[];
  for(const row of network.lines){
    const x=coveredStreetMetres(row.points,roadbed.triangles);
    if(Math.abs(x.lineMetres-row.lengthMetres)>1e-5)
      throw Error('Official CSCL source geometry lengths disagree');
    totalLineMetres+=x.lineMetres;totalPavedMetres+=x.pavedMetres;
    for(const [key,map] of [[row.name,byStreet],[row.physicalid,byPhysicalId]]){
      const prior=map.get(key)||{name:row.name,physicalid:row.physicalid,
        lineMetres:0,pavedMetres:0,uncoveredMetres:0,segments:0};
      prior.lineMetres+=x.lineMetres;
      prior.pavedMetres+=x.pavedMetres;
      prior.uncoveredMetres+=x.uncoveredMetres;
      prior.segments++;
      map.set(key,prior);
    }
    if(row.conflictFids.length)crossingSamples.push({
      physicalid:row.physicalid,streetName:row.name,
      buildingFids:row.conflictFids,sourceLineMetres:round(x.lineMetres),
      in2022RoadbedMetres:round(x.pavedMetres),
      roadbedCoveragePercent:round(x.pavedMetres/x.lineMetres*100)
    });
  }
  const roundedRow=x=>({
    ...x,lineMetres:round(x.lineMetres),pavedMetres:round(x.pavedMetres),
    uncoveredMetres:round(x.uncoveredMetres),
    roadbedCoveragePercent:round(x.lineMetres>0?100*x.pavedMetres/x.lineMetres:0)
  });
  if(crossingSamples.length!==4)
    throw Error('Expected exactly four preexisting CSCL/OTI footprint disagreements');
  return {
    schema:'patrol-nyc-dumbo-cscl-oti-2022-pavement-coverage-v1',
    role:'SOURCE_ONLY_DIAGNOSTIC_NOT_NAVIGABLE_OR_2026_AS_BUILT',
    yearPavement:2022,datasetCenterline:'NYC OTI CSCL inkn-q76z',
    roads:network.segmentCount,pavementTriangles:roadbed.stats.renderedTriangles,
    fullSourceLineMetres:round(totalLineMetres),
    withinHistoricalRoadbedMetres:round(totalPavedMetres),
    historicalRoadbedCoveragePercent:round(totalPavedMetres/totalLineMetres*100),
    outside2022SourcePavementMetres:round(totalLineMetres-totalPavedMetres),
    crossingSamples,
    byStreet:[...byStreet.values()].map(roundedRow)
      .sort((a,b)=>a.name.localeCompare(b.name)),
    byPhysicalId:[...byPhysicalId.values()].map(roundedRow)
      .sort((a,b)=>a.physicalid-b.physicalid),
    caution:'Limited Front/Dock 2022 pavement AOI; this does not establish real 2026 lane use, 3D bridge elevation, vehicle legality or true present-day street widths.'
  };
}
export function run(){
  const json=file=>JSON.parse(readFileSync(file,'utf8'));
  const cscl=json('assets/nyc/dumbo-cscl-official-snapshot.json');
  const bldg=json('assets/nyc/dumbo-oti-metric-48.json');
  const pavement=json('assets/nyc/dumbo-front-dock-roadbed-2022.json');
  const network=reconcileMetricStreets(cscl,bldg);
  const roadbed=prepareOfficialDumboRoadbed(pavement);
  const report=auditDumboStreetPavement(network,roadbed);
  mkdirSync('artifacts/nyc-dumbo-metric',{recursive:true});
  writeFileSync('artifacts/nyc-dumbo-metric/cscl-roadbed-source-coverage.json',
    JSON.stringify(report,null,2));
  console.log(JSON.stringify({
    passed:true,roadSegments:report.roads,
    fullSourceLineMetres:report.fullSourceLineMetres,
    withinHistoricalRoadbedMetres:report.withinHistoricalRoadbedMetres,
    historicalRoadbedCoveragePercent:report.historicalRoadbedCoveragePercent,
    conflictSamples:report.crossingSamples
  },null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  run();
