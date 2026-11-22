import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../tools/nyc/true-scale-preview.html',import.meta.url),'utf8');
const smoke=readFileSync(new URL('../tools/nyc/mn05-roof-lowflight-browser-smoke.mjs',import.meta.url),'utf8');
test('2014 source rooftops are strictly opt-in, not the default NYC metre flight map',()=>{
  assert.match(html,/<input id="mn05RoofToggle" type="checkbox"\/>/);
  assert.doesNotMatch(html,/<input id="mn05RoofToggle"[^>]*checked/);
  assert.match(html,/new URLSearchParams\(location.search\)\.get\('mn05Roofs'\)==='1'/);
  assert.match(html,/if\(mn05RoofToggle\.checked&&mn05RoofMesh\)/);
  assert.match(html,/if\(!mn05RoofToggle\.checked\)return/);
  assert.match(html,/sourceVerticalDatumVerified!==false/);
  assert.match(html,/sourceYear:2014,sourceVerticalDatumVerified:false/);
  assert.match(html,/2014[\s\S]{0,200}2026|2026[\s\S]{0,200}2014/);
});
test('only official hash-pinned cached roof meshes share existing true metres',()=>{
  assert.match(html,/mn05-cached-roof-metric-preview\.json/);
  assert.match(html,/b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57/);
  assert.match(html,/source\.projection\?\.originLonLat\?\.join/);
  assert.match(html,/roofData\.counts\?\.genuineSavedSourceTriangles>12000/);
  assert.match(html,/gl\.bindVertexArray\(mn05RoofMesh\.vao\)/);
});
test('original metre lowflight colliders and roadbed remain while new roofs are visual only',()=>{
  assert.match(html,/advanceMetricFlight\(flyState,flightKeys,delta,buildingData,metreBounds\)/);
  assert.match(html,/hitsBuilding\(flyState\.position,buildingData,1\.2\)/);
  assert.match(html,/gl\.bindVertexArray\(realPavement\.vao\)/);
  assert.match(html,/gl\.bindVertexArray\(buildings\.vao\)/);
  assert.match(smoke,/mn05Roofs=1&skipHistoricGML=1/);
  assert.match(smoke,/page\.keyboard\.down\('e'\)/);
  assert.match(smoke,/sourceQA\.originalMunicipalRoadFeatures<50/);
  assert.match(smoke,/aerialChangedPercent/);
  assert.match(smoke,/contextLost/);
});
test('historical CityGML is never silently fabricated for original default scene',()=>{
  assert.match(html,/skipHistoricGML/);
  assert.match(html,/if\(!skipHistoricGML&&!historyResponse\.ok\)/);
  assert.match(html,/if\(skipHistoricGML\)\{historicToggle\.checked=false;historicToggle\.disabled=true;\}/);
  assert.match(html,/historical\.role!=='QA_ONLY_HISTORIC_CITYGML_NOT_IN_GAME'/);
});
