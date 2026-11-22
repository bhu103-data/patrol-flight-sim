// Source-exact duplicate remediation, NOT a generic "hide NYC GIS" shortcut.
// Frozen 44th Street WebGL2 A/B isolated FID 212747 as the grey wall (24.56%
// left-wall pixel change; next FID 949144 was 2.35%). The same independent
// geoToGame transform also misregisters 1000156, the second 1540 Broadway.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [source,html,json]=await Promise.all([
  readFile(new URL('../assets/nyc/nyc-gis-infill.js',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8')
]);
const asset=JSON.parse(json);
const begin=html.indexOf('    const blocks=[',html.indexOf('PATROL_NYC_GMAP_V8'));
const end=html.indexOf('    for(const [i,b] of blocks.entries())',begin);
assert.ok(begin>0&&end>begin,'Need actual runtime landmark list');
const protectedSites=new Function(html.slice(begin,end)+'return blocks;')()
  .map(({name,x,z,w,d})=>({name,x,z,w,d}));
const signature='    if(rec.fid===1000156 && named1540AlreadyRendered){\n      skippedMisregistered1540++;\n      continue;\n    }\n';
const signature1515='    if(rec.fid===212747 && named1515AlreadyRendered){\n      skippedMisregistered1515++;\n      continue;\n    }\n';
assert.equal(source.split(signature).length,2,
  'The 1540 FID-only omission must be source-reviewed');
assert.equal(source.split(signature1515).length,2,
  'The 1515 FID-only omission must be source-reviewed');
const baselineSource=source.replace(signature,'').replace(signature1515,'');
const compile=txt=>new Function(txt.replace(/^export /gm,'')+
  '\nreturn buildTimesSquareGisInfill;')();
