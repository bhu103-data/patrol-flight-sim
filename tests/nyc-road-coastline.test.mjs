// Verify NYC coastal road safety across the entire asphalt + sidewalk width.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const text=await readFile(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
const {buildNycStreetNetwork}=await import('data:text/javascript;base64,'+
  Buffer.from(text).toString('base64'));

const grid={blockWidth:24,blockLength:33,tilt:.24,offset:30,
  parkHalfWidth:43,parkHalfLength:151,parkCenter:10000};
function build(terrainAt){
  const ribbons=[];
  const stats=buildNycStreetNetwork({
    addQuad(){},addTri(){},box(){},beam(){},
    ribbon(a,b,width,color){ribbons.push({a,b,width,color})},
    terrainAt,detailBand:()=>3,grid,streetY:20,waterY:0,
    timesBounds:[900,1000,900,1000],existingStreets:[],
    isClear:()=>true
  });
  return {ribbons,stats};
}
function crossingAtEight(ribbons){
  return ribbons.some(r=>
    r.width===6.35 &&
    Math.abs(r.a[0]-(30+.24*r.a[2]))<.01 &&
    Math.abs(r.b[0]-(30+.24*r.b[2]))<.01 &&
    Math.min(r.a[2],r.b[2])<8 &&
    Math.max(r.a[2],r.b[2])>8);
}
test('complete Manhattan avenue exists over continuous dry ground',()=>{
  assert.equal(crossingAtEight(build(()=>100).ribbons),true);
});
test('a narrow water inlet through asphalt must clip that avenue',()=>{
  const wet=(x,z)=>Math.abs(z-8)<1.6 &&
    Math.abs(x-(30+.24*z))<1.7?0:100;
  const scene=build(wet);
  assert.equal(crossingAtEight(scene.ribbons),false);
  assert.ok(scene.stats.skippedRoadFootprints>0);
});
test('a water inlet under only the sidewalk also clips avenue asphalt',()=>{
  const wet=(x,z)=>Math.abs(z-8)<1.6 &&
    Math.abs(x-(30+.24*z)-4.25)<1.4?0:100;
  const scene=build(wet);
  assert.equal(crossingAtEight(scene.ribbons),false);
  assert.ok(scene.stats.skippedRoadFootprints>0);
});

test('coastal food carts need a dry footprint, not merely a dry center',()=>{
  const dry=build(()=>100);
  assert.ok(dry.stats.hotDogCarts>=4,'fixture baseline must include vendor stands');
  // The Times Square vendor at (-4.4, 9.1) has a dry center, but this
  // tiny diagonal inlet floods the edge of its 2.35-unit footprint.
  const wet=(x,z)=>Math.hypot(x-(-4.4+2.35),z-(9.1+2.35))<.22?0:100;
  const harbor=build(wet);
  assert.equal(harbor.stats.hotDogCarts,dry.stats.hotDogCarts-1,
    'a dry cart center must not allow the kiosk to extend into water');
  assert.ok(harbor.stats.skippedWater>0);
});

test('a sub-texel shoreline inlet cannot slip between road water probes',()=>{
  // On the i=0 Manhattan avenue, the old 1.8-unit probe interval missed
  // the waterline at z≈13.03; the rendered full-width asphalt crossed water.
  const inletZ=13.026315789473685;
  const wet=(x,z)=>Math.abs(z-inletZ)<.09 &&
    Math.abs(x-(30+.24*z))<5?0:100;
  const avenue=ribbons=>ribbons.filter(r=>r.width===6.35 &&
    Math.abs(r.a[0]-(30+.24*r.a[2]))<.025 &&
    Math.abs(r.b[0]-(30+.24*r.b[2]))<.025 &&
    r.a[2]>=-.01&&r.b[2]<=33.01);
  const clear=avenue(build(()=>100).ribbons);
  assert.ok(clear.some(r=>r.a[2]<inletZ&&r.b[2]>inletZ),
    'unobstructed original avenue must remain connected');
  const coast=build(wet),segments=avenue(coast.ribbons);
  assert.ok(coast.stats.skippedRoadFootprints>0);
  assert.equal(segments.some(r=>r.a[2]<inletZ&&r.b[2]>inletZ),false,
    'new half-step shoreline probes must break asphalt at the inlet');
  assert.ok(segments.some(r=>r.b[2]<8) &&
    segments.some(r=>r.a[2]>17),
    'preserve safe road approaches rather than erasing the whole block');
});
