// Safety guards must belong to actual rendered, building-safe road fragments.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  chongqingTerraceRoads, sampleChongqingTerraceSurface,
  clipChongqingDryRoadSegments, clipRoadToFreeSegments,
  collectChongqingShorelineRoadEnds
} from '../assets/chongqing/road-clearance.js';

const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
const tributary=z=>-390+18*Math.sin(z/175);
const riverDist=(x,z)=>Math.min(Math.abs(z-riverCenter(x))-78,
  z<18&&z>-620?Math.abs(x-tributary(z))-47:Infinity);
const ground=(x,z)=>riverDist(x,z)<0?-13:Math.max(8,9+riverDist(x,z)*.172);

function built(obstacles=[]){
  const all=[];
  for(const plan of chongqingTerraceRoads(riverCenter)){
    const sampled=sampleChongqingTerraceSurface(plan,ground,riverCenter);
    const dry=clipChongqingDryRoadSegments(sampled,plan.width,ground,riverDist);
    const final=dry.map(path=>clipRoadToFreeSegments(
      path,plan.width,obstacles,.8,2.5).paths);
    const ends=collectChongqingShorelineRoadEnds(dry,final,plan.width);
    all.push({dry,final,ends,width:plan.width,plan});
  }
  return all;
}
const marker=p=>[p.x,p.z].map(v=>v.toFixed(4)).join(':');
const guards=all=>all.flatMap(row=>row.ends);
const baseline=built();

test('six authentic tributary-bank guards survive without buildings',()=>{
  assert.equal(guards(baseline).length,6);
  for(const g of guards(baseline)){
    assert.ok(riverDist(g.point.x,g.point.z)>2.4);
    assert.ok(g.width>=10 && g.width<=13);
    assert.ok(Math.abs(g.intoRoad)===1);
  }
});
test('a building occupying one dead end removes its now-orphaned guard',()=>{
  const one=baseline.find(v=>v.ends.length===2);
  assert.ok(one,'the live road generator must form a tributary gap');
  const blockedEnd=one.dry[0].at(-1);
  const obstruction={x:blockedEnd.x,z:blockedEnd.z,w:12,d:12,
    base:-1000,top:1000};
  const modified=built([obstruction]);
  const original=new Set(guards(baseline).map(g=>marker(g.point)));
  const guarded=guards(modified);
  assert.ok(guarded.length<6,'guard on clipped shoreline end must disappear');
  assert.ok(guarded.length>=4,'unrelated dry crossings should remain guarded');
  assert.ok(!guarded.some(g=>marker(g.point)===marker(blockedEnd)),
    'a building-truncated road must not retain its old bank guard');
  assert.ok(guarded.every(g=>original.has(marker(g.point))),
    'building cuts must never invent a new guard away from the actual bank');
});
test('interior building cuts never introduce fake river end guards',()=>{
  const first=baseline[0];
  const interior=first.dry[0][Math.floor(first.dry[0].length*.5)];
  const blocker={x:interior.x,z:interior.z,w:12,d:12,
    base:-1000,top:1000};
  const modified=built([blocker]);
  const known=new Set(guards(baseline).map(g=>marker(g.point)));
  assert.ok(guards(modified).every(g=>known.has(marker(g.point))),
    'a building split is not a riverbank and may not create a guard');
});
test('invalid or disconnected final roads do not allocate scene guards',()=>{
  const line=[[{x:0,y:15,z:0},{x:5,y:15,z:0}],
    [{x:15,y:15,z:0},{x:20,y:15,z:0}]];
  assert.equal(collectChongqingShorelineRoadEnds(line,[[],[]],12).length,0);
  assert.equal(collectChongqingShorelineRoadEnds(line,[[line[0]],[line[1]]],12).length,2);
  assert.equal(collectChongqingShorelineRoadEnds(line,[[line[0]]],12).length,0);
});
test('the production scene places guard sites after final building clipping',()=>{
  const code=readFileSync(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  const dry=code.indexOf('const dryRoads=clipChongqingDryRoadSegments(');
  const clip=code.indexOf('const clear=clipRoadToFreeSegments(dry,plan.width,obstacles',dry);
  const guard=code.indexOf('shorelineRoadEnds.push(...collectChongqingShorelineRoadEnds(',dry);
  const render=code.indexOf('buildChongqingShorelineBarriers({',guard);
  assert.ok(dry>0&&clip>dry&&guard>clip&&render>guard,
    'guards must be derived after the real road renderer has clipped buildings');
  assert.match(code,/const finalPaths=clear\.paths\.filter/);
});
