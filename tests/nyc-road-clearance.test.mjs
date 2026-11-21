// node --test tests/nyc-road-clearance.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const fromFile=async name=>readFile(new URL(name,import.meta.url),'utf8');
const source=await fromFile('../assets/nyc/nyc-street-network.js');
const {buildNycStreetNetwork}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function city(isClear){
  const slabs=[],signalObjects=[];
  const grid={
    blockWidth:24,blockLength:33,tilt:.24,offset:30,
    parkHalfWidth:43,parkHalfLength:150,parkCenter:10000
  };
  const stats=buildNycStreetNetwork({
    addQuad(){},addTri(){},box(...params){signalObjects.push(params)},
    beam(){},ribbon(a,b,width,color){slabs.push({a,b,width,color})},
    terrainAt:()=>100,detailBand:()=>3,
    grid,streetY:20,waterY:0,timesBounds:[900,1000,900,1000],
    existingStreets:[],isClear,
    lettering(){},pavementText(){}
  });
  return {stats,slabs,signalObjects,grid};
}
test('Manhattan grid still has roads when lots are clear',()=>{
  const {stats,slabs}=city(()=>true);
  assert.ok(stats.avenues>80);
  assert.ok(stats.streets>80);
  assert.ok(slabs.length>200);
  assert.equal(stats.skippedRoadFootprints,0);
});
test('no road ribbon or intersection is painted through an occupied building',()=>{
  const obstacle={x:30,z:16,w:10,d:16};
  const isClear=(x,z,r=0)=>Math.abs(x-obstacle.x)>obstacle.w*.5+r||
    Math.abs(z-obstacle.z)>obstacle.d*.5+r;
  const {stats,slabs}=city(isClear);
  assert.ok(stats.skippedRoadFootprints>0,'conflict must be detected');
  assert.ok(stats.avenues>50&&stats.streets>50);
  for(const rib of slabs){
    const x=(rib.a[0]+rib.b[0])*.5,z=(rib.a[2]+rib.b[2])*.5;
    const dx=rib.b[0]-rib.a[0],dz=rib.b[2]-rib.a[2];
    const side=Math.hypot(dx,dz);
    // A conservative test: no road's center strip can sit inside the building.
    if(Math.abs(x-obstacle.x)<obstacle.w*.5-.1&&
       Math.abs(z-obstacle.z)<obstacle.d*.5-.1)
      assert.fail('Road ribbon inside building footprint');
  }
});
test('main NYC lot filter protects street routes in visual and collision data',async()=>{
  const html=await fromFile('../index.html');
  const start=html.indexOf('function nycParcelCrossesRoad(');
  const end=html.indexOf('function setupCityLots(',start);
  assert.ok(start>0&&end>start);
  const functionBody=html.slice(start,end);
  const roads=[[[0,-90],[0,90]],[[100,0],[240,0]]];
  const policy=new Function('CITY_STREETS',functionBody+';return nycParcelCrossesRoad;')(roads);
  assert.equal(policy([0,12,12,15]),true);
  assert.equal(policy([12,12,12,15]),true,'sidewalk setback is protected');
  assert.equal(policy([47,45,12,15]),false);
  assert.equal(policy([150,0,12,15]),true);
  assert.ok(html.includes('cityLots=safeParcels;'));
  assert.ok(html.includes('for (const lot of safeParcels)'));
});
