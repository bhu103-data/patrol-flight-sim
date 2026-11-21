// NYC Tidewater-inspired native WebGL2 water: bounded, reversible visual layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const at=html.indexOf('  const WORLD_FS = ');
assert.ok(at>0,'existing native WebGL2 terrain + ocean shader is required');
const shader=html.slice(at,html.indexOf('  const WORLD_',at+20)>at?
  html.indexOf('  const WORLD_',at+20):at+64000);
test('NYC water detail is compile-time reversible and guarded by city and pixel size',()=>{
  assert.match(shader,/const bool NYC_TIDEWATER_DETAIL = true;/);
  assert.match(shader,/if\(uManhattan && NYC_TIDEWATER_DETAIL && pixel < 14\.0\)/);
  assert.match(shader,/if\(uManhattan && NYC_TIDEWATER_DETAIL && pixel < 2\.0\)/);
  assert.equal(html.split('const bool NYC_TIDEWATER_DETAIL = true;').length-1,1);
});
test('dark water gusts stay world-space and do not touch wave displacement or C185',()=>{
  assert.match(shader,/vnoise\(xz\*0\.0068\+/);
  assert.match(shader,/nycGustPatch=smoothstep/);
  assert.match(shader,/roughness=clamp\(roughness\*\(1\.0\+0\.20\*nycGustPatch\)/);
  assert.match(shader,/waterCol \*= 1\.0-0\.058\*nycGustPatch/);
  assert.match(html,/float oceanHeight\(vec2 xz, float depth, float pixel\)/);
  assert.match(html,/floatOceanPose\(x,z,plane\.yaw/);
  assert.match(html,/sampleFloatOceanFloor\(x,z\)/);
});
test('fragmented foam fades into stable distant average without new textures',()=>{
  assert.match(shader,/foamFragment=smoothstep\(0\.30,0\.70/);
  assert.match(shader,/foamResolve=1\.0-smoothstep\(0\.42,2\.0,pixel\)/);
  assert.match(shader,/caps \*= fragmented;/);
  assert.match(shader,/shore \*= fragmented;/);
  assert.doesNotMatch(shader,/uniform sampler2D uTidewater/);
});
test('subpixel caustics are filtered only in NYC',()=>{
  assert.match(shader,/causticFootprint=\(uManhattan && NYC_TIDEWATER_DETAIL\)/);
  assert.match(shader,/focus=oceanCaustic\(floorXZ,depth\)\*localDetail\*/);
});
test('existing same-camera A/B harness covers crest and sea-detail independently',()=>{
  const testTool=readFileSync(new URL('../tools/aircraft/nyc-water-crest-compare.mjs',import.meta.url),'utf8');
  assert.match(testTool,/PATROL_COMPARE_MODE==='sea-detail'/);
  assert.match(testTool,/const bool NYC_TIDEWATER_DETAIL = false;/);
  assert.match(testTool,/nyc-water-'\+report\.mode/);
  assert.match(testTool,/gpuFrameMs:null/);
});
