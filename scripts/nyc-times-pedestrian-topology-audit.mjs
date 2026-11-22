/**
 * Data-only polygon/line topology check in shared metre coordinates.
 * A DCM CENTERLINE must never be treated as vehicle-drivable merely
 * because it exists; portions outside 2022 ROADBED may lie in PLAZA.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

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
export function classifyCenterlines(source,roadbed,pedestrian){
  if(source?.projection?.originLonLat?.join(',')!==
     roadbed?.projection?.originLonLat?.join(',')||
     source?.projection?.originLonLat?.join(',')!==
     pedestrian?.projection?.originLonLat?.join(','))
    throw Error('Mapped official datasets have incompatible CRS origins');
  const named=new Map();
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
    for(const line of street.lines){
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
  console.log(JSON.stringify({
    centrelineMetres:audit.total.centrelineMetres,
    roadbedPercent:audit.total.roadbedPercent,
    roadbedOrPlazaPercent:audit.total.roadbedOrPlazaPercent,
    Broadway:audit.byStreet.find(x=>x.streetName==='Broadway')||null,
    blockedAutomatedRouting:true
  },null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  run().catch(e=>{console.error(e);process.exitCode=1;});
