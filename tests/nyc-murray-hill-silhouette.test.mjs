import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,snapshot} from '../scripts/nyc-murray-hill-footprints.mjs';
import {murrayHillSilhouettes,buildMurrayHillVisualMesh} from '../assets/nyc/murray-hill-silhouette.js';
const shape=[[-73.98,40.75],[-73.9798,40.75],[-73.9798,40.7502],[-73.98,40.7502],[-73.98,40.75]];
const feature=(id,heightFt,ring=shape)=>({properties:{DOITT_ID:id,HEIGHT_ROOF:heightFt},geometry:{type:'Polygon',coordinates:[ring]}});
test('rejects unknown roof heights, duplicate IDs and exterior geometry',()=>{
 const features=normalize([feature(10,190),feature(10,190),feature(11,null),feature(12,-1),feature(13,40,[[-74.1,40.75],...shape.slice(1)])]);
 assert.deepEqual(features.map(f=>f.id),[10]);
});
test('official roof heights and authored setbacks remain distinguishable',async()=>{
 const data=await snapshot(async()=>({ok:true,json:async()=>({features:[feature(20,250),feature(21,310)]})}));
 assert.equal(data.collision,false);
 const items=[];const stats=murrayHillSilhouettes(data,item=>items.push(item));
 assert.equal(stats.buildings,2);assert.equal(stats.approximateRoofTiers,2);
 assert.equal(items.filter(v=>v.kind==='approximate-inset-terrace').length,2);
 assert.ok(items.every(v=>v.ring.every(p=>p.every(Number.isFinite))));
 assert.ok(items.filter(v=>v.baseHeight).every(v=>v.baseHeight<v.height));
});
test('never accepts a collision-enabled snapshot',()=>{
 assert.throws(()=>murrayHillSilhouettes({schema:'patrol-nyc-murray-hill-visual-only-v1',viewOnly:true,collision:true,buildings:[]},()=>{}));
});
test('visual mesh generates true walls, roof triangles, bounded window details and inset roof',async()=>{
 const wide=[[-73.98,40.75],[-73.9796,40.75],[-73.9796,40.75025],[-73.98,40.75025],[-73.98,40.75]];
 const snapshotData=await snapshot(async()=>({ok:true,json:async()=>({features:[feature(20,300,wide)]})}));
 const quads=[],tris=[];
 const stats=buildMurrayHillVisualMesh(snapshotData,{addQuad:(...args)=>quads.push(args),addTri:(...args)=>tris.push(args)});
 assert.equal(stats.buildings,1);
 assert.equal(stats.approximateTerraces,1);
 assert.ok(stats.windowQuads>0);
 assert.ok(stats.roofTriangles>=4);
 assert.ok(quads.some(q=>q.at(-1)===7));
 assert.ok(tris.every(t=>t.at(-1)===8&&t.slice(0,3).every(p=>p.every(Number.isFinite))));
 assert.ok(stats.facadeQuads<=2800);
 assert.equal(stats.visualOnly,true);
});
test('concave source shape retains true roof triangulation without invented terraces',async()=>{
 const notch=[[-73.98,40.75],[-73.9797,40.75],[-73.9797,40.7501],[-73.97985,40.7501],[-73.97985,40.7502],[-73.98,40.7502],[-73.98,40.75]];
 const data=await snapshot(async()=>({ok:true,json:async()=>({features:[feature(21,300,notch)]})}));
 const tris=[];const s=buildMurrayHillVisualMesh(data,{addQuad:()=>{},addTri:(...x)=>tris.push(x)});
 assert.equal(s.buildings,1);assert.equal(s.approximateTerraces,0);
 assert.equal(s.roofTriangles,4);
});
