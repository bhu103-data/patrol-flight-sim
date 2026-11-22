/** Source-preserving NYC 2022 Roadbed/Sidewalk MultiPolygon *outline* pilot.
 * NOT roadbed polygon fill, current pavement texture, surveyed grade or a
 * collision/surface model. The source's holes remain holes (rings drawn).
 */
import {wgs84ToLocalMetres} from './nyc-metric-footprints.mjs';
const DATASETS=Object.freeze({
  roadbed:'NYC Planimetric Database: Roadbed',
  sidewalk:'NYC Planimetric Database: Sidewalk'
});
const COLORS={roadbed:[.98,.38,.68],sidewalk:[.36,.89,.41]};
const valid=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);

function geoBoundsMetres(b){
  if(!b||![b.west,b.east,b.south,b.north].every(Number.isFinite))
    throw Error('Bounding WGS84 query extent required');
  const coords=[
    [b.west,b.south],[b.west,b.north],
    [b.east,b.south],[b.east,b.north]
  ].map(wgs84ToLocalMetres);
  return [
    Math.min(...coords.map(v=>v[0])),Math.max(...coords.map(v=>v[0])),
    Math.min(...coords.map(v=>v[1])),Math.max(...coords.map(v=>v[1]))
  ];
}
/** Liang–Barsky for a bounded pilot: source vertices remain unmodified in
 * the downloaded source artifact. Only viewport visibility is clipped.
 */
export function clipSegment(a,b,[minX,maxX,minZ,maxZ]){
  let t0=0,t1=1;
  const dx=b[0]-a[0],dz=b[1]-a[1];
  const ps=[-dx,dx,-dz,dz];
  const qs=[a[0]-minX,maxX-a[0],a[1]-minZ,maxZ-a[1]];
  for(let i=0;i<4;i++){
    if(Math.abs(ps[i])<1e-10){
      if(qs[i]<0)return null;
      continue;
    }
    const t=qs[i]/ps[i];
    if(ps[i]<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);
    if(t0>t1)return null;
  }
  return [[a[0]+t0*dx,a[1]+t0*dz],
    [a[0]+t1*dx,a[1]+t1*dz]];
}
function add(out,p,y,color){
  out.push(p[0],y,p[1],0,1,0,...color);
}
export function buildMetricPlanimetricOutlines(snapshot,{type,maxEdges=100000}={}){
  if(!DATASETS[type]||snapshot?.sourceDataset!==DATASETS[type]||
     !Array.isArray(snapshot?.records))
    throw TypeError('Exact official NYC roadbed/sidewalk snapshot provenance required');
  const bbox=geoBoundsMetres(snapshot.boundsWGS84),colors=COLORS[type],out=[];
  let edges=0,metres=0,outers=0,holes=0,records=0,skipped=0;
  for(const feature of snapshot.records){
    if(!Array.isArray(feature.polygons)||!feature.polygons.length){
      skipped++;continue;
    }
    let used=false;
    for(const polygon of feature.polygons){
      if(!Array.isArray(polygon)||!polygon.length){skipped++;continue;}
      for(let ringIndex=0;ringIndex<polygon.length;ringIndex++){
        const ring=polygon[ringIndex];
        if(!Array.isArray(ring)||ring.length<4||ring.length>25000||
           !ring.every(pair=>Array.isArray(pair)&&
             pair.length===2&&Number.isFinite(pair[0])&&Number.isFinite(pair[1]))){
          skipped++;continue;
        }
        const xy=ring.map(p=>wgs84ToLocalMetres(p));
        if(!xy.every(valid)){skipped++;continue;}
        if(ringIndex===0)outers++;else holes++;
        for(let i=1;i<xy.length;i++){
          const result=clipSegment(xy[i-1],xy[i],bbox);
          if(!result)continue;
          const [a,b]=result;
          const length=Math.hypot(a[0]-b[0],a[1]-b[1]);
          if(length<.025)continue;
          if(++edges>maxEdges)throw Error('Bounded planimetric outline edge budget exceeded');
          add(out,a,type==='roadbed'?.42:.48,colors);
          add(out,b,type==='roadbed'?.42:.48,colors);
          metres+=length;used=true;
        }
      }
    }
    if(used)records++;
  }
  if(!records||!edges)throw Error('No visible genuine planimetric edges from official source');
  return {vertexBuffer:new Float32Array(out),
    stats:{dataset:snapshot.sourceDataset,records,outerRings:outers,
      innerRings:holes,visibleEdges:edges,
      visibleOutlineLengthMetres:Math.round(metres*100)/100,
      historicSource:true,pavementFill:false,sourceHolesPreserved:true,
      drawnRoadWidths:false,collidersUnchanged:true},
    sourceRejected:snapshot.rejections?.length??0,skipped};
}
