// Run: node --test tests/chongqing-landmarks.test.mjs
// Regression test for the procedural, browser-independent building module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const code=await readFile(new URL('../assets/chongqing/landmarks.js',import.meta.url),'utf8');
const { buildChongqingLandmarks }=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

class Vec {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
}
class Obj {
  constructor(){
    this.position=new Vec();
    this.scale=new Vec(1,1,1);
    this.rotation={set(){}};
    this.matrix={};
    this.children=[];
  }
  add(v){this.children.push(v)}
  updateMatrix(){}
}
class Geometry {
  constructor(){this.attributes={};this.index=null}
  setAttribute(k,v){this.attributes[k]=v}
  setIndex(a){this.index=a}
  computeVertexNormals(){}
}
class BoxGeometry extends Geometry {
  constructor(){
    super();
    const coords=Array.from({length:24},(_,i)=>[
      (i%4===0||i%4===3)?0:1,
      i%4<2?1:0
    ]);
    this.attributes.uv={
      coords,count:coords.length,needsUpdate:false,
      getX(i){return this.coords[i][0]},
      getY(i){return this.coords[i][1]},
      setXY(i,u,v){this.coords[i]=[u,v]}
    };
  }
  getAttribute(name){return this.attributes[name]}
}
class Material {
  constructor(options={}){Object.assign(this,options)}
  clone(){return new Material(this)}
}
class Mesh extends Obj {
  constructor(g,m){super();this.geometry=g;this.material=m}
}
class InstancedMesh extends Mesh {
  constructor(geo,material,capacity){
    super(geo,material);
    this.capacity=capacity;
    this.count=0;
    this.instanceMatrix={needsUpdate:false};
    this.written=0;
  }
  setMatrixAt(index,m){
    assert.ok(index<this.capacity,'instanced buffer overflow');
    this.written++;
  }
  computeBoundingSphere(){}
}
const FakeThree={
  BoxGeometry,CylinderGeometry:Geometry,TorusGeometry:Geometry,
  BufferGeometry:Geometry,Float32BufferAttribute:Geometry,
  MeshStandardMaterial:Material,MeshPhysicalMaterial:Material,MeshBasicMaterial:Material,
  Object3D:Obj,Mesh,Group:Obj,InstancedMesh,PointLight:Obj,
  DoubleSide:2
};

function setup(){
  const meshes=[],obstacles=[],signs=[];
  const scene={add(o){meshes.push(o)}};
  const pbr={concrete:new Material({color:0xb2b2b2}),glass:new Material({roughness:.2}),
    window:new Material({color:0xdddddd}),
    residentialFacade:new Material({map:'original-PBR-residential-atlas'})};
  const ground=(x,z)=>Math.max(8,22+z*.12);
  const box=(x,y,z,w,h,d,mat,parent=scene)=>{
    const mesh=new Mesh(new Geometry(),mat);
    mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
  };
  const monument=buildChongqingLandmarks({
    THREE:FakeThree,scene,ground,pbr,box,sign:(...items)=>signs.push(items),obstacles
  });
  return {monument,meshes,obstacles,signs,ground,pbr};
}

test('eight towers and the 300-metre Crystal are present',()=>{
  const {monument}=setup();
  assert.equal(monument.stats.towers,8);
  assert.equal(monument.stats.crystalLength,300);
  assert.equal(monument.stats.trainCars,3);
  assert.equal(monument.stats.facadeBands>500,true);
  assert.equal(monument.stats.mullions>1000,true);
});

test('Raffles podium and Crystal have collision envelopes and landable tops',()=>{
  const {monument,obstacles}=setup();
  const podium=obstacles.find(o=>o.w===324&&o.d===115);
  const crystal=obstacles.find(o=>o.w===300&&o.d===32.5);
  assert.ok(podium);
  assert.ok(crystal);
  assert.ok(crystal.top>monument.raffles.y);
  assert.ok(crystal.base>200);
});

