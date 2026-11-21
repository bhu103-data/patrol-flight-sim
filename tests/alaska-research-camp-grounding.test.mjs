// Alaska research camp regression using the production site search, cabin
// mesh authoring and bundled surveyed 3DEP terrain (not a screenshot mock).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const dem=JSON.parse(readFileSync(
  new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const heights=Buffer.from(dem.heightsBase64,'base64');
const scale=Math.min(.04,(75*.9-12.2)/dem.maxElevationMeters);
function terrain(x,z){
  const u=Math.max(0,Math.min(255,(z/1920+.5)*256-.5));
  const v=Math.max(0,Math.min(255,(1-(x/1920+.5))*256-.5));
  const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j;
  const value=(col,row)=>heights.readUInt16LE((row*256+col)*2);
  const upper=value(i,j)*(1-a)+value(Math.min(i+1,255),j)*a;
  const lower=value(i,Math.min(j+1,255))*(1-a)+
    value(Math.min(i+1,255),Math.min(j+1,255))*a;
  return 12.2+scale*(upper*(1-b)+lower*b);
}
const findStart=game.indexOf('  function findScenerySite(');
const findEnd=game.indexOf('  function createMapScenery(',findStart);
const padStart=game.indexOf('    function alaskaShedPad(');
const shedStart=game.indexOf('    function shed(',padStart);
const shedEnd=game.indexOf('\n\n    if(selectedMap.alaska) {',shedStart);
assert.ok(findStart>=0&&findEnd>findStart&&padStart>=0&&
  shedStart>padStart&&shedEnd>shedStart,'production scene functions found');

function siteFinder(sample){
  return new Function('sampleTerrainHeight','selectedMap',
    'NYC_FLIGHT_RADIUS','FLIGHT_RADIUS','WATER_H','cityLotAt',
    game.slice(findStart,findEnd)+';return findScenerySite;')(
    sample,{alaska:true,city:false},735,860,12.2,()=>null);
}
function scenario(sample,map={alaska:true}){
  const boxes=[],colliders=[];
  const box=(x,y,z,w,h,d,color)=>boxes.push({x,y,z,w,h,d,color});
  const solid={addQuad(){},addTri(){}};
  const solidAt=(name,x,z,y,top,halfX,halfZ)=>
    colliders.push({name,x,z,y,top,halfX,halfZ});
  const f=new Function('sampleTerrainHeight','WATER_H','selectedMap',
    'box','solid','solidAt','iron','timber',
    game.slice(padStart,shedEnd)+';return {alaskaShedPad,shed};')(
    sample,12.2,map,box,solid,solidAt,[.30,.35,.38],[.41,.32,.24]);
  return {...f,boxes,colliders};
}

test('the 3DEP glacier has an actual buildable research camp and annex',()=>{
  const finder=siteFinder(terrain),{alaskaShedPad}=scenario(terrain);
  const camp=finder(150,314,{footprint:8,range:180,
    validate:(x,z)=>Boolean(alaskaShedPad(x,z,10,13))});
  assert.ok(camp,'dry research camp must exist near the original glacier');
  const primary=alaskaShedPad(camp.x,camp.z,10,13);
  assert.ok(primary&&primary.low>13.2&&
    primary.top-primary.low<2.28,'full main lodge remains dry and buildable');
  const annex=finder(camp.x+17,camp.z+7,{
    footprint:5,range:27,
    validate:(x,z)=>Boolean(alaskaShedPad(x,z,8,9)),
    avoid:(x,z)=>Math.abs(x-camp.x)<11&&Math.abs(z-camp.z)<12
  });
  assert.ok(annex,'dry annex must exist near its parent lodge');
  assert.ok(alaskaShedPad(annex.x,annex.z,8,9),'annex has a safe surveyed pad');
  assert.ok(Math.abs(camp.x-annex.x)>=9 ||
    Math.abs(camp.z-annex.z)>=11,'the two building footprints never collide');
});

test('a narrow flooded channel cancels the entire research hut, not just one stilt',()=>{
  const inlet=(x,z)=>Math.hypot(x-1.8,z)<.15?12.2:18;
  const {alaskaShedPad,shed,boxes,colliders}=scenario(inlet);
  assert.equal(alaskaShedPad(0,0,10,13),null,
    'narrow channel lies between old corner/center probes');
  assert.equal(shed({x:0,y:18,z:0},10,13,[.6,.4,.3],1.5,'research cabin'),false);
  assert.equal(boxes.length,0,'no submerged render geometry');
  assert.equal(colliders.length,0,'no invisible hitbox in water');
});

test('sloping dry research cabin has a high foundation and four anchored supports',()=>{
  const slope=(x,z)=>15+x*.105+z*.025;
  const {alaskaShedPad,shed,boxes,colliders}=scenario(slope);
  const pad=alaskaShedPad(0,0,10,13);
  assert.ok(pad);
  assert.equal(shed({x:0,y:15,z:0},10,13,[.6,.4,.3],1.5,'research cabin'),true);
  const walls=boxes.find(b=>b.w===10&&b.d===13&&b.h===3.7);
  assert.ok(walls,'main cabin body rendered');
  assert.ok(walls.y-walls.h*.5>=pad.top-.051,
    'cabin floor is above the highest foundation terrain');
  const supports=boxes.filter(b=>b.w===.27&&b.d===.27);
  assert.equal(supports.length,4);
  for(const post of supports){
    assert.ok(Math.abs(post.y-post.h*.5-slope(post.x,post.z))<1e-6,
      'stilt base touches the sampled hillside');
    assert.ok(post.h>=.25&&Number.isFinite(post.h));
  }
  assert.equal(colliders.length,1);
  assert.ok(colliders[0].y>=pad.top-.001,'collision agrees with the drawn floor');
});

test('old non-Alaska shed ground height remains untouched',()=>{
  const {shed,boxes,colliders}=scenario(()=>12.2,{alaska:false});
  assert.equal(shed({x:1,y:27,z:3},10,13,[.5,.4,.3],1.5,'coast cabin'),true);
  assert.equal(boxes.filter(b=>b.w===.27&&b.d===.27).length,0);
  assert.ok(boxes.some(b=>b.w===10&&b.h===3.7&&b.y===28.8));
  assert.equal(colliders[0].y,27);
});
