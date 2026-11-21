// node --test tests/nyc-bridgehead-generator.test.mjs
// Run the actual terrain generator with the repository's full OTI dataset.
// Unlike source-string assertions this verifies the city parcel output.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const snapshot=JSON.parse(await readFile(
  new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
function expression(name){
  const i=source.indexOf('const '+name);
  assert.ok(i>=0,'missing '+name);
  const start=source.indexOf('=',i)+1,end=source.indexOf(';',start);
  return new Function('return ('+source.slice(start,end)+')')();
}
function functionSource(name){
  const i=source.indexOf('function '+name+'(');
  assert.ok(i>=0,'missing '+name);
  let depth=0,after=-1;
  for(let j=source.indexOf('{',i);j<source.length;j++){
    if(source[j]==='{')depth++;
    else if(source[j]==='}'&&--depth===0){after=j+1;break}
  }
  assert.ok(after>i,'unclosed '+name);
  return source.slice(i,after);
}
const roads=expression('CITY_STREETS');
const expressway=expression('CITY_EXPRESSWAY');
const city={
  tilt:.24,offset:30,blockWidth:24,blockLength:33,
  parkHalfWidth:43,parkCenter:206,parkHalfLength:151,
  parkWaters:[],landmarks:[],officialFootprints:snapshot.footprints,
  streets:[...roads,expressway.points,expressway.ramp],
  focusZones:expression('NYC_FOCUS_ZONES'),
  railway:expression('BROOKLYN_RAIL'),
  runway:expression('HARBOR_RUNWAY'),
  timesSquareBounds:expression('TIMES_SQUARE').bounds
};
const genName='function* generateTerrain(options)';
const begin=source.indexOf(genName);
assert.ok(begin>=0,'terrain generator exists');
let depth=0,end=-1;
for(let i=source.indexOf('{',begin);i<source.length;i++){
  if(source[i]==='{')depth++;
  else if(source[i]==='}'&&--depth===0){end=i+1;break}
}
assert.ok(end>begin,'terrain generator closes');
const generateTerrain=new Function('return ('+source.slice(begin,end)+')')();
const terrain=[...generateTerrain({
  size:64,span:1920,landmarks:[],scale:54,water:12.2,city
})].find(step=>step?.type==='done');
assert.ok(terrain,'generator finished without errors');
const brooklyn=terrain.parcels.filter(lot=>
  lot[0]>210&&lot[0]<435&&lot[1]>-415&&lot[1]<-195);
const fills=brooklyn.filter(lot=>
  lot[2]>=8.5&&lot[2]<=10.5&&lot[3]>=14&&lot[3]<=17&&
  lot[4]>=9.6&&lot[4]<=15.5);
test('Brooklyn Bridge district contains bounded additional building footprints',()=>{
  assert.equal(snapshot.footprints.length,100);
  assert.ok(brooklyn.length>=25,'bridgehead should contain substantial buildings');
  assert.ok(fills.length>=8,'small vacant blocks should be filled');
  assert.equal(terrain.height.length,64*64);
});
test('generated bridgehead buildings do not intrude into authored road corridors',()=>{
  const crosses=new Function('city','return ('+
    functionSource('generatedCityRoadOverlap')+')')(city);
  for(const lot of brooklyn)
    assert.equal(crosses(lot,5.85),false,
      'road overlap at '+lot[0].toFixed(1)+', '+lot[1].toFixed(1));
});
test('gapfill buildings do not overlap neighboring parcels',()=>{
  for(const lot of fills)for(const neighbor of brooklyn){
    if(lot===neighbor)continue;
    const overlapX=Math.abs(lot[0]-neighbor[0])<
      (lot[2]+neighbor[2])*.5+1.25;
    const overlapZ=Math.abs(lot[1]-neighbor[1])<
      (lot[3]+neighbor[3])*.5+1.25;
    assert.equal(overlapX&&overlapZ,false,
      'building overlap near '+lot[0].toFixed(1)+', '+lot[1].toFixed(1));
  }
});
test('gapfill buildings keep away from runway and railway guard bands',()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  for(const lot of fills){
    const [x,z,w,d]=lot,track=city.railway,runway=city.runway;
    const dist=Math.hypot(x-clamp(x,track.west,track.east),z-track.z);
    assert.ok(Math.abs(dist-track.radius)>=4+Math.hypot(w,d)*.43,
      'rail corridor clear');
    assert.equal(Math.abs(x-runway.x)<runway.halfLength+w/2+5 &&
      Math.abs(z-runway.z)<runway.halfWidth+d/2+5,false,
    'runway clear');
  }
});
