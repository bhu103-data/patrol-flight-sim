// Runtime geometry regression: extract the actual water clearance function.
// These cases passed the old center/corner-only nine-point detection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('  function usableFloatWater(');
const end=source.indexOf('  function findFloatWaterStart()',start);
assert.ok(start>0&&end>start,'production seaplane clearance function exists');
const implementation=source.slice(start,end);

function check({terrain=()=>12.2,dock=()=>true,city=false,alaska=false,yaw=0}={}){
  const samples=[];
  const evaluate=new Function(
    'plane','WATER_H','sampleTerrainHeight','cityLotAt','sceneryObstacle',
    'selectedMap','alaskaObstacles','clearOfNycHeroDocks',
    implementation+';return usableFloatWater;'
  )({yaw},12.2,(x,z)=>{samples.push([x,z]);return terrain(x,z)},
    ()=>null,()=>null,{city,alaska},[],dock);
  return {safe:evaluate(0,0,yaw),samples};
}

test('open-water floatplane contact checks at least 25 distinct footprint positions',()=>{
  const {safe,samples}=check();
  assert.equal(safe,true);
  assert.ok(samples.length>=25,'dense pontoon footprint must be evaluated');
  assert.equal(new Set(samples.map(([x,z])=>x.toFixed(3)+','+z.toFixed(3))).size,
    samples.length,'contact probes must not duplicate positions');
});

test('narrow shoreline finger between old longitudinal contact points blocks landing',()=>{
  const terrain=(x,z)=>Math.abs(z-1.525)<.05?13.0:12.2;
  assert.equal(check({terrain}).safe,false,'bow/midship inlet must not be ignored');
});

test('narrow island ridge between float rails blocks landing',()=>{
  const terrain=(x,z)=>Math.abs(x-.925)<.06?13.0:12.2;
  assert.equal(check({terrain}).safe,false,'outboard pontoon must not beach');
  const rotated=(x,z)=>Math.abs(x-1.525)<.05?13.0:12.2;
  assert.equal(check({terrain:rotated,yaw:Math.PI/2}).safe,false,
    'sample coordinates must rotate with the airplane');
});

test('NYC authored pier edge touching one float rejects otherwise dry-free water',()=>{
  assert.equal(check({city:true,dock:(x,z)=>Math.abs(x-.925)>.08}).safe,
    false,'dock exclusion must cover both pontoons, not just the center');
  assert.equal(check({city:true,dock:()=>true}).safe,true,
    'empty NYC harbor retains safe landings');
  assert.equal(check({city:false,dock:()=>false}).safe,true,
    'NYC-specific dock constraints must not leak into other maps');
});
