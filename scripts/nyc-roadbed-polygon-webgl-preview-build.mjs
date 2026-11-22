/**
 * Build a 1:1 measured-roadbed source viewer. Output belongs to QA artifact,
 * never to the compressed production flight map.
 */
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import earcut,{deviation} from 'earcut';
const src=JSON.parse(readFileSync('artifacts/nyc-roadbed-source/roadbed.json','utf8'));
if(src.schema!=='patrol-nyc-oti-roadbed-planimetric-2022-v1')
  throw Error('Unrecognized official NYC pavement polygon schema');
const flatPolygons=[],triangles=[];
let ringCount=0,triangleCount=0,skippedDegenerate=0;
for(const feature of src.roadbeds){
  for(const rings of feature.polygons){
    let coords=[],holes=[],vertices=0;
    for(let i=0;i<rings.length;i++){
      const ring=rings[i].slice(0,-1);
      if(i)holes.push(vertices);
      for(const p of ring){coords.push(p[0],p[1]);vertices++;}
      ringCount++;
    }
    if(vertices<3)throw Error('Invalid source polygon '+feature.objectId);
    const indices=earcut(coords,holes,2);
    if(indices.length<3||indices.length%3)
      throw Error('Cannot triangulate official polygon '+feature.objectId);
    const error=deviation(coords,holes,2,indices);
    if(!Number.isFinite(error)||error>.0005)
      throw Error('Triangulation filled a polygon hole or lost source area '+
        feature.objectId+' deviation='+error);
    for(let i=0;i<indices.length;i+=3){
      const p=indices.slice(i,i+3).map(k=>[coords[k*2],coords[k*2+1]]);
      const area=Math.abs((p[1][0]-p[0][0])*(p[2][1]-p[0][1])-
        (p[1][1]-p[0][1])*(p[2][0]-p[0][0]))*.5;
      if(area<.0000001){skippedDegenerate++;continue;}
      triangles.push({sourceId:feature.objectId,subtype:feature.subtype,vertices:p});
      triangleCount++;
    }
    flatPolygons.push(feature.objectId);
  }
}
if(flatPolygons.length<40||triangleCount<1000||
  flatPolygons.length!==src.counts.polygons)
  throw Error('Geometry coverage too low for source-measured roadbed preview');
const payload={schema:'patrol-oti-roadbed-triangulated-metres-v1',
  source:src.source,referenceImageryYear:2022,projection:src.projection,
  note:'2022 roadbed outlines; flat Y=0 QA only, no real 3D grades/curbs/lanes.',
  counts:{features:src.counts.features,polygons:flatPolygons.length,
    rings:ringCount,triangles:triangleCount,skippedDegenerate},triangles};
const out='artifacts/nyc-roadbed-source';
writeFileSync(out+'/roadbed-mesh.json',JSON.stringify(payload));
copyFileSync('artifacts/nyc-true-scale/source.json',out+'/source.json');
const parent=readFileSync('tools/nyc/true-scale-preview.html','utf8');
let html=parent;
function once(oldValue,newValue,label){
  const hits=html.split(oldValue).length-1;
  if(hits!==1)throw Error('Unrecognized parent QA preview at '+label+' ('+hits+')');
  html=html.replace(oldValue,newValue);
}
once('灰色：官方建筑足迹按原始米制屋顶高度挤出；蓝色：官方道路中心线；无伪造车道和立面。',
  '灰色：官方建筑形体；绿色：OTI 2022 道路面；黄色：真实交叉口；蓝色：DCM 中心线。道路为二维参考面，并非现时车辆行驶和真实立面。','source labeling');
once('const position=[],colors=[],normals=[],roadPos=[],roadColors=[],roadNormals=[];',
  'const position=[],colors=[],normals=[],roadPos=[],roadColors=[],roadNormals=[],pavementPos=[],pavementColors=[],pavementNormals=[];','separate pavement batch');
once('  const buildings=meshBuffer(position,colors,normals);',
  [
  '  const roadResponse=await fetch("./roadbed-mesh.json");',
  '  if(!roadResponse.ok)throw Error("Authentic OTI roadbed mesh missing");',
  '  const realRoads=await roadResponse.json();',
  '  if(realRoads.schema!=="patrol-oti-roadbed-triangulated-metres-v1"||',
  '     realRoads.projection.originLonLat.join(",")!==source.projection.originLonLat.join(","))',
  '    throw Error("Roadbed and city massing use inconsistent metre coordinates");',
  '  for(const patch of realRoads.triangles){',
  '    const c=patch.subtype===350010?[.78,.63,.29]:',
  '      patch.subtype===350020?[.50,.44,.67]:[.20,.49,.41];',
  '    for(const p of patch.vertices){',
  '      addPoint(pavementPos,pavementColors,pavementNormals,',
  '        [p[0],.05,p[1]],c,[0,1,0]);',
  '    }',
  '  }',
  '  const pavement=meshBuffer(pavementPos,pavementColors,pavementNormals);',
  '  const buildings=meshBuffer(position,colors,normals);'
  ].join('\n'),'upload road mesh');
once('    gl.bindVertexArray(buildings.vao);gl.drawArrays(gl.TRIANGLES,0,buildings.count);',
  [
  '    gl.bindVertexArray(pavement.vao);gl.drawArrays(gl.TRIANGLES,0,pavement.count);',
  '    gl.bindVertexArray(buildings.vao);gl.drawArrays(gl.TRIANGLES,0,buildings.count);'
  ].join('\n'),'render real road polygons');
once('    buildingTriangles:triCount,streetVertices:streets.count};',
  [
  '    buildingTriangles:triCount,streetVertices:streets.count,',
  '    realPavementFeatures:realRoads.counts.features,',
  '    realPavementTriangles:pavement.count/3,realPavementVertices:pavement.count};'
  ].join('\n'),'publish QA stats');
once("source.boundsMetres[3]-source.boundsMetres[1])+' 米';",
  "source.boundsMetres[3]-source.boundsMetres[1])+' 米 · OTI 2022 道路面 '+realRoads.counts.features+' 块';",
  'visual source metrics');
writeFileSync(out+'/preview.html',html);
console.log('NYC measured 3D roadbed preview',JSON.stringify(payload.counts));
