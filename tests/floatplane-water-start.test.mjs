import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const a=game.indexOf('  function findFloatWaterStart(){');
const b=game.indexOf('  let gearDown = false;',a);
assert.ok(a>=0&&b>a,'floatplane water-launch search must be extractable');
const choose=new Function('selectedMap','NYC_FLIGHT_RADIUS','FLIGHT_RADIUS',
  'usableFloatWater','boats','sceneryPose','const sceneryTime=0;'+game.slice(a,b)+';return findFloatWaterStart;');

test('the global launcher offers a waterborne start only with appropriate aircraft and map',()=>{
  assert.match(game,/id="waterStartChoice"/);
  assert.match(game,/id="waterStart" type="checkbox" name="waterStart"/);
  assert.match(game,/const waterAvailable=settings\.get\('aircraft'\)==='seaplane'/);
  assert.match(game,/!map\.vegas && !map\.chongqing/);
  assert.match(game,/const waterStartRequested=selectedAircraft==='seaplane' && settings\.has\('waterStart'\)/);
  assert.match(game,/if\(waterStartRequested && !resumedFromCosmos && !alaskaGlacierView\)/);
  assert.match(game,/waterborne=true;\s*console\.info\('\[PATROL\] Water launch validated'/);
});

test('already safe water stays at the actual published map spawn',()=>{
  const start=[-19,33,-667];
  const search=choose({spawn:start,alaska:true},800,800,
    ()=>true,[],()=>[0,0,0]);
  assert.deepEqual(search(),[-19,-667,0]);
  assert.deepEqual(search(),[-19,-667,0],'the chosen berth is deterministic');
});

test('search moves a dry spawn to safely sized water, not an onshore point',()=>{
  const spawn=[100,40,0],isWater=(x,z)=>x<=-18 && Math.abs(z)<140;
  const search=choose({spawn},800,800,isWater,[],()=>[0,0,0]);
  const site=search();
  assert.ok(site,'should find navigable water near a shore');
  assert.ok(isWater(site[0],site[1],site[2]));
  assert.ok(Math.hypot(site[0],site[1])<782);
  assert.notDeepEqual(site.slice(0,2),[spawn[0],spawn[2]]);
});

test('a ferry at the initial spawn forces a different berth',()=>{
  const ship={halfLength:20};
  const search=choose({spawn:[0,50,0]},800,800,()=>true,[ship],()=>[0,0,0]);
  const site=search();
  assert.ok(site && Math.hypot(site[0],site[1])>=29);
});

test('no safe water never places a floatplane on dry land',()=>{
  const search=choose({spawn:[0,50,0]},800,800,()=>false,[],()=>[0,0,0]);
  assert.equal(search(),null);
});
