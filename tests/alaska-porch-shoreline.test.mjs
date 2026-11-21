// Exercise the actual Alaska harbor authoring code with a synthetic shoreline.
// A dry cabin foundation must not imply that its projecting porch and stairs
// also sit on dry ground; narrow inlets can run between their center probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=game.indexOf('  function buildAlaskaHarbor() {');
const end=game.indexOf('  function buildAlaskaFalls()',start);
assert.ok(start>=0 && end>start,'production Alaska harbor source is available');

const harborSource=game.slice(start,end);
const first={x:132,z:-538,w:10,d:16};
const porchX=first.x+.12*first.w;
const porchZ=first.z-first.d/2-1.10;
const stepZ=porchZ-1.02;

function generateHarbor(floodAt=null){
  const boxes=[],obstacles=[];
  const terrain=(x,z)=>floodAt&&Math.hypot(x-floodAt[0],z-floodAt[1])<.16
    ? 12.2 : 17;
  const addTri=()=>{},addQuad=()=>{};
  const createTriangleMesh=()=>({addTri,addQuad,upload:()=>({})});
  const addModelBox=(_,x,y,z,w,h,d)=>boxes.push({x,y,z,w,h,d});
  const addRideBeam=()=>{},pushRoadStrip=()=>{};
  const builder=new Function('createTriangleMesh','addModelBox','addRideBeam',
    'lerp','clamp','pushRoadStrip','ALASKA_PLACES','sampleTerrainHeight',
    'WATER_H','alaskaObstacles','console',
    harborSource+';return buildAlaskaHarbor;')(
      createTriangleMesh,addModelBox,addRideBeam,
      (a,b,t)=>a+(b-a)*t,(n,a,b)=>Math.max(a,Math.min(b,n)),
      pushRoadStrip,
      {harbor:{x:151,z:-525},beacon:{x:-155,z:-610}},
      terrain,12.2,obstacles,{info(){}}
    );
  builder();
  const matches=(w,d,z)=>boxes.some(b=>Math.abs(b.x-porchX)<.01 &&
    Math.abs(b.z-z)<.01&&Math.abs(b.w-w)<.01&&Math.abs(b.d-d)<.01);
  return {boxes,obstacles,
    porch:matches(2.66,1.88,porchZ),
    stairs:matches(1.72,.35,stepZ)};
}

test('a cabin on dry ground keeps its porch and steps on a flat dry shelf',()=>{
  const scene=generateHarbor();
  assert.ok(scene.obstacles.some(o=>o.name==='harbor building'&&
    Math.abs(o.x-first.x)<.01&&Math.abs(o.z-first.z)<.01));
  assert.ok(scene.porch,'dry porch is rendered');
  assert.ok(scene.stairs,'dry entrance stairs are rendered');
});

test('a narrow flooded outer porch corner rejects only the unsafe porch',()=>{
  // The old three centerline probes at z=porchZ all read dry ground.
  // This pocket is under the far corner of the 2.66 x 1.88 m deck.
  const scene=generateHarbor([porchX+1.33,porchZ-.94]);
  assert.ok(scene.obstacles.some(o=>o.name==='harbor building'&&
    Math.abs(o.x-first.x)<.01&&Math.abs(o.z-first.z)<.01),
    'dry cabin foundation remains placed');
  assert.equal(scene.porch,false,'a flooded outer corner prevents deck creation');
  assert.equal(scene.stairs,false,'no detached stairs appear when porch is rejected');
});

test('a flooded stair outer edge does not create suspended or submerged steps',()=>{
  // The porch itself remains dry; only the furthest tread edge is wet.
  const scene=generateHarbor([porchX+.86,stepZ-.43]);
  assert.equal(scene.porch,true,'dry porch remains rendered');
  assert.equal(scene.stairs,false,'wet tread corner rejects stairs');
});
