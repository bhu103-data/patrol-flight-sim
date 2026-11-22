/**
 * Source-only geographic QA for Broadway DCM centreline fragments that do
 * not lie inside official NYC OTI 2022 ROADBED/PLAZA/SIDEWALK polygons.
 * Do not turn these centreline segments into traffic or pedestrian routes.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {pointInPolygons} from './nyc-times-pedestrian-topology-audit.mjs';
import {metresPerDegree} from './nyc-times-true-scale-pilot.mjs';

const EPS=1e-9;
const cross=(ax,ay,bx,by)=>ax*by-ay*bx;
const same=(a,b)=>Math.abs(a-b)<=1e-8;
const rounded=(x,n=3)=>+x.toFixed(n);
const interpolate=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];

function assertSameSourceOrigin(source,roadbed,pedestrian){
  const o=source?.projection?.originLonLat;
  if(!Array.isArray(o)||o.length!==2||!o.every(Number.isFinite)||
     roadbed?.projection?.originLonLat?.join(',')!==o.join(',')||
     pedestrian?.projection?.originLonLat?.join(',')!==o.join(','))
    throw Error('Official Broadway source projections differ');
  if(!Array.isArray(source.roads)||!Array.isArray(roadbed.roadbeds)||
     !Array.isArray(pedestrian.plaza)||!Array.isArray(pedestrian.sidewalk))
    throw Error('Missing official road / pavement / plaza / sidewalk source');
  return o;
}
function wgs84(point,origin){
  const [east,north]=metresPerDegree(origin[1]);
  return [rounded(origin[0]+point[0]/east,7),
          rounded(origin[1]+point[1]/north,7)];
}
// Intersect the ACTUAL segment with polygon rings, preserving holes and
// collinear boundary endpoints. Do not buffer centerlines into fake roads.
export function sourceSurfaceIntervals(a,b,classes){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||
     ![...a,...b].every(Number.isFinite))throw Error('Invalid local-metre source segment');
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(len<1e-6)return [];
  const cuts=[0,1];
  for(const features of Object.values(classes)){
    for(const feature of features){
      for(const polygon of feature.polygons){
        for(const ring of polygon){
          for(let j=1;j<ring.length;j++){
            const c=ring[j-1],d=ring[j],sx=d[0]-c[0],sy=d[1]-c[1];
            const cx=c[0]-a[0],cy=c[1]-a[1],den=cross(dx,dy,sx,sy);
            if(Math.abs(den)<EPS){
              // A shared collinear boundary still splits geometry at both
              // endpoints; its legal drivable classification remains unknown.
              if(Math.abs(cross(cx,cy,dx,dy))<EPS){
                const mag=dx*dx+dy*dy;
                cuts.push(Math.max(0,Math.min(1,(cx*dx+cy*dy)/mag)));
                cuts.push(Math.max(0,Math.min(1,((d[0]-a[0])*dx+
                  (d[1]-a[1])*dy)/mag)));
              }
              continue;
            }
            const t=cross(cx,cy,sx,sy)/den;
            const u=cross(cx,cy,dx,dy)/den;
            if(t>EPS&&t<1-EPS&&u>=-EPS&&u<=1+EPS)cuts.push(t);
          }
        }
      }
    }
  }
  cuts.sort((x,y)=>x-y);
  const unique=cuts.filter((t,i)=>i===0||!same(t,cuts[i-1]));
  const result=[];
  for(let i=1;i<unique.length;i++){
    const t0=unique[i-1],t1=unique[i],lengthMeters=(t1-t0)*len;
    if(lengthMeters<1e-5)continue;
    const mid=interpolate(a,b,(t0+t1)/2);
    const surfaceClasses=Object.entries(classes)
      .filter(([,features])=>pointInPolygons(mid,features))
      .map(([name])=>name);
    const classification=surfaceClasses.length===0?'unmapped':
      surfaceClasses.length===1?surfaceClasses[0]:'overlap';
    result.push({start:interpolate(a,b,t0),end:interpolate(a,b,t1),
      lengthMeters,surfaceClasses,classification});
  }
  return result;
}
export function broadwaySurfaceGaps(source,roadbed,pedestrian){
  const origin=assertSameSourceOrigin(source,roadbed,pedestrian);
  const classes={roadbed:roadbed.roadbeds,plaza:pedestrian.plaza,
    sidewalk:pedestrian.sidewalk};
  const totals={centrelineMeters:0,roadbedMeters:0,plazaMeters:0,
    sidewalkMeters:0,unmappedMeters:0,overlapMeters:0};
  const intervals=[];let sourceSegmentCount=0;
  for(const road of source.roads){
    if(road.streetName!=='Broadway')continue;
    if(!Number.isSafeInteger(road.objectId))throw Error('Missing DCM OBJECTID');
    for(let lineIndex=0;lineIndex<road.lines.length;lineIndex++){
      const line=road.lines[lineIndex];
      for(let segmentIndex=1;segmentIndex<line.length;segmentIndex++){
        const parts=sourceSurfaceIntervals(line[segmentIndex-1],
          line[segmentIndex],classes);
        sourceSegmentCount++;
        for(const part of parts){
          totals.centrelineMeters+=part.lengthMeters;
          const key=part.classification+'Meters';
          totals[key]+=part.lengthMeters;
          if(part.classification==='roadbed')continue;
          intervals.push({
            dcmObjectId:road.objectId,streetName:'Broadway',
            lineIndex,segmentIndex:segmentIndex-1,
            classification:part.classification,
            surfaceClasses:part.surfaceClasses,
            lengthMeters:rounded(part.lengthMeters),
            fromLocalMeters:part.start.map(v=>rounded(v)),
            toLocalMeters:part.end.map(v=>rounded(v)),
            fromWgs84:wgs84(part.start,origin),
            toWgs84:wgs84(part.end,origin)
          });
        }
      }
    }
  }
  if(sourceSegmentCount<2||totals.centrelineMeters<100)
    throw Error('Missing official Broadway DCM centerline geometry');
  if(Object.values(totals).some(v=>!Number.isFinite(v)))
    throw Error('Nonfinite classified Broadway distance');
  return {
    schema:'patrol-nyc-broadway-surface-gaps-v1',
    sourceVintage:'OTI 2022 planimetrics; DCM extracted at build time',
    role:'GEOGRAPHIC_QA_ONLY_NO_AUTO_VEHICLE_ROUTING',
    originWgs84:origin,sourceSegmentCount,
    totals:Object.fromEntries(Object.entries(totals).map(([k,v])=>
      [k,rounded(v)])),
    reviewIntervals:intervals.sort((a,b)=>
      (a.classification==='unmapped'?0:1)-
      (b.classification==='unmapped'?0:1)||b.lengthMeters-a.lengthMeters),
    caution:'DCM centerlines are not vehicle lanes; mapped 2022 plaza/sidewalk/unmapped segments do not establish 2026 access rights.'
  };
}
export function broadwayGapGeoJson(report){
  return {type:'FeatureCollection',
    name:'PATROL Broadway source-only surface review',
    properties:{role:report.role,vintage:report.sourceVintage},
    features:report.reviewIntervals.map((p,i)=>({
      type:'Feature',id:i+1,properties:{
        dcmObjectId:p.dcmObjectId,classification:p.classification,
        sourceYear:2022,lengthMeters:p.lengthMeters,
        sourceRole:'QA_ONLY_NOT_DRIVABLE'
      },geometry:{type:'LineString',coordinates:[
        p.fromWgs84,p.toWgs84
      ]}}))
  };
}
export function run(){
  const ref=JSON.parse(readFileSync('artifacts/nyc-true-scale/source.json','utf8'));
  const bed=JSON.parse(readFileSync('artifacts/nyc-roadbed-source/roadbed.json','utf8'));
  const ped=JSON.parse(readFileSync(
    'artifacts/nyc-oti-pedestrian-source/pedestrian-surfaces.json','utf8'));
  const base=JSON.parse(readFileSync(
    'artifacts/nyc-oti-pedestrian-source/centreline-surface-topology.json','utf8'));
  const report=broadwaySurfaceGaps(ref,bed,ped);
  const actual=report.totals;
  const broadway=base.byStreet.find(x=>x.streetName==='Broadway');
  if(!broadway||Math.abs(actual.centrelineMeters-broadway.centrelineMetres)>.02||
    Math.abs(actual.roadbedMeters-broadway.roadbedMetres)>.02||
    Math.abs(actual.plazaMeters-broadway.plazaMetres)>.02||
    Math.abs(actual.sidewalkMeters-broadway.sidewalkMetres)>.02)
    throw Error('Broadway source line-gap QA disagrees with original source topology');
  const prefix='artifacts/nyc-oti-pedestrian-source/';
  writeFileSync(prefix+'broadway-surface-gap-locations.json',
    JSON.stringify(report,null,2));
  writeFileSync(prefix+'broadway-surface-gap-locations.geojson',
    JSON.stringify(broadwayGapGeoJson(report),null,2));
  console.log(JSON.stringify({passed:true,totals:report.totals,
    needsReview:report.reviewIntervals.length,blockedAutoRouting:true}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  run();
