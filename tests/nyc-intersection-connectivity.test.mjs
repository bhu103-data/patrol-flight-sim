// Regression: disconnected road fragments must not authorize a ghost crosswalk.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
const {buildNycStreetNetwork}=await import(
  'data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const grid={blockWidth:24,blockLength:33,tilt:.24,offset:30,
  parkHalfWidth:43,parkHalfLength:150,parkCenter:10000};
const i=10,j=-10,z=j*grid.blockLength;
const x=i*grid.blockWidth+grid.tilt*z+grid.offset;

function scene(isClear){
  const quads=[],roads=[];
  const stats=buildNycStreetNetwork({
    addQuad(...args){quads.push(args)},addTri(){},box(){},beam(){},
    ribbon(a,b,width){roads.push({a,b,width})},
    terrainAt:()=>100,detailBand:()=>3,
    grid,streetY:20,waterY:0,timesBounds:[900,1000,900,1000],
    existingStreets:[],isClear
  });
  const paint=quads.filter(q=>q.length>=5&&
    Array.isArray(q[4])&&Math.abs(q[4][0]-.85)<.001 &&
    Math.abs(q[4][1]-.86)<.001&&
    q.slice(0,4).every(v=>Array.isArray(v)&&
      Math.abs(v[0]-x)<11&&Math.abs(v[2]-z)<11));
  return {stats,paint,roads};
}

test('Brooklyn road intersection renders crosswalk when a street reaches it',()=>{
  const clear=scene(()=>true);
  assert.ok(clear.paint.length>=10,'expected visible Brooklyn crosswalk markings');
});

test('road remnants beyond two building cuts do not imply a connected junction',()=>{
  // Two buildings block both north and south avenue approaches 6-8 units
  // away from the actual junction. The intersection footprint itself is
  // clear, while distant surviving fragments keep the old road identifiers.
  const clear=(px,pz,r=0)=>{
    const roadX=i*grid.blockWidth+grid.tilt*pz+grid.offset;
    if(Math.abs(px-roadX)>4.6+r)return true;
    return !([-322,-338].some(center=>Math.abs(pz-center)<1.3+r));
  };
  const interrupted=scene(clear);
  assert.ok(interrupted.stats.preservedRoadSections>0,
    'distant road sections should survive the clipping operation');
  assert.equal(interrupted.paint.length,0,
    'no crosswalk without a real avenue reaching the Brooklyn node');
});
