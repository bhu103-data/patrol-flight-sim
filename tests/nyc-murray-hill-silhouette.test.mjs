import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalize,snapshot} from '../scripts/nyc-murray-hill-footprints.mjs';
import {murrayHillSilhouettes} from '../assets/nyc/murray-hill-silhouette.js';
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