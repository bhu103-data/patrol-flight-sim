// Source-exact duplicate remediation, NOT a generic "hide NYC GIS" shortcut.
// The screenshot trace on Draft #261 showed the true grey wall came from
// GIS; the FID 1000156 envelope is a second wrongly registered 1540 Broadway.
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
assert.equal(source.split(signature).length,2,
  'The one FID-only omission must be source-reviewed');
const baselineSource=source.replace(signature,'');
const compile=txt=>new Function(txt.replace(/^export /gm,'')+
  '\nreturn buildTimesSquareGisInfill;')();
const oldBuilder=compile(baselineSource),newBuilder=compile(source);
const run=(build,sites=protectedSites,features=asset.features,skipFids=null)=>{
  const quads=[],triangles=[],boxes=[];
  const result=build({...asset,features},{ground:14.95,bounds:[-34,56,-52,68],
    protectedSites,skipFids,
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
test('remove precisely five duplicate pieces; preserve every other polygon',()=>{
  const a=run(oldBuilder),b=run(newBuilder);
  assert.equal(a.result.sourceBuildings,35);
  assert.equal(b.result.sourceBuildings,34);
  assert.equal(a.result.infillPieces,76);
  assert.equal(b.result.infillPieces,71);
  assert.equal(a.result.roofTriangles,226);
  assert.equal(b.result.roofTriangles,214);
  assert.equal(a.result.inputRecords,120);
  assert.equal(b.result.inputRecords,120);
  assert.equal(a.result.windowQuads,b.result.windowQuads);
  assert.equal(a.result.storefrontQuads,b.result.storefrontQuads);
  assert.equal(a.result.windowTrimQuads,b.result.windowTrimQuads);
  assert.equal(b.result.skippedMisregistered1540,1);
  for(const kind of ['quads','triangles','boxes'])
    assert.ok(isOrderedSubsequence(a[kind],b[kind]),
      'Every remaining '+kind+' must preserve exact vertex ordering/colors');
});
test('source-only, unprotected and unrelated FIDs still render normally',()=>{
  for(const sites of [[],protectedSites.filter(p=>p.name!=='1540 Broadway')]){
    const oldRun=run(oldBuilder,sites),newRun=run(newBuilder,sites);
    for(const kind of ['quads','triangles','boxes'])
      assert.deepEqual(oldRun[kind],newRun[kind]);
    assert.equal(newRun.result.skippedMisregistered1540,0);
  }
  for(const fid of [384606,958605,212747]){
    const features=asset.features.filter(r=>r.fid===fid);
    const a=run(oldBuilder,protectedSites,features),b=run(newBuilder,protectedSites,features);
    assert.deepEqual(a.quads,b.quads);
    assert.deepEqual(a.triangles,b.triangles);
    assert.equal(b.result.skippedMisregistered1540,0);
  }
});
test('original 1540 custom mesh, billboards and flight pipeline remain intact',()=>{
  assert.match(html,/\{name:'1540 Broadway',address:'44th–45th'/);
  assert.match(html,/const officialRing=survey\?\.uv\.map/);
  assert.match(html,/const protectedTimesSites=buildTimesSquareDistrict/);
  assert.match(html,/protectedSites:protectedTimesSites/);
  assert.match(source,/skippedMisregistered1540/);
  assert.match(source,/named1540AlreadyRendered/);
  assert.doesNotMatch(source,/rec\.fid===1000156.*nycGIS=off/);
});

test('diagnostic FID skip is opt-in, exact and reports the removed source record',()=>{
  const record=asset.features.find(r=>r.fid===1000156);
  assert.ok(record);
  const baseline=run(newBuilder,[],[record]);
  const skipped=run(newBuilder,[],[record],new Set([1000156]));
  assert.equal(baseline.result.sourceBuildings,1);
  assert.equal(baseline.result.skippedDiagnosticFids,0);
  assert.deepEqual(baseline.result.sourceFids,[1000156]);
  assert.equal(skipped.result.sourceBuildings,0);
  assert.equal(skipped.result.skippedDiagnosticFids,1);
  assert.deepEqual(skipped.result.sourceFids,[]);
  assert.deepEqual(skipped.quads,[]);
  assert.deepEqual(skipped.triangles,[]);
  assert.deepEqual(skipped.boxes,[]);
  assert.throws(()=>run(newBuilder,[],[record],[1000156]),
    /Diagnostic skipFids must be a Set/);
});
