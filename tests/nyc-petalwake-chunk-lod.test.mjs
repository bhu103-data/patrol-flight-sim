import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {distanceToChunk,selectChunkLOD,createStreetFurnitureChunkBudget} from '../assets/nyc/petalwake-chunk-lod.js';
import {buildNycStreetNetwork} from '../assets/nyc/nyc-street-network.js';
test('Petalwake AABB LOD selects near/mid/far at exact chunk edges',()=>{
 const box=[0,0,0,10,10,10];
 assert.equal(distanceToChunk([5,5,5],box),0);
 assert.equal(distanceToChunk([15,5,5],box),5);
 assert.equal(distanceToChunk([15,15,5],box),Math.hypot(5,5));
 assert.equal(selectChunkLOD(0),2);
 assert.equal(selectChunkLOD(134.9),2);
 assert.equal(selectChunkLOD(135),1);
 assert.equal(selectChunkLOD(559.9),1);
 assert.equal(selectChunkLOD(560),0);
 assert.throws(()=>distanceToChunk([1,2,3],[2,0,0,1,3,3]));
 assert.throws(()=>selectChunkLOD(-1));
});
test('chunk furniture budget preserves bridgehead priority and spatial caps',()=>{
 const budget=createStreetFurnitureChunkBudget({cellX:10,cellZ:10,bridgeCap:2,otherCap:3});
 assert.equal(budget.permits(1,1,1,true),false);
 assert.equal(budget.permits(1,1,2,true),true);
 assert.equal(budget.permits(1,1,2,false),false);
 for(let i=0;i<2;i++)budget.record(1,1,true);
 assert.equal(budget.permits(1,1,2,true),false);
 assert.equal(budget.permits(11,1,2,true),true);
 assert.equal(budget.permits(1,1,3,false),true);
 assert.equal(budget.snapshot()['bridge:0:0'],2);
});
test('PATROL runtime road adapter consumes chunk budget without rewriting road geometry',()=>{
 const source=readFileSync(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
 assert.match(source,/createStreetFurnitureChunkBudget/);
 assert.match(source,/furnitureChunks\.permits\(cx,cz,detailBand\(cx,cz\),bridgehead\)/);
 assert.match(source,/furnitureChunks\.record\(cx,cz,bridgehead\)/);
 assert.match(source,/generatedCityRoadOverlap|roadCorridorClear/);
});
test('bridgehead streets retain existing safety and cap, without new fixture asset',()=>{
 const stats=buildNycStreetNetwork({
  addQuad(){},addTri(){},box(){},beam(){},ribbon(){},
  terrainAt:()=>100,detailBand:()=>3,
  grid:{blockWidth:24,blockLength:33,tilt:.24,offset:30,parkCenter:10000,parkHalfLength:151,parkHalfWidth:43},
  streetY:20,waterY:12.2,timesBounds:[900,1000,900,1000],
  existingStreets:[],isClear:()=>true
 });
 assert.ok(stats.brooklynStreetFurniture<=22);
 assert.ok(stats.streetFurniture<=104);
 assert.ok(stats.brooklynStreetFurniture>=0);
});
