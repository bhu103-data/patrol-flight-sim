// Conservative source-footprint low-flight CAMERA only, not PATROL C185 physics.
// Reproduce actual 48 OTI building prisms and 295 true-metre CSCL traces.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareDistrict} from '../assets/nyc/dumbo-oti-metric.mjs';
import {reconcileMetricStreets} from '../assets/nyc/dumbo-cscl-metric-reconcile.mjs';
import {makeDumboMetricFlySafety,pointInSourceRing}
  from '../assets/nyc/dumbo-metric-fly-safety.mjs';

const json=p=>JSON.parse(readFileSync(new URL('../assets/nyc/'+p,import.meta.url),'utf8'));
const buildings=prepareDistrict(json('dumbo-oti-metric-48.json'));
const network=reconcileMetricStreets(json('dumbo-cscl-official-snapshot.json'),
  json('dumbo-oti-metric-48.json'));
const bounds={
  minX:Math.min(...buildings.flatMap(b=>b.ring.map(p=>p[0]))),
  maxX:Math.max(...buildings.flatMap(b=>b.ring.map(p=>p[0]))),
  minZ:Math.min(...buildings.flatMap(b=>b.ring.map(p=>p[1]))),
  maxZ:Math.max(...buildings.flatMap(b=>b.ring.map(p=>p[1])))
};
const realSafety=makeDumboMetricFlySafety(buildings,bounds);

test('all 48 municipal building footprints are solid swept camera obstacles',()=>{
  assert.equal(realSafety.buildingCount,48);
  assert.equal(realSafety.radius,1.3);
  assert.equal(realSafety.roofMargin,1.8);
  const aboveAllBuildings=Math.max(...buildings.map(b=>b.roofY))+
    realSafety.roofMargin+1;
  for(const b of buildings){
    const p=b.ring[0];
    const collision=realSafety.obstacle([p[0],Math.min(10,b.roofY),p[1]]);
    assert.equal(collision?.kind,'building',
      'camera collision must protect EVERY original OTI source footprint edge');
    // Municipal source polygons can overlap. Their first returned collider
    // may belong to another taller source building, not the tested FID.
    // A true clearance guarantee requires exceeding ALL source roofs.
    assert.equal(realSafety.obstacle([p[0],aboveAllBuildings,p[1]]),null);
  }
});

test('a true CSCL non-conflicting segment supplies an actually safe 1:1 camera spawn',()=>{
  const focus=[(bounds.minX+bounds.maxX)*.5,0,
    (bounds.minZ+bounds.maxZ)*.5];
  const spawn=realSafety.sourceStreetSpawn(network.lines,focus);
  assert.ok(Number.isSafeInteger(spawn.sourcePhysicalId));
  assert.equal(spawn.sourcePhysicalId,56482,
    'closest verified Front Street source physical ID changed');
  assert.equal(spawn.streetName,'FRONT ST');
  assert.ok(spawn.openAheadMetres>=20&&spawn.openAheadMetres<=30,
    'inspection must aim along a swept-clear source road tangent');
  assert.ok(Math.abs(spawn.headingRadians)>1.0&&
    Math.abs(spawn.headingRadians)<2.3,
    'east-west Front Street should not face the adjoining warehouse wall');
  assert.ok(spawn.position.every(Number.isFinite));
  assert.equal(spawn.position[1],9.5);
  assert.equal(spawn.yIsDiagnosticAGL,true);
  assert.equal(spawn.claimedSafeStreetRouting,false);
  assert.equal(realSafety.obstacle(spawn.position),null);
  assert.ok(network.lines.some(l=>l.physicalid===spawn.sourcePhysicalId&&
    l.conflictFids.length===0));
  const move=realSafety.sweep(spawn.position,
    [spawn.position[0],spawn.position[1]+8,spawn.position[2]]);
  assert.equal(move.blocked,false);
  assert.equal(move.movedMetres,8);
});

test('swept source prism collision rejects tunnelling, buffers corners and allows above roofs',()=>{
  const synthetic=Array.from({length:48},(_,i)=>{
    const x=i?100+i*48:0,z=i?250:0;
    return {fid:i+1,roofY:16,
      ring:[[x,z],[x+10,z],[x+10,z+10],[x,z+10]]};
  });
  const flight=makeDumboMetricFlySafety(synthetic,
    {minX:-8,maxX:2500,minZ:-10,maxZ:300});
  const low=flight.sweep([-6,6,5],[16,6,5]);
  assert.equal(low.blocked,true);
  assert.equal(low.fid,1);
  assert.equal(low.kind,'building');
  assert.ok(low.position[0]<-1.29);
  assert.ok(low.movedMetres>0&&low.movedMetres<22,
    'swept test stops BEFORE the real footprint buffer, not inside a wall');
  assert.equal(flight.obstacle([-.5,6,5])?.fid,1,
    'a 1.3m camera radius must not allow near-edge clipping');
  assert.equal(flight.sweep([-6,25,5],[16,25,5]).blocked,false,
    'above roof plus 1.8m clearance the camera may pass freely');
  assert.equal(flight.sweep([-6,2.5,5],[-6,0,5]).kind,'out-of-metre-tile');
  assert.throws(()=>flight.sweep([-6,25,5],[600,25,5]),/Excessive/);
  assert.throws(()=>flight.sweep([5,6,5],[11,6,5]),/Unsafe initial/);
});

test('building ring point-in-polygon handles corners, boundaries and concavities',()=>{
  const ring=[[0,0],[10,0],[10,10],[5,10],[5,5],[0,5]];
  assert.equal(pointInSourceRing([7,7],ring),true);
  assert.equal(pointInSourceRing([2,7],ring),false,
    'concave notch must remain empty even if inside bounding rectangle');
  assert.equal(pointInSourceRing([5,7],ring),true);
  assert.equal(pointInSourceRing([10,10],ring),true);
  assert.equal(pointInSourceRing([-1,5],ring),false);
});

test('only optional WebGL viewer imports low-flight safety; main map and 48 official rings unchanged',()=>{
  const view=readFileSync(new URL('../tools/nyc/dumbo-metric-preview.html',import.meta.url),'utf8');
  const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(view,/makeDumboMetricFlySafety/);
  assert.match(view,/flySafety\.sweep/);
  assert.match(view,/sourceStreetSpawn\(network\.lines,roadFocus\)/);
  assert.match(view,/KeyW/);
  assert.match(view,/cameraOnly:true/);
  assert.doesNotMatch(game,/dumbo-metric-fly-safety/);
  assert.equal(network.lines.length,295);
  assert.equal(network.conflicts.length,4);
  assert.equal(buildings.length,48);
});
