import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SOURCES,makeUrl,normalizeGeoJSON,pointInsidePolygon,
  audit2022RoadbedCoverage}
  from '../scripts/nyc-times-plani-real-boundary-probe.mjs';
const orig=[-73.9864883,40.756421];
const loc=([x,z])=>[orig[0]+x/84300,orig[1]+z/110900];
const ring=(pts)=>[...pts.map(loc),loc(pts[0])];
const source=(s,geo,properties={})=>({
  type:'FeatureCollection',features:[{
    type:'Feature',
    properties:{OBJECTID:9,SOURCE_ID:99,FEATURE_CODE:3500,
      SUB_FEATURE_CODE:350000,STATUS:'Updated',...properties},
    geometry:geo
  }]
});
const square=(x,z,w)=>ring([[x,z],[x+w,z],[x+w,z+w],[x,z+w]]);
test('only exact NYC historical OTI roadbed, pavement edge and plaza services are queried',()=>{
  assert.deepEqual(SOURCES.map(x=>x.kind),
    ['roadbed','pavementEdge','plaza']);
  assert.deepEqual(SOURCES.map(x=>x.geom),
    ['Polygon','LineString','Polygon']);
  assert.ok(SOURCES[0].url.endsWith('Roadbed_2022/FeatureServer/20'));
  assert.ok(SOURCES[1].url.endsWith('Pavement_Edge_2022/FeatureServer/14'));
  assert.ok(SOURCES[2].url.endsWith('Plaza_2022/FeatureServer/16'));
  for(const s of SOURCES){
    const u=new URL(makeUrl(s,500));
    assert.equal(u.searchParams.get('inSR'),'4326');
    assert.equal(u.searchParams.get('outSR'),'4326');
    assert.equal(u.searchParams.get('f'),'geojson');
    assert.equal(u.searchParams.get('resultOffset'),'500');
    assert.equal(u.searchParams.get('geometry'),'-73.989,40.7555,-73.9825,40.7602');
  }
  assert.throws(()=>makeUrl({url:'https://google.com'},0));
  assert.throws(()=>makeUrl(SOURCES[0],-2));
});
test('real roadbed, intersections and paved edge keep correct geometry type and code',()=>{
  const poly=source(SOURCES[0],{type:'Polygon',coordinates:[square(0,0,10)]});
  const a=normalizeGeoJSON(SOURCES[0],poly);
  assert.equal(a.records.length,1);
  assert.equal(a.records[0].roadbedVsIntersection,'roadbed');
  assert.ok(a.records[0].coordinatesMetres[0][0].length===5);
  const b=normalizeGeoJSON(SOURCES[0],source(SOURCES[0],
    {type:'Polygon',coordinates:[square(10,0,4)]},
    {OBJECTID:12,SUB_FEATURE_CODE:350010}));
  assert.equal(b.records[0].roadbedVsIntersection,'intersection');
  const edges=normalizeGeoJSON(SOURCES[1],source(SOURCES[1],
    {type:'LineString',coordinates:[loc([0,0]),loc([0,10])]},
    {FEATURE_CODE:2260,SUB_FEATURE_CODE:226000}));
  assert.equal(edges.records.length,1);
  assert.equal(edges.records[0].coordinatesMetres.length,1);
  assert.equal(edges.records[0].coordinatesMetres[0].length,2);
});
test('plaza polygon holes are NOT filled as pedestrian surfaces',()=>{
  const src=source(SOURCES[2],{type:'MultiPolygon',
    coordinates:[[
      square(-10,-10,20),square(-2,-2,4)
    ]]},{FEATURE_CODE:3700,SUB_FEATURE_CODE:370000});
  const data=normalizeGeoJSON(SOURCES[2],src);
  assert.equal(data.records.length,1);
  const members=data.records[0].coordinatesMetres;
  assert.equal(members.length,1);
  assert.equal(members[0].length,2);
  assert.equal(pointInsidePolygon([7,0],members[0]),true);
  assert.equal(pointInsidePolygon([0,0],members[0]),false);
  assert.equal(pointInsidePolygon([40,40],members[0]),false);
});
test('independent centerline sampling detects missing 2022 paved surface; no fallback invents roads',()=>{
  const polygon=[[[-1,-2],[11,-2],[11,2],[-1,2],[-1,-2]]];
  const roadbed=[{id:9,roadbedVsIntersection:'roadbed',
    coordinatesMetres:[polygon]}];
  const cscl=[{id:81,name:'Broadway',constructedVehicleCandidate:true,
    lines:[[[0,0],[10,0]]]},
    {id:82,name:'7 Avenue',constructedVehicleCandidate:true,
      lines:[[[0,10],[10,10]]]},
    {id:83,name:'Walkway',constructedVehicleCandidate:false,
      lines:[[[0,10],[10,10]]]}];
  const report=audit2022RoadbedCoverage(cscl,roadbed,[],2);
  assert.equal(report.motorRecords,2);
  assert.equal(report.samples,10);
  assert.equal(report.insideHistoric2022Roadbed,5);
  assert.equal(report.coverageFraction,.5);
  assert.equal(report.missed.length,1);
  assert.equal(report.missed[0].id,82);
  assert.equal(report.onHistoricPlaza,0);
  assert.throws(()=>audit2022RoadbedCoverage(null,roadbed,[]));
  assert.throws(()=>audit2022RoadbedCoverage(cscl,roadbed,[],0));
});
test('off-envelope CSCL polyline tails are excluded from official 2022 coverage denominator',()=>{
  // ArcGIS envelope intersect returns an entire modern road segment, including
  // parts beyond where 2022 roadbed polygons were actually queried.
  const official2022OnlyInBbox=[{id:120,roadbedVsIntersection:'roadbed',
    coordinatesMetres:[[[[300,0],[340,0],[340,20],[300,20],[300,0]]]]}];
  const returnedWholeCsclRoad=[{id:22,name:'7 Avenue',
    constructedVehicleCandidate:true,lines:[[[320,10],[380,10]]]}];
  const r=audit2022RoadbedCoverage(returnedWholeCsclRoad,
    official2022OnlyInBbox,[],2);
  assert.ok(r.samples>=6&&r.samples<=10,'retain original query ROI samples');
  assert.ok(r.outsideBboxSamplesDiscarded>15,'discard unqueried road tail');
  assert.equal(r.coverageFraction,1);
  assert.equal(r.insideHistoric2022Roadbed,r.samples);
  assert.deepEqual(r.missed,[]);
  assert.ok(r.officialSpatialQueryBoundsMetres[2]<340);
});
test('historical source stays audit-only, no proprietary map copy or production overlay',async()=>{
  const script=await readFile(new URL(
    '../scripts/nyc-times-plani-real-boundary-probe.mjs',import.meta.url),'utf8');
  const main=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(script.includes('licenseApprovedForGame:false'));
  assert.ok(script.includes('codeAffectsPlayableFlight:false'));
  assert.ok(script.includes('Manhattan:\'2022-03-18\'')===false||script.includes('2022-03-18'));
  assert.ok(!main.includes('nyc-times-plani-real-boundary-probe.mjs'));
  assert.ok(!script.includes('maps.googleapis.com'));
});
