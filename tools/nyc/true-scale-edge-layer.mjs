/**
 * Opt-in 2022 NYC OTI sidewalks + curb/cut data for the existing measured
 * lowflight source viewer. NO flight, collision, camera, roadbed changes.
 */
export async function createMeasuredEdgeLayer({sourceProjection,meshBuffer,addPoint}){
  const response=await fetch('./edge-mesh.json',{cache:'no-store'});
  if(!response.ok)throw Error('Measured NYC street-edge source missing: '+response.status);
  const layer=await response.json();
  if(layer.schema!=='patrol-nyc-lowflight-street-edge-metre-v1'||
     layer.mode!=='OPT_IN_QA_NOT_DEFAULT_MAP'||
     layer.sourceYear!==2022||
     JSON.stringify(layer.projection)!==JSON.stringify(sourceProjection)||
     layer.counts?.sidewalkFeatures<25||
     layer.counts?.curbFeatures<100||
     layer.counts?.curbCuts<100||
     layer.triangles?.length!==layer.counts.sidewalkTriangles)
    throw Error('NYC curb/sidewalk source identity or geometry count mismatch');
  const surfaces=[],surfaceColors=[],surfaceNormals=[];
  const edges=[],edgeColors=[],edgeNormals=[];
  for(const item of layer.triangles){
    if(!Array.isArray(item.vertices)||item.vertices.length!==3)
      throw Error('Invalid original sidewalk triangle '+item.id);
    const col=item.subtype===380010?[.55,.54,.63]:[.68,.66,.59];
    for(const p of item.vertices){
      if(p.length!==2||!p.every(Number.isFinite))
        throw Error('Invalid official metre sidewalk vertex');
      addPoint(surfaces,surfaceColors,surfaceNormals,
        [p[0],.057,p[1]],col,[0,1,0]);
    }
  }
  for(const item of layer.lineSegments){
    if(!['curb','curbCut'].includes(item.kind)||!item.a||!item.b)
      throw Error('Unknown real curb/cut source type');
    const col=item.kind==='curbCut'?[.98,.51,.29]:[.19,.83,.91];
    for(const p of [item.a,item.b]){
      if(p.length!==2||!p.every(Number.isFinite))
        throw Error('Invalid official metre curb coordinate');
      addPoint(edges,edgeColors,edgeNormals,
        [p[0],.090,p[1]],col,[0,1,0]);
    }
  }
  const sidewalkBuffer=meshBuffer(surfaces,surfaceColors,surfaceNormals);
  const curbBuffer=meshBuffer(edges,edgeColors,edgeNormals);
  if(sidewalkBuffer.count/3!==layer.counts.sidewalkTriangles||
     curbBuffer.count/2!==layer.lineSegments.length)
    throw Error('WebGL sidewalk/curb buffer lost source geometry');
  return {
    sourceYear:2022,sourceOnly:true,
    sidewalkFeatures:layer.counts.sidewalkFeatures,
    sidewalkTriangles:sidewalkBuffer.count/3,
    curbFeatures:layer.counts.curbFeatures,
    curbCuts:layer.counts.curbCuts,
    curbLineVertices:curbBuffer.count,
    draw(gl){
      gl.bindVertexArray(sidewalkBuffer.vao);
      gl.drawArrays(gl.TRIANGLES,0,sidewalkBuffer.count);
      gl.bindVertexArray(curbBuffer.vao);
      gl.drawArrays(gl.LINES,0,curbBuffer.count);
    }
  };
}
