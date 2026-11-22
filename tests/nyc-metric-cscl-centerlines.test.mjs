import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {BBOX,requestUrl,normalizeCSCL,downloadCSCL}
  from '../tools/nyc/fetch-times-square-cscl.mjs';
import {buildMetricCenterlines}
  from '../assets/nyc/nyc-metric-centerlines.mjs';

const dir=dirname(fileURLToPath(import.meta.url));
const sample=(id=100,name='W 44 ST')=>({
 physicalid:String(id),full_street_name:name,rw_type:'1',trafdir:'FT',
 streetwidth:'40',number_travel_lanes:'2',
 the_geom:{type:'MultiLineString',coordinates:[[
  [-73.9864883,40.756421],[-73.9854883,40.756421],
  [-73.9854883,40.757421]
 ]]}
});
const wrap=segments=>({
 sourceDataset:'NYC Street Centerline (CSCL) / inkn-q76z',
 boundsWGS84:BBOX,
 fetchedUtc:'2026-11-22T00:00:00.000Z',
 queryUrl:requestUrl(),segments
});

test('official CSCL extractor queries a fixed small Times Square WGS84 bounding box',()=>{
 const url=new URL(requestUrl());
 assert.equal(url.origin,'https://data.cityofnewyork.us');
 assert.equal(url.pathname,'/resource/inkn-q76z.json');
 assert.equal(url.searchParams.get('$where'),
   'within_box(the_geom,40.7605,-73.9902,40.7548,-73.9824)');
 assert.equal(url.searchParams.get('$limit'),'2000');
 assert.match(url.searchParams.get('$select'),/physicalid,the_geom/);
 assert.match(url.searchParams.get('$select'),/trafdir/);
});

test('only real finite source polylines enter a normalized official record',()=>{
 const r=normalizeCSCL([sample(),sample(100,'Duplicate'),sample(101),
   {physicalid:'102',the_geom:{type:'Point',coordinates:[]}},
   {physicalid:'bad',the_geom:{type:'MultiLineString',coordinates:[]}}]);
 assert.equal(r.segments.length,2);
 assert.equal(r.rejects.length,3);
 assert.equal(r.segments[0].parts[0].length,3);
 assert.equal(r.segments[0].trafdir,'FT');
 assert.equal(r.segments[0].streetwidthRaw,'40');
 assert.throws(()=>normalizeCSCL(Array.from({length:2000},()=>sample())),
   /incomplete extraction/);
});

test('all road geometry uses the same WGS84 metre basis as official buildings',()=>{
 const data=normalizeCSCL([sample()]).segments;
 const r=buildMetricCenterlines(wrap(data));
 assert.equal(r.stats.records,1);
 assert.equal(r.stats.edges,2);
 assert.equal(r.stats.parts,1);
 assert.equal(r.stats.uniqueStreetNames,1);
 assert.ok(r.stats.totalLengthMetres>180 && r.stats.totalLengthMetres<210);
 assert.equal(r.stats.noRoadEdgesOrPavement,true);
 assert.equal(r.vertexBuffer.length,2*2*9);
 assert.ok([...r.vertexBuffer].every(Number.isFinite));
 assert.equal(r.vertexBuffer[0],0);
 assert.ok(r.vertexBuffer[9]>80 && r.vertexBuffer[9]<90);
 assert.ok(Math.abs(r.vertexBuffer[1]-.65)<.00001);
});

test('reject unsupported snapshot and invalid polyline parts without synthetic roads',()=>{
 assert.throws(()=>buildMetricCenterlines({segments:[]}),/official snapshot/);
 assert.throws(()=>buildMetricCenterlines(wrap([
   {physicalid:'1',parts:[]}
 ])),/No valid finite/);
 const ok=buildMetricCenterlines(wrap([
   {physicalid:'2',name:'real',parts:[
     [[-73.9864883,40.756421],[-73.9854883,40.756421]]
   ]},
   {physicalid:'2',parts:[[[0,0],[1,1]]]}
 ]));
 assert.equal(ok.stats.records,1);
 assert.equal(ok.rejected.length,1);
});

test('off-line bounded fetch rejects missing/empty/mislocated source instead of fake roads',async()=>{
 const data=Array.from({length:20},(_,i)=>sample(i+1000,'W '+(42+i%10)+' ST'));
 const mock=async()=>({ok:true,json:async()=>data});
 const v=await downloadCSCL(mock);
 assert.equal(v.inputRows,20);
 assert.equal(v.segments.length,20);
 assert.equal(v.sourcePage,'https://data.cityofnewyork.us/d/inkn-q76z');
 assert.match(v.disclaimer,/NOT measured curb/);
 // A source with zero roads cannot accidentally be accepted as geometry.
 assert.equal(normalizeCSCL([]).segments.length,0);
 assert.throws(()=>buildMetricCenterlines(wrap([])),/No valid finite/);
});

test('viewer and CI keep official roads distinct from fake asphalt and actual curbs',()=>{
 const page=readFileSync(resolve(dir,'../nyc-metric-pilot.html'),'utf8');
 const workflow=readFileSync(resolve(dir,'../.github/workflows/nyc-metric-pilot.yml'),'utf8');
 assert.match(page,/nyc-metric-centerlines\.mjs/);
 assert.match(page,/cscl-centerlines\.json/);
 assert.match(page,/不是测绘路缘/);
 assert.match(workflow,/fetch-times-square-cscl\.mjs/);
 assert.doesNotMatch(page,/mapbox.*token|googleapis.*key/i);
});
