import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('          if (uAlaska) {');
const end=html.indexOf('                    if (uManhattan) {',start);
assert.ok(start>=0&&end>start,'Production Alaska land raymarch shader present');
const alaska=html.slice(start,end);
test('Alaska terrain photo scales reflect rock, wind-snow and forest independently',()=>{
  assert.match(alaska,/vec2 groundTile=fract\(projected\*mix\(\.107,\.074,snowCoverage\)\)/);
  assert.match(alaska,/vec2 forestTile=fract\(projected\*\.140\)/);
  assert.match(alaska,/float snowCoverage=max\(smoothstep/);
  assert.match(alaska,/vec2 wallUV=abs\(n\.x\)>abs\(n\.z\)\?p\.zy:p\.xy/);
  assert.match(alaska,/textureLod\(uAlaskaPhotoAlbedo,groundUV,lod\)/);
  assert.match(alaska,/textureLod\(uAlaskaPhotoAlbedo,forestUV,lod\)/);
  assert.match(alaska,/if\(uAlaskaPhotoReady\)/,'atlas-missing fallback preserved');
});
test('Surveyed DEM shoreline darkening is only color and never changes geometry',()=>{
  assert.match(alaska,/float coastalStone=\(1\.0-smoothstep\(\.18,1\.85,alt\)\)/);
  assert.match(alaska,/albedo\*=1\.0-coastalStone\*\(\.075\+\.065\*macro\)/);
  assert.doesNotMatch(alaska,/discard\s*;/);
  assert.match(html,/float depth = max\(WATER_H - th, 0\.0\)/);
  assert.match(html,/vec3 reflectedSky = getSky\(roughRefl\)/);
});
