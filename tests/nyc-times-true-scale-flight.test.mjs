import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {containsFootprint,distToSegment2,hitsBuilding,
  spawnOnVerifiedStreet,advanceMetricFlight,metricFlightTarget}
  from '../tools/nyc/true-scale-flight.mjs';
const square={fid:111,heightMeters:28,outline:[
  [10,10],[30,10],[30,30],[10,30]
]};
const rectangle=[square],area=[-100,-100,100,100];
test('geometric collision uses official footprint polygon and roof height, not its bounding box',()=>{
  assert.equal(containsFootprint([11,11],square.outline),true);
  assert.equal(containsFootprint([9,11],square.outline),false);
  assert.equal(distToSegment2([6,15],[10,10],[10,30]),4);
  assert.equal(hitsBuilding([20,8,20],rectangle),true);
  assert.equal(hitsBuilding([8.9,8,20],rectangle,1.2),true);
  assert.equal(hitsBuilding([5,8,20],rectangle,1.2),false);
  assert.equal(hitsBuilding([20,30.5,20],rectangle,1.2),false);
  assert.throws(()=>distToSegment2([NaN,0],[0,0],[1,1]));
});

test('spawn selects a verified improved nonpaper official DCM line, clear of city massing',()=>{
  const sample={roads:[
    {objectId:1,streetName:'Unbuilt planned',paperStreet:'Y',
      buildStatus:'Unimproved',lines:[[[0,0],[20,0]]]},
    {objectId:2,streetName:'Near but inside building',paperStreet:'N',
      buildStatus:'Improved',lines:[[[15,20],[25,20]]]},
    {objectId:3,streetName:'West 42 Street',paperStreet:'N',
      buildStatus:'Improved',lines:[[[-40,0],[-5,0]]]},
  ]};
  const start=spawnOnVerifiedStreet(sample,rectangle);
  assert.equal(start.street,'West 42 Street');
  assert.equal(start.sourceObjectId,3);
  assert.equal(start.position[1],8);
  assert.equal(hitsBuilding(start.position,rectangle),false);
  assert.ok(Number.isFinite(start.yaw));
  assert.throws(()=>spawnOnVerifiedStreet({roads:[]},rectangle),/Actual official/);
  assert.throws(()=>spawnOnVerifiedStreet({roads:[sample.roads[0]]},rectangle),/No clear/);
});

test('swept flight stops at a source polygon even if movement would tunnel through it',()=>{
  const state={position:[0,8,20],yaw:Math.PI/2,pitch:0};
  let s=state,anyBlocked=false;
  for(let i=0;i<24;i++){
    s=advanceMetricFlight(s,{KeyW:true},.1,rectangle,area);
    anyBlocked ||= s.blocked;
    assert.equal(hitsBuilding(s.position,rectangle,1.2),false);
  }
  assert.equal(anyBlocked,true);
  assert.ok(s.position[0]<=8.801,'must never move into polygon at x10');
  const step=advanceMetricFlight(s,{KeyE:true},.1,rectangle,area);
  assert.ok(step.position[1]>s.position[1],
    'flight may ascend alongside a wall even when horizontal motion is blocked');
  const high=advanceMetricFlight({position:[0,50,20],yaw:Math.PI/2,pitch:0},
    {KeyW:true,ShiftLeft:true},.1,rectangle,area);
  assert.ok(high.position[0]>0,'flight above roof can fly over recorded footprint');
  assert.equal(hitsBuilding(high.position,rectangle,1.2),false);
  const target=metricFlightTarget([2,8,5],Math.PI/2,0);
  assert.ok(target[0]>2.99&&Math.abs(target[2]-5)<1e-8);
});

test('Flight controls are bound to an independent source preview, not production PATROL',async()=>{
  const source=await readFile(new URL('../tools/nyc/true-scale-preview.html',import.meta.url),'utf8');
  const game=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const workflow=await readFile(new URL('../.github/workflows/nyc-times-true-scale-flight.yml',import.meta.url),'utf8');
  assert.match(source,/from '\.\/flight\.mjs'/);
  assert.match(source,/spawnOnVerifiedStreet\(source,buildingData\)/);
  assert.match(source,/advanceMetricFlight\(flyState,flightKeys,delta,buildingData,metreBounds\)/);
  assert.match(source,/metricFlightTarget\(flyState.position,flyState.yaw,flyState.pitch\)/);
  assert.match(source,/getFlight:\(\)=>\(/);
  assert.ok(source.includes('官方道路中心线'));
  assert.ok(!game.includes('true-scale-flight.mjs'));
  assert.match(workflow,/cp tools\/nyc\/true-scale-flight\.mjs artifacts\/nyc-true-scale\/flight\.mjs/);
  for(const path of ['../tools/nyc/true-scale-flight.mjs',
    '../tools/nyc/true-scale-flight-browser-smoke.mjs']){
    const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(path,import.meta.url))],
      {encoding:'utf8'});
    assert.equal(result.status,0,result.stderr||result.stdout);
  }
});
