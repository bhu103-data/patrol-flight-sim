import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMeteredMassing,wgs84ToMeters} from '../assets/nyc/times-square-metered-massing.mjs';
import {MESH_STRIDE,buildingContains,buildNeighborhoodMesh}
  from '../assets/nyc/nyc-true-scale-neighborhood.mjs';

const load=async name=>JSON.parse(await readFile(
  new URL('../assets/nyc/'+name,import.meta.url),'utf8'));
const [footprints,roads]=await Promise.all([
  load('times-square-footprints.json'),load('nyc-dcm-centerlines-sample.json')]);
const massing=buildMeteredMassing(footprints);

test('NYC real-source buildings + roads share one metre-scale frame',()=>{
  assert.equal(massing.units,'metres');
  assert.equal(massing.heightScale,1);
  assert.equal(roads.schema,'patrol-nyc-dcm-centerline-segments-v1');
  assert.equal(roads.originWGS84[0],-73.9864883);
  assert.equal(roads.originWGS84[1],40.756421);
  assert.match(roads.source,/DCM_Street_Center_Line/);
  assert.match(roads.important,/not proof of paved width/);
  assert.equal(roads.roads.length,38);
  assert.equal(roads.roads.reduce((n,r)=>n+r[2].length,0),89);
  assert.ok(massing.buildings.length>=118);
  const [dx,dy]=wgs84ToMeters(roads.originWGS84,massing.origin);
  assert.ok(Math.abs(dx)<.01,'same One Times Square east origin');
  assert.ok(dy < -140&&dy > -155,
    'official DCM old-origin north offset should be transformed, not guessed');
});

test('new runtime scene renders 118 source buildings plus 89 official street segments',()=>{
  const g=buildNeighborhoodMesh(massing,roads,{detail:true});
  assert.equal(g.strideFloats,MESH_STRIDE);
  assert.ok(g.interleaved instanceof Float32Array);
  assert.equal(g.counts.buildings,massing.buildings.length);
  assert.equal(g.counts.streetFeatures,38);
  assert.equal(g.counts.streetSegments,89);
  assert.ok(g.counts.facadeWindows>100,'bounded authored facade detail should be visible');
  assert.ok(g.counts.facadeWindows<=6200,'never blow runtime facade budget');
  assert.ok(g.counts.triangles>g.counts.roofTriangles+g.counts.wallTriangles);
  assert.ok(g.counts.triangles<180000,'bounded WebGL2 polygon budget');
  assert.equal(g.interleaved.length,g.counts.triangles*3*MESH_STRIDE);
  assert.ok(g.interleaved.every(Number.isFinite),'GPU buffer is finite');
  assert.equal(g.provenance.streets,roads.source);
  assert.match(g.caveat,/illustrative, not measured/);
  const y=[];
  for(let i=1;i<g.interleaved.length;i+=MESH_STRIDE)y.push(g.interleaved[i]);
  assert.ok(Math.max(...y)>260,'actual official roof height not compressed');
  assert.ok(y.includes(-.135),'centerline-derived road deck is present');
});

test('road source is not silently invented if absent',()=>{
  assert.throws(()=>buildNeighborhoodMesh(massing,{schema:'wrong',roads:[]}),
    /DCM official road data missing/);
  assert.throws(()=>buildNeighborhoodMesh({...massing,units:'game-units'},roads),
    /genuine metre-scale NYC/);
  const low=buildNeighborhoodMesh(massing,roads,{detail:false});
  assert.equal(low.counts.facadeWindows,0);
  assert.equal(low.counts.streetSegments,89);
  assert.ok(low.counts.triangles<20000,'bounded fallback keeps real source geometry');
});

test('low-altitude collision uses original source FID polygons and roof height',()=>{
  const building=massing.buildings.find(b=>b.fid===22922);
  assert.ok(building,'known municipal building retained');
  const east=building.footprintMeters.reduce((s,p)=>s+p[0],0)/building.footprintMeters.length;
  const north=building.footprintMeters.reduce((s,p)=>s+p[1],0)/building.footprintMeters.length;
  assert.equal(buildingContains(massing,east,north,2),22922);
  assert.equal(buildingContains(massing,east,north,400),null);
  assert.equal(buildingContains(massing,10000,10000,2),null);
});

test('PATROL launcher routes experimental map to real-source free-flight entry',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const match=html.match(/name="flightMap" value="manhattanReality"/g)||[];
  assert.equal(match.length,1);
  assert.match(html,/choice[\s\S]{0,190}manhattanReality|settings[\s\S]{0,190}manhattanReality|flightMap'\) === 'manhattanReality'/);
  assert.match(html,/assets\/nyc\/nyc-true-scale-flight\.html/);
  const page=await readFile(
    new URL('../assets/nyc/nyc-true-scale-flight.html',import.meta.url),'utf8');
  assert.match(page,/buildNeighborhoodMesh\(massing,roadSource/);
  assert.match(page,/buildingContains\(massing/);
  assert.match(page,/requestPointerLock/);
  assert.match(page,/source buildings/);
  assert.doesNotMatch(page,/https?:\/\/(?:google\.com|maps\.google|cesium\.com)/);
  assert.match(page,/not the original aircraft physics/);
});
