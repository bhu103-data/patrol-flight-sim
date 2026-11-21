// NYC shoreline fixtures: don't draw zebra stripes at inundated or blocked corners.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
const {buildNycStreetNetwork}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));
const grid={blockWidth:24,blockLength:33,tilt:.24,offset:30,
  parkHalfWidth:43,parkHalfLength:151,parkCenter:10000};
const z=-330,x=10*24+grid.tilt*z+grid.offset;
function run(terrainAt,isClear=()=>true){
  const quads=[];
  const stats=buildNycStreetNetwork({
    addQuad(...q){quads.push(q)},addTri(){},box(){},beam(){},ribbon(){},
    terrainAt,detailBand:()=>3,grid,streetY:20,waterY:0,
    timesBounds:[900,1000,900,1000],existingStreets:[],isClear
  });
  const paint=quads.filter(q=>q.length>=5&&Array.isArray(q[4])&&
    Math.abs(q[4][0]-.85)<.001&&Math.abs(q[4][1]-.86)<.001 &&
    q.slice(0,4).every(p=>Array.isArray(p)&&
      Math.abs(p[0]-x)<11&&Math.abs(p[2]-z)<11));
  return {stats,paint};
}
test('Brooklyn bridgehead zebra stripes stay visible on dry unblocked ground',()=>{
  assert.ok(run(()=>100).paint.length>0);
});
test('a flooded 7.5-unit corner suppresses crosswalk despite a dry road center',()=>{
  const wet=(px,pz)=>Math.hypot(px-(x+7.5),pz-(z+7.5))<.7?0:100;
  const {stats,paint}=run(wet);
  assert.equal(paint.length,0);
  assert.ok(stats.skippedWater>0);
});
test('a corner structure outside the old 5-unit clearance suppresses the crosswalk',()=>{
  const isClear=(px,pz,r=.5)=>Math.hypot(px-(x+7.5),pz-(z+7.5))>.7+r;
  const {stats,paint}=run(()=>100,isClear);
  assert.equal(paint.length,0);
  assert.ok(stats.skippedRoadFootprints>0);
});
