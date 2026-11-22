// Scope: the Vegas Venetian campanile, not generic hotels or other maps.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('    // PATROL_VEGAS_VENETIAN_CAMPANILE_BELFRY_V1');
const clockAt=html.indexOf('      const clock=',start);
const end=html.lastIndexOf('    for(const side of [-1,1]){',clockAt);
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
  assert.match(html,/\{site:\{name:'Venetian Campanile Close-up'\},x:-11,z:8,height:15\.7/);
  assert.ok(boxes.length<115,'tiny bounded mesh patch, no city-wide boxes');
  assert.match(html,/function buildVegasStrip\(geometry\)/);
  assert.match(html,/function buildVegasHotels\(/);
});

test('actual clock mesh has twelve readable ticks and two hands on both existing faces',()=>{
  const begin=html.lastIndexOf('    for(const side of [-1,1]){',
    html.indexOf('      const clock=',start));
  const end=html.indexOf('    // PATROL_VEGAS_CAMPANILE_BELL_V1',begin);
  assert.ok(begin>start&&end>begin,'target only the two campanile dials');
  const dialQuads=[],dialBoxes=[];
  new Function('box','addQuad','ground','cream','iron',html.slice(begin,end))(
    (...args)=>dialBoxes.push(args),(...args)=>dialQuads.push(args),
    ground,[.89,.81,.67],[.24,.23,.21]);
  assert.equal(dialQuads.length,68,'2 faces × (20 ivory sectors +12 ticks +2 hands)');
  assert.equal(dialBoxes.length,2,'each dial retains one raised central pivot');
  const ink=dialQuads.filter(q=>q[4][0]===.20);
  assert.equal(ink.length,28,'24 cardinal/short ticks plus four hands');
  for(const q of dialQuads){
    assert.ok(q.slice(0,4).every(v=>v.length===3&&v.every(Number.isFinite)),
      'clock ticks are actual finite 3D triangles, not overlaid HTML text');
  }
  assert.ok(dialQuads.filter(q=>q[0][0]<-13).length>=14);
  assert.ok(dialQuads.filter(q=>q[0][0]>-9).length>=14);
});
test('lightweight suspended bell stays inside the already-conservative tower collider',()=>{
  const begin=html.indexOf('    // PATROL_VEGAS_CAMPANILE_BELL_V1',start);
  const end=html.indexOf('    cylinder(-11,8,[[ground+16.4',begin);
  assert.ok(begin>start&&end>begin);
  const bells=[],supports=[];
  new Function('box','cylinder','ground','iron',html.slice(begin,end))(
    (...args)=>supports.push(args),(...args)=>bells.push(args),
    ground,[.24,.23,.21]);
  assert.equal(bells.length,2,'single main bell and low-poly clapper');
  assert.equal(supports.length,1,'one suspended horizontal bell bar');
  for(const [x,z,levels,color,sides] of bells){
    assert.deepEqual([x,z],[-11,8]);
    assert.ok([8,10].includes(sides),'mobile-friendly radial tessellation');
    assert.ok(levels.every(([y,rad])=>y>=ground+14.5&&
      y<=ground+15.5&&rad<=.52&&rad>0),
      'no bell facet may pierce the exterior facade or roof');
    assert.equal(color.length,3);
  }
  assert.ok(supports[0][3]<1.8&&supports[0][4]<.2,
    'slender support must leave the arch openings visible');
});
