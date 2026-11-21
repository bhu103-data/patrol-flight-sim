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
test('an obstructed Manhattan avenue keeps clear approaches without painting through a building',()=>{
  // Building is centered on i=0 Avenue between j=0 and j=1.
  const obstruction={x:33.84,z:16,w:10,d:10};
  const isClear=(x,z,r=0)=>Math.abs(x-obstruction.x)>=obstruction.w*.5+r||
    Math.abs(z-obstruction.z)>=obstruction.d*.5+r;
  const {stats,slabs}=city(isClear);
  const mainAsphalt=slabs.filter(r=>r.width===6.35&&
    Math.abs(r.a[0]-(30+.24*r.a[2]))<.02&&
    Math.abs(r.b[0]-(30+.24*r.b[2]))<.02&&
    r.a[2]>=-1e-8&&r.b[2]<=33+1e-8);
  assert.ok(stats.preservedRoadSections>=2,'clear road approaches should be retained');
  assert.ok(mainAsphalt.some(r=>r.a[2]>=0&&r.b[2]<7),
    'keep the avenue approaching the building from the south');
  assert.ok(mainAsphalt.some(r=>r.a[2]>25&&r.b[2]<=33),
    'keep the avenue leaving the building to the north');
  for(const r of mainAsphalt){
    const middleZ=(r.a[2]+r.b[2])/2;
    assert.equal(isClear(30+.24*middleZ,middleZ,r.width*.5),true,
      'asphalt ribbon must not penetrate the occupied parcel');
  }
});
test('thin walls between grid samples cannot cut through avenue asphalt',()=>{
  const wall={x:33.5,z:12.3,w:.16,d:.16};
  const isClear=(x,z,r=0)=>Math.abs(x-wall.x)>=wall.w*.5+r||
    Math.abs(z-wall.z)>=wall.d*.5+r;
  const clean=city(()=>true),occupied=city(isClear);
  const includesAvenue=slabs=>slabs.some(row=>
    Math.abs(row.a[0]-30)<1e-7&&Math.abs(row.a[2])<1e-7&&
    Math.abs(row.b[0]-37.92)<1e-7&&Math.abs(row.b[2]-33)<1e-7&&
    Math.abs(row.width-6.35)<1e-5);
  assert.equal(includesAvenue(clean.slabs),true);
  assert.equal(includesAvenue(occupied.slabs),false,
    'small building wall must remove the entire obstructed asphalt ribbon');
  assert.ok(occupied.stats.avenues>500,'retain Manhattan road density');
});
test('main NYC lot filter protects street routes in visual and collision data',async()=>{
  const html=await fromFile('../index.html');
  const start=html.indexOf('function nycParcelCrossesRoad(');
  const end=html.indexOf('function setupCityLots(',start);
  assert.ok(start>0&&end>start);
  const functionBody=html.slice(start,end);
  const roads=[[[0,-90],[0,90]],[[100,0],[240,0]]];
  const expressway={points:[[350,-440,0],[350,-350,7.7]],ramp:[[360,-350,7.7],[390,-350,0]]};
  const policy=new Function('CITY_STREETS','CITY_EXPRESSWAY',
    functionBody+';return nycParcelCrossesRoad;')(roads,expressway);
  assert.equal(policy([0,12,12,15]),true);
  assert.equal(policy([11,12,12,15]),true,'sidewalk setback is protected');
  assert.equal(policy([47,45,12,15]),false);
  assert.equal(policy([150,0,12,15]),true);
  assert.equal(policy([350,-420,12,15]),true,'expressway clears towers');
  assert.equal(policy([383,-350,12,15]),true,'ramp clears obstructing buildings');
  assert.ok(html.includes('cityLots=safeParcels;'));
  assert.ok(html.includes('for (const lot of safeParcels)'));
});
