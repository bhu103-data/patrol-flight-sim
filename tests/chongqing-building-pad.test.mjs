import test from 'node:test';
import assert from 'node:assert/strict';
import {surveyChongqingBuildingPad} from '../assets/chongqing/urban-architecture.js';

const dry=()=>100;
test('a full parcel survives gentle terrain and its foundation covers every corner',()=>{
  const ground=(x,z)=>25+.08*x+.06*z;
  const pad=surveyChongqingBuildingPad({
    x:0,z:0,w:20,d:30,ground,riverDist:dry
  });
  assert.ok(pad);
  assert.equal(pad.perimeter.length,8);
  assert.ok(Math.abs(pad.grade-3.4)<1e-8);
  assert.ok(Math.abs(pad.base-(26.7+.24))<1e-8);
  assert.ok(pad.perimeter.every(([x,y,z])=>Math.abs(y-ground(x,z))<1e-8));
});
test('a steep cut is refused rather than rendering unsupported towers',()=>{
  assert.equal(surveyChongqingBuildingPad({
    x:0,z:0,w:25,d:25,ground:(x)=>25+x*.7,riverDist:dry
  }),null);
});
test('a narrow wet inlet anywhere in the footprint blocks construction',()=>{
  assert.equal(surveyChongqingBuildingPad({
    x:0,z:0,w:20,d:20,ground:()=>25,
    riverDist:(x,z)=>Math.abs(x-5)<.5&&Math.abs(z)<.5?-1:100
  }),null);
});
test('invalid or submerged terrain never creates a foundation mesh',()=>{
  for(const ground of [()=>-13,()=>NaN,()=>Infinity])
    assert.equal(surveyChongqingBuildingPad({
      x:0,z:0,w:16,d:16,ground,riverDist:dry
    }),null);
});
