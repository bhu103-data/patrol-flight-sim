import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('  function nycDetailBand(');
const b=html.indexOf('  const WARNING_DISTANCE',a);
assert.ok(a>0&&b>a,'NYC LOD policy must be extractable');
const NYC_HERO_ROUTE={spawn:[-140,-611],coreRadius:102,skylineRadius:178};
const NYC_FOCUS_ZONES=[
  [82,-342,78,118],[285,-330,105,186],[372,-285,86,162],
  [-85,-398,75,112]
];
const lod=new Function('nycHeroDistance','NYC_HERO_ROUTE','NYC_FOCUS_ZONES',
  html.slice(a,b)+'return nycDetailBand;')(
    ()=>999,NYC_HERO_ROUTE,NYC_FOCUS_ZONES);

test('Bridge/DUMBO focal pockets receive real LOD3 rather than LOD2',()=>{
  assert.equal(lod(285,-330),3);
  assert.equal(lod(372,-285),3);
  assert.equal(lod(298,-357),3);
});
test('Brooklyn LOD3 is bounded and does not inflate the entire island',()=>{
  assert.ok(lod(480,-285)<3);
  assert.ok(lod(250,-440)<3);
  assert.ok(lod(440,-195)<3);
  assert.equal(lod(285,-330),3);
});
test('Manhattan scenic corridor retains existing high detail',()=>{
  assert.equal(lod(-60,-320),3);
});
