import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  TIMES_SQUARE_ORIGIN,wgs84ToMeters,metersToWgs84,
  signedAreaMeters,triangulateSimplePolygon,buildMeteredMassing
} from '../assets/nyc/times-square-metered-massing.mjs';

const data=JSON.parse(await readFile(
  new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));

test('Times Square projection is metre-scale, anchored, and invertible',()=>{
  assert.deepEqual(wgs84ToMeters(
    [TIMES_SQUARE_ORIGIN.lon,TIMES_SQUARE_ORIGIN.lat]),[0,0]);
  const east=wgs84ToMeters(
    [TIMES_SQUARE_ORIGIN.lon+.001,TIMES_SQUARE_ORIGIN.lat])[0];
  const north=wgs84ToMeters(
    [TIMES_SQUARE_ORIGIN.lon,TIMES_SQUARE_ORIGIN.lat+.001])[1];
  assert.ok(east>84&&east<85,'1/1000 longitude '+east+'m');
  assert.ok(north>110&&north<112,'1/1000 latitude '+north+'m');
  for(const sample of [
    [-73.9885,40.756],[-73.9835,40.7595],[-73.9864,40.7578]
  ]){
    const roundTrip=metersToWgs84(wgs84ToMeters(sample));
    assert.ok(Math.abs(roundTrip[0]-sample[0])<1e-10);
    assert.ok(Math.abs(roundTrip[1]-sample[1])<1e-10);
  }
  assert.throws(()=>wgs84ToMeters([-200,40]),/WGS84/);
});

test('source FIDs and original rooftop feet are preserved, with NO 0.32 height scale',()=>{
  const result=buildMeteredMassing(data);
  assert.equal(result.units,'metres');
  assert.equal(result.heightScale,1);
  assert.equal(result.source,data.reference);
  assert.equal(result.sourceFeatureCount,data.features.length);
  assert.ok(result.buildings.length>=15,
    'Official Times Square subset must produce actual geometry');
  assert.ok(result.boundsMeters);
  assert.ok(result.tallestRoofMeters>100);
  const source=data.features.find(f=>f.fid===22922);
  assert.ok(source);
  const model=result.buildings.find(f=>f.fid===22922);
  assert.ok(model,'known official footprint FID must remain included');
  assert.ok(Math.abs(model.roofHeightMeters-source.heightFt*0.3048)<1e-12);
  assert.ok(model.roofHeightMeters>source.heightFt*.3048*.32*3);
  assert.ok(model.areaSquareMeters>1);
  assert.ok(model.footprintMeters.length>=3);
  assert.equal(result.roofTriangles,
    result.buildings.reduce((a,b)=>a+b.roofTriangles.length,0));
});

test('roof triangles preserve the true concave outline area (no fan fill)',()=>{
  const ring=[[0,0],[6,0],[6,2],[2,2],[2,6],[0,6]];
  const tris=triangulateSimplePolygon(ring);
  assert.equal(tris.length,ring.length-2);
  const area=tris.reduce((sum,ids)=>sum+
    Math.abs(signedAreaMeters(ids.map(i=>ring[i]))),0);
  assert.ok(Math.abs(area-20)<1e-9);
  assert.equal(signedAreaMeters(ring),20);
  const reverse=triangulateSimplePolygon([...ring].reverse());
  assert.equal(reverse.length,4);
});

test('source records with holes are explicitly skipped rather than falsely filled',()=>{
  const fixture={coordinateSystem:data.coordinateSystem,reference:data.reference,
    retrieved:data.retrieved,features:[
      {fid:1,heightFt:100,rings:[[
        [-73.9865,40.7577],[-73.9864,40.7577],
        [-73.9864,40.7578],[-73.9865,40.7578],[-73.9865,40.7577]
      ]]},
      {fid:2,heightFt:80,rings:[[
        [-73.9865,40.7577],[-73.9864,40.7577],
        [-73.9864,40.7578],[-73.9865,40.7577]
      ],[
        [-73.98649,40.75771],[-73.98645,40.75771],
        [-73.98649,40.75771]
      ]]},
      {fid:1,heightFt:500,rings:[[
        [-73.9865,40.7577],[-73.9864,40.7577],
        [-73.9865,40.7578],[-73.9865,40.7577]
      ]]}
  ]};
  const r=buildMeteredMassing(fixture);
  assert.equal(r.buildings.length,1);
  assert.equal(r.skipped.multiRing,1);
  assert.equal(r.skipped.duplicate,1);
  assert.equal(r.buildings[0].roofHeightMeters,30.48);
  assert.throws(()=>buildMeteredMassing({features:[]}),/Unrecognized/);
});

test('massing remains separate from production flight, roads and collision',async()=>{
  const source=await readFile(
    new URL('../assets/nyc/times-square-metered-massing.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\.32\s*\)|MAX_PIECES|MAX_WINDOW_TRIM_QUADS/);
  assert.match(source,/OPT-IN QA ONLY/);
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/times-square-metered-massing\.mjs/);
});
