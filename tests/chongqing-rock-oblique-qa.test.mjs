// Browser-only A/B guard: this QA must NEVER leak its debug camera toggle
// into the production Chongqing map or modify player flight controls.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const runnerURL=new URL('../scripts/chongqing-browser-smoke.mjs',import.meta.url);
const source=await readFile(runnerURL,'utf8');
const runtime=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');

test('real rock oblique Chromium smoke file compiles without Playwright startup',()=>{
  const command=spawnSync(process.execPath,['--check',fileURLToPath(runnerURL)],
    {encoding:'utf8'});
  assert.equal(command.status,0,command.stderr||command.stdout||'Node parser error');
});

test('rock before/after cameras are identical and exist only in browser QA',()=>{
  assert.match(source,/page\.route\('\*\*\/assets\/chongqing\/chongqing\.js'/);
  assert.match(source,/const rockMarker='let marketInspect=null;'/);
  assert.ok(source.includes('window.__patrolQaRock=(visible)=>'));
  assert.ok(source.includes('rock.visible=visible;'));
  assert.ok(source.includes("false,'03j-market-rock-oblique-without-skin'"));
  assert.ok(source.includes("true,'03k-market-rock-oblique-with-skin'"));
  assert.ok(source.includes('pose.rockTriangles===864'));
  assert.ok(source.includes('pose.rockVertices===475'));
  assert.ok(source.includes('pose.alphaChannels===4'));
  assert.ok(source.includes('pose.minRayTerrainClearance>=1.3'));
  assert.ok(source.includes('Could not restore original Digit8 after rock A/B photos'));
  assert.ok(!runtime.includes('__patrolQaRock'),
    'debug toggle must not be shipped in the actual browser game');
  assert.ok(runtime.includes('const marketRockOutcrop=buildChongqingMarketRockOutcrop('));
  assert.ok(runtime.includes('const obstacleIndex=new SpatialObstacleIndex('));
});
