import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  lonLatToENU, NYC_REALITY_ORIGIN,
  projectMunicipalFeature, auditTimesSquareSnapshot
} from '../assets/nyc/nyc-reality-projection.mjs';

const snapshot=JSON.parse(readFileSync(
  new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../nyc-reality.html',import.meta.url),'utf8');

test('WGS84 origin projects to near zero without compressed game coordinates',()=>{
  const zero=lonLatToENU(NYC_REALITY_ORIGIN.lon,NYC_REALITY_ORIGIN.lat);
  for(const item of zero) assert.ok(Math.abs(item)<1e-7);
  const east=lonLatToENU(NYC_REALITY_ORIGIN.lon+.001,NYC_REALITY_ORIGIN.lat);
  const north=lonLatToENU(NYC_REALITY_ORIGIN.lon,NYC_REALITY_ORIGIN.lat+.001);
  assert.ok(east[0]>84&&east[0]<85,'0.001 longitude degree is ~84 meters');
  assert.ok(north[1]>110&&north[1]<112,'0.001 latitude degree is ~111 meters');
  assert.ok(Math.abs(east[1])<.01);
  assert.ok(Math.abs(north[0])<.01);
});

test('height is exactly feet-to-meters and polygon shape is not compressed',()=>{
  const sample=snapshot.features.find(f=>f.rings.length===1);
  const projected=projectMunicipalFeature(sample);
  assert.equal(projected.fid,sample.fid);
  assert.ok(Math.abs(projected.heightMeters-sample.heightFt*.3048)<1e-9);
  assert.equal(projected.footprintMeters.length,sample.rings[0].length-1);
  for(const point of projected.footprintMeters){
    assert.equal(point.length,2);
    assert.ok(point.every(Number.isFinite));
  }
  assert.ok(Math.abs(projected.signedAreaMeters2)>.01);
});

test('all 120 exact municipal IDs accounted for, without invented hole filling',()=>{
  assert.equal(snapshot.features.length,120);
  const audit=auditTimesSquareSnapshot(snapshot);
  assert.equal(audit.originalCount,120);
  assert.equal(audit.accepted.length,118);
  assert.deepEqual(audit.rejected.map(b=>b.fid).sort((a,b)=>a-b),
    [800370,1072214]);
  assert.equal(new Set(audit.accepted.map(r=>r.fid)).size,118);
  assert.ok(audit.accepted.every(r=>r.heightMeters>0 && Number.isFinite(r.signedAreaMeters2)));
  assert.match(audit.units,/1 world unit = 1 meter/);
});

test('reject malformed, repeated or multi-ring geometry rather than draw false roofs',()=>{
  const f=snapshot.features[0];
  assert.throws(()=>projectMunicipalFeature({...f,heightFt:NaN}),/Unsupported/);
  assert.throws(()=>projectMunicipalFeature({...f,rings:[]}),/Unsupported/);
  assert.throws(()=>projectMunicipalFeature({...f,rings:[[...f.rings[0].slice(0,-1)]]}),/closed/);
  const duplicate=auditTimesSquareSnapshot({...snapshot,features:[f,f]});
  assert.equal(duplicate.accepted.length,1);
  assert.equal(duplicate.rejected.length,1);
});

test('viewer consumes meter-true projection and explicitly disclaims absent roads and facades',()=>{
  assert.match(html,/nyc-reality-projection\.mjs/);
  assert.match(html,/times-square-footprints\.json/);
  assert.match(html,/THREE\.ExtrudeGeometry/);
  assert.match(html,/1 unit = 1 meter/);
  assert.match(html,/street centerlines only/);
  assert.match(html,/nyc-reality-street-centerlines\.mjs/);
  assert.match(html,/not a photorealistic Manhattan release/);
  assert.doesNotMatch(html,/buildTimesSquareDistrict\(/);
});
