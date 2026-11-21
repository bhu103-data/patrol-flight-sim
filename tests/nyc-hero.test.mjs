// Run: node --test tests/nyc-hero.test.mjs
// No renderer, external packages or licensed 3D downloads required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../assets/nyc/nyc-hero.js', import.meta.url), 'utf8');
const { buildNycHeroScenery } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

function build(groundY) {
  let quads=0, boxes=0, beams=0, maxRadius=0, smallestArea=Infinity;
  const island=[-140,-611];
  const point = p => {
    assert.ok(Array.isArray(p) && p.length === 3);
    for (const value of p) assert.ok(Number.isFinite(value));
    maxRadius=Math.max(maxRadius,Math.hypot(p[0]-island[0],p[2]-island[1]));
  };
  const stats=buildNycHeroScenery({
    waterY:0, groundY, liberty:island, spawn:[-108,-594],
    addQuad:(a,b,c,d,color) => {
      quads++;
      [a,b,c,d].forEach(point);
      assert.equal(color.length,3);
      const ab=b.map((v,i)=>v-a[i]), ac=c.map((v,i)=>v-a[i]);
      const cross=[
        ab[1]*ac[2]-ab[2]*ac[1],
        ab[2]*ac[0]-ab[0]*ac[2],
        ab[0]*ac[1]-ab[1]*ac[0]
      ];
      smallestArea=Math.min(smallestArea,Math.hypot(...cross)*.5);
    },
    box:(x,y,z,w,h,d,color) => {
      boxes++;
      point([x,y,z]);
      for(const size of [w,h,d])assert.ok(Number.isFinite(size) && size>0);
      assert.equal(color.length,3);
    },
    beam:(a,b,width,color) => {
      beams++;
      point(a);point(b);
      assert.ok(Number.isFinite(width) && width>0);
      assert.equal(color.length,3);
    }
  });
  return {quads,boxes,beams,maxRadius,smallestArea,stats};
}

for (const groundY of [1,2.2,4.8]) {
  test('Liberty Island is bounded, finite and detailed at elevation ' + groundY,()=>{
    const result=build(groundY);
    assert.equal(result.stats.starPoints,11);
    assert.equal(result.stats.westFerryDeckPanels,18);
    assert.ok(result.stats.masonryPanels>400);
    assert.ok(result.quads<1700 && result.boxes<700 && result.beams<500);
    assert.ok(result.maxRadius<68,'all new details must remain local to Liberty Island');
    assert.ok(result.smallestArea>0.000001,'avoid degenerate quads');
  });
}

test('west side contains the ferry detail without moving the existing spawn jetty',()=>{
  const result=build(2.2);
  assert.equal(result.stats.pierPanels,8);
  assert.equal(result.stats.walkwayPanels,44);
  assert.equal(result.stats.westFerryDeckPanels,18);
});