test('Liziba retains an actual open train-height corridor through the building',()=>{
  const {monument,obstacles}=setup();
  const station=obstacles.filter(o=>Math.abs(o.x-monument.liziba.x)<1&&Math.abs(o.z-monument.liziba.z)<=20);
  assert.equal(station.length,4);
  const [lower,upper]=station;
  assert.ok(lower.top<monument.liziba.y);
  assert.ok(upper.base>monument.liziba.y);
  assert.ok(upper.top>lower.top+40);
});

test('three carriages move with the elevated rail curve',()=>{
  const {monument,meshes}=setup();
  const cars=meshes.filter(x=>x instanceof Obj && !(x instanceof Mesh) && x.children.length>10);
  assert.equal(cars.length,3);
  const before=cars.map(c=>[c.position.x,c.position.y,c.position.z]);
  monument.update(.016);
  monument.update(.040);
  const after=cars.map(c=>[c.position.x,c.position.y,c.position.z]);
  for(let i=0;i<3;i++){
    assert.notEqual(after[i][0],before[i][0]);
    assert.ok(after[i].every(Number.isFinite));
  }
});

test('landmark mesh batching fits the indexed capacities',()=>{
  const {monument,meshes}=setup();
  const instances=meshes.filter(x=>x instanceof InstancedMesh);
  assert.ok(instances.length>=4);
  assert.ok(instances.every(i=>i.written<=i.capacity));
  assert.ok(monument.stats.lizibaWindows>350);
});

test('Liziba station uses original textured PBR facade even in low graphics mode',()=>{
  const {monument,meshes,pbr,obstacles}=setup();
  const shells=meshes.filter(mesh=>mesh instanceof Mesh&&
    mesh.material===pbr.residentialFacade);
  assert.equal(shells.length,2,'Lower and upper apartment shells use one shared PBR atlas');
  const [lower,upper]=shells;
  assert.ok(lower.scale.y<upper.scale.y);
  for(const shell of shells){
    const uv=shell.geometry.getAttribute('uv');
    assert.ok(uv);
    assert.ok(uv.needsUpdate);
    for(let i=8;i<16;i++)
      assert.deepEqual(uv.coords[i],[.02,.002],
        'Roof/underside must sample plain concrete, not painted windows');
  }
  // The upper storeys have more actual floors and hence more atlas rows.
  assert.ok(upper.geometry.getAttribute('uv').coords[0][1]>
    lower.geometry.getAttribute('uv').coords[0][1]);
  monument.setQuality('low');
  assert.ok(shells.every(shell=>shell.visible!==false),
    'Low graphics mode keeps textured buildings instead of blank gray boxes');
  assert.equal(obstacles.filter(o=>Math.abs(o.x-monument.liziba.x)<1&&
    Math.abs(o.z-monument.liziba.z)<=20).length,4,
    'Monorail opening and all collision volumes stay unchanged');
});

test('LiZiba translucent concourse exposes monorail without opaque side slab',()=>{
  const {monument,meshes,obstacles}=setup();
  const walls=meshes.filter(item=>item instanceof Mesh&&
    item.material?.transparent===true&&item.material?.color===0x8aa6b3);
  assert.equal(walls.length,2,'two transparent river-facing station sides');
  assert.ok(walls.every(w=>w.material.opacity===.34&&w.material.depthWrite===false));
  const frame=meshes.find(item=>item instanceof InstancedMesh&&item.capacity===120&&
    item.material?.color===0x8198a6);
  assert.ok(frame,'shared physical steel mullion batch');
  assert.equal(frame.count,30);
  assert.equal(frame.written,30,'all structural members set their instance transforms');
  monument.setQuality('low');
  assert.ok(walls.every(w=>w.visible!==false),'saving GPU resources must not reintroduce opaque wall');
  assert.notEqual(frame.visible,false,'station frames stay visible in low graphics mode');
  assert.equal(obstacles.filter(o=>Math.abs(o.x-monument.liziba.x)<1&&
    Math.abs(o.z-monument.liziba.z)<=20).length,4,'unchanged portal collision volumes');
  assert.doesNotMatch(code,/solid\(station\.x,railY\+2\.9,station\.z\+side\*18,frameLength,16\.3,4,concrete\)/);
});
