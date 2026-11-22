import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=s.indexOf('// Alaska-only two-layer auroral curtains:');
const end=s.indexOf('vec3 getSky(vec3 rd)',start);
assert.ok(start>=0&&end>start,'Alaska-only shader section exists');
const aurora=s.slice(start,end);
test('aurora uses bounded two-layer single-noise animation with pixel anti-aliasing',()=>{
  assert.match(aurora,/for\(int i=0;i<2;i\+\+\)/);
  assert.equal((aurora.match(/vnoise\(/g)||[]).length,1,
    'one advected noise field per layer avoids duplicate sky/ocean cost');
  assert.match(aurora,/fwidth\(az\)/);
  assert.match(aurora,/return clamp\(light\*visibility/);
  assert.match(aurora,/uAtmosphere\.z/);
  assert.match(aurora,/uAtmosphere\.w/);
  assert.match(aurora,/uSun\.y/);
});
test('aurora remains Alaska-only, night-only and uses shared sky water reflection',()=>{
  assert.match(s,/if\(uAlaska\)horizon\+=alaskaAurora\(rd\)/);
  assert.match(s,/vec3 reflectedSky = getSky\(roughRefl\)/);
  assert.match(aurora,/float night=1\.0-smoothstep\(-0\.22,-0\.11,uSun\.y\)/);
  assert.doesNotMatch(aurora,/texture\(/,'no new photo atlas or download');
  assert.match(s,/return oceanExposure\(xz\)\*height\*\(uAlaska\?0\.30:1\.0\)/);
});
