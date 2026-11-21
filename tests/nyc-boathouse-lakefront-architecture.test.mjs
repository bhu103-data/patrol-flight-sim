import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const src=readFileSync(new URL('../assets/nyc/central-park-amenities.js',import.meta.url),'utf8');
const scope={};
new Script(src.replace(/^export /gm,'')+
  '\n;globalThis.build=buildCentralParkAmenities;').runInNewContext(scope);
const grid={offset:30,tilt:.24,parkCenter:206,parkHalfLength:151,parkHalfWidth:43};
const terrain=(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24);
const rgb=(c,values)=>Array.isArray(c)&&c.join(',')===values.join(',');
const capture=(quality)=>{
  const quads=[],triangles=[],beams=[],boxes=[];
  const stats=scope.build({grid,quality,waterY:12.2,terrainAt:terrain,
    addQuad:(a,b,c,d,color)=>quads.push({corners:[a,b,c,d],color}),
    addTri:(a,b,c,color)=>triangles.push({corners:[a,b,c],color}),
    beam:(a,b,w,color)=>beams.push({a,b,w,color}),
    box:(x,y,z,w,h,d,color)=>boxes.push({x,y,z,w,h,d,color}),
    ribbon:()=>{}});
  return {stats,quads,triangles,beams,boxes};
};

test('Boathouse has green gabled metal roof, high-detail standing seams',()=>{
  const high=capture('high'),low=capture('low');
  const green=[.27,.45,.37],seam=[.37,.55,.46];
  for(const scene of [high,low]){
    assert.equal(scene.triangles.filter(t=>rgb(t.color,green)).length,2,
      'two real triangular gable ends, no gray roof polygon');
    assert.equal(scene.quads.filter(t=>rgb(t.color,green)).length,2,
      'two green roof slopes');
    assert.equal(scene.stats.attractions,5);
    assert.equal(scene.stats.boats,4);
  }
  const highRibs=high.beams.filter(b=>rgb(b.color,seam)&&b.w===.023);
  const lowRibs=low.beams.filter(b=>rgb(b.color,seam)&&b.w===.023);
  assert.equal(highRibs.length,18,'nine standing seams on each slope');
  assert.equal(lowRibs.length,0,'low graphics skips micro-geometry');
  for(const b of highRibs)for(const point of [b.a,b.b]){
    assert(point.every(Number.isFinite));
    assert(point[2]>153&&point[2]<161);
  }
});

test('lake-facing stripe awning is double-color real surface and dry',()=>{
  const high=capture('high'),low=capture('low');
  const red=[.53,.26,.25],ivory=[.86,.80,.68];
  const find=(scene,c)=>scene.quads.filter(q=>rgb(q.color,c));
  assert.equal(find(high,red).length,7);
  assert.equal(find(high,ivory).length,7);
  assert.equal(find(low,red).length+find(low,ivory).length,0);
  const lakeDry=(u,z)=>{
    const dx=(u+14)/24,dz=(z-150)/16.2;
    const a=Math.atan2(dz,dx);
    return Math.hypot(dx,dz)/(1+.055*Math.sin(3*a+1.15)+.025*Math.cos(7*a-1.15));
  };
  const panels=[...find(high,red),...find(high,ivory)];
  for(const quad of panels)for(const p of quad.corners){
    const u=p[0]-grid.offset-grid.tilt*p[2];
    assert.ok(lakeDry(u,p[2])>1.05,'awning canopy may not project into Lake water');
    assert.ok(p.every(Number.isFinite));
  }
  // Also check deck corners: a dry canopy is not enough when the floor
  // projects farther toward water than its anchor point.
  const deck=high.boxes.find(b=>b.w===1.35&&b.d===5.45);
  assert.ok(deck,'thin pale terrace slab missing');
  for(const u of [deck.x-deck.w/2,deck.x+deck.w/2])
    for(const z of [deck.z-deck.d/2,deck.z+deck.d/2])
      assert.ok(lakeDry(u-grid.offset-grid.tilt*z,z)>1.05,
        'terrace slab corners must be above Lake bank');
});

test('six colonnade feet ground on terrain and new detailing stays batched',()=>{
  const high=capture('high'),low=capture('low');
  const columns=high.beams.filter(b=>b.w===.123&&rgb(b.color,[.77,.76,.69]));
  assert.equal(columns.length,6);
  assert.equal(low.beams.filter(b=>b.w===.123).length,0);
  for(const beam of columns){
    const p=beam.a;
    assert.ok(Math.abs(p[1]-(terrain(p[0],p[2])+.15))<1e-8,
      'column base must sample terrain at its actual position');
    assert.ok(beam.b[1]>p[1]+1,'column must support the awning');
  }
  const glass=high.boxes.filter(b=>b.w===.070&&b.h===1.55);
  assert.equal(glass.length,5,'five non-flat lake-facing glass bays');
  assert.ok(high.boxes.length<125&&high.beams.length<250&&high.quads.length<350,
    'must stay within park batch mesh budget and current regression limits');
  for(const p of high.quads.flatMap(q=>q.corners))
    assert(p.length===3&&p.every(Number.isFinite));
});
