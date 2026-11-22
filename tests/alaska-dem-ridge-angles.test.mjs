import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const qa=readFileSync(new URL('../tools/alaska/compare_dem_normals.mjs',import.meta.url),'utf8');
const shipped=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const dem=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const bytes=Buffer.from(dem.heightsBase64,'base64');
assert.equal(bytes.length,dem.width*dem.height*2);

function sourceElevation(x,z){
  // Exact source-grid transform in existing Alaska worker; no new world scale.
  const c=(n,max)=>Math.max(0,Math.min(n,max));
  const px=c((z/1920+.5)*dem.width-.5,dem.width-1);
  const pz=c((1-(x/1920+.5))*dem.height-.5,dem.height-1);
  const ix=Math.floor(px),iz=Math.floor(pz);
  const tx=px-ix,tz=pz-iz,ix1=Math.min(ix+1,dem.width-1),iz1=Math.min(iz+1,dem.height-1);
  const at=(a,b)=>bytes.readUInt16LE((b*dem.width+a)*2);
  return (at(ix,iz)*(1-tx)+at(ix1,iz)*tx)*(1-tz)
    +(at(ix,iz1)*(1-tx)+at(ix1,iz1)*tx)*tz;
}

test('fjord west/east views target measured high terrain instead of water/harbor occluders',()=>{
  const westSea=sourceElevation(30,-240),westSlope=sourceElevation(-350,-240);
  const eastSea=sourceElevation(70,0),eastSlope=sourceElevation(350,0);
  assert.ok(westSea<250&&eastSea<250,'both viewers begin close to fjord floor');
  assert.ok(westSlope-westSea>600,'west camera faces an actual DEM high-slope');
  assert.ok(eastSlope-eastSea>500,'east camera faces an actual DEM high-slope');
  assert.ok(qa.includes('west:{x:30,z:-240,yaw:-Math.PI/2,pitch:0.075,minAlt:30}'));
  assert.ok(qa.includes('east:{x:70,z:0,yaw:Math.PI/2,pitch:0.060,minAlt:35}'));
  assert.ok(qa.includes("['west-ridge','west','12']"));
  assert.ok(qa.includes("['east-ridge','east','12']"));
  assert.ok(shipped.includes('<option value="12">Noon</option>'));
  assert.ok(qa.includes("Invalid QA environment option"));
});

test('fixed DEM QA still uses source-exact baseline and never changes the shipped game',()=>{
  assert.ok(qa.includes("const sha='38a9be192ca14cf5d47f6991d050b4093357f044'"));
  assert.ok(qa.includes('window.__patrolDemFrozenTime=42'));
  assert.ok(!shipped.includes('PatrolAlaskaNormalQA'));
  assert.ok(!shipped.includes('__patrolDemFrozenTime'));
});
