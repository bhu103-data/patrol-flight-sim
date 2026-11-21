// Regression: street-level pedestrians render tapered 3D anatomy, not cubes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('  function buildStreetVehicle(');
const stop=html.indexOf('  const streetMeshes',begin);
assert.ok(begin>=0&&stop>begin);
let depth=0,end=-1;
const open=html.indexOf('{',begin);
for(let i=open;i<stop;i++){
 if(html[i]==='{')depth++;
 else if(html[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>begin);
const builder=html.slice(begin,end);
function record(){
 const quads=[],triangles=[],boxes=[];
 const mesh=()=>({
  addQuad(...args){quads.push(args)},
  addTri(...args){triangles.push(args)},
  upload(){return {quads,triangles,boxes}}
 });
 return {mesh,quads,triangles,boxes,
  box:(_quad,...args)=>boxes.push(args)};
}
function build(kind){
 const m=record();
 const f=new Function('createTriangleMesh','addModelBox','addVegasLettering',
  'return ('+builder+')')(m.mesh,m.box,()=>{});
 return f(kind,[.29,.41,.55],[.70,.52,.39]);
}
test('near-view walker body has a smooth polygonal human silhouette',()=>{
 const m=build('walker');
 assert.ok(m.quads.length>70 && m.quads.length<250,'bounded sculpted mesh');
 assert.ok(m.triangles.length>15 && m.triangles.length<220,'capped rings');
 assert.equal(m.boxes.length,0,'no giant blocky cube head/torso/arms');
 const ys=m.quads.flatMap(q=>q.slice(0,4).map(p=>p[1]));
 assert.ok(Math.min(...ys)<.79 && Math.max(...ys)>1.81);
 for(const face of m.quads){
  for(const p of face.slice(0,4)){
   assert.equal(p.length,3);
   assert.ok(p.every(Number.isFinite));
  }
 }
});
test('independent animated trouser legs are tapered, capped and grounded',()=>{
 const source=html.slice(html.indexOf('  const walkerLeg=(()=>{'),
  html.indexOf('  const rideGuestMeshes=[',html.indexOf('  const walkerLeg=(()=>{')));
 assert.ok(source.includes('const n=10'));
 const m=record();
 const getLeg=new Function('createTriangleMesh','addModelBox',source+
  ';return walkerLeg;');
 const leg=getLeg(m.mesh,m.box);
 assert.equal(leg.boxes.length,0,'no rectangular trouser');
 assert.ok(leg.quads.length>=20&&leg.quads.length<=40);
 assert.equal(leg.triangles.length,10);
 const ys=leg.quads.flatMap(q=>q.slice(0,4).map(p=>p[1]));
 assert.ok(Math.min(...ys)<=-.77&&Math.max(...ys)>=-.02);
 assert.match(html,/drawMesh\(walkerLeg,mat4FromBasis\(hip/);
});
test('police uniforms and other existing street actor types are unchanged',()=>{
 const officer=build('officer');
 assert.ok(officer.boxes.length>4);
 assert.ok(html.includes('PATROL_NYC_PEDESTRIAN_SILHOUETTE_V1'));
});
