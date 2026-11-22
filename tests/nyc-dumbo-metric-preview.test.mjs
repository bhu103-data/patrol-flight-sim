// Physically consistent DUMBO pilot: refuses per-building arbitrary fitting.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DUMBO_ORIGIN,M_PER_DEG_LAT,M_PER_DEG_LON,toLocalMeters,
  toWgs84,prepareDistrict,signedArea} from '../assets/nyc/dumbo-oti-metric.mjs';
const snapshot=JSON.parse(readFileSync(new URL('../assets/nyc/dumbo-oti-metric-48.json',import.meta.url),'utf8'));
const district=prepareDistrict(snapshot);
const byFid=new Map(district.map(b=>[b.fid,b]));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('48 real municipal building rings, unique IDs and finite physically measured roofs',()=>{
  assert.equal(district.length,48);
  assert.equal(byFid.size,48);
  assert.equal(snapshot.datasetId,'5zhs-2jue');
  assert.match(snapshot.assetRole,/NOT_GAME_COLLISION/);
  assert.equal(snapshot.sourceFileSha256.length,64);
  assert.ok(M_PER_DEG_LON>84000&&M_PER_DEG_LON<84600);
  assert.ok(M_PER_DEG_LAT>110900&&M_PER_DEG_LAT<111200);
  for(const b of district){
    assert.ok(b.roofY>3&&b.roofY<92);
    assert.ok(b.areaM2>1);
    assert.ok(b.roofTriangles.length>=2&&b.roofTriangles.length<=b.ring.length-2);
    assert.ok(b.roofTriangles.every(t=>t.every(p=>p.length===2&&p.every(Number.isFinite))));
    const area=b.roofTriangles.reduce((s,t)=>s+Math.abs(signedArea(t)),0);
    assert.ok(Math.abs(area-b.areaM2)<Math.max(.03,b.areaM2*1e-5));
  }
});
test('WGS84↔metric roundtrip and one global scale for every building',()=>{
  const pairs=[DUMBO_ORIGIN.lon,DUMBO_ORIGIN.lat];
  assert.ok(distance(toLocalMeters(...pairs),[0,0])<1e-7);
  for(const b of snapshot.features){
    for(const [lon,lat] of b.ring){
      const [x,z]=toLocalMeters(lon,lat),[backLon,backLat]=toWgs84(x,z);
      assert.ok(Math.abs(backLon-lon)<1e-11&&Math.abs(backLat-lat)<1e-11);
    }
  }
  // Projected distances between every pair MUST be consistent with their
  // real source centroids; no independent miniature fit into fake game lots.
  const a=byFid.get(1080628),b=byFid.get(1031082),c=byFid.get(1051309);
  assert.ok(a&&b&&c);
  assert.ok(Math.abs(distance(a.center,b.center)-148.5)<2);
  assert.ok(Math.abs(distance(a.center,c.center)-141.7)<2);
  assert.ok(Math.abs(distance(b.center,c.center)-244.9)<2);
  assert.ok(Math.abs(a.roofY-121*.3048)<1e-8);
});
test('preview is segregated from flight/gameplay scripts and explicitly rejects false survey claims',()=>{
  const html=readFileSync(new URL('../tools/nyc/dumbo-metric-preview.html',import.meta.url),'utf8');
  assert.match(html,/WebGL2/);
  assert.match(html,/(?:NOT a surveyed|No surveyed)/i,
    'source preview must explicitly reject a surveyed reconstruction claim');
  assert.match(html,/assets\/nyc\/dumbo-oti-metric-48\.json/);
  assert.match(html,/prepareDistrict/);
  assert.doesNotMatch(html,/advanceFlight\(|PatrolSpaceBridge|setAircraft\(/);
});
