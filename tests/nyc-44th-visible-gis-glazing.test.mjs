// Camera-grounded regression for the *actual* NYC GIS geometry exposed at
// the Times Square Street Level / 44th Street LED Canyon fixed camera.
// The source is the bundled municipal FID, not a screenshot-only mockup.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const js=await readFile(new URL('../assets/nyc/nyc-gis-infill.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const data=JSON.parse(await readFile(new URL(
  '../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
const start=html.indexOf('    const blocks=[',html.indexOf('PATROL_NYC_GMAP_V8'));
const end=html.indexOf('    for(const [i,b] of blocks.entries()){',start);
assert.ok(start>=0&&end>start);
const protectedSites=new Function(html.slice(start,end)+'return blocks')();
const marker='const cameraFacingCut=showcaseFacade &&';
assert.ok(js.includes(marker),'street-visible source gate must remain explicit');
const compile=source=>new Function(source.replace(
  'export function buildTimesSquareGisInfill','function buildTimesSquareGisInfill')+
  ';return buildTimesSquareGisInfill')();
const previous=compile(js.replace(marker,
  'const cameraFacingCut=false && showcaseFacade &&'));
const current=compile(js);
function render(build,ids){
  const source={...data,features:data.features.filter(f=>ids.includes(f.fid))};
  const quads=[],triangles=[];
  const stats=build(source,{ground:14.93,bounds:[-34,56,-52,68],
    protectedSites,addQuad:(...args)=>quads.push(args),
    addTri:(...args)=>triangles.push(args),box:()=>{}});
  return {quads,triangles,stats};
}
const source=data.features.find(f=>f.fid===1000156);
assert.ok(source&&source.heightFt>500,'bundle genuine NYC FID 1000156');
const before=render(previous,[1000156]),after=render(current,[1000156]);
const added=[];let oldIndex=0;
for(const q of after.quads){
  if(oldIndex<before.quads.length &&
    JSON.stringify(q)===JSON.stringify(before.quads[oldIndex]))oldIndex++;
  else added.push(q);
}

test('two long official polygon edges get bounded camera-facing glass and deep metal mullions',()=>{
  assert.equal(after.stats.sourceBuildings,1);
  assert.equal(after.stats.infillPieces,5);
  assert.equal(before.stats.windowQuads,180);
  assert.equal(after.stats.windowQuads,198);
  assert.equal(added.length,42,'18 glass panels, 18 transoms, 6 vertical fins');
  assert.equal(added.filter(q=>q[5]===7).length,18);
  assert.equal(added.filter(q=>q[5]===6).length,24);
  const glass=added.filter(q=>q[5]===7);
  const segments=new Set(glass.map(q=>Math.round(
    Math.min(...q.slice(0,4).map(p=>p[0]))*10)));
  assert.equal(segments.size,2,'only two clipped camera-facing edge segments');
  for(const q of glass)for(const p of q.slice(0,4)){
    assert.ok(p[0]>20.1&&p[0]<31.0,'must be the surveyed camera-facing lot');
    assert.ok(p[2]>16.90&&p[2]<17.0,'glass sits on street-side cut, not a new parcel');
    assert.ok(p[1]>20&&p[1]<71,'glazing stays between podium and roof');
  }
});

test('no original street surfaces, upper windows, official triangulated roof or existing geometry are removed',()=>{
  assert.equal(oldIndex,before.quads.length);
  assert.deepEqual(after.triangles,before.triangles);
  assert.equal(after.stats.roofTriangles,before.stats.roofTriangles);
  assert.ok(after.stats.windowQuads<=200);
  assert.ok(after.stats.windowQuads<2200);
  for(const q of added)for(const p of q.slice(0,4))
    assert.ok(p.every(Number.isFinite),'all added geometry is finite');
});

test('the candidate is a narrow FID-only fix; 1530 Broadway storefront survives unchanged',()=>{
  assert.deepEqual(render(current,[384606]),render(previous,[384606]));
  assert.match(js,/const showcaseFacade=rec\.fid===1000156&&h>=45/);
  assert.match(html,/nyOfficialGisPbr\(material,n,surfaceRoughness\)/);
});
