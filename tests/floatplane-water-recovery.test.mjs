import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('    if(floatplane && !crash){');
const end=html.indexOf('    const armorCanLand=',start);
assert.ok(start>=0&&end>start);
const tick=new Function('context','with(context){'+html.slice(start,end)+'}');
function state({afloat=false,valid=()=>true,prev=[0,17,0],nyc=false}={}){
  const c={floatplane:true,crash:false,waterborne:afloat,brakes:false,
    x:1,y:13,z:2,dt:.1,floor:12.2,sceneryTime:0,floatRotate:false,
    prevPos:prev,prevYaw:.2,WATER_H:12.2,FLOAT_CLEARANCE:1.5,
    selectedMap:{city:nyc},lastTime:1000,sampleTerrainHeight:()=>10,sampleFloatOceanFloor:()=>10,
    floatOceanPose:()=>({height:.4}),
    plane:{pos:[1,13,2],pitch:-.35,yaw:.4,bank:.25,rollAnim:.4,speed:25,afterburner:true},
    usableFloatWater:valid,explosions:[],impacts:[]};
  c.finishFlight=(...args)=>c.impacts.push(args);
  return c;
}
test('hard arrival on verified water sheds speed and stays afloat',()=>{
  const c=state();tick(c);
  assert.equal(c.waterborne,true);
  assert.deepEqual(c.plane.pos,[1,13.7,2]);
  assert.equal(c.plane.speed,9);
  assert.equal(c.plane.afterburner,false);
  assert.equal(c.explosions[0].isWater,true);
  assert.deepEqual(c.impacts,[]);
});
test('blocked water taxi brakes at last clear position, never in the obstacle',()=>{
  const c=state({afloat:true,valid:x=>x===0});tick(c);
  assert.equal(c.waterborne,true);
  assert.deepEqual(c.plane.pos,[0,13.7,0]);
  assert.equal(c.plane.yaw,.2);
  assert.equal(c.plane.speed,0);
  assert.equal(c.brakes,true);
  assert.deepEqual(c.impacts,[]);
});
test('blocked airborne contact stays above water without granting a landing',()=>{
  const c=state({valid:()=>false});tick(c);
  assert.equal(c.waterborne,false);
  assert.ok(c.plane.pos[1]>13.7);
  assert.equal(c.plane.pitch,0);
  assert.deepEqual(c.impacts,[]);
});
test('a moving obstruction covering both footprints still triggers a genuine collision',()=>{
  const c=state({afloat:true,valid:()=>false});tick(c);
  assert.equal(c.waterborne,false);
  assert.equal(c.impacts.length,1);
  assert.equal(c.impacts[0][2],false);
});

test('NYC water touchdown and blocked taxi rollback follow the same ocean crest',()=>{
  const landing=state({nyc:true});tick(landing);
  assert.equal(landing.waterborne,true);
  assert.deepEqual(landing.plane.pos,[1,14.1,2]);
  assert.equal(landing.plane.speed,9);
  const rollback=state({nyc:true,afloat:true,valid:x=>x===0});tick(rollback);
  assert.equal(rollback.waterborne,true);
  assert.deepEqual(rollback.plane.pos,[0,14.1,0]);
  assert.equal(rollback.brakes,true);
  assert.equal(rollback.impacts.length,0);
});
