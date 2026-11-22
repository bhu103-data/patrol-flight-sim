/**
 * Native WebGL source-QA composite of true 2022 sidewalk polygon shapes,
 * official curb polylines and observed curb-cut break lines.
 * Distinct small Y offsets are for VIEWER DEPTH ONLY, not real elevations.
 * No new production road/traffic mesh or guessed kerb rise is created.
 */
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import earcut,{deviation} from 'earcut';
const input='artifacts/nyc-curb-sidewalk-source/';
const base='artifacts/nyc-roadbed-source/';
const geometry=JSON.parse(readFileSync(input+'edges.json','utf8'));
const pavement=JSON.parse(readFileSync(base+'roadbed-mesh.json','utf8'));
if(geometry.schema!=='patrol-nyc-oti-sidewalk-curb-metre-source-v1'||
   geometry.projection?.originLonLat.join(',')!==
   pavement.projection?.originLonLat.join(','))
  throw Error('Sidewalk, roadbed and buildings must share exact WGS84 metres');
const triangles=[],lineSegments=[];
let degenerate=0,polygons=0,rings=0;
for(const feature of geometry.sidewalks)for(const ringSet of feature.polygons){
  const coords=[],holes=[];let vertices=0;
  for(const [i,raw] of ringSet.entries()){
    if(i)holes.push(vertices);
    const ring=raw.slice(0,-1);
    if(ring.length<3)throw Error('Invalid sidewalk ring for '+feature.objectId);
    for(const point of ring){
      if(point.length!==2||!point.every(Number.isFinite))
        throw Error('Invalid source sidewalk metre coordinate');
      coords.push(...point);vertices++;
    }
    rings++;
  }
  const indices=earcut(coords,holes,2);
  const error=deviation(coords,holes,2,indices);
  if(indices.length<3||indices.length%3||!Number.isFinite(error)||error>.0005)
    throw Error('Sidewalk polygon hole/area triangulation mismatch id='+
      feature.objectId+' error='+error);
  for(let i=0;i<indices.length;i+=3){
    const pts=indices.slice(i,i+3).map(k=>[coords[k*2],coords[k*2+1]]);
    const area=Math.abs((pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-
      (pts[1][1]-pts[0][1])*(pts[2][0]-pts[0][0]))*.5;
    if(area<1e-7){degenerate++;continue;}
    triangles.push({id:feature.objectId,subtype:feature.subtype,vertices:pts});
  }
  polygons++;
}
for(const [kind,list] of [['curb',geometry.curbs],['curbCut',geometry.curbCuts]]){
  for(const feature of list){
    for(const part of feature.parts)for(let i=1;i<part.length;i++){
      const a=part[i-1],b=part[i];
      if(a.length!==2||b.length!==2||!a.concat(b).every(Number.isFinite))
        throw Error('Invalid official metre curb coordinates');
      if(Math.hypot(a[0]-b[0],a[1]-b[1])<.001)continue;
      lineSegments.push({kind,id:feature.objectId,subtype:feature.subtype,a,b});
    }
  }
}
if(polygons<5||triangles.length<100||lineSegments.length<200)
  throw Error('Measured curb-sidewalk geometry coverage unexpectedly low');
const payload={schema:'patrol-nyc-oti-street-edge-webgl-metre-v1',
  sourceImageryYear:2022,projection:geometry.projection,
  note:'SIDEWALK planes and CURB/CURB CUT line overlays in flat illustrative ground. Y layering is NOT 2026 survey elevation or curb height.',
  counts:{sidewalkFeatures:geometry.counts.sidewalkFeatures,
    sidewalkPolygons:polygons,sidewalkRings:rings,
    sidewalkTriangles:triangles.length,
    skippedDegenerate:degenerate,
    curbFeatures:geometry.counts.curbFeatures,
    curbCuts:geometry.counts.curbCuts,
    curbLineSegments:lineSegments.filter(x=>x.kind==='curb').length,
    curbCutLineSegments:lineSegments.filter(x=>x.kind==='curbCut').length},
  triangles,lineSegments};
writeFileSync(input+'edge-mesh.json',JSON.stringify(payload));
copyFileSync(base+'source.json',input+'source.json');
copyFileSync(base+'roadbed-mesh.json',input+'roadbed-mesh.json');
let html=readFileSync(base+'preview.html','utf8');
function replaceOnce(before,after,label){
  const matches=html.split(before).length-1;
  if(matches!==1)throw Error('Parent measured WebGL template changed '+label+
    ' matches='+matches);
  html=html.replace(before,after);
}
replaceOnce('绿色：OTI 2022 道路面；黄色：真实交叉口；蓝色：DCM 中心线。',
  '绿色：OTI 2022 道路面；黄色：交叉口；灰白：实测人行道面；青色：实测路缘；橙色：实测路缘开口；蓝色：DCM 中心线。',
  'source legend');
replaceOnce('const pavement=meshBuffer(pavementPos,pavementColors,pavementNormals);',
  [
    'const edgeResponse=await fetch("./edge-mesh.json");',
    'if(!edgeResponse.ok)throw Error("Official curb-sidewalk geometry missing");',
    'const streetEdges=await edgeResponse.json();',
    'if(streetEdges.schema!=="patrol-nyc-oti-street-edge-webgl-metre-v1"||',
    '  streetEdges.projection.originLonLat.join(",")!==source.projection.originLonLat.join(","))',
    '  throw Error("Unaligned official sidewalk and curb coordinate frame");',
    'const sidewalkPos=[],sidewalkCol=[],sidewalkNorm=[],curbPos=[],curbCol=[],curbNorm=[];',
    'for(const tri of streetEdges.triangles){',
    '  const c=tri.subtype===380010?[.55,.54,.63]:[.67,.66,.59];',
    '  for(const p of tri.vertices)',
    '    addPoint(sidewalkPos,sidewalkCol,sidewalkNorm,',
    '      [p[0],.057,p[1]],c,[0,1,0]);',
    '}',
    'for(const seg of streetEdges.lineSegments){',
    '  const c=seg.kind==="curbCut"?[.98,.52,.30]:[.25,.81,.92];',
    '  for(const p of [seg.a,seg.b])',
    '    addPoint(curbPos,curbCol,curbNorm,[p[0],.090,p[1]],c,[0,1,0]);',
    '}',
    'const sidewalks=meshBuffer(sidewalkPos,sidewalkCol,sidewalkNorm);',
    'const curbEdges=meshBuffer(curbPos,curbCol,curbNorm);',
    'const pavement=meshBuffer(pavementPos,pavementColors,pavementNormals);'
  ].join('\n'),'upload accurate street edges');
replaceOnce('gl.bindVertexArray(pavement.vao);gl.drawArrays(gl.TRIANGLES,0,pavement.count);',
  [
    'gl.bindVertexArray(pavement.vao);gl.drawArrays(gl.TRIANGLES,0,pavement.count);',
    'gl.bindVertexArray(sidewalks.vao);gl.drawArrays(gl.TRIANGLES,0,sidewalks.count);',
    'gl.bindVertexArray(curbEdges.vao);gl.drawArrays(gl.LINES,0,curbEdges.count);'
  ].join('\n'),'render sidewalk/curb data');
replaceOnce('realPavementTriangles:pavement.count/3,realPavementVertices:pavement.count};',
  [
    'realPavementTriangles:pavement.count/3,realPavementVertices:pavement.count,',
    'realSidewalkFeatures:streetEdges.counts.sidewalkFeatures,',
    'realSidewalkTriangles:sidewalks.count/3,',
    'realCurbFeatures:streetEdges.counts.curbFeatures,',
    'realCurbCuts:streetEdges.counts.curbCuts,',
    'realCurbLineVertices:curbEdges.count};'
  ].join('\n'),'publish street edge QA stats');
writeFileSync(input+'preview.html',html);
console.log('NYC authentic curb/sidewalk WebGL source preview',
  JSON.stringify(payload.counts));
