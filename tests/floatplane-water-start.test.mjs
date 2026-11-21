import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const a=game.indexOf('  function findFloatWaterStart(){');
const b=game.indexOf('  let gearDown = false;',a);
assert.ok(a>=0&&b>a,'floatplane water-launch search must be extractable');
const choose=new Function('selectedMap','NYC_FLIGHT_RADIUS','FLIGHT_RADIUS','WARNING_DISTANCE',
  'usableFloatWater','boats','sceneryPose','const sceneryTime=0;'+game.slice(a,b)+';return findFloatWaterStart;');

test('the global launcher offers a waterborne start only with appropriate aircraft and map',()=>{
  assert.match(game,/id="waterStartChoice"/);
  assert.match(game,/id="waterStart" type="checkbox" name="waterStart"/);
  assert.match(game,/const waterAvailable=settings\.get\('aircraft'\)==='seaplane'/);
  assert.match(game,/!map\.vegas && !map\.chongqing/);
  assert.match(game,/const waterStartRequested=selectedAircraft==='seaplane' && settings\.has\('waterStart'\)/);
  assert.match(game,/if\(waterStartRequested && !resumedFromCosmos &&\s*!alaskaGlacierView && !alaskaHarborView\)/);
  assert.match(game,/waterborne=true;\s*console\.info\('\[PATROL\] Water launch validated'/);
});

test('already safe water stays at the actual published map spawn',()=>{
  const start=[-19,33,-667];
  const search=choose({spawn:start,alaska:true},735,860,130,
    ()=>true,[],()=>[0,0,0]);
  assert.deepEqual(search(),[-19,-667,0]);
  assert.deepEqual(search(),[-19,-667,0],'the chosen berth is deterministic');
});

test('search moves a dry spawn to safely sized water, not an onshore point',()=>{
  const spawn=[100,40,0],isWater=(x,z)=>x<=-18 && Math.abs(z)<140;
  const search=choose({spawn},800,800,130,isWater,[],()=>[0,0,0]);
  const site=search();
  assert.ok(site,'should find navigable water near a shore');
  assert.ok(isWater(site[0],site[1],site[2]));
  assert.ok(Math.hypot(site[0],site[1])<782);
  assert.notDeepEqual(site.slice(0,2),[spawn[0],spawn[2]]);
});

test('a ferry at the initial spawn forces a different berth',()=>{
  const ship={halfLength:20};
  const search=choose({spawn:[0,50,0]},800,800,130,()=>true,[ship],()=>[0,0,0]);
  const site=search();
  assert.ok(site && Math.hypot(site[0],site[1])>=29);
});

test('no safe water never places a floatplane on dry land',()=>{
  const search=choose({spawn:[0,50,0]},800,800,130,()=>false,[],()=>[0,0,0]);
  assert.equal(search(),null);
});

test('Alaska southern open water is rejected when it leads into boundary assist',()=>{
  // A fjord opening points south from the actual Alaska spawn. Its water
  // surface stays open beyond the game-world edge, so a 94m water-only test
  // incorrectly launched straight into the automatic boundary turn.
  const spawn=[-19,33,-667];
  const isWater=(x,z)=>x>-38&&x<0&&z<-644;
  const select=choose({spawn,alaska:true},735,860,130,
    isWater,[],()=>[0,0,0]);
  const berth=select();
  assert.ok(!berth ||
    !(Math.abs(berth[0]+19)<1e-8 && Math.abs(berth[1]+667)<1e-8
      && Math.abs(Math.cos(berth[2])+1)<1e-8),
    'do not launch south from the old boundary-facing spawn');
  if(berth){
    const end=[berth[0]+Math.sin(berth[2])*132,
      berth[1]+Math.cos(berth[2])*132];
    assert.ok(Math.hypot(...end)<=860-130-8,
      'water takeoff corridor must end before boundary auto-turn');
  }
});
