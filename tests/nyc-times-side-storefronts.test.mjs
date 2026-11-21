// Execute the production city building mesh generator with real Times Square
// bounds. This regression covers the previously blank X-facing side walls,
// while keeping the official FID footprint, non-NYC and distant LOD paths.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=page.indexOf('function buildCityBuildings(');
assert.ok(start>=0,'production anonymous-building generator exists');
const open=page.indexOf('{',start);
let depth=0,end=-1;
for(let i=open;i<page.length;i++){
  if(page[i]==='{')depth++;
  else if(page[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>start,'building generator closes');
const body=page.slice(start,end);
assert.match(body,/PATROL_NYC_TIMES_SHORT_SIDE_STOREFRONTS_V1/);

function generate({x=20,z=10,w=9,d=11,h=6,detail=2,official=false,demolished=false}={}){
  const boxes=[],quads=[];
  const build=new Function('createTriangleMesh','addModelBox','addRideBeam',
    'nycDetailBand','MANHATTAN_GRID','WATER_H','tintSeed',
    'addDowntownFacadeRelief','buildOfficialFootprintMesh',
    'return ('+body+')')(
      ()=>({addTri(){},addQuad(...args){quads.push(args)},
        upload(){return {boxes,quads};}}),
      (_quad,...args)=>boxes.push(args),()=>{},
      ()=>detail,{tilt:.24,offset:30,blockWidth:24,blockLength:33},
      12.2,()=>.45,()=>0,
      (_tri,addQuad)=>addQuad([0,0,0],[0,0,1],[1,0,1],[1,0,0],[.3,.3,.3])
    );
  const lot=[x,z,w,d,h,.45,demolished];
  if(official)lot[7]=[[x-w/2,z-d/2],[x+w/2,z-d/2],
    [x+w/2,z+d/2],[x-w/2,z+d/2]];
  build([lot]);
  const sideGlass=boxes.filter(box=>box.at(-1)===5 &&
    Math.abs(box[3]-.06)<.001 && Math.abs(box[4]-1.58)<.001);
  return {boxes,quads,sideGlass};
}

test('short Times Square streetcorner has framed glass facing both side streets',()=>{
  const shot=generate();
  assert.equal(shot.sideGlass.length,6,'three bays on each east/west flank');
  assert.equal(shot.sideGlass.filter(b=>b[0]<20).length,3);
  assert.equal(shot.sideGlass.filter(b=>b[0]>20).length,3);
  const xCentres=shot.sideGlass.map(b=>b[0]);
  assert.ok(xCentres.every(v=>Math.abs(v-20)>4.5 && Math.abs(v-20)<4.7));
  const frontGlass=shot.boxes.filter(b=>b.at(-1)===5 &&
    Math.abs(b[5]-.065)<.001 && Math.abs(b[4]-1.59)<.01);
  assert.ok(frontGlass.length>=2,'existing north/south shop windows remain');
  assert.ok(shot.boxes.length>40 && shot.boxes.length<90,
    'all new frames stay batched within a bounded geometry budget');
});

test('side glazing remains entirely below roof and inside protected sidewalk margin',()=>{
  const {boxes,sideGlass}=generate();
  const x=20,z=10,w=9,d=11,h=6,y=14.58;
  for(const box of boxes){
    const [bx,by,bz,bw,bh,bd]=box;
    assert.ok([bx,by,bz,bw,bh,bd].every(Number.isFinite));
    assert.ok(bx-bw/2>=x-w/2-.60 && bx+bw/2<=x+w/2+.60,
      'no protruding window blocks the street');
    assert.ok(bz-bd/2>=z-d/2-.60 && bz+bd/2<=z+d/2+.60,
      'side glass remains within reserved sidewalk clearance');
    assert.ok(by-bh/2>=y-.01 && by+bh/2<=y+h+.20,
      'all short storefront decoration stays within the roof envelope');
  }
  assert.ok(sideGlass.every(b=>b[1]-b[4]/2>y+.62));
});

test('only Times Square low-rise, LOD2/3 anonymous parcels gain side storefronts',()=>{
  for(const args of [
    {x:140,z:10},{x:20,z:110},{x:20,z:10,detail:1},
    {x:20,z:10,h:4.2},{x:20,z:10,h:7.6},
    {x:20,z:10,official:true},{x:20,z:10,demolished:true}
  ]){
    const scene=generate(args);
    assert.equal(scene.sideGlass.length,0,
      'out-of-scope/destroyed/official parcel must stay untouched: '+JSON.stringify(args));
  }
  assert.equal(generate({h:7.5}).sideGlass.length,6);
});

test('no new draw or buffer per individual shop bay',()=>{
  assert.doesNotMatch(body.slice(
    body.indexOf('PATROL_NYC_TIMES_SHORT_SIDE_STOREFRONTS_V1'),
    body.indexOf('// Side glazing follows the real setback silhouette')),
    /createTriangleMesh|\.upload\(|new THREE\./,
    'new side windows reuse existing city draw batch');
});
