// Test production navigation height against real Brooklyn rooftop tank mesh.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('  function sampleGroundHeight(');
const end=html.indexOf('  function navigationSurface(',begin);
assert.ok(begin>=0&&end>begin,'height navigation function is present');
const code=html.slice(begin,end);
const baseHeight=12.2+2.38;
const makeHeight=new Function(
  'sampleTerrainHeight','cityLotAt','WATER_H','selectedMap','nycDetailBand',
  'MANHATTAN_GRID',code+';return sampleGroundHeight;'
);
const grid={tilt:.24,offset:30,blockWidth:24,blockLength:33};
const lot=[244,-336,9,19,15,.41,false]; // near Brooklyn Bridge, archType 12
const inLot=(l,x,z)=>Math.abs(x-l[0])<l[2]*.5&&Math.abs(z-l[1])<l[3]*.5?l:null;
const height=(l,city=true,detail=3)=>makeHeight(
  ()=>12.2,(x,z)=>inLot(l,x,z),12.2,{city},()=>detail,grid);
const tank=[lot[0]+lot[2]*.16,lot[1]+lot[3]*.12];

test('rendered wooden tank is a solid cylinder only at its actual roof location',()=>{
  const h=height(lot);
  assert.equal(h(...tank),baseHeight+lot[4]+2.77,
    'tank cap is 2.77 world units above building roof');
  assert.equal(h(tank[0]+.50,tank[1]+.20),baseHeight+lot[4]+2.77);
  assert.equal(h(tank[0]+1.6,tank[1]),baseHeight+lot[4],
    'nearby ordinary roof is not an invisible raised collision platform');
  assert.equal(h(lot[0]-lot[2]*.25,lot[1]-lot[3]*.2),baseHeight+lot[4]);
  assert.equal(h(100,100),12.2,'free water/ground remains unchanged');
});
test('no ghost tank on destroyed, official survey or different map buildings',()=>{
  const destroyed=[...lot];destroyed[6]=true;
  assert.equal(height(destroyed)(...tank),baseHeight+1.75);
  const official=[...lot,[[240,-340],[248,-340],[248,-332],[240,-332]]];
  assert.equal(height(official)(...tank),baseHeight+lot[4]);
  assert.equal(height(lot,false)(...tank),baseHeight+lot[4]);
  assert.equal(height(lot,true,2)(...tank),baseHeight+lot[4]);
  const outside=[500,-336,9,19,15,.41,false];
  assert.equal(height(outside)(500+9*.16,-336+19*.12),baseHeight+15);
});
test('collision height uses the same barrel offsets, radius and cap as mesh',()=>{
  const building=html.slice(html.indexOf('  function buildCityBuildings('),
    html.indexOf('  function tintSeed('));
  assert.match(building,/const tx=x\+w\*\.16,tz=z\+d\*\.12,roofY=y\+h/);
  assert.match(building,/const n=16,r=\.76\+\(archType%3\)\*\.055/);
  assert.match(building,/const lower=roofY\+1\.13,upper=lower\+1\.43/);
  assert.match(building,/upper\+\.21/);
  assert.match(code,/PATROL_DUMBO_WATER_TANK_COLLISION_V1/);
});
