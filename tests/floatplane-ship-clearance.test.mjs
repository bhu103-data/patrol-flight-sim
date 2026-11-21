// Ensure moving ships are solid for C185 taxi and touchdown (not only spawn).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function clearOfNycHeroDocks(');
const end=html.indexOf('  function findFloatWaterStart()',start);
assert.ok(start>0&&end>start,'production floatplane routines are present');
const makeWater=new Function(
  'selectedMap','NYC_HERO_ROUTE','plane','sampleTerrainHeight','WATER_H',
  'cityLotAt','sceneryObstacle','alaskaObstacles',
  'boats','sceneryPose','sceneryTime',
  html.slice(start,end)+';return usableFloatWater;'
);
const route={spawn:[-108,-594],liberty:[-140,-611]};
function water(boats=[],pose=(ship)=>[ship.x,ship.z,ship.heading],clock=0){
  return makeWater({city:true},route,{yaw:0},()=>12.2,12.2,
    ()=>null,()=>null,[],boats,pose,clock);
}
test('ferry hull blocks floatplane landing and taxi near both pontoons',()=>{
  const ferry={x:300,z:-400,heading:0,halfLength:13,halfWidth:3.3};
  const testWater=water([ferry]);
  assert.equal(testWater(300,-400,0),false,'center of ferry is not navigable');
  assert.equal(testWater(306,-400,0),false,'wing-tip buffer clears port beam');
  assert.equal(testWater(300,-385,0),false,'bow clearance is respected');
  assert.equal(testWater(300,-378,0),true,'open water beyond ferry stays safe');
  assert.equal(testWater(315,-400,0),true,'unobstructed cross-channel water remains');
});
test('collision envelope rotates with ship heading instead of a static world axis',()=>{
  const ferry={x:300,z:-400,heading:Math.PI/2,halfLength:13,halfWidth:3.3};
  const testWater=water([ferry]);
  assert.equal(testWater(315,-400,0),false,'rotated bow remains solid');
  assert.equal(testWater(300,-385,0),true,'side of rotated ferry is unobstructed');
});
test('water check follows the current position of a moving harbor ferry',()=>{
  const ferry={x:300,z:-400,heading:0,halfLength:13,halfWidth:3.3};
  const pose=(ship,t)=>[ship.x+t*20,ship.z,ship.heading];
  assert.equal(water([ferry],pose,0)(300,-400,0),false);
  assert.equal(water([ferry],pose,2)(300,-400,0),true);
  assert.equal(water([ferry],pose,2)(340,-400,0),false);
});
test('no ships means valid open-water touchdown remains possible',()=>{
  assert.equal(water([])(300,-400,0),true);
});

// The aircraft has a 10.922 m wingspan: collision bounds must follow its yaw,
// not just the ship's heading or a fixed 4.4-unit center-point padding.
test('flight heading changes its swept clearance next to a ferry beam',()=>{
  const ferry={x:300,z:-400,heading:0,halfLength:13,halfWidth:3.3};
  const usable=water([ferry]);
  assert.equal(usable(308.5,-400,0),false,
    'parallel wing tips extend into the ferry safety envelope');
  assert.equal(usable(308.5,-400,Math.PI/2),true,
    'crosswise wings do not unnecessarily close the open channel');
  assert.equal(usable(300,-378,0),true,
    'clear water beyond the ferry bow remains available');
});

test('heading-aware clearance follows a ferry turning through ninety degrees',()=>{
  const ferry={x:300,z:-400,heading:Math.PI/2,halfLength:13,halfWidth:3.3};
  const usable=water([ferry]);
  assert.equal(usable(300,-391.5,Math.PI/2),false,
    'wings parallel to rotated ferry occupy its beam');
  assert.equal(usable(300,-391.5,0),true,
    'orthogonal wings leave sufficient cross-channel space');
});

test('diagonal taxi gap is passable while a real wing contact is blocked',()=>{
  const buoy={x:300,z:-400,heading:0,halfLength:.5,halfWidth:.5};
  const testWater=water([buoy]);
  assert.equal(testWater(305.4,-394.6,Math.PI/4),true,
    'airplane nose clears the tiny hull on both aircraft axes');
  assert.equal(testWater(303.5,-396.5,Math.PI/4),false,
    'a closer diagonally aligned aircraft intersects the buffered hull');
});
