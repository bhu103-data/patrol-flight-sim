// Actual official 2022 pavement triangle overlay, not a guessed DUMBO street grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toLocalMeters} from '../assets/nyc/dumbo-oti-metric.mjs';
import {prepareOfficialDumboRoadbed,sourceRoadToWgs84,
  sourceRoadToDistrictMeters,ROADBED_SOURCE} from '../assets/nyc/dumbo-roadbed-metric.mjs';

const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const road=read('../assets/nyc/dumbo-front-dock-roadbed-2022.json');
const buildings=read('../assets/nyc/dumbo-oti-metric-48.json');
const pilot=prepareOfficialDumboRoadbed(road);
const near=(a,b,eps=1e-8)=>Math.abs(a-b)<eps;

test('reuse EXACT official OTI roadbed 2022 source, not invented lane centerlines',()=>{
  assert.equal(road.schema,'patrol-nyc-dumbo-front-dock-oti-roadbed-2022-v1');
  assert.equal(road.source,ROADBED_SOURCE);
  assert.equal(road.year,2022);
  assert.equal(road.triangles.length,577);
  assert.equal(pilot.stats.sourceTriangles,577);
  assert.equal(pilot.stats.renderedTriangles,553);
  assert.equal(pilot.stats.skippedDegenerate,24,
    '0.001 m rounding by the upstream source exporter collapses 24 microtriangles');
  assert.equal(pilot.stats.featureIds,8);
  assert.ok(Math.abs(pilot.stats.originalAreaM2-3714.73)<.25);
  assert.ok(pilot.stats.discardedAreaM2<1e-7);
  assert.equal(pilot.stats.unit,'metres');
  assert.match(pilot.stats.note,/no lane directions/);
});

test('all road triangles share the SAME WGS84 to local-metre frame as 48 buildings',()=>{
  assert.equal(buildings.features.length,48);
  const origin=[road.origin.lon,road.origin.lat];
  const check=sourceRoadToWgs84([0,0],road.origin);
  assert.ok(check.every((v,i)=>near(v,origin[i],1e-11)));
  for(const point of [[110.771,17.333],[0,0],[-35,-23],[190,23]]){
    const geo=sourceRoadToWgs84(point,road.origin);
    const m=sourceRoadToDistrictMeters(point,road.origin);
    const reference=toLocalMeters(...geo);
    assert.ok(m.every((v,i)=>near(v,reference[i],1e-9)));
  }
  const xs=pilot.triangles.flatMap(t=>t.points.map(p=>p[0]));
  const zs=pilot.triangles.flatMap(t=>t.points.map(p=>p[1]));
  assert.ok(Math.max(...xs)-Math.min(...xs)>150);
  assert.ok(Math.max(...zs)-Math.min(...zs)>15);
  const bpts=buildings.features.flatMap(f=>f.ring.map(p=>toLocalMeters(...p)));
  const minB=[Math.min(...bpts.map(p=>p[0])),Math.min(...bpts.map(p=>p[1]))];
  const maxB=[Math.max(...bpts.map(p=>p[0])),Math.max(...bpts.map(p=>p[1]))];
  assert.ok(Math.min(...xs)<maxB[0]&&Math.max(...xs)>minB[0]);
  assert.ok(Math.min(...zs)<maxB[1]&&Math.max(...zs)>minB[1],
    'limited Front/Dock source must overlap the 48-building AOI');
});

test('fail closed on wrong source year, feature codes, arbitrary clip or fabricated polygons',()=>{
  assert.throws(()=>prepareOfficialDumboRoadbed({...road,year:2026}),/Unexpected/);
  assert.throws(()=>prepareOfficialDumboRoadbed({...road,source:'other'}),/Unexpected/);
  assert.throws(()=>prepareOfficialDumboRoadbed({...road,origin:{lon:-73.989,lat:40.702}}),/Unexpected/);
  assert.throws(()=>prepareOfficialDumboRoadbed({...road,triangles:[{
    ...road.triangles[0],sub:123}]}),/Unexpected|Invalid/);
  const fake=structuredClone(road);
  fake.triangles[0].v[0]=[400,400];
  assert.throws(()=>prepareOfficialDumboRoadbed(fake),/exceeds official source clip/);
});

test('roadbed is 2022 paved footprint and only appears in opt-in staging',()=>{
  const preview=readFileSync(new URL('../tools/nyc/dumbo-metric-preview.html',import.meta.url),'utf8');
  assert.match(preview,/prepareOfficialDumboRoadbed/);
  assert.match(preview,/dumbo-front-dock-roadbed-2022\.json/);
  assert.match(preview,/2022 paved roadbed/);
  assert.doesNotMatch(preview,/advanceFlight\(|PatrolSpaceBridge/);
  const original=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(original,/dumbo-front-dock-roadbed-2022\.json/);
});
