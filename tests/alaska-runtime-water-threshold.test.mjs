// Regression-test the ACTUAL production terrain generator with the real
// Alaska 3DEP asset. Do not confuse a GIS <=3m QA proxy with the game's
// measured-elevation >1m land switch or its compressed vertical units.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const demFile = JSON.parse(readFileSync(
  new URL('../assets/alaska/tracy-arm-3dep.json', import.meta.url), 'utf8'));
const raw = Buffer.from(demFile.heightsBase64, 'base64');
assert.equal(raw.byteLength, 256 * 256 * 2);

const demHeights = new Uint16Array(256 * 256);
for (let i = 0; i < demHeights.length; i++)
  demHeights[i] = raw.readUInt16LE(i * 2);

// Use the worker source function verbatim instead of duplicating its branch.
// The preview path stops before expensive shadows and RGBA8 quantization.
const functionStart = html.indexOf('  function* generateTerrain(options) {');
const functionEnd = html.indexOf('\n  const workerSrc = ' + String.fromCharCode(96), functionStart);
assert.ok(functionStart > 0 && functionEnd > functionStart,
  'worker uses the same extractable terrain generator as previews');
const factory = new Function('return (' + html.slice(functionStart, functionEnd).trim() + ')');
const generateTerrain = factory();

const water = 12.2, scale = 75, size = 128, span = 1920;
const verticalScale = Math.min(.04, (scale * .90 - water) / demFile.maxElevationMeters);
const options = {
  size, span, landmarks: [], scale, water,
  airfield: null, city: null, alaska: true, vegas: null, dc: null,
  chongqing: null, preview: true,
  alaskaDEM: {
    heights: demHeights,
    width: 256, height: 256, verticalScale,
  },
};

function sourceMeters(u, v) {
  // Same georeferenced interpolation as actual generateTerrain():
  // game east => south-first DEM rows decreasing, game north => DEM east.
  const x = Math.max(0, Math.min(255, v * 256 - .5));
  const z = Math.max(0, Math.min(255, (1 - u) * 256 - .5));
  const x0 = Math.floor(x), z0 = Math.floor(z);
  const x1 = Math.min(x0 + 1, 255), z1 = Math.min(z0 + 1, 255);
  const tx = x - x0, tz = z - z0;
  const h = (ix, iz) => demHeights[iz * 256 + ix];
  return (h(x0,z0) * (1-tx) + h(x1,z0)*tx) * (1-tz) +
    (h(x0,z1)*(1-tx) + h(x1,z1)*tx) * tz;
}
function previewData() {
  for (const event of generateTerrain(options))
    if (event && event.type === 'preview') return event.height;
  throw new Error('Production preview did not return terrain heights');
}

test('production Alaska terrain preview follows DEM 1m water threshold at every cell', () => {
  const terrain = previewData();
  assert.equal(terrain.length, size * size);
  let sea = 0, land = 0, changedBetween1And3 = 0;
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const u = (col + .5) / size, v = (row + .5) / size;
    const metres = sourceMeters(u, v);
    const expectedHeight = Math.max(.02, Math.min(.96,
      (metres > 1 ? water + metres * verticalScale : water - 4.5) / scale));
    const actual = terrain[row * size + col];
    assert.ok(Number.isFinite(actual));
    assert.ok(Math.abs(actual - expectedHeight) < 1e-6,
      'terrain geometry must match game DEM at ' + col + ',' + row);
    if (metres <= 1) {
      sea++;
      assert.ok(actual * scale < water - 1, 'submerged survey terrain must stay below water');
    } else {
      land++;
      assert.ok(actual * scale > water, 'survey height above 1m must be dry land');
      if (metres <= 3) changedBetween1And3++;
    }
  }
  assert.ok(sea > 400 && land > 400, 'real fjord includes land and water');
  assert.ok(changedBetween1And3 > 0,
    'game threshold 1m differs from the older GIS diagnostic 3m threshold');
});

test('floatplane uses the same game-world water height and 25-contact shore guard', () => {
  assert.match(html, /const WATER_H = 12\.2;/);
  assert.match(html, /return Math\.max\(h, WATER_H\);/);
  assert.match(html, /const metres=measuredHeight\(u,v\);/);
  assert.match(html, /metres>1\s*\?\s*water\+metres\*options\.alaskaDEM\.verticalScale/);
  assert.match(html, /for\(const along of \[-3\.05,-1\.525,0,1\.525,3\.05\]\)/);
  assert.match(html, /for\(const across of \[-1\.85,-\.925,0,\.925,1\.85\]\)/);
  assert.match(html, /sampleTerrainHeight\(px,pz\)>WATER_H\+\.06/);
  assert.match(html, /if\(floatplane && !crash\)/);
  assert.match(html, /floor<=WATER_H\+\.06/);
  assert.match(html, /new URLSearchParams\(location\.search\)\.get\('alaskaTerrain'\)!=='legacy'/);
});
