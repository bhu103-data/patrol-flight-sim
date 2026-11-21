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
