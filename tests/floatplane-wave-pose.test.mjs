import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=source('../index.html');
const start=html.indexOf('  const oceanBands =');
const stop=html.indexOf('  const oceanVec4 =',start);
assert.ok(start>=0&&stop>start);
const pose=new Function(html.slice(start,stop)+'\nreturn floatOceanPose;')();
const water=12.2,abyss=()=>2;
test('ocean float pose follows both pontoons and changes on a stationary plane',()=>{
  const run=(t,map={})=>pose(88,-602,.44,t,map,water,abyss);
  const a=run(1),b=run(2),quiet=run(1,{alaska:true});
  assert.notEqual(a.height,b.height);
  assert.ok(Math.abs(a.pitch)>1e-5 && Math.abs(a.bank)>1e-5);
  assert.equal(a.height,(a.left+a.right)*.5);
  assert.ok(Math.abs(quiet.height-a.height*.3)<1e-9);
  assert.ok(Math.abs(Math.tan(quiet.bank)-Math.tan(a.bank)*.3)<1e-9);
  assert.deepEqual(run(1,{dc:true}),{height:0,left:0,right:0,pitch:0,bank:0});
  assert.equal(pose(88,-602,.44,1,{},water,()=>water-.05).height,0);
});
test('Chongqing river pose uses the rendered wave phase and preserves branch level',()=>{
  const cq=source('../assets/chongqing/chongqing.js');
  const at=cq.indexOf('function cqFloatWavePose(');
  const to=cq.indexOf('function moveSharedFloatplane',at);
  assert.ok(at>=0&&to>at);
  const build=new Function('riverCenter',cq.slice(at,to)+'return cqFloatWavePose;');
  const main=build(()=>0),branch=build(()=>100);
  const a=main(49,0,1,4),b=main(49,0,1,5);
  assert.notEqual(a.height,b.height);
  assert.notEqual(a.pitch,0);
  assert.notEqual(a.bank,0);
  assert.ok(Math.abs(branch(49,0,1,4).height-a.height+.10)<1e-9);
  assert.match(cq,/waterUniforms\.uTime\.value=time/);
});
