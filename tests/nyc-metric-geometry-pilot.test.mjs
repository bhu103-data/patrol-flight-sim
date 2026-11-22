// Node >=22: node --test tests/nyc-metric-geometry-pilot.test.mjs
// No browser or GPU required. This is a GEOMETRY audit, not visual approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  ORIGIN,FEET_TO_METRES,wgs84ToEnu,signedArea,triangulateRing,
  buildMetricFootprintMesh
} from '../assets/nyc/nyc-metric-geometry-pilot.js';

const asset=JSON.parse(readFileSync(new URL(
  '../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));

test('ENU origin is zero; local X=geographic east and Z=-north',()=>{
  const o=wgs84ToEnu(ORIGIN.lon,ORIGIN.lat,0);
  assert.ok(o.every(v=>Math.abs(v)<1e-7));
  const east=wgs84ToEnu(ORIGIN.lon+0.00001,ORIGIN.lat);
  const north=wgs84ToEnu(ORIGIN.lon,ORIGIN.lat+0.00001);
  assert.ok(east[0]>.8&&east[0]<.9);
  assert.ok(Math.abs(east[1])<.001);
  assert.ok(north[1]>1.10&&north[1]<1.12);
  assert.ok(Math.abs(north[0])<.001);
  const up=wgs84ToEnu(ORIGIN.lon,ORIGIN.lat,20);
  assert.ok(Math.abs(up[2]-20)<1e-5);
});
test('horizontal and vertical scales remain physical metres',()=>{
  assert.equal(FEET_TO_METRES,.3048);
  const close=wgs84ToEnu(-73.9857,40.758,0),
    farther=wgs84ToEnu(-73.9856,40.758,0);
  assert.ok(farther[0]>close[0]);
  const metres=farther[0]-close[0];
  assert.ok(metres>8&&metres<9);
});
test('polygon triangulation respects concavity rather than using roof fans',()=>{
  const concave=[[0,0],[3,0],[3,3],[1.5,1],[0,3]];
  const triangles=triangulateRing(concave);
  assert.equal(triangles.length,3);
  const area=triangles.reduce((n,t)=>n+Math.abs(signedArea(t)),0);
  assert.ok(Math.abs(area-Math.abs(signedArea(concave)))<1e-8);
});
test('NYC snapshot builds in one consistent ENU frame, no fictional scaling',()=>{
  assert.equal(asset.features.length,120);
  const output=buildMetricFootprintMesh(asset);
  const s=output.stats;
  assert.equal(s.inputRecords,120);
  assert.ok(s.acceptedBuildings>80,
    'Most official polygons must survive without road/venue clipping');
  assert.equal(s.metresPerWorldUnit,1);
  assert.equal(s.acceptedBuildings+s.rejectedBuildings,120);
  assert.equal(new Set(s.acceptedFids).size,s.acceptedBuildings);
  assert.ok(s.maxX-s.minX>100&&s.maxX-s.minX<800);
  assert.ok(s.maxZ-s.minZ>150&&s.maxZ-s.minZ<800);
  assert.ok(s.maxHeight>80&&s.maxHeight<800);
  assert.equal(output.interleaved.length,s.triangles*3*6);
  assert.ok(output.interleaved.every(Number.isFinite));
  assert.ok(!s.rejectedBuildings||s.rejects.every(r=>r.reason));
});
test('rebuilding same official data gives repeatable geometry and counts',()=>{
  const a=buildMetricFootprintMesh(asset),b=buildMetricFootprintMesh(asset);
  assert.deepEqual(a.stats.acceptedFids,b.stats.acceptedFids);
  assert.equal(a.stats.triangles,b.stats.triangles);
  assert.deepEqual(a.interleaved,b.interleaved);
});
