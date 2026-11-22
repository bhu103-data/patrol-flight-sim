import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  TRUEGEO_ORIGIN,toLocalMeters,polygonSignedArea,
  triangulateSimplePolygon,buildTrueGeoTimesSquare
} from '../assets/nyc/truegeo-times-square.mjs';

const snapshot=JSON.parse(await readFile(
  new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
const pilot=buildTrueGeoTimesSquare(snapshot);
const byFid=new Map(snapshot.features.map(f=>[f.fid,f]));

test('uses 120 unique municipal FIDs already in the official snapshot',()=>{
  assert.equal(snapshot.features.length,120);
  assert.equal(byFid.size,120);
  assert.match(snapshot.reference,/NYC_Building_Footprint/);
  assert.equal(pilot.stats.length+pilot.skipped.length,120);
});

test('true-coordinate preview respects 1 meter per horizontal model unit',()=>{
  assert.deepEqual(toLocalMeters(TRUEGEO_ORIGIN.lon,TRUEGEO_ORIGIN.lat),
    [0,0]);
  const east=toLocalMeters(TRUEGEO_ORIGIN.lon+.001,TRUEGEO_ORIGIN.lat);
  const north=toLocalMeters(TRUEGEO_ORIGIN.lon,TRUEGEO_ORIGIN.lat+.001);
  assert.ok(Math.abs(east[0]-84.44)<.15,'eastward geodetic shift was compressed');
  assert.ok(Math.abs(east[1])<.05,'east basis rotated into north');
  assert.ok(Math.abs(north[1]+111.05)<.3,'northward distance not ENU meters');
  assert.ok(Math.abs(north[0])<.05,'north basis rotated into east');
});

test('source height conversion is exactly feet -> meters without game scaling',()=>{
  for(const building of pilot.stats){
    const ft=byFid.get(building.fid).heightFt;
    assert.ok(Math.abs(building.roofMeters-ft*.3048)<1e-9);
  }
  assert.ok(Math.abs(pilot.bounds.maxY-887.75*.3048)<1e-7);
  assert.ok(pilot.bounds.maxY>270,'tall source building was clamped');
});

test('preserves 118 valid simple source footprint locations and polygon roofs',()=>{
  assert.equal(pilot.stats.length,118);
  assert.equal(pilot.skipped.length,2);
  assert.equal(pilot.positions.length/9,2104);
  for(const f of pilot.stats){
    assert.ok(f.footprintAreaSqMeters>.5);
    assert.equal(f.roofTriangles,f.footprintCorners-2);
    assert.ok(Number.isSafeInteger(f.fid));
  }
  assert.ok(pilot.bounds.maxX-pilot.bounds.minX>550,
    'city spans have been scaled down into a toy game block');
  assert.ok(pilot.bounds.maxZ-pilot.bounds.minZ>540);
});

test('never silently roofs over two source courtyards',()=>{
  assert.deepEqual(pilot.skipped.map(x=>x.fid).sort((a,b)=>a-b),
    [800370,1072214]);
  assert.ok(pilot.skipped.every(x=>/courtyard/.test(x.reason)));
});

test('every 3D vertex and surface normal is finite and buffers agree',()=>{
  const n=pilot.positions.length/3;
  assert.equal(pilot.normals.length,pilot.positions.length);
  assert.equal(pilot.surfaceKinds.length,n);
  assert.ok(n>6000&&n<20000);
  assert.ok(Array.from(pilot.positions).every(Number.isFinite));
  assert.ok(Array.from(pilot.normals).every(Number.isFinite));
  assert.ok(Array.from(pilot.surfaceKinds).every(k=>k===0||k===1));
});

test('ear clipping retains concave roof areas without a convex fan',()=>{
  const l=[[0,0],[4,0],[4,1],[1,1],[1,4],[0,4]];
  const roof=triangulateSimplePolygon(l);
  assert.equal(roof.length,l.length-2);
  const sum=roof.reduce((s,tri)=>s+Math.abs(polygonSignedArea(tri)),0);
  assert.ok(Math.abs(sum-7)<1e-8);
});

test('bad polygon and geodetic inputs fail closed',()=>{
  assert.throws(()=>toLocalMeters(NaN,40),/Invalid WGS84/);
  assert.throws(()=>toLocalMeters(-70,91),/Invalid WGS84/);
  assert.throws(()=>triangulateSimplePolygon([[0,0],[1,0]]),/needs/);
  const duplicate={features:[snapshot.features[0],snapshot.features[0]]};
  assert.throws(()=>buildTrueGeoTimesSquare(duplicate),/duplicated/);
});

test('source avoids invented game-space road collision overrides',async()=>{
  const code=await readFile(new URL(
    '../assets/nyc/truegeo-times-square.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(code,/geoToGame|cityLotAt|MANHATTAN_GRID|\\.32\\s*\\*/);
  assert.match(code,/NOT[\s\S]*production gameplay/);
  assert.match(code,/ECEF-to-ENU/);
});

test('standalone WebGL2 preview labels its actual limitations',async()=>{
  const html=await readFile(new URL(
    '../truegeo-times-square-preview.html',import.meta.url),'utf8');
  assert.match(html,/buildTrueGeoTimesSquare/);
  assert.match(html,/gl\.drawArrays\(gl\.TRIANGLES/);
  assert.match(html,/NOT the existing compressed PATROL Manhattan map/);
  assert.match(html,/street centerlines/);
  assert.match(html,/50 m reference grid/);
  const js=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(js,'preview module missing');
  assert.doesNotThrow(()=>new Function(js.replace(/^import .*;$/m,'')));
});
