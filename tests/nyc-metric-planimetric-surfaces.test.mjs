import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {BBOX} from '../tools/nyc/fetch-times-square-cscl.mjs';
import {DATASETS,urlFor,normalizePlanimetricPolygons,fetchPlanimetric}
  from '../tools/nyc/fetch-times-square-planimetrics.mjs';
import {buildMetricPlanimetricOutlines,clipSegment}
  from '../assets/nyc/nyc-metric-planimetric-outlines.mjs';

const dir=dirname(fileURLToPath(import.meta.url));
const ring=[
  [-73.9866,40.7565],[-73.9864,40.7565],
  [-73.9864,40.7567],[-73.9866,40.7567],[-73.9866,40.7565]
];
const hole=[
  [-73.98658,40.75652],[-73.98653,40.75652],
  [-73.98653,40.75656],[-73.98658,40.75656],[-73.98658,40.75652]
];
const rec=(id=1,withHole=false)=>({
 source_id:'0',status:'New',shape_area:'211.9',
 the_geom:{type:'MultiPolygon',
  coordinates:[[ring, ...(withHole?[hole]:[])]]}
});
const wrap=(records,type='roadbed')=>({
 sourceDataset:DATASETS[type].name,sourcePage:DATASETS[type].page,
 boundsWGS84:BBOX,fetchedUtc:'2026-11-22T00:00:00.000Z',
 records,queryUrl:urlFor(type),rejections:[]
});

test('official Roadbed and Sidewalk URLs are bounded, georeferenced and dataset-distinct',()=>{
 for(const [kind,id] of [['roadbed','i36f-5ih7'],
                         ['sidewalk','vfx9-tbb6']]){
  const u=new URL(urlFor(kind));
  assert.equal(u.origin,'https://data.cityofnewyork.us');
  assert.equal(u.pathname,'/resource/'+id+'.json');
  assert.equal(u.searchParams.get('$where'),
   'within_box(the_geom,40.7605,-73.9902,40.7548,-73.9824)');
  assert.equal(u.searchParams.get('$limit'),'2000');
 }
 assert.throws(()=>urlFor('asphalt-texture'),/Unknown official/);
});

test('source MultiPolygon holes, exteriors and original vertices survive exactly',()=>{
 const input=[rec(1,true),rec(2)];
 const out=normalizePlanimetricPolygons(input);
 assert.equal(out.records.length,2);
 assert.equal(out.rejections.length,0);
 assert.equal(out.outerRings,2);
 assert.equal(out.innerRings,1);
 assert.equal(out.vertexCount,15);
 assert.deepEqual(out.records[0].polygons[0][0],ring);
 assert.deepEqual(out.records[0].polygons[0][1],hole);
 assert.equal(out.records[0].shapeAreaRaw,'211.9');
 assert.notEqual(out.records[0].rowId,out.records[1].rowId,
   'nonunique source ID must never collapse geometries');
});

test('source refuses missing/incorrect open polygon rings and 2000 cap',()=>{
 const damaged=rec();
 damaged.the_geom.coordinates[0][0]=[
  ...ring.slice(0,-1),[-73.9867,40.75652]
 ];
 const out=normalizePlanimetricPolygons([damaged,rec()]);
 assert.equal(out.records.length,1);
 assert.equal(out.rejections.length,1);
 assert.throws(()=>normalizePlanimetricPolygons(Array.from({length:2000},rec)),
  /cap/);
 assert.throws(()=>normalizePlanimetricPolygons([rec()],{maxVertices:2}),
  /vertex budget/);
});

test('road and sidewalk source downloads are separate and cannot fabricate empty maps',async()=>{
 const records=Array.from({length:5},(_,i)=>rec(i));
 const mock=async()=>({ok:true,json:async()=>records});
 for(const type of ['roadbed','sidewalk']){
  const scene=await fetchPlanimetric(type,mock);
  assert.equal(scene.records.length,5);
  assert.equal(scene.inputRows,5);
  assert.equal(scene.sourceDataset,DATASETS[type].name);
  assert.match(scene.sourceImagery,/2022/);
  assert.match(scene.caution,/no road traffic lanes/);
  assert.ok(scene.queryUrl.includes(DATASETS[type].id));
 }
 const empty=normalizePlanimetricPolygons([]);
 assert.equal(empty.records.length,0);
 assert.throws(()=>buildMetricPlanimetricOutlines(wrap([]),{type:'roadbed'}),
  /No visible/);
});

test('metre-frame roadbed and sidewalk draw real ring outlines including holes, no fill',()=>{
 for(const type of ['roadbed','sidewalk']){
  const parsed=normalizePlanimetricPolygons([rec(1,true)]);
  const shape=buildMetricPlanimetricOutlines(
    wrap(parsed.records,type),{type});
  assert.equal(shape.stats.records,1);
  assert.equal(shape.stats.innerRings,1);
  assert.equal(shape.stats.outerRings,1);
  assert.equal(shape.stats.visibleEdges,8);
  assert.equal(shape.vertexBuffer.length,8*2*9);
  assert.equal(shape.stats.pavementFill,false);
  assert.equal(shape.stats.sourceHolesPreserved,true);
  assert.equal(shape.stats.drawnRoadWidths,false);
  assert.equal(shape.stats.collidersUnchanged,true);
  assert.ok([...shape.vertexBuffer].every(Number.isFinite));
  assert.ok(shape.stats.visibleOutlineLengthMetres>50);
 }
});

test('screen bounds clip outliers without modifying underlying official source',()=>{
 const bbox=[-5,5,-3,3];
 assert.deepEqual(clipSegment([-10,0],[10,0],bbox),[[-5,0],[5,0]]);
 assert.equal(clipSegment([10,10],[20,20],bbox),null);
 assert.deepEqual(clipSegment([-1,-1],[1,1],bbox),[[-1,-1],[1,1]]);
});

test('the future source outlines are separate from game mesh and not called roads',()=>{
 const source=readFileSync(resolve(dir,'../assets/nyc/nyc-metric-planimetric-outlines.mjs'),'utf8');
 const fetcher=readFileSync(resolve(dir,'../tools/nyc/fetch-times-square-planimetrics.mjs'),'utf8');
 assert.match(source,/not.*roadbed polygon fill|NOT roadbed polygon fill/i);
 assert.match(source,/wgs84ToLocalMetres/);
 assert.match(fetcher,/ring/);
 assert.doesNotMatch(source,/fillRect|THREE.Mesh|roadWidth\s*=/);
});
