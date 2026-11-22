import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifySourceFrames}
  from '../scripts/nyc-sidewalk-curb-lowflight-mesh.mjs';

const projection={
  originLonLat:[-73.9864883,40.756421],
  bboxLonLat:[-73.99,40.7552,-73.9822,40.7610],
  scaleMetresPerGameUnit:null
};
function polygon(i){
  const r=40;
  const ring=Array.from({length:r},(_,j)=>{
    const t=j/r*2*Math.PI;
    return [i*15+4*Math.cos(t),4*Math.sin(t)];
  });
  ring.push(ring[0]);
  return {objectId:i+1,subtype:380000,polygons:[[ring]]};
}
function fake(){
  const sidewalks=Array.from({length:30},(_,i)=>polygon(i));
  const curbs=Array.from({length:201},(_,id)=>({
    objectId:id+1,parts:[Array.from({length:7},(_,n)=>[id*.5,n*.1])]
  }));
  const curbCuts=Array.from({length:217},(_,id)=>({
    objectId:id+1,subtype:222700,
    parts:[[[id*.25,0],[id*.25,.2]]]
  }));
  return {edges:{schema:'patrol-nyc-oti-sidewalk-curb-metre-source-v1',
    projection,counts:{sidewalkFeatures:30,curbFeatures:201,curbCuts:217},
    sidewalks,curbs,curbCuts},
  roads:{schema:'patrol-nyc-lowflight-oti-roadbed-metre-v1',
    mode:'SOURCE_VERIFIED_NO_DEFAULT_GAME_CHANGE',projection}};
}
test('meter source identity checked without optional external module',()=>{
  const {edges,roads}=fake();
  assert.equal(verifySourceFrames(edges,roads),true);
  assert.deepEqual(edges.projection,roads.projection);
  assert.ok(edges.sidewalks.every(item=>item.polygons[0][0]
    .every(point=>point.length===2)));
  const source=readFileSync(new URL(
    '../scripts/nyc-sidewalk-curb-lowflight-mesh.mjs',import.meta.url),'utf8');
  assert.match(source,/await import\('earcut'\)/,
    'only dedicated geometry build may require Earcut');
  assert.match(source,/deviation\(points,holes,2,indices\)/,
    'original source holes must be area-verified');
  assert.match(source,/mode:'OPT_IN_QA_NOT_DEFAULT_MAP'/);
});
test('never combine incompatible / compressed metre projections',()=>{
  const {edges,roads}=fake();
  assert.throws(()=>verifySourceFrames(edges,{
    ...roads,projection:{...projection,originLonLat:[0,0]}
  }),/same exact metre projection/);
  assert.throws(()=>verifySourceFrames({
    ...edges,projection:{...projection,scaleMetresPerGameUnit:.32}
  },roads),/same exact metre projection/);
  assert.throws(()=>verifySourceFrames(edges,{
    ...roads,mode:'PATROL_COMPRESSED_GAME'
  }),/same exact metre projection/);
});
test('existing lowflight and anti-tunnel remain; realEdges opt-in never toggles default',()=>{
  const html=readFileSync(new URL('../tools/nyc/true-scale-preview.html',import.meta.url),'utf8');
  assert.match(html,/spawnOnVerifiedStreet/);
  assert.match(html,/advanceMetricFlight/);
  assert.match(html,/hitsBuilding/);
  assert.match(html,/URLSearchParams\(window.location.search\)\.get\('realEdges'\)==='1'/);
  assert.match(html,/measuredEdges\?\.draw\(gl\)/);
  assert.match(html,/officialStreetEdges2022:measuredEdges\?/);
  assert.doesNotMatch(html,/from ['"]\.\/edge-layer\.mjs['"]/,
    'mandatory module import would break current source flight CI');
});
