// Real production geometry: enforce food-cart platform and parasol clearance
// from emitted road strips. No browser mocks, external assets, or time-based RNG.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
const {buildNycStreetNetwork}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));

function scene({terrainAt=()=>100,isClear=()=>true,existingStreets=[]}={}){
  const roads=[],vendors=[];
  const stats=buildNycStreetNetwork({
    addQuad(){},addTri(){},beam(){},lettering(){},pavementText(){},
    box(x,y,z,w,h,d){
      if(w===3.45&&d===2.70&&h===.09)vendors.push({x,z});
    },
    ribbon(a,b,width){
      // Only the actual emitted asphalt, not offset sidewalks or lane paint.
      if(width===6.35||width===5.65)roads.push({a,b,width});
    },
    terrainAt,detailBand:()=>3,
    grid:{blockWidth:24,blockLength:33,tilt:.24,offset:30,
      parkHalfWidth:43,parkHalfLength:150,parkCenter:10000},
    streetY:20,waterY:0,timesBounds:[900,1000,900,1000],
    existingStreets,isClear
  });
  return {roads,vendors,stats};
}
function distanceFromRoad(x,z,road){
  const dx=road.b[0]-road.a[0],dz=road.b[2]-road.a[2];
  const t=Math.max(0,Math.min(1,
    ((x-road.a[0])*dx+(z-road.a[2])*dz)/(dx*dx+dz*dz||1)));
  return Math.hypot(x-road.a[0]-t*dx,z-road.a[2]-t*dz);
}
test('all five vendor canopies clear the actual street network',()=>{
  const {roads,vendors,stats}=scene();
  assert.ok(roads.length>1000,'production Manhattan and Brooklyn roads must be present');
  assert.equal(stats.hotDogCarts,5,'retain street life without deleting carts');
  assert.equal(vendors.length,stats.hotDogCarts);
  for(const {x,z} of vendors)for(const road of roads){
    assert.ok(distanceFromRoad(x,z,road)>=road.width*.5+2.35-1e-8,
      'vendor canopy must not intersect asphalt at '+x+','+z);
  }
  assert.ok(vendors.some(({x,z})=>x===-65&&z===-345),
    'first downtown vendor is relocated from the occupied original road');
});
test('blocked street corner relocates a vendor without colliding with a parcel',()=>{
  const obstacle={x:-65,z:-345,w:5,d:5};
  const isClear=(x,z,r=0)=>
    Math.abs(x-obstacle.x)>=obstacle.w*.5+r||
    Math.abs(z-obstacle.z)>=obstacle.d*.5+r;
  const {roads,vendors,stats}=scene({isClear});
  assert.equal(vendors.length,stats.hotDogCarts);
  assert.equal(vendors.some(({x,z})=>x===obstacle.x&&z===obstacle.z),false);
  for(const {x,z}of vendors){
    assert.equal(isClear(x,z,2.35),true);
    for(const road of roads)
      assert.ok(distanceFromRoad(x,z,road)>=road.width*.5+2.35-1e-8);
  }
});
test('wet outer canopy point rejects a Times Square food stand',()=>{
  const water=(x,z)=>x>-2.5&&x<-2.3&&z>9.0&&z<9.2;
  const terrainAt=(x,z)=>water(x,z)?0:100;
  const {vendors,stats}=scene({terrainAt});
  assert.equal(vendors.length,stats.hotDogCarts);
  assert.equal(vendors.some(({x,z})=>x===-4.4&&z===9.1),false,
    'platform is dry at center but its east parasol edge reaches water');
  for(const {x,z}of vendors){
    for(const [dx,dz] of [[0,0],[-2,0],[2,0],[0,-2],[0,2],
      [-1.4,-1.4],[-1.4,1.4],[1.4,-1.4],[1.4,1.4]]){
      assert.ok(terrainAt(x+dx,z+dz)>1.58,'no vendor foot reaches water');
    }
  }
});
