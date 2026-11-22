// Scope: the Vegas Venetian campanile, not generic hotels or other maps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('    // PATROL_VEGAS_VENETIAN_CAMPANILE_BELFRY_V1');
const end=html.indexOf('    for(const side of [-1,1]){\n      const clock=',start);
assert.ok(start>0&&end>start,'campanile geometry must remain separately inspectable');
const body=html.slice(start,end);
const ground=12.2,boxes=[],quads=[],colliders=[];
const build=new Function('box','solidAt','addQuad','ground','glass','cream',body);
build((...a)=>boxes.push(a),(...a)=>colliders.push(a),
  (...a)=>quads.push(a),ground,[.23,.32,.40],[.89,.81,.67]);

test('Venetian belfry geometry has actual open arch rings on all four facades',()=>{
  assert.equal(quads.length,96,'4 faces * 3 arches * 8 voussoir segments');
  for(const q of quads){
    assert.equal(q.length,5);
    assert.ok(q.slice(0,4).every(v=>v.length===3&&v.every(Number.isFinite)));
  }
  const left=quads.filter(q=>q.slice(0,4).every(v=>v[0]<-12));
  const right=quads.filter(q=>q.slice(0,4).every(v=>v[0]>-10));
  const north=quads.filter(q=>q.slice(0,4).every(v=>v[2]>10));
  const south=quads.filter(q=>q.slice(0,4).every(v=>v[2]<6));
  for(const arr of [left,right,north,south])assert.ok(arr.length>=20);
  assert.ok(boxes.some(b=>b[3]===4.42&&b[4]===.34),'separate roof cornice');
  assert.ok(!boxes.some(b=>Math.abs(b[0]+11)<.25&&
    Math.abs(b[2]-8)<.25&&b[4]>1.3&&b[1]>ground+14),
    'no opaque box should fill the upper bell gallery');
});
test('tower collision, site, roof apex and map selector are unchanged',()=>{
  assert.deepEqual(colliders,[['Venetian Campanile',-11,8,ground,ground+16.4,1.925,1.925]]);
  assert.match(html,/solidAt\('Venetian Campanile spire',-11,8,ground\+16\.4,ground\+20\.75,0\.6,0\.6\)/);
  assert.match(html,/\{site:\{name:'Venetian Campanile Close-up'\},x:-11,z:8,height:12/);
  assert.ok(boxes.length<115,'tiny bounded mesh patch, no city-wide boxes');
  assert.match(html,/function buildVegasStrip\(geometry\)/);
  assert.match(html,/function buildVegasHotels\(/);
});
