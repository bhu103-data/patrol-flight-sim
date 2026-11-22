// Check shoreline contact against the actual irregular Alaska floe mesh.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../assets/alaska/alaska-fjord-detail.js',import.meta.url),'utf8');
const {buildAlaskaFjordDetail}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));
const WATER=12.2;
const hash=n=>{
  const s=Math.sin(n*127.1+78.233)*43758.5453;
  return s-Math.floor(s);
};

function firstFloe(){
  const h=hash(17),j=hash(37);
  const east=28+j*152,north=250+h*195;
  const radius=1.35+3.9*hash(3),corners=7;
  const ring=[];
  for(let k=0;k<corners;k++){
    const angle=k*2*Math.PI/corners,scale=.75+.31*hash(k*23);
    ring.push([east+Math.cos(angle)*radius*scale,
      north+Math.sin(angle)*radius*(.53+.23*h)*scale]);
  }
  return {east,north,radius,ring};
}

function scene(terrainAt){
  return buildAlaskaFjordDetail({
    addTri(){},addQuad(){},terrainAt,waterY:WATER
  });
}
const clear=scene(()=>11);
const initial=firstFloe();

test('all irregular floes still render over unoccupied open water',()=>{
  assert.equal(clear.iceFloes,86);
  assert.equal(clear.iceFloesRejectedShore,0);
});

test('diagonal headland, shoreline edge and submerged ledge cannot intersect a floe',()=>{
  const ring=initial.ring;
  const targets=[
    {name:'diagonal vertex',point:ring[1]},
    {name:'edge midpoint',point:ring[1].map((n,i)=>(n+ring[2][i])*.5)},
    {name:'interior spoke',point:ring[3].map((n,i)=>(n+[initial.east,initial.north][i])*.5)}
  ];
  const compass=[[initial.east,initial.north],
    [initial.east+initial.radius,initial.north],
    [initial.east-initial.radius,initial.north],
    [initial.east,initial.north+initial.radius],
    [initial.east,initial.north-initial.radius]];
  for(const {name,point} of targets){
    assert.ok(compass.every(p=>Math.hypot(p[0]-point[0],p[1]-point[1])>.25),
      name+' must exercise terrain missed by old cardinal probes');
    const height=(x,z)=>Math.hypot(x-point[0],z-point[1])<.13?13.3:11;
    const result=scene(height);
    assert.equal(result.iceFloes,clear.iceFloes-1,name+' excludes the floe touching shore');
    assert.equal(result.iceFloesRejectedShore,1,name+' records one rejected floe');
  }
});

test('invalid elevation in the actual perimeter is never interpreted as water',()=>{
  const point=initial.ring[2];
  const height=(x,z)=>Math.hypot(x-point[0],z-point[1])<.13?NaN:11;
  const result=scene(height);
  assert.equal(result.iceFloes,clear.iceFloes-1);
  assert.equal(result.iceFloesRejectedShore,1);
});

test('static floe waterline sides have bounded dark facets below their snow tops',()=>{
  const triangles=[],quads=[];
  const stats=buildAlaskaFjordDetail({
    terrainAt:()=>11,waterY:WATER,
    addTri(a,b,c,color){triangles.push({a,b,c,color});},
    addQuad(a,b,c,d,color){quads.push({a,b,c,d,color});}
  });
  assert.equal(stats.iceFloes,86,'all clear-water floes remain present');
  // Only the floe skirts have a bottom exactly waterY - .085.
  const skirts=quads.filter(q=>
    Math.abs(q.c[1]-(WATER+.035-.12))<1e-6 &&
    Math.abs(q.d[1]-(WATER+.035-.12))<1e-6);
  assert.ok(skirts.length>600,'every floe retains its visible waterline wall');
  const levels=new Set(skirts.map(q=>q.color[1].toFixed(3)));
  assert.ok(levels.size>25,'shore-facing ice avoids a repeated flat-color wall');
  assert.ok(skirts.every(q=>q.color.every(v=>v>=0&&v<=.7)),
    'facets are shaded, never overexposed ice-white');
  assert.ok(skirts.every(q=>q.a.every(Number.isFinite)&&
    q.b.every(Number.isFinite)&&q.c.every(Number.isFinite)&&
    q.d.every(Number.isFinite)),'facets cannot introduce invalid vertices');
});
