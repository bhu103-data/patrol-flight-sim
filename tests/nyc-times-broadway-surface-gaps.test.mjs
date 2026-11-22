import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sourceSurfaceIntervals,broadwaySurfaceGaps,broadwayGapGeoJson
} from '../scripts/nyc-times-broadway-surface-gaps.mjs';

const ring=(a,b,c,d)=>[[a,b],[c,b],[c,d],[a,d],[a,b]];
const polygon=(outer,holes=[])=>({polygons:[[outer,...holes]]});
const crs={originLonLat:[-73.9864883,40.756421]};
const classes={
  roadbed:[polygon(ring(0,-5,30,5))],
  plaza:[polygon(ring(30,-5,60,5))],
  sidewalk:[polygon(ring(60,-5,80,5))]
};
const ref={projection:crs,roads:[{
  objectId:1712,streetName:'Broadway',
  lines:[[[-10,0],[40,0],[100,0]]]
}]};
const bed={projection:crs,roadbeds:classes.roadbed};
const ped={projection:crs,plaza:classes.plaza,
  sidewalk:classes.sidewalk};

test('exact piece intervals preserve 2022 surface classes, not fictional drivable street widths',()=>{
  const items=sourceSurfaceIntervals([-10,0],[100,0],classes);
  assert.deepEqual(items.map(x=>x.classification),
    ['unmapped','roadbed','plaza','sidewalk','unmapped']);
  assert.deepEqual(items.map(x=>Math.round(x.lengthMeters)),
    [10,30,30,20,20]);
  assert.ok(items.every(x=>x.start.every(Number.isFinite)&&
    x.end.every(Number.isFinite)));
});
test('real ring holes and all source polygon boundaries create unmapped segments',()=>{
  const items=sourceSurfaceIntervals([-10,0],[80,0],{
    roadbed:[polygon(ring(0,-5,60,5),[ring(25,-2,35,2)])],
    plaza:[],sidewalk:[]
  });
  const by=(kind)=>items.filter(x=>x.classification===kind)
    .reduce((s,x)=>s+x.lengthMeters,0);
  assert.equal(Math.round(by('roadbed')),50);
  assert.equal(Math.round(by('unmapped')),40);
  assert.ok(items.some(x=>x.classification==='unmapped'&&
    Math.abs(x.start[0]-25)<.001&&Math.abs(x.end[0]-35)<.001));
});
test('two real DCM segment boundaries never imply an entire drivable Broadway route',()=>{
  const result=broadwaySurfaceGaps(ref,bed,ped);
  assert.deepEqual(result.totals,{
    centrelineMeters:110,roadbedMeters:30,plazaMeters:30,
    sidewalkMeters:20,unmappedMeters:30,overlapMeters:0
  });
  assert.equal(result.role,'GEOGRAPHIC_QA_ONLY_NO_AUTO_VEHICLE_ROUTING');
  const gaps=result.reviewIntervals.filter(x=>x.classification==='unmapped');
  assert.equal(gaps.length,2);
  assert.deepEqual(gaps.map(x=>x.lengthMeters).sort((a,b)=>a-b),[10,20]);
  const geojson=broadwayGapGeoJson(result);
  assert.equal(geojson.type,'FeatureCollection');
  assert.equal(geojson.features.length,result.reviewIntervals.length);
  assert.ok(geojson.features.every(f=>
    f.geometry.type==='LineString'&&
    f.geometry.coordinates.every(p=>p.length===2&&
      p.every(Number.isFinite)&&p[0]<-73&&p[1]>40)&&
    f.properties.sourceRole==='QA_ONLY_NOT_DRIVABLE'));
});
test('overlapping mapped surfaces get explicit overlap review, not silent prioritization',()=>{
  const items=sourceSurfaceIntervals([-10,0],[100,0],{
    roadbed:[polygon(ring(0,-5,40,5))],
    plaza:[polygon(ring(30,-5,50,5))],
    sidewalk:[]
  });
  const overlap=items.filter(x=>x.classification==='overlap');
  assert.equal(Math.round(overlap.reduce((a,x)=>a+x.lengthMeters,0)),10);
  assert.ok(overlap.every(x=>x.surfaceClasses.includes('roadbed')&&
    x.surfaceClasses.includes('plaza')));
});
test('fail closed on mismatched origin, missing source, invalid coordinates and missing Broadway',()=>{
  assert.throws(()=>broadwaySurfaceGaps(ref,
    {...bed,projection:{originLonLat:[0,0]}},ped),/projections differ/);
  assert.throws(()=>broadwaySurfaceGaps(ref,bed,
    {...ped,sidewalk:null}),/Missing official/);
  assert.throws(()=>sourceSurfaceIntervals([0,0],[NaN,0],classes),
    /Invalid local-metre/);
  assert.throws(()=>broadwaySurfaceGaps(
    {projection:crs,roads:[]},bed,ped),/Missing official Broadway/);
});
