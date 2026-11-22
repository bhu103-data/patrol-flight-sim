// Real production bridgehead stop-line controller, not a separate mocked implementation.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function bridgeheadSignalGreen(time){');
const end=html.indexOf('  function bridgeheadTrafficPose(actor,time){',start);
assert.ok(start>=0&&end>start,'Production signal controller not found');
const js=html.slice(start,end);
const {green,travel}=new Function(js+
  'return {green:bridgeheadSignalGreen,travel:bridgeheadSignalTravel};')();

function actor(slot=0){
  const stop=194.5-slot*5.5;
  return {signalized:true,signalQueueSlot:slot,kind:slot?'sedan':'taxi',
    bridgeSegmentCount:1,route:{lengths:[0,200,420],total:420},
    pace:7,offset:stop-35};
}

test('NYC red-green control repeats on the same world clock as rendered lens',()=>{
  for(let n=-2;n<5;n++){
    assert.equal(green(n*32),false);
    assert.equal(green(n*32+11.999),false);
    assert.equal(green(n*32+12),true);
    assert.equal(green(n*32+31.999),true);
  }
  assert.match(html,/const green=bridgeheadSignalGreen\(sceneryTime\)/);
  assert.match(html,/const traveled=actor\.signalized\?bridgeheadSignalTravel\(actor,time\)/);
  assert.match(html,/signalized:true,signalQueueSlot:j/);
  assert.match(html,/PATROL_NYC_BRIDGEHEAD_SIGNAL_SYNC_V1/);
});

test('arriving on red stops before the crossing; green resumes without a jump',()=>{
  const a=actor();
  assert.ok(Math.abs(travel(a,5)-194.5)<1e-9);
  for(const t of [5.001,6,8,10,11.999,12]){
    assert.ok(Math.abs(travel(a,t)-194.5)<1e-7,'red must hold at '+t);
  }
  assert.ok(travel(a,12.1)>194.5,'car must depart on green');
  assert.ok(travel(a,12.1)<195.5,'departure must not teleport');
  assert.ok(travel(a,18)>travel(a,12.1));
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
