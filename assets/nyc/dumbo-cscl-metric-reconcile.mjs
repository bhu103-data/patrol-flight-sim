// Source disagreement audit: #266 official NYC OTI CSCL street lines,
// #243 48 NYC OTI roof footprint rings, #270 official 2022 OTI pavement.
// This module never adjusts any source vertex or claims surveyed road widths.
import {prepareDumboCsclStreetNetwork} from './dumbo-cscl-true-metre.js';
import {prepareDistrict,toLocalMeters} from './dumbo-oti-metric.mjs';

const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-
  (b[1]-a[1])*(p[0]-a[0]);
const bbox=poly=>[Math.min(...poly.map(p=>p[0])),
  Math.min(...poly.map(p=>p[1])),
  Math.max(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[1]))];
const bboxesOverlap=(a,b)=>a[0]<=b[2]&&b[0]<=a[2]&&
  a[1]<=b[3]&&b[1]<=a[3];

// A boundary contact is not automatically considered road/building overlap.
// Proper segment-edge crossings and strictly interior endpoints are flagged.
function pointInRing(p,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&
       p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])
      inside=!inside;
  }
  return inside;
}
function crossing(a,b,c,d){
  const x=cross(a,b,c),y=cross(a,b,d),u=cross(c,d,a),v=cross(c,d,b);
  return x*y < -1e-12&&u*v < -1e-12;
}
export function lineCutsBuilding(segment,ring){
  const [a,b]=segment;
  if(!bboxesOverlap(bbox(segment),bbox(ring)))return false;
  if(pointInRing(a,ring)||pointInRing(b,ring))return true;
  return ring.some((c,i)=>crossing(a,b,c,ring[(i+1)%ring.length]));
}

export function sourceLineRibbon(line,widthMetres=1.2){
  // Visible ONLY as a 1.2m diagnostic guide. Its width is not NYC pavement.
  if(!Number.isFinite(widthMetres)||widthMetres<=0||widthMetres>2)
    throw Error('Invalid symbolic centerline width');
  const [a,b]=line,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(len<.01)return [];
  const ox=-dz/len*widthMetres/2,oz=dx/len*widthMetres/2;
  const p=[a[0]+ox,a[1]+oz],q=[b[0]+ox,b[1]+oz],
    r=[b[0]-ox,b[1]-oz],s=[a[0]-ox,a[1]-oz];
  return [[p,q,r],[p,r,s]];
}
export function reconcileMetricStreets(csclSnapshot,buildingSnapshot){
  if(csclSnapshot?.dataset!=='inkn-q76z'||
     csclSnapshot?.acceptedRows!==404||
     csclSnapshot?.records?.length!==404)
    throw Error('NYC CSCL source snapshot does not match pinned #266');
  const frame={project:(lon,lat,y=0)=>{
    const [x,z]=toLocalMeters(lon,lat);
    return [x,y,z]; // original #266 parser accepts source frame injection
  }};
  const cscl=prepareDumboCsclStreetNetwork(csclSnapshot,frame);
  if(cscl.sourceCount!==404||cscl.acceptedSourceRecordCount!==213||
     cscl.segmentCount!==295||cscl.excludedSourceRecordCount!==191)
    throw Error('CSCL source selection drift or new roadway eligibility');
  const buildings=prepareDistrict(buildingSnapshot);
  if(buildings.length!==48)throw Error('OTI metric building sample drift');
  const polygons=buildings.map(b=>({...b,bounds:bbox(b.ring)}));
  const conflicts=[],traces=[];
  for(const row of cscl.groundCenterlines){
    const segment=row.metres.map(p=>[p[0],p[2]]);
    if(segment.some(p=>p.some(v=>!Number.isFinite(v))))
      throw Error('Invalid projected source CSCL geometry');
    const conflictFids=polygons
      .filter(b=>bboxesOverlap(bbox(segment),b.bounds)&&
        lineCutsBuilding(segment,b.ring)).map(b=>b.fid);
    if(conflictFids.length)
      conflicts.push({physicalid:row.physicalid,name:row.name,
        buildingFids:conflictFids});
    traces.push({...row,points:segment,conflictFids});
  }
  const names=[...new Set(traces.map(x=>x.name))].sort();
  return {
    source:'NYC OTI Centerline inkn-q76z',
    sourceCount:cscl.sourceCount,
    groundRecords:cscl.acceptedSourceRecordCount,
    excludedRecords:cscl.excludedSourceRecordCount,
    segmentCount:traces.length,
    streetNames:names,
    sourceBBox:cscl.bbox,
    networkLengthMetres:traces.reduce((s,t)=>s+t.lengthMetres,0),
    conflicts,lines:traces,
    limitations:'CSCL guides are not pavement/curb widths or confirmed 2026 lanes; 2022 roadbed is a smaller historical AOI. All data conflicts retained.'
  };
}
