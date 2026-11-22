// Compat-port of the previously evidenced Vegas fixed camera from draft #112.
// This source guard does not replace same-camera WebGL screenshot review.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const script=await readFile(new URL('../scripts/vegas-core-browser-smoke.mjs',import.meta.url),'utf8');

test('Strip street camera avoids the known foreground-post framing regression',()=>{
  const matches=[...html.matchAll(/\{site:\{name:'Strip Street View'\},x:([\d.-]+),z:([\d.-]+),height:([\d.-]+),bearing:([\d.-]+),radius:([\d.-]+),rise:([\d.-]+),/g)];
  assert.equal(matches.length,1,'keep one selectable Strip street view');
  const [x,z,height,bearing,radius,rise]=matches[0].slice(1).map(Number);
  assert.deepEqual([x,z,height,bearing,radius,rise],[-23,-171.5,1.5,152,10,2],
    'exact compatible camera correction from source PR #112');
});
test('six-camera QA still captures the actual Vegas near view in WebGL2',()=>{
  assert.match(script,/selectOption\(\{label:'Strip Street View'\}\)/);
  assert.match(script,/vegas-core-'\+view\+'-'\+preset\+'\.png/);
  assert.match(script,/telemetry\.webgl2&&telemetry\.error===0/);
  assert.match(html,/\{site:\{name:'Strip Street View'\}/);
});
