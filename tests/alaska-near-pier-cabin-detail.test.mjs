import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('  function buildAlaskaHarbor() {');
const end=source.indexOf('  function buildAlaskaFalls()',start);
assert.ok(start>=0&&end>start,'real Alaska harbor is present');
const current=source.slice(start,end);
// Compare the same six cabin sites and dry terrain with and without the two
// opt-in near-field joinery flags. This never duplicates the harbor builder.
const minimal=current.replace('10,16,red,true);','10,16,red);')
  .replace('11,14,[0.36,0.48,0.45],true);','11,14,[0.36,0.48,0.45]);');
assert.notEqual(minimal,current,'two near-pier huts must opt into joinery');

function render(builderText,terrain=()=>17){
  const boxes=[],beams=[],obstacles=[];
  const quad=()=>{},tri=()=>{};
  const fn=new Function('createTriangleMesh','addModelBox','addRideBeam',
    'lerp','clamp','pushRoadStrip','ALASKA_PLACES','sampleTerrainHeight',
    'WATER_H','alaskaObstacles','console',
    builderText+'return buildAlaskaHarbor;')(
    ()=>({addQuad:quad,addTri:tri,upload:()=>({})}),
    (_,x,y,z,w,h,d,color)=>boxes.push({x,y,z,w,h,d,color}),
    (_,start,end,width,color)=>beams.push({start,end,width,color}),
    (a,b,t)=>a+(b-a)*t,
    (v,a,b)=>Math.max(a,Math.min(b,v)),
    ()=>{}, {harbor:{x:151,z:-525},beacon:{x:-155,z:-610}},
    terrain,12.2,obstacles,{info(){}});
  fn();
  return {boxes,beams,obstacles};
}

test('exactly two cabins receive actual timber geometry without moving obstacles',()=>{
  const rich=render(current),base=render(minimal);
  assert.deepEqual(rich.obstacles,base.obstacles,
    'added visible joinery must not alter all six cabins or docking collision');
  assert.equal(rich.obstacles.filter(o=>o.name==='harbor building').length,6);
  assert.equal(rich.beams.length-base.beams.length,8,
    'two cabins gain two gable ends with paired projecting roof bars');
  assert.equal(rich.boxes.length-base.boxes.length,44,
    'two dry porches gain four louver bars, rails and deck seams each');
  assert.ok(rich.boxes.every(b=>[b.x,b.y,b.z,b.w,b.h,b.d].every(Number.isFinite)));
  assert.ok(rich.boxes.every(b=>b.w>0&&b.h>0&&b.d>0));
});

test('new porch joinery is absent when surveyed shoreline makes deck unsafe',()=>{
  const terrain=(x,z)=>z< -540?12.2:17;
  const rich=render(current,terrain),base=render(minimal,terrain);
  assert.deepEqual(rich.obstacles,base.obstacles);
  assert.equal(rich.beams.length-base.beams.length,8);
  // Even when a porch is blocked, eaves/vents remain on dry cabins.
  assert.ok(rich.boxes.length-base.boxes.length<=44);
});

test('compatibility and other maps retain existing lifecycle guards',()=>{
  assert.match(source,/if\(selectedMap\.alaska && !graphicsCompat && smoothScenery\(\)\)/);
  assert.match(source,/if \(!selectedMap\.alaska\) return;/);
  assert.match(source,/disposeSceneMesh\(alaskaHarbor\)/);
});
