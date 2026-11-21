// node --test tests/nyc-bridgehead-infill.test.mjs
// Exercise the actual city-height function on bounded Brooklyn bridgehead lots.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('function cityHeight(east, north, includeBuildings = false)');
assert.ok(start>0,'city terrain function exists');
const brace=source.indexOf('{',start);
let end=-1,level=0;
for(let i=brace;i<source.length;i++){
  if(source[i]==='{')level++;
  else if(source[i]==='}'&&--level===0){end=i+1;break;}
}
assert.ok(end>brace,'city function closes');
const functionSource=source.slice(start,end);
const hash=(ix,iy,seed)=>{
  let n=(ix*374761393+iy*668265263+seed*1442695041)|0;
  n=(n^(n>>>13))*1274126177;
  return ((n^(n>>>16))>>>0)/4294967295;
};
const city={
  tilt:.24,offset:30,blockWidth:24,blockLength:33,
  parkHalfWidth:43,parkCenter:206,parkHalfLength:151,
  parkWaters:[],landmarks:[]
};
const height=vm.runInNewContext('('+functionSource+')',{
  city,hash,water:12.2,scale:54,
  clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v))
});
test('an eligible DUMBO lot with a previously suppressed hash now gets buildings',()=>{
  const x=389.6,z=-346.4;
  const ground=height(x,z);
  const roof=height(x,z,true);
  assert.ok((roof-ground)*54>9.2,
    'Bridgehead lot should have enough height for detailed midrise facade');
});
test('infill only changes the Brooklyn Bridge district and retains density threshold elsewhere',()=>{
  assert.match(functionSource,/const brooklynBridgeInfill=outerBoroughs/);
  assert.match(functionSource,/north>-415 && north<-195 && east>210 && east<435/);
  assert.match(functionSource,/brooklynBridgeInfill\?0\.035:0\.14/);
  assert.match(functionSource,/9\.4 \+ signature \* 7\.1 \+ hash\(ix\*3,iz\*7,2921\)\*5\.5/);
});
test('road and bridge clearance still runs before a parcel is accepted',()=>{
  assert.match(source,/const inStreet=generatedCityRoadOverlap\(\[x,z,width,length\],5\.85\)/);
  assert.match(source,/if\(inStreet \|\| \(Math\.abs\(x-runway\.x\)/);
});
