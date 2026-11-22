import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [source,assetText,html]=await Promise.all([
  readFile(new URL('../assets/nyc/nyc-gis-infill.js',import.meta.url),'utf8'),
  readFile(new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'),
  readFile(new URL('../index.html',import.meta.url),'utf8')
]);
const build=new Function(source.replace(/^export /gm,'')+
  '\nreturn buildTimesSquareGisInfill;')();
const asset=JSON.parse(assetText);
function run(skipFids=null){
  let quads=0,triangles=0;
  return build(asset,{
    addQuad:()=>{quads++},addTri:()=>{triangles++},box:()=>{},
    ground:14.95,bounds:[-34,56,-52,68],protectedSites:[],skipFids
  });
}

test('default production GIS build keeps the exact original source FID inventory',()=>{
  const baseline=run();
  assert(baseline.sourceBuildings>0);
  assert(baseline.sourceFids.length>0);
  assert.equal(baseline.skippedDiagnosticFids,0);
  assert.deepEqual(baseline.sourceFids,[...new Set(baseline.sourceFids)]);
});

test('opt-in diagnostic skips exactly one emitted FID and restores the same inventory',()=>{
  const baseline=run();
  const fid=baseline.sourceFids[0];
  const omitted=run(new Set([fid]));
  assert.equal(omitted.skippedDiagnosticFids,1);
  assert.equal(omitted.sourceBuildings,baseline.sourceBuildings-1);
  assert(!omitted.sourceFids.includes(fid));
  assert.deepEqual(omitted.sourceFids,baseline.sourceFids.filter(x=>x!==fid));
  const restored=run(new Set());
  assert.equal(restored.skippedDiagnosticFids,0);
  assert.deepEqual(restored.sourceFids,baseline.sourceFids);
  assert.equal(restored.sourceBuildings,baseline.sourceBuildings);
});

test('diagnostic FID input is strictly typed and cannot activate from ordinary gameplay URL',()=>{
  const baseline=run();
  assert.throws(()=>run([baseline.sourceFids[0]]),/must be a Set/);
  assert.throws(()=>run(new Set(['not-a-fid'])),/non-integer/);
  assert.match(html,/\.get\('nycFidProbe'\)==='1'/);
  assert.match(html,/if\(nycFidProbeEnabled\)\{\s*window\.__patrolNycFidProbe=/);
  assert.match(html,/skipFids:nycFidProbeEnabled\?new Set\(skipFids\):null/);
});
