import test from 'node:test';
import assert from 'node:assert/strict';
import {BBOX} from '../tools/nyc/fetch-times-square-cscl.mjs';
import {buildMetricCurbs} from '../assets/nyc/nyc-metric-curbs.mjs';
import {requestCurbUrl,normalizeCurbRecords,downloadCurbs}
  from '../tools/nyc/fetch-times-square-curbs.mjs';

const sample=(i=1)=>({
  objectid:i,status:'a',shape_leng:'32',
  the_geom:{type:'MultiLineString',coordinates:[[
    [-73.98649,40.75642],[-73.98646,40.75645],
    [-73.9864,40.75649]
  ]]}
});
test('actual NYC planimetric curb query reuses exact 1:1 WGS84 pilot bbox',()=>{
 const u=new URL(requestCurbUrl());
 assert.equal(u.origin,'https://data.cityofnewyork.us');
 assert.equal(u.pathname,'/resource/5xvt-8cbk.json');
 assert.equal(u.searchParams.get('$where'),
  'within_box(the_geom,'+
  [BBOX.north,BBOX.west,BBOX.south,BBOX.east].join(',')+')');
 assert.equal(u.searchParams.get('$limit'),'2000');
});
test('curb source parser preserves WGS84 vertices without fabricated road widths',()=>{
 const {segments,rejected}=normalizeCurbRecords([
   sample(),sample(2),{objectid:3,the_geom:{type:'Point',coordinates:[0,0]}}]);
 assert.equal(segments.length,2);
 assert.equal(rejected.length,1);
 assert.deepEqual(segments[0].parts[0][0],[-73.98649,40.75642]);
 assert.equal(segments[0].shapeLengthRaw,'32');
 assert.ok(!Object.hasOwn(segments[0],'widthMetres'));
 assert.throws(()=>normalizeCurbRecords(Array.from({length:2000},()=>sample())),
  /cap/);
});
test('curb source download refuses insufficient/invalid data',async()=>{
 const source=Array.from({length:20},(_,i)=>sample(i+1));
 const result=await downloadCurbs(async()=>({ok:true,json:async()=>source}));
 assert.equal(result.segments.length,20);
 assert.match(result.captureVintage,/2022/);
 assert.match(result.disclaimer,/NOT verified current roadbed/);
 assert.equal(result.inputRows,20);
});

test('real municipality curb geometry shares WGS84 ENU metre scale, not streetwidth offsets',async()=>{
 const data=Array.from({length:20},(_,i)=>sample(i+1));
 const snapshot=await downloadCurbs(async()=>({ok:true,json:async()=>data}));
 const mesh=buildMetricCurbs(snapshot);
 assert.equal(mesh.stats.records,20);
 assert.equal(mesh.stats.edges,40);
 assert.equal(mesh.vertexBuffer.length,40*2*9);
 assert.equal(mesh.stats.noRoadbedOrSidewalks,true);
 assert.ok(mesh.stats.totalLengthMetres>50);
 assert.ok([...mesh.vertexBuffer].every(Number.isFinite));
 assert.ok(Math.abs(mesh.vertexBuffer[1]-.84)<.000001);
});
test('curb renderer refuses unknown provenance and all-bad WGS84 geometries',()=>{
 assert.throws(()=>buildMetricCurbs({segments:[]}),/Official NYC/);
 const invalid={
   sourceDataset:'NYC Planimetric Database: Curbs / 5xvt-8cbk',
   segments:[{id:'10',parts:[[[NaN,0],[0,1]]]}]
 };
 assert.throws(()=>buildMetricCurbs(invalid),/No physical NYC curb/);
});
