// Actual Chongqing production terrain, the 72x50-unit playable restaurant
// and its neighboring approach. No synthetic isolated hillside substitution.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
const moduleText=await readFile(new URL('../assets/chongqing/hotpot-terrace-grade.js',import.meta.url),'utf8');
const {HOTPOT_TERRACE,hotpotTerraceWeight,gradeChongqingHotpotTerrain}=
  await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));
const start=source.indexOf('const riverCenter=');
const end=source.indexOf('const worldGeometry=',start);
assert.ok(start>0&&end>start,'production river and ground formula exist');
const terrain=new Function('gradeChongqingHotpotTerrain','clamp',
  source.slice(start,end)+
  ';return {ground,ungradedGround,HOTPOT_TERRACE_FLOOR};')(
    gradeChongqingHotpotTerrain,
    (x,a,b)=>Math.max(a,Math.min(b,x))
  );
const {ground,ungradedGround,HOTPOT_TERRACE_FLOOR:floor}=terrain;
const site=[[249,200],[249,250],[321,200],[321,250]];
const span=ys=>Math.max(...ys)-Math.min(...ys);

test('real hillside used to penetrate shop corners by tens of game units',()=>{
  const original=site.map(([x,z])=>ungradedGround(x,z));
  assert.ok(span(original)>35,'must target a real old foundation defect');
  assert.ok(Math.abs(floor-ungradedGround(285,253))<1e-10);
  assert.ok(floor>40&&floor<50);
});

test('all four actual shop body corners share the same terraced support plane',()=>{
  const flat=site.map(([x,z])=>ground(x,z));
  assert.ok(span(flat)<1e-8,'world mesh, physics and building foot must align');
  for(const y of flat)assert.ok(Math.abs(y-floor)<1e-8);
  assert.equal(hotpotTerraceWeight(285,225),1);
  assert.equal(hotpotTerraceWeight(249,250),1);
  assert.ok(Math.abs(ground(285,265)-floor)<.15,
    'playable hotpot start and small iron bowl stand on the entry apron');
  assert.match(source,/hotpotTerraceCornerSpread:/);
  assert.match(source,/HOTPOT_TERRACE_FLOOR=ungradedGround\(285,253\)/);
});

test('outside bounded shop grading, city/river/remote Hongyadong terrain is identical',()=>{
  for(const [x,z] of [[0,0],[155,225],[285,375],[400,225],[285,105],
    [-355,176],[-121,-345],[285,-20],[750,250],[170,255]]){
    assert.equal(ground(x,z),ungradedGround(x,z),`no change at ${x},${z}`);
    assert.equal(hotpotTerraceWeight(x,z),0);
  }
  assert.ok(HOTPOT_TERRACE.outerHalfWidth<112);
  assert.ok(HOTPOT_TERRACE.outerHalfDepth<115);
});

test('slope blend is continuous and avoids adding a sharp retaining cliff',()=>{
  let maxStep=0;
  for(let x=177;x<=393;x+=2)for(let z=114;z<=337;z+=2){
    const here=ground(x,z);
    assert.ok(Number.isFinite(here));
    maxStep=Math.max(maxStep,
      Math.abs(ground(x+1,z)-here),Math.abs(ground(x,z+1)-here));
  }
  assert.ok(maxStep<1.65,'graded slope must not develop a >1.65-unit vertical 1-unit step: '+maxStep);
  for(const x of [176,394])for(const z of [170,225,280])
    assert.equal(ground(x,z),ungradedGround(x,z));
});

test('terrace preserves shop door, miniature hotpot and full game state behavior',()=>{
  assert.match(source,/const hotpotDoor=\{x:hotpot\.x,z:hotpot\.z\+34,y:shopY\+2\.7\}/);
  assert.match(source,/state=\{[\s\S]*?pos:new THREE\.Vector3\(285,ground\(285,265\)\+2\.7,265\)/);
  assert.match(source,/buildChongqingHotpotDisplay\(\{[\s\S]*?x:278,z:hotpot\.z\+31/);
  assert.match(source,/pbr\.cutStone/);
  assert.match(source,/state\.flying=key!=='Digit4'/);
  assert.ok(Math.abs(ground(285,259)-floor)<1e-8);
  assert.throws(()=>gradeChongqingHotpotTerrain(NaN,45,285,225),RangeError);
});
