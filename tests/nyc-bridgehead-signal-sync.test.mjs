// Real production bridgehead stop-line controller, not a separate mocked implementation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function bridgeheadSignalGreen(time){');
const end=html.indexOf('  function bridgeheadTrafficPose(actor,time){',start);
assert.ok(start>=0&&end>start,'Production signal controller not found');
const js=html.slice(start,end);
const {green,phase,travel}=new Function(js+
  'return {green:bridgeheadSignalGreen,phase:bridgeheadSignalPhase,travel:bridgeheadSignalTravel};')();

function actor(slot=0){
  const stop=194.5-slot*5.5;
  return {signalized:true,signalQueueSlot:slot,kind:slot?'sedan':'taxi',
    bridgeSegmentCount:1,route:{lengths:[0,200,420],total:420},
    pace:7,offset:stop-35};
}

test('NYC red-green-amber control repeats on the same world clock as rendered lens',()=>{
  for(let n=-2;n<5;n++){
    assert.equal(green(n*32),false);
    assert.equal(green(n*32+11.999),false);
    assert.equal(green(n*32+12),true);
    assert.equal(green(n*32+26.999),true);
    assert.equal(green(n*32+27),false);
    assert.equal(green(n*32+31.999),false);
    assert.equal(phase(n*32+0),'red');
    assert.equal(phase(n*32+12),'green');
    assert.equal(phase(n*32+27),'amber');
  }
  assert.match(html,/const green=bridgeheadSignalGreen\(sceneryTime\)/);
  assert.match(html,/const phase=bridgeheadSignalPhase\(sceneryTime\)/);
  assert.match(html,/nycBridgeheadSignalFaces\.amber/);
  assert.match(html,/const traveled=actor\.signalized\?bridgeheadSignalTravel\(actor,time\)/);
  assert.match(html,/signalized:true,signalQueueSlot:j/);
  assert.match(html,/PATROL_NYC_BRIDGEHEAD_SIGNAL_SYNC_V1/);
});

test('arriving on red stops before the crossing; green resumes without a jump',()=>{
  const a=actor();
  // With an 8-unit comfort-braking arc, nominal crossing is at t=5,
  // while the actual smooth stop finishes 8/7 seconds later.
  assert.ok(travel(a,5)<194.5,'the car must already be braking');
  assert.ok(Math.abs(travel(a,5+8/7)-194.5)<1e-9);
  for(const t of [5+8/7,7,8,10,11.999,12]){
    assert.ok(Math.abs(travel(a,t)-194.5)<1e-7,'red must hold at '+t);
  }
  assert.ok(travel(a,12.1)>194.5,'car must depart on green');
  assert.ok(travel(a,12.1)<195.5,'departure must not teleport');
  assert.ok(travel(a,18)>travel(a,12.1));
  assert.ok(Math.abs(travel(a,12+16/7)-202.5)<1e-6,
    'green launch must accelerate back to normal cruise speed');
});

test('braking and acceleration preserve speed at phase boundaries',()=>{
  const a=actor();
  const stop=194.5,startBrake=5-8/7,endBrake=5+8/7;
  const speed=(t,h=.0001)=>(travel(a,t+h)-travel(a,t-h))/(2*h);
  assert.ok(Math.abs(travel(a,startBrake)-(stop-8))<1e-7);
  assert.ok(Math.abs(speed(startBrake)-7)<.005,'brake-entry speed must be cruise');
  assert.ok(Math.abs(speed(endBrake))<.005,'brake must finish with zero speed');
  assert.ok(Math.abs(speed(12))<.005,'launch must start with zero speed');
  assert.ok(Math.abs(speed(12+16/7)-7)<.005,
    'launch must join cruise without speed discontinuity');
});

test('yellow nominal arrival stops for next green; clear green crosses',()=>{
  const a=actor();
  a.offset=194.5-7*29;
  const stop=194.5;
  assert.ok(travel(a,29)<stop,'yellow braking before physical stop line');
  for(const t of [30.5,34,40,43.999,44])
    assert.ok(Math.abs(travel(a,t)-stop)<1e-7,
      'yellow arrival must wait through next red at '+t);
  assert.ok(travel(a,44.2)>stop,'must leave on next-cycle green');
  const passing=actor();
  passing.offset=194.5-7*16;
  assert.ok(Math.abs(travel(passing,16)-194.5)<1e-8,
    'car that can clear on green must not unnecessarily stop');
  assert.ok(Math.abs(travel(passing,16.2)-195.9)<1e-8);
});

test('queue slots stop at distinct physical points and never reverse travel',()=>{
  const taxi=actor(0),sedan=actor(1);
  assert.ok(Math.abs(travel(taxi,7)-travel(sedan,7)-5.5)<1e-8);
  for(const car of [taxi,sedan]){
    let prev=travel(car,0),stationary=0;
    for(let t=.25;t<1100;t+=.25){
      const now=travel(car,t);
      assert.ok(Number.isFinite(now));
      assert.ok(now+1e-8>=prev,'route progress cannot jump backward at '+t);
      assert.ok(now-prev<=car.pace*.25+1e-7,'route progress cannot teleport');
      if(now-prev<.00001)stationary++;
      prev=now;
    }
    assert.ok(stationary>=25,'red-light waiting was never exercised');
  }
});

test('only NYC bridge connector actors opt in, original geometry remains intact',()=>{
  assert.match(html,/if\(actor\.bridgehead\)return bridgeheadTrafficPose\(actor,time\)/);
  assert.match(html,/const phase=\(\(traveled%period\)\+period\)%period;/);
  assert.match(html,/if\(selectedMap\.city\)\{/);
  // The deck-to-street path and water/parcel exclusions still exist.
  assert.match(html,/function makeBrooklynBridgeheadCarRoute\(/);
  assert.match(html,/if\(terrainAt\(x,z\)<=waterY\+\.68\|\|lotAt\(x,z\)\)return null;/);
});
