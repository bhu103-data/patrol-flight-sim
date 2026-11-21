// Run: node --test tests/nyc-liberty-crown-volume.test.mjs
// Evaluate the actual Statue of Liberty body builder, not a mock crown.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function buildNewYorkLandmark(kind) {');
assert.ok(start>=0,'statue generator is present');
const open=html.indexOf('{',start);
let depth=0,end=-1;
for(let i=open;i<html.length;i++){
  if(html[i]==='{')depth++;
  else if(html[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>start,'landmark generator closes');
const source=html.slice(start,end);
const groups=[];
const generator=new Function('createTriangleMesh','addModelBox',
  source+';return buildNewYorkLandmark;')(
  ()=>{
    const triangles=[],quads=[];
    const batch={triangles,quads};
    groups.push(batch);
    return {
      addTri:(...args)=>triangles.push(args),
      addQuad:(...args)=>quads.push(args),
      upload:()=>({count:triangles.length*3+quads.length*6})
    };
  },
  ()=>{}
);
const mesh=generator('liberty'),body=groups[0];
const close=(v,t)=>Math.abs(v-t)<1e-6;
const rays=body.triangles.filter(tri=>tri.slice(0,3).some(p=>close(p[1],27.12)));
const raySides=body.quads.filter(quad=>quad.slice(0,4).some(p=>close(p[1],27.12)));
const triangleArea=([a,b,c])=>{
  const u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],
    u[0]*v[1]-u[1]*v[0]];
  return Math.hypot(...cross)*.5;
};
test('seven crown rays have distinct front and back faces plus sidewalls',()=>{
  assert.equal(rays.length,14,'seven two-sided triangular faces');
  assert.equal(raySides.length,14,'two longitudinal flank panels per ray');
  // Every ray also gets a closed rectangular lower cap at y=25.85.
  assert.ok(body.quads.filter(q=>q.slice(0,4).every(p=>close(p[1],25.85))).length>=7);
  for(const t of rays){
    assert.ok(triangleArea(t)>0.006,'no paper-thin or degenerate ray face');
    for(const vertex of t.slice(0,3))
      assert.ok(vertex.every(Number.isFinite),'finite crown vertex');
  }
});
test('seven ray tips are evenly separated by 360 / 7 degrees',()=>{
  const tips=[];
  for(let i=0;i<rays.length;i+=2){
    const a=rays[i].slice(0,3).find(p=>close(p[1],27.12));
    const b=rays[i+1].slice(0,3).find(p=>close(p[1],27.12));
    const x=(a[0]+b[0])*.5,z=(a[2]+b[2])*.5;
    tips.push((Math.atan2(z,x)+Math.PI*2)%(Math.PI*2));
    assert.ok(Math.hypot(x,z)>1.65&&Math.hypot(x,z)<1.76);
  }
  assert.equal(tips.length,7);
  tips.sort((a,b)=>a-b);
  for(let i=0;i<7;i++){
    const gap=(tips[(i+1)%7]-tips[i]+Math.PI*2)%(Math.PI*2);
    assert.ok(Math.abs(gap-Math.PI*2/7)<.001,
      'crown rays must not cluster at the rear of the head');
  }
});
test('copper crown remains within the original statue size and mesh budget',()=>{
  assert.ok(mesh.body.count>3000 && mesh.body.count<7000,
    'extra relief is batched into existing draw call');
  const allPoints=[
    ...body.triangles.flatMap(t=>t.slice(0,3)),
    ...body.quads.flatMap(q=>q.slice(0,4))
  ];
  assert.ok(allPoints.every(p=>p.every(Number.isFinite)));
  assert.ok(Math.max(...allPoints.map(p=>p[1]))<=31.3+1e-6);
  assert.ok(Math.min(...allPoints.map(p=>p[1]))>=-1e-6);
  assert.equal(groups.length,2,'no new runtime mesh or draw call');
});
