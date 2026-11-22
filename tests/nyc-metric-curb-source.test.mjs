import test from 'node:test';
import assert from 'node:assert/strict';
import {BBOX} from '../tools/nyc/fetch-times-square-cscl.mjs';
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
