/**
 * Exact source polygons for the existing 1:1 DCM/footprint low-flight viewer.
 * Shares the official 2022 OTI JSON and WGS84 metre frame from PR #244.
 * QA artifact only: no additions to production game / flight engine / main.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export async function build(){
  const {default:earcut,deviation}=await import('earcut');
  const source=JSON.parse(readFileSync('artifacts/nyc-true-scale/source.json','utf8'));
  const road=JSON.parse(readFileSync('artifacts/nyc-roadbed-source/roadbed.json','utf8'));
  if(source.schema!=='patrol-nyc-times-square-metre-source-pilot-v1'||
     road.schema!=='patrol-nyc-oti-roadbed-planimetric-2022-v1'||
     source.projection?.scaleMetresPerGameUnit!==null||
     JSON.stringify(source.projection)!==JSON.stringify(road.projection))
    throw Error('Cannot combine mismatched 1:1 official building and roadbed coordinate frames');
  if(road.referenceImageryYear!==2022||
     !road.source?.includes('Roadbed_2022/FeatureServer/20')||
     !Array.isArray(road.roadbeds)||road.roadbeds.length<70)
    throw Error('Official OTI Roadbed 2022 provenance/coverage missing');
  const positions=[],subtypes=[],ids=[],seen=new Set();
  let polys=0,rings=0,degenerate=0;
  for(const feature of road.roadbeds){
    if(!Number.isSafeInteger(feature.objectId)||seen.has(feature.objectId)||
       !Array.isArray(feature.polygons))throw Error('Invalid or duplicate official road polygon ID');
    seen.add(feature.objectId);
    for(const poly of feature.polygons){
      const xy=[],holes=[];let n=0;
      if(!Array.isArray(poly)||!poly.length)throw Error('Missing official road polygon rings');
      for(let i=0;i<poly.length;i++){
        const sourceRing=poly[i];
        if(!Array.isArray(sourceRing)||sourceRing.length<4)
          throw Error('Missing official road ring vertices');
        const ring=sourceRing.slice(0,-1);
        if(i)holes.push(n);
        for(const point of ring){
          if(!Array.isArray(point)||point.length!==2||
             !point.every(v=>Number.isFinite(v)&&Math.abs(v)<10000))
            throw Error('Invalid roadbed vertex');
          xy.push(point[0],point[1]);n++;
        }
        rings++;
      }
      const indices=earcut(xy,holes,2);
      if(indices.length<3||indices.length%3||
         !Number.isFinite(deviation(xy,holes,2,indices))||
         deviation(xy,holes,2,indices)>0.0005)
        throw Error('Official road geometry triangulation error or filled interior hole');
      for(let i=0;i<indices.length;i+=3){
        const pts=indices.slice(i,i+3).map(k=>[xy[2*k],xy[2*k+1]]);
        const area=Math.abs((pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-
          (pts[1][1]-pts[0][1])*(pts[2][0]-pts[0][0]))*.5;
        if(area<1e-7){degenerate++;continue;}
        for(const [east,north] of pts)positions.push(east,0.06,north);
        subtypes.push(feature.subtype);
        ids.push(feature.objectId);
      }
      polys++;
    }
  }
  if(polys<70||positions.length/9<7000||positions.length/9>30000)
    throw Error('Authentic road surface geometry coverage/budget out of range');
  const payload={schema:'patrol-nyc-lowflight-oti-roadbed-metre-v1',
    mode:'SOURCE_VERIFIED_NO_DEFAULT_GAME_CHANGE',
    source:road.source,year:2022,projection:road.projection,
    disclaimer:'True 2022 source pavement polygon outlines; no 2026 lanes, curbs, heights or verified road clearance',
    counts:{features:road.roadbeds.length,polygons:polys,rings,
      triangles:positions.length/9,degenerate},positions,subtypes,ids};
  mkdirSync('artifacts/nyc-true-scale',{recursive:true});
  writeFileSync('artifacts/nyc-true-scale/roadbed-mesh.json',JSON.stringify(payload));
  console.log('[NYC ROADBED LOWFLIGHT]',JSON.stringify(payload.counts));
  return payload.counts;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  build().catch(e=>{console.error(e);process.exitCode=1;});
