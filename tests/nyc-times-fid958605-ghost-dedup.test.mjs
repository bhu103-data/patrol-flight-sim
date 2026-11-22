// Production-GIS validation: dedupe only the tiny second copy of the
// named 1552 Broadway while preserving non-target rooftop vent placement.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [html,js,raw]=await Promise.all([
  read('index.html'),
  read('assets/nyc/nyc-gis-infill.js'),
  read('assets/nyc/times-square-footprints.json')
]);
const asset=JSON.parse(raw);
const idx=html.indexOf('    const blocks=[',html.indexOf('PATROL_NYC_GMAP_V8'));
const stop=html.indexOf('    for(const [i,b] of blocks.entries()){',idx);
assert.ok(idx>=0&&stop>idx);
const sites=new Function(html.slice(idx,stop)+'return blocks')();
const site=sites.find(x=>x.name==='1552 Broadway');
const lookup='const NYC_TIMES_VERIFIED_FOOTPRINTS = ';
const at=html.indexOf(lookup);
assert.ok(at>0);
const verified=JSON.parse(html.slice(at+lookup.length,
  html.indexOf(';',at+lookup.length)));
const data=asset.features.find(f=>f.fid===958605);
assert.ok(data&&data.heightFt>50&&data.heightFt<70);
const gate='if(rec.fid===958605 && protectedSites.some(';
assert.ok(js.includes(gate),'targeted source-ID and name gate');
assert.match(js,/skipped1552DecorationSlots\+\+/);
assert.match(js,/const boxOrdinal=pieces\+skipped1552DecorationSlots/);
const compile=source=>new Function(source.replace(
  'export function buildTimesSquareGisInfill','function buildTimesSquareGisInfill')+
  ';return buildTimesSquareGisInfill')();
const current=compile(js);
const baseline=compile(js.replace(gate,
  'if(false && rec.fid===958605 && protectedSites.some('));
function generate(build,features=asset.features,protectedSites=sites){
  const quads=[],tris=[],boxes=[];
  const stats=build({...asset,features},{
    ground:14.93,bounds:[-34,56,-52,68],protectedSites,
    addQuad:(...v)=>quads.push(v),
    addTri:(...v)=>tris.push(v),box:(...v)=>boxes.push(v)
  });
  return {stats,quads,tris,boxes};
}
function preserveInOrder(original,reduced){
  let matched=0;
  for(const value of original)
    if(matched<reduced.length &&
      JSON.stringify(value)===JSON.stringify(reduced[matched]))matched++;
  assert.equal(matched,reduced.length,'no existing unrelated geometry changed');
}

test('named 1552 Broadway retains its verified municipal tower and billboard',()=>{
  assert.equal(verified['1552 Broadway'].fid,958605);
  assert.ok(site&&site.x===-16&&site.z===22);
  assert.ok(site.panels.some(p=>p[3]==='LIGHTYEAR'));
  assert.match(html,/const officialRing=survey\?\.uv\.map/);
  assert.match(html,/solidAt\('Times Square streetfront'/);
  const one=generate(baseline,[data]),gone=generate(current,[data]);
  assert.equal(one.stats.sourceBuildings,1);
  assert.equal(one.stats.infillPieces,1);
  assert.equal(one.quads.length,4,'source remnant is only four walls');
  assert.equal(one.tris.length,2,'one two-triangle roof');
  assert.equal(gone.stats.sourceBuildings,0);
  assert.equal(gone.quads.length,0);
  assert.equal(gone.tris.length,0);
});

test('source-only GIS without the curated site still draws FID 958605',()=>{
  const standalone=sites.filter(x=>x.name!=='1552 Broadway');
  assert.deepEqual(
    generate(current,[data],standalone),
    generate(baseline,[data],standalone)
  );
});

test('all other 120-source geometry and roof details retain exact position and order',()=>{
  const before=generate(baseline),after=generate(current);
  assert.equal(before.stats.inputRecords,120);
  assert.equal(before.stats.sourceBuildings,34);
  assert.equal(after.stats.sourceBuildings,33);
  assert.equal(before.stats.infillPieces,75);
  assert.equal(after.stats.infillPieces,74);
  assert.equal(before.stats.roofTriangles,224);
  assert.equal(after.stats.roofTriangles,222);
  assert.equal(after.stats.windowQuads,before.stats.windowQuads,
    'all glass faces must survive regardless of parent facade PRs');
  assert.ok(after.stats.windowQuads>=850&&after.stats.windowQuads<=950);
  assert.equal(after.stats.storefrontQuads,201);
  assert.deepEqual(after.stats.materialSurfaceIds,[6,7,8]);
  assert.equal(before.quads.length-after.quads.length,4);
  assert.equal(before.tris.length-after.tris.length,2);
  assert.equal(before.boxes.length-after.boxes.length,1);
  preserveInOrder(before.quads,after.quads);
  preserveInOrder(before.tris,after.tris);
  preserveInOrder(before.boxes,after.boxes);
});

test('44th Street building and prior 2 Times Square dedup remain unaffected',()=>{
  for(const fid of [1000156,941790,384606]){
    const features=asset.features.filter(x=>x.fid===fid);
    assert.equal(features.length,1);
    assert.deepEqual(generate(current,features),
      generate(baseline,features),'non-target FID '+fid+' must not change');
  }
});
