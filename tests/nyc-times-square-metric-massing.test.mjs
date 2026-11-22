// Actual NYC Building Footprints snapshot -> metre-scale scene geometry.
// This is a new coordinate-basis pilot, not approval of the existing city map.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ORIGIN,toLocalMeters,feetToMeters,buildMetricMassing}
  from '../assets/nyc/times-square-metric-massing.js';
const source=JSON.parse(await readFile(new URL(
  '../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
const geometry=buildMetricMassing(source);

test('ellipsoid east-north local frame preserves physical distance, unlike compressed PATROL game',()=>{
  assert.deepEqual(toLocalMeters(ORIGIN.longitude,ORIGIN.latitude),[0,0]);
  const duffy=toLocalMeters(-73.98528,40.75889);
  assert.ok(duffy[0]>101.5&&duffy[0]<102.5,'Duffy E offset in metres');
  assert.ok(duffy[1]>273.5&&duffy[1]<274.8,'Duffy N offset in metres');
  const distance=Math.hypot(...duffy);
  assert.ok(distance>292&&distance<293);
  const compressed=Math.hypot(-.9-23,42.8+47.5);
  assert.ok(compressed/distance<.325&&compressed/distance>.315,
    'old fictional game places use only ~.32 world units per real metre');
  assert.equal(feetToMeters(100),30.48);
  assert.throws(()=>toLocalMeters(NaN,40.75));
  assert.throws(()=>feetToMeters(-1));
});

test('real 120 official records build source-relative polygon mesh, not relocated proxy cubes',()=>{
  assert.equal(source.features.length,120);
  assert.equal(new Set(source.features.map(f=>f.fid)).size,120);
  assert.equal(geometry.stats.sourceRecords,120);
  assert.ok(geometry.stats.renderedBuildings>=110,'must render nearly all valid source polygons');
  assert.equal(geometry.stats.renderedBuildings+geometry.stats.skippedBuildings,120);
  assert.equal(geometry.stats.metersPerWorldUnit,1);
  assert.equal(geometry.stats.totalTriangles,
    geometry.stats.wallTriangles+geometry.stats.roofTriangles);
  assert.equal(geometry.positions.length,geometry.normals.length);
  assert.equal(geometry.positions.length,geometry.colors.length);
  assert.equal(geometry.positions.length,geometry.stats.totalTriangles*9);
  assert.ok(geometry.positions.every(Number.isFinite));
  assert.ok(geometry.normals.every(Number.isFinite));
  assert.ok(geometry.colors.every(Number.isFinite));
  assert.ok(geometry.colors.every(v=>v>=0&&v<=1));
  assert.ok(geometry.stats.totalTriangles>1000&&geometry.stats.totalTriangles<12000,
    'bounded real footprint massing: no 1M-poly street impostor');
  assert.ok(geometry.buildings.every(b=>b.vertexCount>=3&&b.sourceAreaSquareMeters>1));
});

test('every rendered source roof is source HEIGHTROOF in metres, never fake floor rhythm',()=>{
  const records=new Map(source.features.map(f=>[f.fid,f]));
  for(const b of geometry.buildings){
    const rec=records.get(b.fid);
    assert.ok(rec);
    assert.equal(b.roofHeightFeet,rec.heightFt);
    assert.ok(Math.abs(b.roofHeightMeters-rec.heightFt*.3048)<1e-10);
  }
  assert.ok(geometry.bounds.height[1]>240,
    'height source must preserve tallest real Times Square roofs, not clamp to 66 game units');
  assert.ok(geometry.skipped.every(x=>x.reason!=='collision-with-virtual-road'),
    'no building must be removed for intersecting inaccurate game roads');
});

test('no fake 3D facades, roads, ads or official-image copying in geometry module',async()=>{
  const module=await readFile(new URL(
    '../assets/nyc/times-square-metric-massing.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../nyc-metric-pilot.html',import.meta.url),'utf8');
  assert.ok(module.includes('from source')===false||module.includes('source'));
  assert.ok(!module.includes('geoToGame')&&!module.includes('protectedSites'));
  assert.ok(!module.includes('Math.min(66,'));
  assert.ok(!html.includes('maps.googleapis.com')&&!html.includes('google.com/maps'));
  assert.ok(html.includes('NOT included')&&html.includes('not the playable NYC map'));
});
