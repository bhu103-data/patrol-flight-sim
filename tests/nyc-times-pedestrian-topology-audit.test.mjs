import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coveredLength,pointInPolygons,classifyCenterlines
} from '../scripts/nyc-times-pedestrian-topology-audit.mjs';
const ring=(x0,y0,x1,y1)=>[
  [x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]
];
const feature=(outer,holes=[])=>({polygons:[[outer,...holes]]});

test('exact segment overlap with real source polygon, not fixed-width buffering',()=>{
  const shapes=[feature(ring(0,0,10,10))];
  assert.equal(coveredLength([-10,5],[20,5],shapes),10);
  assert.equal(coveredLength([-10,15],[20,15],shapes),0);
  assert.ok(Math.abs(coveredLength([5,5],[20,5],shapes)-5)<1e-9);
});
test('polygon courtyard hole stays outside drivable and pedestrian surfaces',()=>{
  const shapes=[feature(ring(0,0,10,10),[ring(3,3,7,7)])];
  assert.ok(pointInPolygons([2,5],shapes));
  assert.equal(pointInPolygons([5,5],shapes),false);
  assert.equal(coveredLength([-1,5],[11,5],shapes),6);
  assert.equal(coveredLength([4,5],[6,5],shapes),0);
});
test('polygon union classifies the same centreline across roadbed and plaza',()=>{
  const frame={originLonLat:[-73.9864883,40.756421]};
  const road={projection:frame,roadbeds:[feature(ring(0,-5,500,5))]};
  const plaza={projection:frame,
    plaza:[feature(ring(500,-5,600,5))],
    sidewalk:[feature(ring(600,-5,700,5))]};
  const source={projection:frame,roads:[{streetName:'Broadway',
    lines:[Array.from({length:7},(_,i)=>[i*100,0])]}]};
  const result=classifyCenterlines(source,road,plaza);
  assert.equal(result.total.segmentCount,6);
  assert.ok(Math.abs(result.total.centrelineMetres-600)<.001);
  assert.ok(Math.abs(result.total.roadbedMetres-500)<.001);
  assert.ok(Math.abs(result.total.plazaMetres-100)<.001);
  assert.ok(Math.abs(result.total.roadbedOrPlazaMetres-600)<.001);
  assert.equal(result.total.roadbedPercent,83.33);
  assert.equal(result.total.roadbedOrPlazaPercent,100);
  assert.equal(result.byStreet[0].streetName,'Broadway');
  assert.equal(result.blockedAutomatedRouting,true);
});
test('input with differing source geodesy is never silently aligned',()=>{
  const source={projection:{originLonLat:[0,0]},roads:[]};
  const road={projection:{originLonLat:[1,0]},roadbeds:[]};
  const plaza={projection:{originLonLat:[0,0]},plaza:[],sidewalk:[]};
  assert.throws(()=>classifyCenterlines(source,road,plaza),/incompatible CRS/);
});
test('unbounded, nonfinite or missing source centerlines fail closed',()=>{
  assert.throws(()=>coveredLength([0,0],[Infinity,4],[]),/Nonfinite/);
  const f={originLonLat:[-73.9864883,40.756421]};
  assert.throws(()=>classifyCenterlines({
    projection:f,roads:[]},{projection:f,roadbeds:[]},
    {projection:f,plaza:[],sidewalk:[]}),/missing/);
});
