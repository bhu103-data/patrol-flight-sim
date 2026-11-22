/**
 * Data-only polygon/line topology check in shared metre coordinates.
 * A DCM CENTERLINE must never be treated as vehicle-drivable merely
 * because it exists; portions outside 2022 ROADBED may lie in PLAZA.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ORIGIN,metresPerDegree} from './nyc-times-true-scale-pilot.mjs';

const EPS=1e-9;
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
function pointInRing(p,ring){
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&
       p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
export function pointInPolygons(p,features){
  for(const feature of features){
    for(const rings of feature.polygons){
      if(pointInRing(p,rings[0])&&
        !rings.slice(1).some(r=>pointInRing(p,r)))return true;
    }
  }
  return false;
}
// Cut a metric segment at every source polygon edge crossing; classify each
// sub-interval by point containment. Handles concavity, holes and crossings,
// rather than guessing road widths or raster point sampling.
export function coveredLength(a,b,features){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(!Number.isFinite(len))throw Error('Nonfinite source segment');
  if(len<.000001)return 0;
  const cuts=[0,1];
  for(const feature of features){
    for(const rings of feature.polygons){
      for(const ring of rings){
        for(let i=0;i<ring.length-1;i++){
          const c=ring[i],d=ring[i+1],sx=d[0]-c[0],sy=d[1]-c[1];
          const den=cross([dx,dy],[sx,sy]);
          if(Math.abs(den)<EPS)continue;
          const q=[c[0]-a[0],c[1]-a[1]];
          const t=cross(q,[sx,sy])/den,u=cross(q,[dx,dy])/den;
          if(t>EPS&&t<1-EPS&&u>=-EPS&&u<=1+EPS)cuts.push(t);
        }
      }
    }
  }
  cuts.sort((x,y)=>x-y);
  let inside=0;
  for(let i=1;i<cuts.length;i++){
    const from=cuts[i-1],to=cuts[i];
    if(to-from<1e-10)continue;
    const mid=(from+to)/2;
    if(pointInPolygons([a[0]+mid*dx,a[1]+mid*dy],features))
      inside+=(to-from)*len;
  }
  return inside;
}
// Return the exact portions of a measured source polyline outside the UNION
// of official roadbed/plaza surfaces. Keep endpoint/length evidence rather
// than classifying a whole street with a single painted centerline.
export function outsideSourceIntervals(a,b,features){
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(!Number.isFinite(len))throw Error('Nonfinite source segment');
  if(len<.000001)return [];
  const cuts=[0,1];
  for(const feature of features){
    for(const rings of feature.polygons){
      for(const ring of rings){
        for(let i=0;i<ring.length-1;i++){
          const c=ring[i],d=ring[i+1],sx=d[0]-c[0],sy=d[1]-c[1];
          const den=cross([dx,dy],[sx,sy]);
          if(Math.abs(den)<EPS)continue;
          const q=[c[0]-a[0],c[1]-a[1]];
          const t=cross(q,[sx,sy])/den,u=cross(q,[dx,dy])/den;
          if(t>EPS&&t<1-EPS&&u>=-EPS&&u<=1+EPS)cuts.push(t);
        }
      }
    }
  }
  cuts.sort((x,y)=>x-y);
  const gaps=[];
  for(let i=1;i<cuts.length;i++){
    const lo=cuts[i-1],hi=cuts[i],delta=hi-lo;
    if(delta<1e-10)continue;
    const mid=(lo+hi)/2;
    if(pointInPolygons([a[0]+mid*dx,a[1]+mid*dy],features))continue;
    gaps.push({
      startMeters:[a[0]+lo*dx,a[1]+lo*dy],
      endMeters:[a[0]+hi*dx,a[1]+hi*dy],
      lengthMeters:delta*len
    });
  }
  return gaps;
}
function approximateSourceWGS84(p){
  const scale=metresPerDegree(ORIGIN[1]);
  return [+((ORIGIN[0]+p[0]/scale[0]).toFixed(7)),
    +((ORIGIN[1]+p[1]/scale[1]).toFixed(7))];
}
export function classifyCenterlines(source,roadbed,pedestrian){
  if(source?.projection?.originLonLat?.join(',')!==
     roadbed?.projection?.originLonLat?.join(',')||
     source?.projection?.originLonLat?.join(',')!==
     pedestrian?.projection?.originLonLat?.join(','))
    throw Error('Mapped official datasets have incompatible CRS origins');
  const named=new Map(),uncoveredBroadway=[];
  const typed={
    roadbed:roadbed.roadbeds,
    plaza:pedestrian.plaza,
    sidewalk:pedestrian.sidewalk,
    roadbedOrPlaza:[...roadbed.roadbeds,...pedestrian.plaza]
  };
  let all={segmentCount:0,centrelineMetres:0,roadbedMetres:0,
    plazaMetres:0,sidewalkMetres:0,roadbedOrPlazaMetres:0};
  for(const street of source.roads){
    const name=street.streetName||'UNNAMED';
    const row=named.get(name)||{streetName:name,segmentCount:0,
      centrelineMetres:0,roadbedMetres:0,plazaMetres:0,sidewalkMetres:0,
      roadbedOrPlazaMetres:0};
    for(const [lineIndex,line] of street.lines.entries()){
      for(let i=1;i<line.length;i++){
        const a=line[i-1],b=line[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(len<.000001)continue;
        const parts={
          centrelineMetres:len,
          roadbedMetres:coveredLength(a,b,typed.roadbed),
          plazaMetres:coveredLength(a,b,typed.plaza),
          sidewalkMetres:coveredLength(a,b,typed.sidewalk),
          roadbedOrPlazaMetres:coveredLength(a,b,typed.roadbedOrPlaza)
        };
        for(const k of Object.keys(parts)){row[k]+=parts[k];all[k]+=parts[k];}
        if(/broadway/i.test(name)){
          for(const gap of outsideSourceIntervals(a,b,typed.roadbedOrPlaza)){
            const sidewalkCoveredMeters=coveredLength(
              gap.startMeters,gap.endMeters,typed.sidewalk);
            uncoveredBroadway.push({
              streetName:name,objectId:street.objectId??null,
              lineIndex,segmentIndex:i-1,
              ...gap,sidewalkCoveredMeters,
              startApproxWGS84:approximateSourceWGS84(gap.startMeters),
              endApproxWGS84:approximateSourceWGS84(gap.endMeters)
            });
          }
        }
        row.segmentCount++;all.segmentCount++;
      }
    }
    named.set(name,row);
  }
  if(all.segmentCount<5||all.centrelineMetres<500)
    throw Error('Official DCM road geometry missing');
  const percent=v=>Number((v*100).toFixed(2));
  const addRatios=row=>({...row,
    roadbedPercent:percent(row.roadbedMetres/row.centrelineMetres),
    roadbedOrPlazaPercent:
      percent(row.roadbedOrPlazaMetres/row.centrelineMetres)});
  return {
    total:addRatios(all),
    byStreet:[...named.values()].map(addRatios)
      .sort((a,b)=>a.roadbedPercent-b.roadbedPercent),
    blockedAutomatedRouting:true,
    broadwayUncovered:{
      lengthMeters:uncoveredBroadway.reduce((n,x)=>n+x.lengthMeters,0),
      portions:uncoveredBroadway.sort((a,b)=>b.lengthMeters-a.lengthMeters),
      positions:'source local east/north metres; approximate inverse WGS84 positions for review only',
      access:'UNKNOWN — neither 2022 roadbed nor 2022 plaza proves current route permission'
    },
    note:'Centerline vs official 2022 mapped surface QA, NOT vehicle access rights, plaza opening, sidewalk walkability or current traffic directions'
  };
}
export async function run(){
  const source=JSON.parse(readFileSync('artifacts/nyc-true-scale/source.json','utf8'));
  const roadbed=JSON.parse(readFileSync('artifacts/nyc-roadbed-source/roadbed.json','utf8'));
  const pedestrian=JSON.parse(readFileSync(
    'artifacts/nyc-oti-pedestrian-source/pedestrian-surfaces.json','utf8'));
  const audit=classifyCenterlines(source,roadbed,pedestrian);
  const output='artifacts/nyc-oti-pedestrian-source';
  mkdirSync(output,{recursive:true});
  writeFileSync(output+'/centreline-surface-topology.json',
    JSON.stringify(audit,null,2));
  // Red strokes locate unresolved official 2022 centerline segments in the
  // SAME source metre CRS. They do NOT mean roads closed or open in 2026.
  const plan=readFileSync(output+'/pedestrian-roadbed-overlay.svg','utf8');
  const gaps=audit.broadwayUncovered.portions
    .filter(g=>g.lengthMeters>=.05).map(g=>'<line class="unclassified-broadway" '+
      'x1="'+g.startMeters[0].toFixed(3)+'" y1="'+(-g.startMeters[1]).toFixed(3)+'" '+
      'x2="'+g.endMeters[0].toFixed(3)+'" y2="'+(-g.endMeters[1]).toFixed(3)+'" '+
      'stroke="#ff5365" stroke-width="2.2" stroke-linecap="round"/>').join('');
  if(!plan.includes('</svg>')||!gaps)
    throw Error('Official Broadway source map or its nonroadbed portions missing');
  const note='<g id="broadway-unclassified-segments">'+gaps+'</g>';
  writeFileSync(output+'/broadway-unclassified-segments.svg',
    plan.replace('</svg>',note+'</svg>'));
  console.log(JSON.stringify({
    centrelineMetres:audit.total.centrelineMetres,
    roadbedPercent:audit.total.roadbedPercent,
    roadbedOrPlazaPercent:audit.total.roadbedOrPlazaPercent,
    Broadway:audit.byStreet.find(x=>x.streetName==='Broadway')||null,
    BroadwayUncovered:audit.broadwayUncovered.lengthMeters,
    BroadwayUncoveredPortions:audit.broadwayUncovered.portions.length,
    blockedAutomatedRouting:true
  },null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  run().catch(e=>{console.error(e);process.exitCode=1;});
