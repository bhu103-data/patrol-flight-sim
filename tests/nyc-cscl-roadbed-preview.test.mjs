import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCsclRoadbedQaPreview}
  from '../assets/nyc/nyc-cscl-roadbed-qa-preview.js';
const vehicle=(widthMeters)=>({
  id:1,name:'7 Avenue',constructedVehicleCandidate:true,
  widthMeters,lines:[[[0,0],[0,10]]]
});
const walkway={
  id:2,name:'Broadway',constructedVehicleCandidate:false,
  widthMeters:null,lines:[[[4,0],[4,10]]]
};
test('source 10m paved width creates exact symmetric 10×10-m QA strip, not traffic',()=>{
  const a=buildCsclRoadbedQaPreview({
    licenseApprovedForGame:false,records:[vehicle(10),walkway]
  });
  assert.equal(a.stats.vehicleRoads,1);
  assert.equal(a.stats.nonVehicleLines,1);
  assert.equal(a.stats.roadTriangles,4);
  assert.equal(a.stats.unverifiedVehicleWidth,0);
  assert.equal(a.positions.length,4*3*3);
  assert.equal(a.normals.length,a.positions.length);
  assert.equal(a.colors.length,a.positions.length);
  assert.ok(a.positions.every(Number.isFinite));
  assert.ok(a.normals.every(Number.isFinite));
  const motor=a.positions.slice(0,18);
  const xs=[motor[0],motor[3],motor[6],motor[9],motor[12],motor[15]];
  assert.ok(Math.abs(Math.min(...xs)+5)<1e-10);
  assert.ok(Math.abs(Math.max(...xs)-5)<1e-10);
  assert.ok(xs.every(x=>Math.abs(Math.abs(x)-5)<1e-10));
  assert.ok(a.stats.warning.includes('NOT verified curb'));
});
test('source motor width unknown never creates a fabricated roadway surface',()=>{
  const a=buildCsclRoadbedQaPreview({
    licenseApprovedForGame:false,records:[vehicle(null),walkway]
  });
  assert.equal(a.stats.vehicleRoads,1);
  assert.equal(a.stats.unverifiedVehicleWidth,1);
  assert.equal(a.stats.roadTriangles,2);
});
test('not a source data permission: QA mode is opt-in and default game unchanged',async()=>{
  assert.throws(()=>buildCsclRoadbedQaPreview({records:[vehicle(10)]}));
  assert.throws(()=>buildCsclRoadbedQaPreview({licenseApprovedForGame:true,records:[]}));
  const page=await readFile(new URL('../nyc-metric-pilot.html',import.meta.url),'utf8');
  const game=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(page.includes("get('roadbed')==='1'"));
  assert.ok(page.includes('read-only CSCL audit artifact'));
  assert.ok(!game.includes('nyc-cscl-roadbed-qa-preview.js'));
  assert.ok(!game.includes('nyc-times-cscl-roadbed-probe.mjs'));
});
