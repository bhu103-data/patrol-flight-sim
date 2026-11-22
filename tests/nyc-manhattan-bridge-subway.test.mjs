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
  assert.ok(html.includes('Manhattan Bridge · Subway Tracks'),'Metro bridge camera is selectable');
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

test('engineering tower and deck proportions are derived from credited control data',()=>{
  const c=rail.engineering,h=rail.calibratedHeights,game=rail.spec;
  assert.ok(c&&h,'sourced dimensions must be exposed for review');
  assert.equal(c.lowerDeckAboveMhw,42.18432);
  assert.equal(c.upperDeckAboveMhw,49.3776);
  assert.equal(c.saddleAboveMhw,98.298);
  assert.equal(c.mainSpan,448.056);
  assert.equal(c.suspendedSpan,890.016);
  const gameSpan=game.east-game.west;
  const observedMain=game.towerXs[1]-game.towerXs[0];
  const expectedMain=gameSpan*c.mainSpan/c.suspendedSpan;
  assert.ok(Math.abs(observedMain-expectedMain)/expectedMain<0.04,
    'Manhattan Bridge towers should have real main-span / anchorage proportions');
  const normalized=(game.deck-game.water)/c.lowerDeckAboveMhw;
  assert.ok(Math.abs(h.saddle-(game.water+c.saddleAboveMhw*normalized))<1e-8,
    'tower height follows measured prototype saddle ratio');
  assert.ok(h.saddle<game.deck+24,'reject unsupported skyscraper-height cable towers');
  assert.ok(h.saddle>h.upper+8,'upper roadway must remain below tower cap');
  assert.ok(h.cableMid>h.upper,'cable must clear raised road in compressed scene');
  assert.ok(h.anchorage<game.deck,'anchorage descends toward real river-edge datum');
});

test('every horizontal track bed and upper/lower road top faces point UP',()=>{
  const seen=[];
  rail.build({
    box:()=>{},beam:()=>{},
    addQuad:(a,b,c,d)=>{
      const normalY=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
      assert.ok(normalY>1e-9,
        'inverted track/road top normal makes the sunlit bridge look dark');
      const yy=[a[1],b[1],c[1],d[1]];
      assert.ok(yy.every(v=>Math.abs(v-yy[0])<1e-8),
        'bridge top quads must be horizontal');
      seen.push(normalY);
    }
  });
  assert.equal(seen.length,7,'two track beds, two upper roads, two footwalks, one lower road');
});

test('straight rails and flat road slabs are emitted once, not in redundant LOD fragments',()=>{
  let triangles=0,quads=0,walkwayYellow=0,railPairs=0;
  const result=rail.build({
    box:()=>{triangles+=12;},
    beam:(_a,_b,w,color)=>{
      triangles+=12;
      if(Math.abs(w-.075)<1e-6&&color[0]>.8&&color[1]>.6)walkwayYellow++;
      if(Math.abs(w-.095)<1e-6)railPairs++;
    },
    addQuad:()=>{quads++;triangles+=2;}
  });
  assert.equal(quads,7,'7 continuous quads, no duplicated coplanar panels');
  assert.equal(railPairs,8,'exactly 4 dual-rail tracks, one beam per rail');
  assert.ok(walkwayYellow>=4,'two yellow maintenance handrails on each outside edge');
  assert.ok(triangles<15000,'rail realism must fit a 15k added-triangle budget');
  assert.equal(result.quads,quads);
});
test('rail-level spectator camera inspects trains below the upper road deck',()=>{
  assert.match(html,/Manhattan Bridge · Subway Rail Level/);
  const [scenic]=html.match(/name:'Manhattan Bridge · Subway Rail Level',[^\r\n]*/)||[];
  assert.ok(scenic?.includes('height:12'),'lower train viewpoint must preserve the physical road deck');
});
