// node --test tests/chongqing-detail.test.mjs
// Structural tests for batched, tile-textured roof geometry and timber lattice.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const code=await readFile(new URL('../assets/chongqing/details.js',import.meta.url),'utf8');
const {buildChongqingDetails}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

class Vec {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  copy(o){return this.set(o.x,o.y,o.z)}
  clone(){return new Vec(this.x,this.y,this.z)}
  add(o){this.x+=o.x;this.y+=o.y;this.z+=o.z;return this}
  sub(o){this.x-=o.x;this.y-=o.y;this.z-=o.z;return this}
  multiplyScalar(n){this.x*=n;this.y*=n;this.z*=n;return this}
  length(){return Math.hypot(this.x,this.y,this.z)}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}
  normalize(){return this.multiplyScalar(1/(this.length()||1))}
}
class Object3D {
  constructor(){
    this.position=new Vec();this.scale=new Vec(1,1,1);
    this.rotation={set(){}};this.quaternion={setFromUnitVectors(){}};
    this.matrix={};
  }
  updateMatrix(){}
}
class Geometry {
  constructor(){this.attributes={};this.index=[];this.repeat={set(){}}}
  setIndex(v){this.index=v}
  setAttribute(key,value){this.attributes[key]=value}
  computeVertexNormals(){}
}
class Attribute{constructor(array,size){this.array=array;this.itemSize=size}}
class Material {constructor(o={}){Object.assign(this,o)}clone(){return new Material(this)}}
class InstancedMesh {
  constructor(geometry,material,capacity){
    this.geometry=geometry;this.material=material;this.capacity=capacity;
    this.count=0;this.frustumCulled=true;this.visible=true;this.written=0;
    this.instanceMatrix={setUsage(){},needsUpdate:false,array:new Float32Array(capacity*16)};
  }
  setMatrixAt(i,matrix){
    assert.ok(i<this.capacity,'instance buffer overflow');this.written++;
    const values=this.instanceMatrix.array,offset=i*16;
    if(matrix?.elements)values.set(matrix.elements,offset);
    else {values[offset]=i+1;values[offset+5]=1;values[offset+10]=1;values[offset+15]=1;}
  }
  computeBoundingSphere(){}
}
class Matrix4 {
  constructor(){this.elements=new Float32Array(16)}
  makeScale(x,y,z){this.elements[0]=x;this.elements[5]=y;
    this.elements[10]=z;this.elements[15]=1;return this}
}
class Color {constructor(){this.r=.3;this.g=.4;this.b=.6}set(){return this}}
class Light {constructor(){this.position=new Vec()}}
const THREE={
  BoxGeometry:Geometry,PlaneGeometry:Geometry,BufferGeometry:Geometry,
  CylinderGeometry:Geometry,IcosahedronGeometry:Geometry,
  Float32BufferAttribute:Attribute,MeshStandardMaterial:Material,MeshBasicMaterial:Material,
  PointsMaterial:Material,InstancedMesh,Object3D,Vector3:Vec,Color,PointLight:Light,
  Points:class {},Matrix4,DoubleSide:2,StaticDrawUsage:1,AdditiveBlending:2
};
const pbr={
  wood:new Material({kind:'wood'}),carvedWood:new Material({kind:'woodCarving'}),
  roof:new Material({kind:'roof'}),stone:new Material({kind:'stone'}),
  window:new Material({kind:'window'}),cutStone:new Material({kind:'cutStone'})
};
function construct(){
  let seed=89;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const meshes=[],obstacles=[];
  const ground=(x,z)=>Math.max(8,14+z*.15);
  const out=buildChongqingDetails({
    THREE,scene:{add(...arr){meshes.push(...arr)}},ground,
    riverCenter:x=>28*Math.sin(x/150),rand,box(){},ball(){},sign(){},
    hotpot:{x:285,z:225},obstacles,pbr
  });
  return {out,meshes,obstacles};
}
test('curved pitched roofs include eleven landmark levels and one neighboring shop',()=>{
  const {out,meshes}=construct();
  assert.equal(out.stats.curvedRoofs,34);
  const roof=meshes.find(m=>m instanceof InstancedMesh&&m.geometry instanceof Geometry&&m.geometry.attributes.position);
  assert.ok(roof,'custom roof mesh exists');
  assert.equal(roof.count,34);
  assert.equal(roof.material,pbr.roof,'curved roofs retain live PBR material for async texture update');
  const values=roof.geometry.attributes.position.array;
  const y=[];for(let i=1;i<values.length;i+=3)y.push(values[i]);
  assert.ok(Math.max(...y)-Math.min(...y)>.6,'real roof curvature present');
  assert.ok(roof.geometry.index.length>500,'multi-segment 3D roof surface');
});
test('Hongyadong neighboring shop steps back without changing obstacles or GLB facade range',()=>{
  const {out,obstacles}=construct();
  const shop=obstacles.filter(b=>b.x===212&&b.z===297&&b.w===20&&b.d===16);
  assert.equal(shop.length,1,'reuse exact existing shop collision footprint');
  assert.equal(out.hongyadongReplacementCounts.curvedRoofs,33,
    'new neighbor curved eave remains visible when the optional GLB replaces only Hongyadong');
  assert.match(code,/if\(i===0\)\{/);
  assert.match(code,/put\('timber',x,y\+12\.75,z-7\.4,16\.4,5\.8,13\.2\)/);
  assert.match(code,/beam\('carved',\[px,y\+7\.1,z-\.35\]/);
  assert.match(code,/roof\(x,y\+15\.85,z-7\.4,19\.6,1\.15,16\.4\)/);
  assert.doesNotMatch(code,/PATROL_CQ_HONGYADONG_NEIGHBOR_STEP_V1[\s\S]*?\}else\{[\s\S]*?obstacles\.push/,
    'no additional collision proxy within the new detail-only branch');
});

test('window latticework is batched and can be hidden in low quality',()=>{
  const {out,meshes}=construct();
  assert.ok(out.stats.lattice>1500,'detailed window bars');
  const lattice=meshes.find(m=>m.material.kind==='woodCarving'&&m.capacity===3400);
  assert.ok(lattice);
  assert.equal(lattice.count,out.stats.lattice);
  out.setQuality('low');
  assert.equal(lattice.visible,false);
  out.setQuality('normal');
  assert.equal(lattice.visible,true);
});
test('all instanced pools retain valid counts and no overflow',()=>{
  const {meshes}=construct();
  const pools=meshes.filter(m=>m instanceof InstancedMesh);
  assert.ok(pools.length>10);
  for(const mesh of pools){
    assert.ok(mesh.count<=mesh.capacity,'count <= capacity');
    assert.ok(mesh.written<=mesh.capacity,'all matrices fit');
  }
});

test('Scenario swap hides only Hongyadong instances and restores exact original matrices',()=>{
  const {out,meshes}=construct();
  assert.equal(out.hongyadongReplacementCounts.curvedRoofs,33);
  assert.equal(out.hongyadongReplacementCounts.bridge,0,
    'existing Qiansimen bridge must never be hidden');
  assert.ok(out.hongyadongReplacementCounts.timber>0);
  const timber=meshes.find(m=>m instanceof InstancedMesh&&m.capacity===3600);
  const bridge=meshes.find(m=>m instanceof InstancedMesh&&m.capacity===850);
  assert.ok(timber&&bridge);
  const oldTimber=timber.instanceMatrix.array.slice();
  const oldBridge=bridge.instanceMatrix.array.slice();
  out.setHongyadongReplacement(true);
  assert.notDeepEqual(timber.instanceMatrix.array,oldTimber);
  assert.deepEqual(bridge.instanceMatrix.array,oldBridge);
  out.setHongyadongReplacement(false);
  assert.deepEqual(timber.instanceMatrix.array,oldTimber);
  assert.deepEqual(bridge.instanceMatrix.array,oldBridge);
});
