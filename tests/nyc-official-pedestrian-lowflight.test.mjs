import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const preview=readFileSync(new URL('../tools/nyc/true-scale-preview.html',import.meta.url),'utf8');
const builder=readFileSync(new URL('../scripts/nyc-metre-pedestrian-lowflight-build.mjs',import.meta.url),'utf8');
const browser=readFileSync(new URL('../tools/nyc/true-scale-flight-browser-smoke.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/nyc-times-true-scale-flight.yml',import.meta.url),'utf8');
const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('only real source polygons and curb lines may appear in true metre low-fly pilot',()=>{
  assert.match(preview,/fetch\('\.\/pedestrian-mesh\.json'/);
  assert.match(preview,/patrol-nyc-oti-pedestrian-metre-lowflight-v1/);
  assert.match(preview,/OFFICIAL_2022_PLANIMETRIC_NO_DEFAULT_GAME_EDIT/);
  assert.match(preview,/JSON\.stringify\(pedestrian\.projection\)!==JSON\.stringify\(source\.projection\)/);
  assert.match(preview,/gl\.drawArrays\(gl\.TRIANGLES,0,sidewalks\.count\)/);
  assert.match(preview,/gl\.drawArrays\(gl\.TRIANGLES,0,plazas\.count\)/);
  assert.match(preview,/gl\.drawArrays\(gl\.LINES,0,curbLines\.count\)/);
  assert.doesNotMatch(preview,/gl\.drawArrays\(gl\.TRIANGLES,0,rowSurface\.count\)/);
  assert.match(preview,/noSurveyedVerticalDatum:true/);
  assert.match(preview,/路缘开口/);
  assert.ok(!game.includes('nyc-metre-pedestrian-lowflight-build.mjs'));
  assert.ok(!game.includes('pedestrian-mesh.json'));
});

test('upstream source-FID and projection conflicts block rather than guess surfaces',()=>{
  assert.match(builder,/pedestrian\.imageryYear!==2022/);
  assert.match(builder,/edges\.sourceImageryYear!==2022/);
  assert.match(builder,/roadbed\.referenceImageryYear!==2022/);
  assert.match(builder,/Inconsistent official sidewalk OBJECTIDs between two sources/);
  assert.match(builder,/Building, roadbed, pedestrian and curb CRS must be identical/);
  assert.match(builder,/holes\.push\(n\)/);
  assert.match(builder,/deviation\(flat,holes,2,triangles\)/);
  assert.match(builder,/no 2026 lanes, curbs, heights/);
  assert.match(builder,/roadbed\.json/);
  assert.match(builder,/Official pedestrian QA geometry coverage or budget violated/);
});

test('source acquisition and real on-off same-camera screenshot are mandatory CI gates',()=>{
  for(const command of [
    'scripts/nyc-times-pedestrian-plaza-source.mjs',
    'scripts/nyc-times-pedestrian-topology-audit.mjs',
    'scripts/nyc-times-sidewalk-curb-source.mjs',
    'scripts/nyc-metre-pedestrian-lowflight-build.mjs'
  ])assert.ok(workflow.includes('node '+command),command);
  assert.match(workflow,/test -s artifacts\/nyc-true-scale\/pedestrian-mesh\.json/);
  assert.match(browser,/04-aerial-pedestrian-hidden/);
  assert.match(browser,/05-aerial-pedestrian-visible/);
  assert.match(browser,/if\(offHash===onHash\)throw Error/);
  assert.match(browser,/officialPedestrian2022/);
  assert.match(browser,/gl\.getError\(\)/);
});
