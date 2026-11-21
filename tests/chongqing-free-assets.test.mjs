import test from 'node:test';
import assert from 'node:assert/strict';
import {CHONGQING_FREE_ASSETS,CHONGQING_LANDMARK_ASSET_POLICY}
  from '../assets/chongqing/free-assets.js';

test('free Chongqing candidates are separated from landmark geometry',()=>{
  assert.ok(CHONGQING_FREE_ASSETS.length>=4);
  for(const asset of CHONGQING_FREE_ASSETS){
    assert.match(asset.source,/^https:\/\//);
    assert.ok(['CC0','CC0 1.0'].includes(asset.license));
    assert.equal(asset.redistribution,true);
    assert.doesNotMatch(asset.license,/NC|ND|Editorial/i);
  }
  assert.equal(CHONGQING_LANDMARK_ASSET_POLICY.geometry,'procedural-original');
  assert.equal(CHONGQING_LANDMARK_ASSET_POLICY.scenarioCloud,false);
  for(const name of CHONGQING_LANDMARK_ASSET_POLICY.protectedLandmarks)
    assert.ok(name.length>2);
});

test('street furniture stays review-only when its source mesh exceeds the active budget',()=>{
  const lamps=CHONGQING_FREE_ASSETS.filter(a=>a.category==='street-furniture');
  assert.equal(lamps.length,2);
  assert.ok(lamps.every(a=>a.status==='review-only'&&a.sourceTriangles>=20000));
});