const oldBuilder=compile(baselineSource),newBuilder=compile(source);
const run=(build,sites=protectedSites,features=asset.features)=>{
  const quads=[],triangles=[],boxes=[];
  const result=build({...asset,features},{ground:14.95,bounds:[-34,56,-52,68],
    protectedSites:sites,
    addQuad:(...args)=>quads.push(JSON.stringify(args)),
    addTri:(...args)=>triangles.push(JSON.stringify(args)),
    box:(...args)=>boxes.push(JSON.stringify(args))});
  return {result,quads,triangles,boxes};
};
function isOrderedSubsequence(large,small){
  let i=0;
  for(const row of large)if(row===small[i])i++;
  return i===small.length;
}
test('real FID 1000156 is 1540 Broadway, not a second camera-center tower',()=>{
  const named=protectedSites.find(s=>s.name==='1540 Broadway');
  assert.deepEqual(named,{name:'1540 Broadway',x:-15,z:6,w:13,d:10});
  const marker='const NYC_TIMES_VERIFIED_FOOTPRINTS = ';
  const ix=html.indexOf(marker),e=html.indexOf(';',ix+marker.length);
  const table=JSON.parse(html.slice(ix+marker.length,e));
  assert.equal(table['1540 Broadway'].fid,1000156);
  const record=asset.features.find(r=>r.fid===1000156);
  assert.ok(record&&record.heightFt===575);
  const gis=run(newBuilder,protectedSites,[record]);
  assert.equal(gis.result.skippedMisregistered1540,1);
  assert.equal(gis.result.sourceBuildings,0);
  const original=run(oldBuilder,protectedSites,[record]);
  assert.equal(original.result.infillPieces,5);
  assert.equal(original.result.roofTriangles,12);
  const full=original.quads.map(x=>JSON.parse(x))
    .filter(q=>q[5]===6).flatMap(q=>q.slice(0,4));
  const east=full.map(v=>v[0]),north=full.map(v=>v[2]);
  assert.ok(Math.min(...east)>16&&Math.max(...east)<34,
    'Misregistered duplicate must be on opposite avenue side');
  assert.ok(Math.min(...north)>16&&Math.max(...north)<29);
});
test('real FID 212747 is 1515 Broadway, not a second west-side tower',()=>{
  const named=protectedSites.find(s=>s.name==='1515 Broadway');
  assert.deepEqual(named,{name:'1515 Broadway',x:39,z:6,w:15,d:10});
  const marker='const NYC_TIMES_VERIFIED_FOOTPRINTS = ';
  const ix=html.indexOf(marker),e=html.indexOf(';',ix+marker.length);
  const table=JSON.parse(html.slice(ix+marker.length,e));
  assert.equal(table['1515 Broadway'].fid,212747);
  const record=asset.features.find(r=>r.fid===212747);
  assert.ok(record&&record.heightFt===700.68);
  const gis=run(newBuilder,protectedSites,[record]);
  assert.equal(gis.result.skippedMisregistered1515,1);
  assert.equal(gis.result.sourceBuildings,0);
  const original=run(oldBuilder,protectedSites,[record]);
  assert.equal(original.result.sourceBuildings,1);
  const full=original.quads.map(x=>JSON.parse(x))
    .filter(q=>q[5]===6).flatMap(q=>q.slice(0,4));
  const east=full.map(v=>v[0]),north=full.map(v=>v[2]);
  assert.ok(Math.min(...east)>-23&&Math.max(...east)<10,
    'The GIS duplicate must remain in the misregistered west-side projection');
  assert.ok(Math.min(...north)>-14&&Math.max(...north)<9);
  assert.ok(Math.min(...east)<10&&named.x-named.w*.5>31,
    'The same municipal FID is already rendered at its separate named hero site');
});
test('remove only the two proven misregistered FIDs; preserve every other polygon',()=>{
  const a=run(oldBuilder),b=run(newBuilder);
  const withoutDuplicates=run(oldBuilder,protectedSites,
    asset.features.filter(r=>r.fid!==1000156&&r.fid!==212747));
  assert.equal(a.result.inputRecords,120);
  assert.equal(b.result.inputRecords,120);
  assert.equal(b.result.skippedMisregistered1540,1);
  assert.equal(b.result.skippedMisregistered1515,1);
  assert.ok(!b.result.sourceFids.includes(1000156));
  assert.ok(!b.result.sourceFids.includes(212747));
  for(const kind of ['quads','triangles','boxes']){
    assert.deepEqual(b[kind],withoutDuplicates[kind],
      'Only the two duplicate FIDs may be omitted from '+kind);
  }
  assert.ok(b.result.infillPieces<=b.result.maximumPieces,
    'Freed geometry budget must remain inside the original cap');
});
test('source-only, unprotected and unrelated FIDs still render normally',()=>{
  const sourceOnly=run(oldBuilder,[]),sourceOnlyNew=run(newBuilder,[]);
  for(const kind of ['quads','triangles','boxes'])
    assert.deepEqual(sourceOnly[kind],sourceOnlyNew[kind]);
  assert.equal(sourceOnlyNew.result.skippedMisregistered1540,0);
  assert.equal(sourceOnlyNew.result.skippedMisregistered1515,0);
  const without1515=protectedSites.filter(p=>p.name!=='1515 Broadway');
  const oldWithout1515=run(oldBuilder,without1515);
  const newWithout1515=run(newBuilder,without1515);
  const oldWithout1540=run(oldBuilder,protectedSites.filter(p=>p.name!=='1540 Broadway'));
  const newWithout1540=run(newBuilder,protectedSites.filter(p=>p.name!=='1540 Broadway'));
  assert.deepEqual(newWithout1515.quads,
    run(oldBuilder,without1515,asset.features.filter(r=>r.fid!==1000156)).quads);
  assert.deepEqual(newWithout1515.triangles,
    run(oldBuilder,without1515,asset.features.filter(r=>r.fid!==1000156)).triangles);
  assert.deepEqual(newWithout1540.quads,
    run(oldBuilder,protectedSites.filter(p=>p.name!=='1540 Broadway'),
      asset.features.filter(r=>r.fid!==212747)).quads);
  assert.deepEqual(newWithout1540.triangles,
    run(oldBuilder,protectedSites.filter(p=>p.name!=='1540 Broadway'),
      asset.features.filter(r=>r.fid!==212747)).triangles);
  assert.equal(newWithout1515.result.skippedMisregistered1540,1);
  assert.equal(newWithout1515.result.skippedMisregistered1515,0);
  assert.equal(newWithout1540.result.skippedMisregistered1540,0);
  assert.equal(newWithout1540.result.skippedMisregistered1515,1);
  for(const fid of [384606,958605,949144]){
    const features=asset.features.filter(r=>r.fid===fid);
    const a=run(oldBuilder,protectedSites,features),b=run(newBuilder,protectedSites,features);
    assert.deepEqual(a.quads,b.quads);
    assert.deepEqual(a.triangles,b.triangles);
    assert.equal(b.result.skippedMisregistered1540,0);
    assert.equal(b.result.skippedMisregistered1515,0);
  }
});
test('original 1515 and 1540 hero meshes, billboards and flight pipeline remain intact',()=>{
  assert.match(html,/\{name:'1540 Broadway',address:'44th–45th'/);
  assert.match(html,/\{name:'1515 Broadway',address:'44th–45th'/);
  assert.match(html,/const officialRing=survey\?\.uv\.map/);
  assert.match(html,/const protectedTimesSites=buildTimesSquareDistrict/);
  assert.match(html,/protectedSites:protectedTimesSites/);
  assert.match(html,/buildOfficialFootprintMesh\(addTri,addQuad,lot,ground,4\)/);
  assert.match(source,/skippedMisregistered1540/);
  assert.match(source,/skippedMisregistered1515/);
  assert.match(source,/named1540AlreadyRendered/);
  assert.match(source,/named1515AlreadyRendered/);
  assert.doesNotMatch(source,/rec\.fid===1000156.*nycGIS=off/);
});
