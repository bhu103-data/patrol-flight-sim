import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const anchor=game.indexOf('  function clearOfNycHeroDocks(');
const stop=game.indexOf('  function findFloatWaterStart()',anchor);
const finish=game.indexOf('  let gearDown = false;',stop);
assert.ok(anchor>=0 && stop>anchor && finish>stop);
const hero={spawn:[-108,-594],liberty:[-140,-611]};
const buildWater=new Function('selectedMap','NYC_HERO_ROUTE','plane',
  'sampleTerrainHeight','WATER_H','cityLotAt','sceneryObstacle',
  'alaskaObstacles',game.slice(anchor,stop)+';return usableFloatWater;');
const city={city:true,spawn:[-108,48,-594]};
const water=buildWater(city,hero,{yaw:0},()=>12.2,12.2,()=>null,()=>null,[]);
const search=new Function('selectedMap','NYC_FLIGHT_RADIUS','FLIGHT_RADIUS',
  'usableFloatWater','boats','sceneryPose','const sceneryTime=0;'+
  game.slice(stop,finish)+';return findFloatWaterStart;');

test('Liberty Island spawn-facing jetty is solid even where the DEM says water',()=>{
  assert.equal(water(-108,-594,0),false,
    'default aircraft spawn occupies the authored ferry deck');
  assert.equal(water(-114,-598,0),false,
    'wing tip clearance must include approach rails');
  assert.equal(water(-184,-606,0),false,
    'western ferry pier must also be excluded');
  assert.equal(water(-40,-700,0),true,
    'far offshore water remains usable');
});

test('water launch search relocates aircraft offshore from Liberty ferry dock',()=>{
  const locate=search(city,850,850,water,[],()=>[0,0,0]);
  const pos=locate();
  assert.ok(pos,'safe ocean berth exists near the original launch');
  assert.notDeepEqual(pos.slice(0,2),hero.spawn,'never launch inside ferry walkway');
  assert.ok(water(pos[0],pos[1],pos[2]),'selected berth passes same landing footprint gate');
  assert.ok(Math.hypot(pos[0]-hero.liberty[0],pos[1]-hero.liberty[1])>32);
});

test('Liberty island dock restriction never leaks to other maps',()=>{
  const free=buildWater({city:null,alaska:true},hero,{yaw:0},()=>12.2,
    12.2,()=>null,()=>null,[]);
  assert.equal(free(-108,-594,0),true);
});
