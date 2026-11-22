import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('water diagnostics are URL opt-in and mode zero keeps the normal path', () => {
  assert.match(source, /pageParams\.get\('diag'\) \|\| '0'/);
  assert.match(source, /Math\.max\(0, Math\.min\(4,/);
  assert.match(source, /gl\.uniform1i\(uWorld\.diagMode,diagMode\)/);
  assert.match(source, /gl\.uniform1i\(uMesh\.diagMode,diagMode\)/);
  assert.match(source, /window\.PatrolWaterDiagnostic=/);
  assert.match(source, /const targetCam = diagnosticCamera \|\|/);
});

test('diagnostic colors isolate sky, water, fog and sphere without replacing normal formulas', () => {
  assert.match(source, /uDiagMode==1 && !hitSurface/);
  assert.match(source, /uDiagMode==2\)reflectedSky=vec3\(0\.0,1\.0,1\.0\)/);
  assert.match(source, /uDiagMode==3\)return vec3\(0\.0,appliedFog,0\.0\)/);
  assert.match(source, /uDiagMode==4[\s\S]*?vec4\(1\.0,1\.0,0\.0,1\.0\)/);
  assert.match(source, /waterCol=mix\(waterCol,reflectedSky,waterReflectance\)/);
  assert.match(source, /vec3 reflectedSky = getSky\(roughRefl,false\)/);
  assert.match(source, /vec3 col = getSky\(rd,true\)/);
  assert.match(source, /min\(ggx \* facetSparkle, 6\.0\) \* mix\(0\.045,0\.075,localDetail\)/);
  assert.match(source, /return mix\(col,haze,appliedFog\)/);
});
