import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ORIGIN} from '../assets/nyc/times-square-metric-massing.js';
import {auditRoadFootprintClearance}
  from '../scripts/nyc-cscl-footprint-clearance.mjs';
const [lon,lat]=[ORIGIN.longitude,ORIGIN.latitude];
// Tiny local metric fixture. Offsets are approximately exact in a 20m patch;
// the tested production QA uses the identical source EPS conversion for both.
const geo=([x,z])=>[lon+x/84300,lat+z/110900];
const source={features:[
  {fid:11,rings:[[geo([0,0]),geo([10,0]),geo([10,10]),geo([0,10]),geo([0,0])]]},
  {fid:22,rings:[[geo([30,30]),geo([38,30]),geo([38,38]),geo([30,38]),geo([30,30])]]},
  {fid:33,rings:[
    [geo([50,50]),geo([60,50]),geo([60,60]),geo([50,60]),geo([50,50])],
    [geo([54,54]),geo([56,54]),geo([56,56]),geo([54,56]),geo([54,54])]
  ]}
]};
const rec=(id,lines,widthMeters=6,motor=true)=>({
  id,name:'Broadway',constructedVehicleCandidate:motor,
  roadwayType:motor?1:6,direction:motor?'FT':'NV',widthMeters,lines
});
test('safe road is outside even a symmetric half-width paved envelope',()=>{
  const z=auditRoadFootprintClearance([rec(1,[[[-5,20],[15,20]]])],source);
  assert.equal(z.buildingFootprintsChecked,2,'skip source polygon with unmodeled courtyard');
  assert.equal(z.motorizedCenterlinesChecked,1);
  assert.deepEqual(z.directVehicleIntrusions,[]);
  assert.deepEqual(z.possibleSymmetricPavedWidthIntrusions,[]);
});
test('motorized line physically crossing building is rejected by source audit',()=>{
  const x=auditRoadFootprintClearance([rec(2,[[[-5,5],[15,5]]])],source);
  assert.equal(x.directVehicleIntrusions.length,1);
  assert.equal(x.directVehicleIntrusions[0].fid,11);
  assert.ok(x.directVehicleIntrusions[0].insideMetres>9.9);
});
test('road half-width collision is flagged even without line touching walls',()=>{
  const x=auditRoadFootprintClearance([rec(3,[[[-5,12.5],[15,12.5]]],6)],source);
  assert.equal(x.directVehicleIntrusions.length,0);
  assert.equal(x.possibleSymmetricPavedWidthIntrusions.length,1);
  assert.ok(x.possibleSymmetricPavedWidthIntrusions[0].measuredCenterlineToFacadeMetres<3);
  assert.equal(x.possibleSymmetricPavedWidthIntrusions[0].fid,11);
});
test('pedestrian Broadway line through a kiosk is a separate issue, NOT a car',()=>{
  const x=auditRoadFootprintClearance([
    rec(4,[[[-5,5],[15,5]]],null,false),
    rec(5,[[[-5,15],[15,15]]],null,true)
  ],source);
  assert.deepEqual(x.directVehicleIntrusions,[]);
  assert.deepEqual(x.possibleSymmetricPavedWidthIntrusions,[]);
  assert.equal(x.nonVehicularCenterlineOverlaps.length,1);
  assert.equal(x.nonVehicularCenterlineOverlaps[0].roadId,4);
});
test('missing source/invalid road data cannot silently certify the scene',()=>{
  assert.throws(()=>auditRoadFootprintClearance([],null));
  assert.throws(()=>auditRoadFootprintClearance(null,source));
});
