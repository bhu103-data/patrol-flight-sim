import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  TIMES_METRIC_ORIGIN,wgs84ToLocalMeters,localMetersToWgs84,
  uncompressedTimesSquareFootprints,checkTimesSquareReconstructionGate
} from '../assets/nyc/nyc-times-metric-frame.js';

const data=JSON.parse(await readFile(new URL(
  '../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));

test('Times origin is metre-scale X=east, Z=north, with degree round-trip',()=>{
  assert.deepEqual(
    wgs84ToLocalMeters([TIMES_METRIC_ORIGIN.longitude,TIMES_METRIC_ORIGIN.latitude]),[0,0]);
  for(const p of [[-73.9864883,40.756421],[-73.98954,40.755039],
    [-73.982983,40.75996],[-73.98528,40.75889]]){
    const g=localMetersToWgs84(wgs84ToLocalMeters(p));
    assert.ok(Math.hypot(g[0]-p[0],g[1]-p[1])<1e-12);
  }
  const origin=[TIMES_METRIC_ORIGIN.longitude,TIMES_METRIC_ORIGIN.latitude];
  const oneDegreeEast=wgs84ToLocalMeters([origin[0]+.001,origin[1]]);
  const oneDegreeNorth=wgs84ToLocalMeters([origin[0],origin[1]+.001]);
  assert.ok(oneDegreeEast[0]>80&&oneDegreeEast[0]<90);
  assert.ok(Math.abs(oneDegreeEast[1])<1e-10);
  assert.ok(oneDegreeNorth[1]>110&&oneDegreeNorth[1]<112);
  assert.ok(Math.abs(oneDegreeNorth[0])<1e-10);
  assert.throws(()=>wgs84ToLocalMeters([NaN,40.7]),TypeError);
  assert.throws(()=>wgs84ToLocalMeters([200,40.7]),RangeError);
});

test('all 120 official FIDs and 123 source rings survive without clipping or compression',()=>{
  const scene=uncompressedTimesSquareFootprints(data);
  assert.equal(scene.stats.buildingCount,120);
  assert.equal(scene.stats.ringCount,123);
  assert.equal(scene.stats.holesPreserved,3);
  assert.equal(scene.referenceFrame.verticalDatum,null);
  assert.equal(scene.referenceFrame.sourceSnapshotDate,'2026-11-20');
  assert.deepEqual(scene.buildings.map(b=>b.fid),data.features.map(f=>f.fid));
  let count=0,minEast=Infinity,maxEast=-Infinity,minNorth=Infinity,maxNorth=-Infinity;
  for(let i=0;i<data.features.length;i++){
    const source=data.features[i],result=scene.buildings[i];
    assert.equal(result.rings.length,source.rings.length);
    assert.ok(Math.abs(result.roofHeightMeters-source.heightFt*.3048)<1e-10);
    for(let j=0;j<source.rings.length;j++){
      assert.equal(result.rings[j].length,source.rings[j].length);
      for(let k=0;k<source.rings[j].length;k++){
        const original=source.rings[j][k],metric=result.rings[j][k];
        assert.ok(metric.every(Number.isFinite));
        const rebuilt=localMetersToWgs84(metric);
        assert.ok(Math.hypot(original[0]-rebuilt[0],
          original[1]-rebuilt[1])<1e-11);
        minEast=Math.min(minEast,metric[0]);maxEast=Math.max(maxEast,metric[0]);
        minNorth=Math.min(minNorth,metric[1]);maxNorth=Math.max(maxNorth,metric[1]);
        count++;
      }
    }
  }
  assert.equal(count,933);
  assert.ok(maxEast-minEast>550&&maxEast-minEast<560);
  assert.ok(maxNorth-minNorth>545&&maxNorth-minNorth<552);
  assert.ok(scene.stats.maximumRoofMeters>270&&scene.stats.maximumRoofMeters<271,
    'do not clamp 270 m source tower to the old 66 game-unit cap');
});

test('do not treat uncompressed footprint records as a complete 3-D city',()=>{
  const scene=uncompressedTimesSquareFootprints(data);
  const gate=checkTimesSquareReconstructionGate(scene);
  assert.equal(gate.ready,false);
  assert.equal(gate.blockers.length,4);
  assert.ok(gate.blockers.some(t=>t.includes('street centerlines')));
  assert.ok(gate.blockers.some(t=>t.includes('vertical datum')));
  assert.ok(gate.blockers.some(t=>t.includes('facades')));
  assert.ok(gate.blockers.some(t=>t.includes('alignment QA')));
  const corrupted=structuredClone(data);
  corrupted.features[1].fid=corrupted.features[0].fid;
  assert.throws(()=>uncompressedTimesSquareFootprints(corrupted),/duplicate/);
  const broken=structuredClone(data);
  broken.features[0].rings[0].pop();
  assert.throws(()=>uncompressedTimesSquareFootprints(broken),/Open source ring/);
});

test('the existing fictional game stays unchanged until complete streets/terrain replacement',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/PATROL_NYC_GMAP_V8/);
  const pilot=await readFile(new URL(
    '../assets/nyc/nyc-times-metric-frame.js',import.meta.url),'utf8');
  assert.ok(!html.includes('nyc-times-metric-frame.js'),
    'test-only metric basis must never silently overlay incompatible old roads');
  assert.ok(!pilot.includes('dataMesh.addQuad'),
    'metro-map building scale is independent of production WebGL geometry');
  assert.ok(pilot.includes('roofHeightMeters:source.heightFt*.3048'));
});
