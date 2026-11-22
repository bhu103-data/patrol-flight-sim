import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHardwareRenderer,percentileMs,assessNativeGpuRuns}
  from '../tools/alaska/native-gpu-guard.mjs';

const hardware={unmaskedRenderer:'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)',
  unmaskedVendor:'Google Inc. (NVIDIA)'};
const mk=(label,dt=18,firstPlayableMs=2500)=>({
  label,renderer:hardware,intervals:Array.from({length:220},()=>dt),
  firstPlayableMs,pageErrors:[],contextLost:false,map:'alaska',pose:79
});
const abba=()=>[mk('baseline'),mk('updated',19),mk('updated',19),mk('baseline')];
const budgets={maxP95Ms:33.33,maxFirstPlayableMs:10000,maxRegressionPct:10};

test('native renderer identifies physical GPU with explicit vendor and renderer',()=>{
  assert.equal(classifyHardwareRenderer(hardware).accepted,true);
  assert.equal(classifyHardwareRenderer({unmaskedRenderer:'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics)',unmaskedVendor:'Google Inc.'}).accepted,true);
  assert.equal(classifyHardwareRenderer({unmaskedRenderer:'AMD Radeon RX 6600 XT',unmaskedVendor:'AMD'}).accepted,true);
});

test('software, hidden and virtual GPU devices cannot certify a pass',()=>{
  for(const renderer of ['Google SwiftShader','ANGLE (Intel, Microsoft Basic Render Driver)',
    'llvmpipe (LLVM 15.0.7)','Mesa lavapipe','VMware SVGA 3D']){
    assert.equal(classifyHardwareRenderer({unmaskedRenderer:renderer,unmaskedVendor:'Intel'}).accepted,false,renderer);
  }
  assert.equal(classifyHardwareRenderer({unmaskedRenderer:'WebKit WebGL',unmaskedVendor:''}).accepted,false);
  assert.equal(classifyHardwareRenderer({unmaskedRenderer:'Unknown GPU',unmaskedVendor:'Google'}).accepted,false);
});

test('frame quantiles are exact for sorted positive intervals and reject invalid input',()=>{
  assert.equal(percentileMs([30,10,20,40],.95),40);
  assert.equal(percentileMs([30,10,20,40],.5),20);
  assert.throws(()=>percentileMs([],0.5));
  assert.throws(()=>percentileMs([16,NaN],0.95));
});

test('ABBA native samples and positive absolute/relative budgets can pass',()=>{
  const report=assessNativeGpuRuns(abba(),budgets);
  assert.equal(report.status,'PASS');
  assert.equal(report.candidate.frames,440);
  assert.equal(report.candidate.frameP95Ms,19);
  assert.equal(report.checks.frameRegression,true);
});

test('fail closed on missing budgets, software hardware or skipped samples',()=>{
  assert.throws(()=>assessNativeGpuRuns(abba(),{}),/budgets/);
  assert.throws(()=>assessNativeGpuRuns(abba().slice(0,3),budgets),/four-run/);
  const soft=abba();soft[1].renderer={unmaskedRenderer:'Google SwiftShader',unmaskedVendor:'Google'};
  assert.throws(()=>assessNativeGpuRuns(soft,budgets),/Unverified hardware/);
  const missing=abba();missing[0].intervals=[16.7,16.7];
  assert.throws(()=>assessNativeGpuRuns(missing,budgets),/Insufficient/);
  const state=abba();state[1].pageErrors=['webgl lost'];
  assert.throws(()=>assessNativeGpuRuns(state,budgets),/Invalid first-load/);
});

test('slow hardware, worsened frame P95 or slower first-load prevent passing',()=>{
  const tooSlow=abba();
  tooSlow[1].intervals.fill(50);tooSlow[2].intervals.fill(50);
  const frame=assessNativeGpuRuns(tooSlow,budgets);
  assert.equal(frame.status,'FAIL');
  assert.equal(frame.checks.p95Budget,false);
  assert.equal(frame.checks.frameRegression,false);
  const load=abba();load[1].firstPlayableMs=3600;load[2].firstPlayableMs=3600;
  const result=assessNativeGpuRuns(load,budgets);
  assert.equal(result.status,'FAIL');
  assert.equal(result.checks.firstLoadRegression,false);
});

test('ABBA rejects switching between two individually valid real GPUs',()=>{
  const mixed=abba();
  mixed[2].renderer={
    unmaskedRenderer:'ANGLE (Intel, Intel Iris Xe Graphics Direct3D11)',
    unmaskedVendor:'Google Inc. (Intel)'
  };
  assert.equal(classifyHardwareRenderer(mixed[2].renderer).accepted,true);
  assert.throws(()=>assessNativeGpuRuns(mixed,budgets),/Mixed GPU/);
});

test('one bad candidate pass cannot be hidden by pooling all 440 frames',()=>{
  const runs=[mk('baseline',20),mk('updated',20),mk('updated',20),mk('baseline',20)];
  // One candidate run has 15 slow frames out of 220: its own P95 is 28 ms,
  // but pooled candidate P95 would be 20 ms (15 out of 440 = 3.4%).
  for(let i=0;i<15;i++)runs[2].intervals[i]=28;
  const report=assessNativeGpuRuns(runs,budgets);
  assert.equal(report.candidate.frameP95Ms,20);
  assert.equal(report.perRun[2].frameP95Ms,28);
  assert.equal(report.checks.p95Budget,true);
  assert.equal(report.checks.frameRegression,false);
  assert.equal(report.status,'FAIL');
});

test('ABBA rejects invalid raw frame intervals even with a full sample count',()=>{
  const samples=abba();
  samples[1].intervals[10]=NaN;
  assert.throws(()=>assessNativeGpuRuns(samples,budgets),/invalid native frame samples/);
  samples[1].intervals[10]=0;
  assert.throws(()=>assessNativeGpuRuns(samples,budgets),/invalid native frame samples/);
  samples[1].intervals[10]=19;
  samples[1].intervals.length=219;
  assert.throws(()=>assessNativeGpuRuns(samples,budgets),/Insufficient/);
});

test('hardware proof must come from GPU renderer, not vendor string alone',()=>{
  const opaque={
    unmaskedRenderer:'ANGLE (Unknown renderer)',
    unmaskedVendor:'Intel'
  };
  assert.equal(classifyHardwareRenderer(opaque).accepted,false);
  assert.equal(classifyHardwareRenderer(hardware).accepted,true);
});

test('incomplete browser health evidence cannot be considered a GPU pass',()=>{
  const missingErrors=abba();
  delete missingErrors[1].pageErrors;
  assert.throws(()=>assessNativeGpuRuns(missingErrors,budgets),/Invalid first-load/);
  const missingContext=abba();
  delete missingContext[1].contextLost;
  assert.throws(()=>assessNativeGpuRuns(missingContext,budgets),/Invalid first-load/);
  const badContext=abba();badContext[1].contextLost=true;
  assert.throws(()=>assessNativeGpuRuns(badContext,budgets),/Invalid first-load/);
});
