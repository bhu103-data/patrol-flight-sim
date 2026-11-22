import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../.github/workflows/nyc-times-true-scale-source.yml',import.meta.url),'utf8');
const browser=readFileSync(new URL('../tools/nyc/true-scale-browser-smoke.mjs',import.meta.url),'utf8');
const lowflight=readFileSync(new URL('../.github/workflows/nyc-times-true-scale-flight.yml',import.meta.url),'utf8');

test('old source WebGL check builds every authoritative mesh required by modern preview',()=>{
  const steps=[
    'nyc-times-true-scale-pilot.mjs',
    'nyc-times-roadbed-polygon-source.mjs',
    'nyc-metre-lowflight-roadbed-build.mjs',
    'nyc-times-pedestrian-plaza-source.mjs',
    'nyc-times-pedestrian-topology-audit.mjs',
    'nyc-times-sidewalk-curb-source.mjs',
    'nyc-metre-pedestrian-lowflight-build.mjs'
  ];
  for(const name of steps){
    assert.ok(source.includes('node scripts/'+name),'Source CI lacks '+name);
    assert.ok(lowflight.includes('node scripts/'+name),'Lowflight CI lacks '+name);
  }
  for(const file of ['roadbed-mesh.json','pedestrian-mesh.json']){
    assert.ok(source.includes('test -s artifacts/nyc-true-scale/'+file),
      'Source CI never validates '+file);
    assert.ok(lowflight.includes('test -s artifacts/nyc-true-scale/'+file));
    assert.ok(browser.includes("'"+file+"'"));
  }
  for(const module of ['flight.mjs','street-envelope.mjs']){
    assert.ok(source.includes('artifacts/nyc-true-scale/'+module));
    assert.ok(browser.includes("'"+module+"'"));
  }
  assert.match(source,/earcut@3\.0\.2/);
  assert.match(source,/node tools\/nyc\/true-scale-browser-smoke\.mjs/);
});
test('source QA fails fast instead of hanging on missing assets or empty scene',()=>{
  assert.match(browser,/Required official preview assets missing/);
  assert.match(browser,/True-metre preview browser did not initialize/);
  assert.match(browser,/stats\.officialRoadbed2022\.triangles<7000/);
  assert.match(browser,/stats\.officialPedestrian2022\.curbCuts<150/);
  assert.match(browser,/stats\.noInventedStreetSurface/);
  assert.match(browser,/sidewalkDisplayMask/);
  assert.match(source,/derive_sidewalk_display_mask\.py/);
  assert.match(source,/nyc-sidewalk-display-mask\.test\.py/);
  assert.match(lowflight,/derive_sidewalk_display_mask\.py/);
  assert.match(lowflight,/nyc-sidewalk-display-mask\.test\.py/);
  assert.match(source,/feat\/nyc-tsq-meter-crs-road-source-20261122-chat/);
  assert.match(source,/qa\/nyc-pedestrian-topology-audit-current-20261122-chat/);
});
