import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Run the actual browser source in a sterile global; never reconstruct sample geometry.
const src=await readFile(new URL('../assets/nyc/manhattan-bridge-subway.js',import.meta.url),'utf8');
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const browser={};
vm.runInNewContext(src,{window:browser},{timeout:3000});
const rail=browser.PatrolNycManhattanSubway;

test('prototype loads before native WebGL renderer and only builds in NYC scene',()=>{
  assert.ok(rail);
  assert.match(html,/<script src="\.\/assets\/nyc\/manhattan-bridge-subway\.js"><\/script>/);
  assert.ok(html.indexOf('manhattan-bridge-subway.js')<html.indexOf("  'use strict';"));
  assert.match(html,/window\.PatrolNycManhattanSubway\.build\(\{addQuad,box,/);
  const traffic=html.slice(html.indexOf('  function drawCityTraffic('),
    html.indexOf('  let backgroundBuildings'));
  assert.match(traffic,/if\(selectedMap\.city&&typeof window!==['\"]undefined['\"]&&window\.PatrolNycManhattanSubway\)\{/);
  assert.match(traffic,/subway\.trainPose\(sceneryTime,run,car\)/);
  assert.match(traffic,/streetMeshes\.train/);
  assert.match(html,/const BROOKLYN_RAIL = \{[^\n]*enabled:false/);
});

test('Manhattan Bridge has four physically separate tracks; Brooklyn Bridge still road-only',()=>{
  assert.equal(rail.spec.trackOffsets.length,4);
  assert.deepEqual(Array.from(rail.spec.trackOffsets),[-9.5,-6.3,6.3,9.5]);
  assert.equal(rail.runs.length,2);
  assert.equal(rail.runs[0].service,'D');
  assert.equal(rail.runs[1].service,'Q');
  assert.ok(rail.runs[0].side>0,'D is on north-side pair (higher z)');
  assert.ok(rail.runs[1].side<0,'Q is on south-side pair');
  assert.ok(rail.at(rail.spec.west,-12.8)>-322,
    'rail deck may not be drawn onto Brooklyn Bridge at game z=-342');
  assert.ok(rail.spec.deck>12.2+12,
    'bridge deck must clear game-water line, with separate supports');
});

test('all bridge components have finite coordinates and a bounded face budget',()=>{
  const groups={beam:0,box:0,quad:0};
  const used=[];
  const report=rail.build({
    beam:(a,b,w)=>{
      assert.ok([...a,...b,w].every(Number.isFinite));
      assert.ok(w>0);groups.beam++; used.push(a,b);
    },
    box:(x,y,z,w,h,d)=>{
      assert.ok([x,y,z,w,h,d].every(Number.isFinite));
      assert.ok(w>0&&h>0&&d>0);groups.box++;
    },
    addQuad:(...v)=>{
      for(const p of v.slice(0,4)){
        assert.equal(p.length,3);
        assert.ok(p.every(Number.isFinite));
      }
      groups.quad++;
    }
  });
  assert.equal(report.total,report.beams+report.boxes+report.quads);
  assert.equal(report.total,groups.beam+groups.box+groups.quad);
  const upperBoundTris=groups.beam*12+groups.box*12+groups.quad*2;
  assert.ok(upperBoundTris<=20000,'limit added native subway geometry to 20k triangles');
  assert.ok(groups.box>=100,'bridge piers, towers, parapets and lights are 3D');
  assert.ok(groups.beam>=1000,'truss, four rail pairs, catenaries and sleepers exist');
});

test('trains follow the same sloped rail corridor, with deterministic two-way movement',()=>{
  for(const run of rail.runs){
    for(const t of [0,1,9.37,13.2,57.7,180]){
      const a=rail.trainPose(t,run,0),b=rail.trainPose(t,run,1);
      assert.equal(a.x,rail.trainPose(t,run,0).x,'no random per-frame jitter');
      assert.equal(a.y,rail.spec.deck+.22);
      assert.ok(Math.abs(a.z-rail.at(a.x,run.side))<1e-9);
      assert.ok(Math.abs(b.z-rail.at(b.x,run.side))<1e-9);
      assert.ok(Math.abs(a.x-b.x-13.35*run.direction)<1e-8,
        'cars stay 13.35 units apart along the same track');
    }
  }
  assert.throws(()=>rail.trainPose(0,rail.runs[0],4),/Invalid/);
  assert.throws(()=>rail.trainPose(Number.NaN,rail.runs[0],0),/Invalid/);
});
