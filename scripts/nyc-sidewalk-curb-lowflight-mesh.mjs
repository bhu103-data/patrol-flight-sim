/**
 * Source-only 1:1 metre street-edge geometry for the latest #234 low-flight viewer.
 * JSON is consumed only when ?realEdges=1 is explicitly selected.
 * No HTML string substitutions, no guessed curb height or gameplay collision.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export function verifySourceFrames(edgeData,roadData){
  if(edgeData?.schema!=='patrol-nyc-oti-sidewalk-curb-metre-source-v1'||
     roadData?.schema!=='patrol-nyc-lowflight-oti-roadbed-metre-v1'||
     roadData?.mode!=='SOURCE_VERIFIED_NO_DEFAULT_GAME_CHANGE'||
     JSON.stringify(edgeData.projection)!==JSON.stringify(roadData.projection))
    throw Error('Official curb/sidewalk and flight roadbed do not share exact metre projection');
  return true;
}
export async function buildStreetEdgeMesh(edgeData,roadData){
  verifySourceFrames(edgeData,roadData);
  // The general PATROL Node test job runs without npm dependencies.
  // Earcut is needed only to create real polygon geometry in dedicated CI.
  const {default:earcut,deviation}=await import('earcut');
  const triangles=[],lineSegments=[];
  let rings=0,polygons=0,degenerate=0;
  for(const feature of edgeData.sidewalks)for(const ringsData of feature.polygons){
    const points=[],holes=[];let n=0;
    for(const [index,raw] of ringsData.entries()){
      if(index)holes.push(n);
      const ring=raw.slice(0,-1);
      if(ring.length<3)throw Error('Invalid source sidewalk ring '+feature.objectId);
      for(const [east,north] of ring){
        if(!Number.isFinite(east)||!Number.isFinite(north)||
           Math.abs(east)>10000||Math.abs(north)>10000)
          throw Error('Invalid NYC source sidewalk metre coordinate');
        points.push(east,north);n++;
      }
      rings++;
    }
    const indices=earcut(points,holes,2);
    const error=deviation(points,holes,2,indices);
    if(indices.length<3||indices.length%3||!Number.isFinite(error)||error>.0005)
      throw Error('Source sidewalk polygon topology lost: '+feature.objectId+' '+error);
    for(let k=0;k<indices.length;k+=3){
      const v=indices.slice(k,k+3).map(i=>[points[2*i],points[2*i+1]]);
      const area=Math.abs((v[1][0]-v[0][0])*(v[2][1]-v[0][1])-
        (v[1][1]-v[0][1])*(v[2][0]-v[0][0]))*.5;
      if(area<1e-7){degenerate++;continue;}
      triangles.push({id:feature.objectId,subtype:feature.subtype,vertices:v});
    }
    polygons++;
  }
  for(const [kind,features] of [['curb',edgeData.curbs],['curbCut',edgeData.curbCuts]]){
    for(const feature of features){
      for(const part of feature.parts)for(let k=1;k<part.length;k++){
        const a=part[k-1],b=part[k];
        if(a.length!==2||b.length!==2||!a.concat(b).every(Number.isFinite))
          throw Error('Invalid 2D NYC source curb line '+feature.objectId);
        if(Math.hypot(a[0]-b[0],a[1]-b[1])<.001)continue;
        lineSegments.push({kind,id:feature.objectId,subtype:feature.subtype,a,b});
      }
    }
  }
  if(polygons<25||triangles.length<1000||lineSegments.length<1000)
    throw Error('Missing true-source sidewalk / curb coverage');
  return {
    schema:'patrol-nyc-lowflight-street-edge-metre-v1',
    mode:'OPT_IN_QA_NOT_DEFAULT_MAP',
    sourceYear:2022,projection:edgeData.projection,
    note:'2-D planimetrics. QA-only render offsets prevent coplanar flicker. No height, accessible ramp grade or collision is asserted.',
    counts:{sidewalkFeatures:edgeData.counts.sidewalkFeatures,
      sidewalkPolygons:polygons,sidewalkRings:rings,
      sidewalkTriangles:triangles.length,degenerateTriangles:degenerate,
      curbFeatures:edgeData.counts.curbFeatures,
      curbCuts:edgeData.counts.curbCuts,
      curbSegments:lineSegments.filter(x=>x.kind==='curb').length,
      curbCutSegments:lineSegments.filter(x=>x.kind==='curbCut').length},
    triangles,lineSegments
  };
}
export async function run(){
  const edges=JSON.parse(readFileSync('artifacts/nyc-curb-sidewalk-source/edges.json','utf8'));
  const road=JSON.parse(readFileSync('artifacts/nyc-true-scale/roadbed-mesh.json','utf8'));
  const output=await buildStreetEdgeMesh(edges,road);
  writeFileSync('artifacts/nyc-true-scale/edge-mesh.json',JSON.stringify(output));
  writeFileSync('artifacts/nyc-curb-sidewalk-source/edge-mesh.json',JSON.stringify(output));
  console.log('NYC real sidewalk and curb lowflight overlay',JSON.stringify(output.counts));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  run().catch(error=>{console.error(error);process.exitCode=1;});
