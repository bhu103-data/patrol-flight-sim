import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=game.indexOf('    let flightStep;');
const end=game.indexOf('    const {basis,boundaryAssist}=flightStep;',start);
assert.ok(start>0 && end>start,'production flight-stepping dispatch is extractable');
const source=game.slice(start,end);
const dispatch=new Function('crash','scenicViewActive','selectedAircraft',
  'rawDt','dt','getPlaneBasis','advanceFlight',source+'return flightStep;');

function simulate({selectedAircraft='seaplane',rawDt=.3,dt=.05,crash=false,
  scenicViewActive=false}={}){
  const times=[];
  const value=dispatch(crash,scenicViewActive,selectedAircraft,rawDt,dt,
    ()=>({forward:true}),x=>{
      times.push(x);
      return {basis:{forward:true},boundaryAssist:false};
    });
  return {times,value};
}

test('water taxi catches up one slow rendered frame using bounded collision steps',()=>{
  const data=simulate();
  assert.ok(data.times.length>1 && data.times.length<=8);
  assert.ok(data.times.every(x=>x>=0 && x<=.0450001));
  assert.ok(Math.abs(data.times.reduce((a,b)=>a+b,0)-.3)<1e-10,
    'water taxi speed depends on simulated elapsed time, not renderer FPS');
  assert.ok(data.value.basis.forward);
});

test('background-tab stall never teleports aircraft or skips collision steps',()=>{
  const s=simulate({rawDt:4,dt:.05});
  assert.ok(s.times.length<=8);
  assert.ok(Math.abs(s.times.reduce((a,b)=>a+b,0)-.35)<1e-10);
  assert.ok(s.times.every(t=>t<=.045));
});

test('fighter handling remains the original single 50 ms frame step',()=>{
  const s=simulate({selectedAircraft:'fighter'});
  assert.deepEqual(s.times,[.05]);
});

test('scenic mode and crashes do not advance aircraft physics',()=>{
  assert.equal(simulate({crash:true}).times.length,0);
  assert.equal(simulate({scenicViewActive:true}).times.length,0);
});
