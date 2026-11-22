// Standalone metric WebGL roadbed mesh compiler. Reuses the *official*
// OTI 2022 polygon reader ported source-identically from reviewed PR #244.
// Earcut handles actual polygon holes. No fabricated centerline widths/lanes.
import earcut,{deviation} from 'earcut';
export const ROADBED_MESH_SCHEMA='patrol-oti-2022-roadbed-triangles-v1';
export function compileOfficialRoadbedMesh(source,buildings){
  if(source?.schema!=='patrol-nyc-oti-roadbed-planimetric-2022-v1'||
     source.role!=='SOURCE_GEOMETRY_REFERENCE_NOT_GAMEPLAY'||
     source.referenceImageryYear!==2022||
     !Array.isArray(source.roadbeds)||source.roadbeds.length<50)
    throw Error('Expected verified official NYC OTI 2022 roadbed polygons');
  if(!Array.isArray(buildings)||buildings.length<100)
    throw Error('Source-matched building footprint inventory required');
  const packed=[],data=[],countBySubtype={},sourceIds=new Set();
  let triangles=0,skippedDegenerate=0,polygons=0,ringsCount=0,skippedSourceHoles=0;
  let trianglesInsideBuildings=0;
  const within=(p,outline)=>{
    let inside=false;
    for(let i=0,j=outline.length-1;i<outline.length;j=i++){
      const a=outline[i],b=outline[j];
      if((a[1]>p[1])!==(b[1]>p[1])&&
        p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  };
  for(const record of source.roadbeds){
    if(!Number.isSafeInteger(record.objectId)||sourceIds.has(record.objectId))
      throw Error('Roadbed source duplicate/missing OBJECTID');
    sourceIds.add(record.objectId);
    for(const rings of record.polygons){
      const holePositions=[],flat=[];
      let count=0;
      for(let j=0;j<rings.length;j++){
        const ring=rings[j].slice(0,-1);
        if(j)holePositions.push(count);
        for(const p of ring){
          if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))
            throw Error('Bad OTI metre polygon vertex');
          flat.push(p[0],p[1]);
          count++;
        }
        ringsCount++;
      }
      if(count<3||count>16000)throw Error('Empty/oversized official roadbed polygon');
      const indices=earcut(flat,holePositions,2);
      const err=deviation(flat,holePositions,2,indices);
      if(indices.length<3||indices.length%3||!Number.isFinite(err)||err>.0005)
        throw Error('Official roadbed triangulation failed source-area/hole check '+record.objectId);
      let active=0;
      for(let i=0;i<indices.length;i+=3){
        const p=indices.slice(i,i+3).map(idx=>[flat[idx*2],flat[idx*2+1]]);
        const area=Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-
          (p[1][1]-p[0][1])*(p[2][0]-p[0][0]))*.5;
        if(area<1e-7){skippedDegenerate++;continue;}
        const center=[(p[0][0]+p[1][0]+p[2][0])/3,
          (p[0][1]+p[1][1]+p[2][1])/3];
        if(buildings.some(b=>{
          const bbox=b.outline;
          return bbox.length>2&&within(center,bbox);
        }))trianglesInsideBuildings++;
        // Exact source XY projected by parent; Z is north, Y is reference
        // ground. There is NO surveyed vertical roadbed datum in this source.
        for(const q of p)packed.push(q[0],q[1]);
        data.push(record.subtype);
        triangles++;active++;
        countBySubtype[record.subtype]=(countBySubtype[record.subtype]||0)+1;
      }
      if(active===0)throw Error('Roadbed polygon produced no nondegenerate triangles '+record.objectId);
      if(holePositions.length)skippedSourceHoles+=0; // count kept with Earcut, not discarded
      polygons++;
    }
  }
  if(sourceIds.size<50||polygons<50||triangles<1000||
     packed.length!==triangles*6||data.length!==triangles)
    throw Error('Real roadbed source coverage insufficient');
  const result={schema:ROADBED_MESH_SCHEMA,
    role:'OTI_2022_SOURCE_ROADBED_ONLY_NOT_2026_ROAD_SURVEY',
    referenceImageryYear:2022,source:source.source,
    projection:source.projection,
    counts:{features:sourceIds.size,polygons,rings:ringsCount,triangles,
      skippedDegenerate,trianglesInsideBuildings,countBySubtype},
    // Packed 2-D triangles and subtype keep the WebGL first-load bounded.
    flatVerticesMetres:packed,triangleSubtypes:data
  };
  return result;
}
