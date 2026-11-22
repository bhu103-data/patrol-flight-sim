// Derived from the exact 15.9k-triangle source GLB staged in #103, never
// approximate the height bands from screenshot pixels or old procedural boxes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const glb=readFileSync(new URL('../assets/nyc/scenario/liberty.glb',import.meta.url));
const script=readFileSync(new URL('../scripts/nyc-liberty-static-webgl.mjs',import.meta.url),'utf8');
const sha256=createHash('sha256').update(glb).digest('hex');
const expectedSha='34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225';
const definition=src.match(/const libertyScenarioBandRadii = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert.ok(definition,'production collider height-profile data must exist');
const radii=Array.from(definition[1].matchAll(/\d+\.\d+/g),m=>Number(m[0]));
const start=src.indexOf('  const libertyScenarioBandRadii = Object.freeze([');
const end=src.indexOf('  function checkFlightCollision(previous, next) {',start);
assert.ok(start>0&&end>start&&end-start<2500,'helper exactly precedes real collider');
const hit=new Function(src.slice(start,end)+'\nreturn libertyScenarioRadialCollision;')();

function actualMeshTriangles(){
 assert.equal(sha256,expectedSha,
  'new asset SHA requires remeasuring collision bins; never reuse stale bounds');
 assert.equal(glb.toString('ascii',0,4),'glTF');
 assert.equal(glb.readUInt32LE(8),glb.length);
 const jsonLength=glb.readUInt32LE(12),doc=JSON.parse(glb.toString('utf8',20,20+jsonLength));
 const binaryStart=20+jsonLength+8,primitive=doc.meshes[0].primitives[0];
 assert.equal(doc.meshes.length,1);assert.equal(doc.nodes.length,1);
 const coords=doc.accessors[primitive.attributes.POSITION];
 const posView=doc.bufferViews[coords.bufferView];
 assert.equal(coords.componentType,5126);assert.equal(coords.type,'VEC3');
 const pointStart=binaryStart+(posView.byteOffset||0)+(coords.byteOffset||0);
 const pointStride=posView.byteStride||12;
 const indices=doc.accessors[primitive.indices];
 const indexView=doc.bufferViews[indices.bufferView];
 const indexStart=binaryStart+(indexView.byteOffset||0)+(indices.byteOffset||0);
 const indexWidth=indices.componentType===5123?2:indices.componentType===5125?4:0;
 assert.ok(indexWidth>0);assert.equal(indices.count%3,0);
 assert.equal(indices.count/3,15900);
 const indexAt=i=>indexWidth===2?glb.readUInt16LE(indexStart+indexWidth*i):
  glb.readUInt32LE(indexStart+indexWidth*i);
 const point=i=>{const at=pointStart+pointStride*i;return [
  glb.readFloatLE(at),glb.readFloatLE(at+4),glb.readFloatLE(at+8)]};
 const v=[];let yLow=Infinity,yHigh=-Infinity;
 for(let i=0;i<coords.count;i++){
  const xyz=point(i);v.push(xyz);
  yLow=Math.min(yLow,xyz[1]);yHigh=Math.max(yHigh,xyz[1]);
 }
 const scale=31.3/(yHigh-yLow);
 const maxRadius=new Array(16).fill(0);
 for(let i=0;i<indices.count;i+=3){
  const tri=[v[indexAt(i)],v[indexAt(i+1)],v[indexAt(i+2)]];
  const minY=Math.min(...tri.map(q=>(q[1]-yLow)*scale));
  const maxY=Math.max(...tri.map(q=>(q[1]-yLow)*scale));
  // Use ALL vertices of any triangle whose HEIGHT INTERSECTS the slab.
  // This is conservative even for triangles spanning a slab boundary.
  const radius=Math.max(...tri.map(q=>Math.hypot(q[0]*scale,q[2]*scale)));
  for(let k=0;k<16;k++)
   if(minY<=(k+1)*2&&maxY>=k*2)
    maxRadius[k]=Math.max(maxRadius[k],radius);
 }
 return maxRadius;
}
test('every profile bin conservatively contains actual mesh triangles (exact SHA)',()=>{
 assert.equal(radii.length,16);
 const measured=actualMeshTriangles();
 for(let i=0;i<16;i++){
  assert.ok(radii[i]>=measured[i]-1e-5,
   'undersized scenario GLB collider band '+i+': '+radii[i]+' < '+measured[i]);
  assert.ok(radii[i]-measured[i]<.002,
   'overestimated collider band '+i+' must be measured, not a box');
 }
});
test('new renderer-specific shape fixes invisible plaza collisions while retaining actual monument hits',()=>{
 assert.equal(hit(8.4,0,10.5),false,'invisible plaza collision at radius 8.4');
 assert.equal(hit(9.4,0,5),false,'pedestrian ring proximity must remain clear');
 assert.equal(hit(0,0,20),true,'real sculpture body stays solid');
 assert.equal(hit(-2.5,0,30.3),true,'torch envelope stays solid');
 assert.equal(hit(0,0,32),false,'high altitude safely clears the torch');
 assert.equal(hit(Number.NaN,0,10),false);
 assert.equal(hit(0,Infinity,10),false);
 assert.equal(hit(0,0,-1),false);
 // The old fall-back statue used w=11 and 0.94 lower-level multiplier,
 // so this same radius-8.4 corridor was incorrectly blocked by ~10.89.
 assert.ok(8.4<=11*.94+.55);
});
test('scenario-specific activation preserves default, legacy, performance fallback and every other map',()=>{
 const a=src.indexOf("if(mark.kind==='liberty' && !graphicsCompat && smoothScenery())");
 const b=src.indexOf("const dx=Math.abs(x-mark.x),dz=z-mark.z;",a);
 assert.ok(a>0&&b>a&&b-a<900);
 const gate=src.slice(a,b);
 for(const text of [
  "mesh?.source==='scenario'","mesh.triangleCount===15900",
  "mesh.dimensions?.height-31.3","mesh.dimensions?.width-9.323",
  "mesh.dimensions?.depth-9.323",
  "libertyScenarioRadialCollision(x-mark.x,z-mark.z,level)",
  "finishFlight(pos,'Collision with '+mark.name,false)","return;","continue;"
 ])assert.ok(gate.includes(text),'missing deterministic fallback gate: '+text);
 assert.ok(src.slice(b,b+1000).includes("const scale=mark.kind==='liberty'?"),
  'original broad fallback collision must remain unmodified');
});
test('browser QA must actually sweep radius 8 to 11 with the game collider',()=>{
 assert.match(script,/scenarioClearSweeps/);
 assert.match(script,/checkFlightCollision\(\[mark.x\+radius/);
 assert.match(script,/scenarioClearSweeps!==/);
});
