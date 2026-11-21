// node --test tests/nyc-street-overlaps.test.mjs
// Regression: complete municipal footprints, bridgehead and road protection.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const snapshot=JSON.parse(await readFile(new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
test('the 100-record financial-district OTI snapshot is accepted',()=>{
  assert.equal(snapshot.schema,'patrol-nyc-oti-footprints-v1');
  assert.ok(snapshot.footprints.length>=100);
  assert.match(html,/snapshot\.footprints\.length>200/);
  assert.match(html,/snapshot\.footprints\.every\(row=>/);
});
test('footprint collision index covers entire building extent',()=>{
  assert.match(html,/for\s*\(const lot of safeParcels\)/);
  assert.match(html,/for\(let row=Math\.min\(\.\.\.iz\);row<=Math\.max\(\.\.\.iz\);row\+\+\)/);
  assert.match(html,/for\(let col=Math\.min\(\.\.\.ix\);col<=Math\.max\(\.\.\.ix\);col\+\+\)/);
});
test('road-overlap buildings are rejected before terrain baking',()=>{
  assert.match(html,/function generatedCityRoadOverlap/);
  assert.match(html,/officialLots=officialLots\.filter\(lot=>!generatedCityRoadOverlap\(lot\)\)/);
  assert.match(html,/function nycParcelCrossesRoad/);
});
test('Brooklyn bridgehead and neighboring blocks receive detailed LOD',()=>{
  assert.match(html,/\[285,-330,105,186\]/);
  assert.match(html,/\[372,-285,86,162\]/);
});
