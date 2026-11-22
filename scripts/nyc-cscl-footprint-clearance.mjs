// SOURCE-QA ONLY: cross-check official NYC CSCL roadbed centerlines against
// official NYC Building Footprints in one East/North metre frame.
// Do not mistake a symmetric road-width buffer for true legal curbs,
// current bike/plaza infrastructure or a drivable road surface.
import {toLocalMeters} from '../assets/nyc/times-square-metric-massing.js';
const EPS=1e-9;
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const cross=(u,v)=>u[0]*v[1]-u[1]*v[0];
const dot=(u,v)=>u[0]*v[0]+u[1]*v[1];
const length=v=>Math.hypot(...v);
function inside(p,polygon){
  let hit=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&
      p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;
  }
  return hit;
}
function segmentCrossing(a,b,c,d){
  const r=sub(b,a),s=sub(d,c),den=cross(r,s);
  if(Math.abs(den)<EPS)return null;
  const v=sub(c,a),t=cross(v,s)/den,u=cross(v,r)/den;
  return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?
    Math.max(0,Math.min(1,t)):null;
}
function segmentInsideLength(a,b,polygon){
  const v=sub(b,a),len=length(v);
  if(len<EPS)return 0;
  const ts=[0,1];
  for(let i=0;i<polygon.length;i++){
    const t=segmentCrossing(a,b,polygon[i],polygon[(i+1)%polygon.length]);
    if(t!==null)ts.push(t);
  }
  ts.sort((x,y)=>x-y);
  let sum=0;
  for(let i=0;i<ts.length-1;i++){
    const delta=ts[i+1]-ts[i];if(delta<1e-8)continue;
    const t=(ts[i]+ts[i+1])*.5;
    if(inside([a[0]+v[0]*t,a[1]+v[1]*t],polygon))sum+=delta*len;
  }
  return sum;
}
const pointSegmentDistance=(p,a,b)=>{
  const v=sub(b,a),dd=dot(v,v);
  if(dd<EPS)return length(sub(p,a));
  const t=Math.max(0,Math.min(1,dot(sub(p,a),v)/dd));
  return Math.hypot(p[0]-a[0]-v[0]*t,p[1]-a[1]-v[1]*t);
};
function segmentDistance(a,b,c,d){
  if(segmentCrossing(a,b,c,d)!==null)return 0;
  return Math.min(
    pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),
    pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));
}
function sourceFootprints(source){
  const out=[];
  const unique=new Set();
  for(const f of source.features||[]){
    if(!Number.isSafeInteger(f.fid)||unique.has(f.fid))continue;
    unique.add(f.fid);
    // Do not silently fill multi-ring courtyards or holes.
    if(!Array.isArray(f.rings)||f.rings.length!==1||f.rings[0].length<4)
      continue;
    const poly=f.rings[0].map(p=>toLocalMeters(p[0],p[1]));
    if(length(sub(poly[0],poly.at(-1)))<.01)poly.pop();
    if(poly.length<3)continue;
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
    out.push({fid:f.fid,poly,
      bbox:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]});
  }
  return out;
}
export function auditRoadFootprintClearance(roadRecords,buildingSnapshot){
  if(!Array.isArray(roadRecords)||!Array.isArray(buildingSnapshot?.features))
    throw Error('Expected the frozen official building source and checked road list');
  const buildings=sourceFootprints(buildingSnapshot);
  const directVehicle=[],approxHalfWidth=[],nonVehicular=[];
  const vehicle=roadRecords.filter(r=>r.constructedVehicleCandidate);
  for(const road of roadRecords){
    if(!Array.isArray(road.lines)||!road.lines.length)continue;
    const motor=Boolean(road.constructedVehicleCandidate);
    const halfWidth=motor&&Number.isFinite(road.widthMeters)&&road.widthMeters>0?
      road.widthMeters*.5:0;
    for(const building of buildings){
      let insideMetres=0,gap=Infinity;
      const [xmin,ymin,xmax,ymax]=building.bbox;
      for(const line of road.lines)for(let i=1;i<line.length;i++){
        const a=line[i-1],b=line[i];
        if(!a?.every(Number.isFinite)||!b?.every(Number.isFinite))continue;
        if(Math.max(a[0],b[0])+halfWidth<xmin||
           Math.min(a[0],b[0])-halfWidth>xmax||
           Math.max(a[1],b[1])+halfWidth<ymin||
           Math.min(a[1],b[1])-halfWidth>ymax)continue;
        insideMetres+=segmentInsideLength(a,b,building.poly);
        if(motor&&halfWidth>0){
          for(let j=0;j<building.poly.length;j++){
            const c=building.poly[j],d=building.poly[(j+1)%building.poly.length];
            gap=Math.min(gap,segmentDistance(a,b,c,d));
          }
        }
      }
      if(insideMetres>.10){
        const issue={fid:building.fid,roadId:road.id,street:road.name,
          insideMetres:+insideMetres.toFixed(3),
          sourceType:road.roadwayType,sourceDirection:road.direction};
        (motor?directVehicle:nonVehicular).push(issue);
      }
      if(motor&&halfWidth>0&&Number.isFinite(gap)&&gap<halfWidth-.10)
        approxHalfWidth.push({fid:building.fid,roadId:road.id,street:road.name,
          measuredCenterlineToFacadeMetres:+gap.toFixed(3),
          assumedSymmetricHalfPavedWidthMetres:+halfWidth.toFixed(3)});
    }
  }
  return {
    buildingFootprintsChecked:buildings.length,
    motorizedCenterlinesChecked:vehicle.length,
    directVehicleIntrusions:directVehicle,
    possibleSymmetricPavedWidthIntrusions:approxHalfWidth,
    nonVehicularCenterlineOverlaps:nonVehicular,
    caveats:'Symmetric half-width envelope is a screening approximation, NOT verified curb/sidewalk polygon; no driving geometry generated.'
  };
}
