// Built-in 2 Times Square already has municipal FID 941790. The Times
// Square infill projected the same ID into a second small tower at the
// northern scene edge. Verify only that *duplicate visual remnant* is cut.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(file)=>readFile(new URL('../'+file,import.meta.url),'utf8');
const [js,html,raw]=await Promise.all([
  read('assets/nyc/nyc-gis-infill.js'),
  read('index.html'),
  read('assets/nyc/times-square-footprints.json')
]);
const asset=JSON.parse(raw);
const begin=html.indexOf('    const blocks=[',html.indexOf('PATROL_NYC_GMAP_V8'));
const end=html.indexOf('    for(const [i,b] of blocks.entries()){',begin);
assert.ok(begin>=0&&end>begin);
const sites=new Function(html.slice(begin,end)+'return blocks')();
const sourceMarker='const NYC_TIMES_VERIFIED_FOOTPRINTS = ';
const from=html.indexOf(sourceMarker);
assert.ok(from>0);
const official=JSON.parse(html.slice(from+sourceMarker.length,
  html.indexOf(';',from+sourceMarker.length)));
const duplicateGate="if(rec.fid===941790 && protectedSites.some(";
assert.ok(js.includes(duplicateGate),'site-aware FID-only duplicate gate');
const moduleText=js.replace('export function buildTimesSquareGisInfill',
  'function buildTimesSquareGisInfill');
const builder=(src)=>new Function(src+';return buildTimesSquareGisInfill')();
const before=builder(moduleText.replace(duplicateGate,
  'if(false && rec.fid===941790 && protectedSites.some('));
const after=builder(moduleText);

function run(build,features,protectedSites=sites){
  const quads=[],triangles=[];
  const stats=build({...asset,features},{
    ground:14.93,bounds:[-34,56,-52,68],protectedSites,
    addQuad:(...p)=>quads.push(p),addTri:(...p)=>triangles.push(p),
    box:()=>{}
  });
  return {quads,triangles,stats};
}
const target=asset.features.find(f=>f.fid===941790);
assert.ok(target&&target.heightFt>100);
const oldSingle=run(before,[target]),newSingle=run(after,[target]);

test('2 Times Square retains the unique authored municipal polygon and landmark',()=>{
  assert.equal(official['2 Times Square'].fid,941790);
  const site=sites.find(x=>x.name==='2 Times Square');
  assert.ok(site&&site.shape==='wedge'&&site.panels.length===2);
  assert.ok(html.includes('const officialRing=survey?.uv.map('));
  assert.ok(html.includes("solidAt('Times Square streetfront'"));
  assert.equal(oldSingle.stats.sourceBuildings,1);
  assert.equal(oldSingle.stats.infillPieces,1);
  assert.equal(oldSingle.quads.length,26);
  assert.equal(oldSingle.triangles.length,2);
});

test('duplicate GIS remnant is removed only if its named site exists',()=>{
  assert.equal(newSingle.stats.sourceBuildings,0);
  assert.equal(newSingle.stats.infillPieces,0);
  assert.equal(newSingle.quads.length,0);
  assert.equal(newSingle.triangles.length,0);
  const noNamed=sites.filter(x=>x.name!=='2 Times Square');
  assert.deepEqual(run(after,[target],noNamed),
    run(before,[target],noNamed),
    'standalone GIS source must not lose the footprint');
});

test('all other source polygons, glass and roof faces are retained in original order',()=>{
  const old=run(before,asset.features),updated=run(after,asset.features);
  assert.equal(old.stats.sourceBuildings,35);
  assert.equal(updated.stats.sourceBuildings,34);
  assert.equal(old.stats.infillPieces,76);
  assert.equal(updated.stats.infillPieces,75);
  assert.equal(old.stats.windowQuads,updated.stats.windowQuads+18);
  assert.equal(old.stats.storefrontQuads,updated.stats.storefrontQuads);
  assert.equal(old.quads.length-updated.quads.length,26);
  assert.equal(old.triangles.length-updated.triangles.length,2);
  for(const [previous,now] of [
    [old.quads,updated.quads],[old.triangles,updated.triangles]
  ]){
    let index=0;
    for(const face of previous)
      if(index<now.length&&JSON.stringify(face)===JSON.stringify(now[index]))index++;
    assert.equal(index,now.length,'existing nonduplicate geometry is unchanged');
  }
  assert.equal(updated.stats.visualOnly,true);
  assert.deepEqual(updated.stats.materialSurfaceIds,[6,7,8]);
});
