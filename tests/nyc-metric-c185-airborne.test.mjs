import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PATROL_C185_AIRBORNE,makeC185AirborneState,
  c185SourceAirborneStep,c185SceneCollision,
  C185_HALF_SPAN_METRES,C185_HALF_LENGTH_METRES}
  from '../assets/nyc/nyc-c185-metre-airborne.mjs';
import {buildMeteredMassing} from '../assets/nyc/times-square-metered-massing.mjs';
import {buildingContains} from '../assets/nyc/nyc-true-scale-neighborhood.mjs';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const viewer=await readFile(new URL('../assets/nyc/nyc-true-scale-flight.html',
  import.meta.url),'utf8');
const footprints=JSON.parse(await readFile(new URL(
  '../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));

test('C185 airborne coefficients and formulas come from current PATROL main physics',()=>{
  const {cruise,boost,turn,pitchResponse,maxPitch}=PATROL_C185_AIRBORNE;
  assert.deepEqual({cruise,boost,turn,pitchResponse,maxPitch},
    {cruise:19.2,boost:25.5,turn:.93,pitchResponse:2.05,maxPitch:.45});
  const start=html.indexOf("    seaplane: { name: 'Cessna 185 Floatplane'");
  assert.ok(start>0);
  const end=html.indexOf(' },',start);
  const source=html.slice(start,end+3);
  for(const value of ['cruise: 19.2','boost: 25.5','turn: 0.93',
    'pitchResponse: 2.05','maxPitch: 0.45'])
    assert.ok(source.includes(value), 'drift from original source: '+value);
  for(const formula of [
    'plane.speed = lerp(plane.speed,targetSpeed,dt*2.8)',
    'plane.yaw += turnInput * craft.turn * dt * taxiTurn',
    'plane.pitch = lerp(plane.pitch,targetPitch,dt*craft.pitchResponse)',
    'plane.bank = lerp(plane.bank,(grounded||waterborne)?0:-turnInput*0.92,dt*4.5)',
    "plane.pos[1]-=dt*(plane.afterburner?.25:1.25)"
  ])assert.ok(html.includes(formula), 'original airborne equation missing: '+formula);
});

test('C185 source-equation airborne motion is finite and responds to boost/pitch/yaw',()=>{
  let state=makeC185AirborneState([0,80,0],Math.PI);
  let lastZ=state.pos[2];
  for(let i=0;i<40;i++){
    state=c185SourceAirborneStep(state,{
      turn:i<20?.4:-.4,pitch:i<18?.25:0,
      boost:i<20,brake:false
    },.025);
    assert.ok(state.pos.every(Number.isFinite));
    assert.ok(Number.isFinite(state.gForce)&&state.gForce>=.3&&state.gForce<=7.5);
    assert.ok(state.pos[2]<lastZ,'northbound forward motion should use -Z in scene');
    lastZ=state.pos[2];
  }
  assert.ok(state.pos[0]!==0);
  assert.ok(state.pos[1]>80-2,'positive control should have some lift');
  assert.equal(state.collision,null);
  assert.equal(state.steps,40);
  assert.ok(state.speed<=25.5);
});

test('zero-turn C185 flight is time-step invariant for kinematic source equations',()=>{
  let a=makeC185AirborneState([0,80,0],Math.PI);
  let b=makeC185AirborneState([0,80,0],Math.PI);
  for(let i=0;i<20;i++)a=c185SourceAirborneStep(a,{turn:0,pitch:0},.05);
  for(let i=0;i<40;i++)b=c185SourceAirborneStep(b,{turn:0,pitch:0},.025);
  assert.ok(Math.abs(a.pos[0]-b.pos[0])<1e-5);
  assert.ok(Math.abs(a.pos[2]-b.pos[2])<1e-5);
  assert.ok(Math.abs(a.pos[1]-b.pos[1])<1e-5);
});

test('swept collision refuses thin building envelope without final-position teleport',()=>{
  const initial=makeC185AirborneState([0,80,0],Math.PI/2);
  initial.speed=25.5;
  const next=c185SourceAirborneStep(initial,{boost:true},.05,
    p=>p[0]>.80&&p[0]<1.20);
  assert.ok(next.collision,'0.4m sliver needs an actual swept hit');
  assert.match(next.collision.reason,/NYC official building footprint prism/);
  assert.deepEqual(next.pos,initial.pos);
  assert.equal(next.speed,0);
  assert.ok(next.collision.attempted[0]>.80);
});

test('official 1:1 footprint collision samples source building FID and roof height',()=>{
  const m=buildMeteredMassing(footprints);
  const b=m.buildings.find(x=>x.fid===22922);
  assert.ok(b);
  const center={east:0,north:0};
  const collision=c185SceneCollision(m,center,buildingContains,1.2);
  const east=b.footprintMeters.reduce((n,p)=>n+p[0],0)/b.footprintMeters.length;
  const north=b.footprintMeters.reduce((n,p)=>n+p[1],0)/b.footprintMeters.length;
  assert.equal(collision([east,3,-north]),true);
  // The 10.922m wing may overlap a DIFFERENT taller adjacent building,
  // even when the center is above this particular roof. Test universally
  // clear model height, never suppress legitimate neighboring collisions.
  const allClearHeight=Math.max(...m.buildings.map(x=>x.roofHeightMeters))+10;
  assert.equal(collision([east,allClearHeight,-north]),false);
  assert.equal(collision([10000,80,10000]),false);
});

test('source C185 10.922m wingtip is collision-checked far beyond spectator radius',()=>{
  assert.equal(C185_HALF_SPAN_METRES,5.461);
  assert.equal(C185_HALF_LENGTH_METRES,3.90525);
  const fakeBuilding=(_,east,north,height)=>
    Math.abs(east-5.461)<.15&&Math.abs(north)<.15&&height<95?123:null;
  const collision=c185SceneCollision({buildings:[]},{east:0,north:0},
    fakeBuilding,.6);
  assert.equal(collision([0,80,0],{yaw:0,pitch:0,bank:0}),true,
    'wing must hit an obstacle 5.46m from the center');
  assert.equal(collision([0,100,0],{yaw:0,pitch:0,bank:0}),false,
    'wing passing above the real roof must be clear');
  // Roll rotates wing height; no unrealistically level wing tip in bank.
  assert.equal(collision([0,80,0],{yaw:0,pitch:0,bank:.2}),true);
  assert.equal(collision([0,80,0],{yaw:Math.PI/2,pitch:0,bank:0}),false,
    'wingtip must rotate with current original PATROL yaw');
});

test('metric aircraft scene uses true map WGS84 and admits no original-physics false claim',()=>{
  assert.match(viewer,/id="c185Airborne"/);
  assert.match(viewer,/flight'\)==='patrol-c185'/);
  assert.match(viewer,/c185SourceAirborneStep\(airborne,control,dt\/substeps,sourceCollision\)/);
  assert.match(viewer,/Math\.PI-airborne\.yaw/);
  assert.match(viewer,/c185SceneCollision\(massing,geometry\.center,buildingContains,1\.2\)/);
  assert.match(viewer,/usesOriginalAircraftPhysics:false/);
  assert.match(viewer,/airborneFullPhysics:false/);
  assert.doesNotMatch(viewer,/airborneFullPhysics:true/);
  assert.match(viewer,/qualityLow\?0:6200,officialRoadbed:roadbed/);
});
