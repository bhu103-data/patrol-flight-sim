// Live production geometry regression for Central Park's Bow Bridge.
// Test the actual emitted beams/quads/boxes, not regex-only implementation text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/central-park.js',import.meta.url),'utf8');
const {buildCentralPark}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));
const grid={tilt:.24,offset:30,parkCenter:206,parkHalfLength:151,parkHalfWidth:43};
const waterY=12.2,waterTop=waterY+2.83;
const terrainAt=(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24);
const isColor=(a,b)=>a?.length===3&&b.every((v,i)=>Math.abs(a[i]-v)<1e-7);

function render(quality){
  const beams=[],boxes=[],quads=[];
  const valid=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
  const check=(...points)=>{for(const p of points)assert.ok(valid(p),'finite vertex '+p)};
  const stats=buildCentralPark({
    grid,quality,waterY,streetY:14.86,terrainAt,
    addQuad:(a,b,c,d,color)=>{check(a,b,c,d);quads.push({corners:[a,b,c,d],color})},
    addTri:(a,b,c)=>check(a,b,c),
    beam:(a,b,w,color)=>{check(a,b);beams.push({a,b,w,color})},
    box:(x,y,z,w,h,d,color)=>{
      assert.ok([x,y,z,w,h,d].every(Number.isFinite));
      boxes.push({x,y,z,w,h,d,color});
    },
    ribbon:(a,b)=>check(a,b)
  });
  return {stats,beams,boxes,quads};
}
const painted=[.57,.61,.60],castIron=[.25,.31,.31],granite=[.52,.52,.47];

test('arched iron structure spans all 20 bridge segments at two lateral ribs',()=>{
  for(const quality of ['low','high']){
    const {stats,beams,quads}=render(quality);
    assert.equal(stats.majorLandmarks,3);
    assert.equal(stats.bowBridgeAbutments,2);
    assert.equal(stats.bowBridgeTrussMembers,quality==='high'?144:104);
    const arches=beams.filter(b=>Math.abs(b.w-.091)<1e-7&&isColor(b.color,castIron));
    assert.equal(arches.length,40,'two continuous 20-section cast-iron ribs');
    const outline=beams.filter(b=>Math.abs(b.w-.057)<1e-7&&isColor(b.color,painted));
    assert.equal(outline.length,40,'both upper bridge girders exist');
    for(const edge of arches){
      assert.ok(edge.a[1]>=waterTop+.27&&edge.b[1]>=waterTop+.27,
        'bridge arches stay above Lake water');
      assert.ok(Math.abs(edge.a[2]-151)<1.3&&Math.abs(edge.b[2]-151)<1.3);
    }
    const soffits=quads.filter(q=>isColor(q.color,castIron)&&q.corners.every(p=>
      p[2]>=151-1.4&&p[2]<=151+1.4&&p[1]>waterTop+.5));
    assert.ok(soffits.length>=20,'all bridge deck panels have real underside faces');
  }
});

test('two stone abutments run below the waterline and embed in local ground',()=>{
  const {boxes}=render('high');
  const supports=boxes.filter(b=>Math.abs(b.w-1.54)<1e-7&&
    Math.abs(b.d-2.78)<1e-7&&isColor(b.color,granite));
  assert.equal(supports.length,2,'one physical support at each bridge end');
  const expectedXs=[-25,-3].map(u=>grid.tilt*151+grid.offset+u);
  for(const [i,box] of supports.entries()){
    assert.ok(expectedXs.some(x=>Math.abs(box.x-x)<1e-7),'correct bridge anchor');
    const base=box.y-box.h*.5,cap=box.y+box.h*.5;
    assert.ok(base<=waterTop-.54,'footing is not floating above the Lake');
    assert.ok(base<=terrainAt(box.x,box.z)-.17,'footing penetrates dry base terrain');
    assert.ok(cap>waterTop+.80,'support meets the underside of the deck');
    assert.ok(box.h>1,'nonzero masonry foundation at support '+i);
  }
});

test('high quality adds diagonal iron webbing but not new mesh groups',()=>{
  const low=render('low'),high=render('high');
  assert.equal(high.stats.bowBridgeTrussMembers-low.stats.bowBridgeTrussMembers,40);
  assert.equal(high.stats.waterBodies,6);
  assert.ok(high.beams.length>low.beams.length);
  assert.ok(high.quads.length<low.quads.length+10,'same stone deck in both LODs');
});
