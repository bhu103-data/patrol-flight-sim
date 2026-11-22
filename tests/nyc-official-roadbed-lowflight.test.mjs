import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const preview=readFileSync(new URL('../tools/nyc/true-scale-preview.html',import.meta.url),'utf8');
const build=readFileSync(new URL('../scripts/nyc-metre-lowflight-roadbed-build.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/nyc-times-true-scale-flight.yml',import.meta.url),'utf8');
const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('low-flight consumes real official polygon source rather than drawing an invented road strip',()=>{
  assert.match(preview,/fetch\('\.\/roadbed-mesh\.json'/);
  assert.match(preview,/roadbed\.schema!=='patrol-nyc-lowflight-oti-roadbed-metre-v1'/);
  assert.match(preview,/roadbed\.counts\?\.features<70/);
  assert.match(preview,/roadbed\.counts\?\.triangles<7000/);
  assert.match(preview,/JSON\.stringify\(roadbed\.projection\)!==JSON\.stringify\(source\.projection\)/);
  assert.match(preview,/gl\.drawArrays\(gl\.TRIANGLES,0,pavement\.count\)/);
  assert.doesNotMatch(preview,/gl\.drawArrays\(gl\.TRIANGLES,0,rowSurface\.count\)/);
  assert.match(preview,/noInventedStreetSurface:true/);
  assert.match(preview,/官方 OTI 2022 道路面/);
  assert.ok(!game.includes('nyc-metre-lowflight-roadbed-build.mjs'));
});

test('triangulation preserves source ring/hole and 2022 imagery limitations',()=>{
  assert.match(build,/road\.referenceImageryYear!==2022/);
  assert.match(build,/road\.roadbeds\.length<70/);
  assert.match(build,/if\(i\)holes\.push\(n\)/);
  assert.match(build,/const indices=earcut\(xy,holes,2\)/);
  assert.match(build,/deviation\(xy,holes,2,indices\)>0\.0005/);
  assert.match(build,/degenerate\+\+/);
  assert.match(build,/Cannot combine mismatched 1:1 official building and roadbed coordinate frames/);
  assert.match(build,/roadbed-mesh\.json/);
  assert.match(build,/no 2026 lanes, curbs, heights/);
});

test('exact source must be fetched and built in CI, then proven in a browser',()=>{
  assert.match(workflow,/npm install --no-save --no-audit --no-fund earcut@3\.0\.2/);
  assert.match(workflow,/node scripts\/nyc-times-roadbed-polygon-source\.mjs/);
  assert.match(workflow,/node scripts\/nyc-metre-lowflight-roadbed-build\.mjs/);
  assert.match(workflow,/test -s artifacts\/nyc-true-scale\/roadbed-mesh\.json/);
  assert.match(workflow,/node tools\/nyc\/true-scale-flight-browser-smoke\.mjs/);
});
