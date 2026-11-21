// node --test tests/chongqing-streetlife.test.mjs
// No browser or dependencies: verify downtown taxis, roads and GPU batches.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/chongqing/streetlife.js',import.meta.url),'utf8');
const {buildChongqingStreetlife}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

class Vec{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
}
class Object3D {
  constructor(){this.position=new Vec;this.scale=new Vec;this.rotation={set(){}};this.matrix={}}
  updateMatrix(){}
}
class Geometry {
  constructor(){this.attributes={}}
  rotateX(){return this}
  setAttribute(k,v){this.attributes[k]=v}
  setIndex(idx){this.index=idx}
  computeVertexNormals(){}
}
class Material{
  constructor(options={}){Object.assign(this,options)}
}
class Color {constructor(hex){this.hex=hex}}
class InstancedMesh{
  constructor(geometry,material,capacity){
    this.geometry=geometry;this.material=material;
    this.capacity=capacity;this.count=0;
    this.instanceMatrix={setUsage(){},needsUpdate:false};
    this.written=0;this.visible=true;this.frustumCulled=true;
  }
  setMatrixAt(i){
    assert.ok(i<this.capacity,'GPU instance buffer exceeded');
    this.written++;
  }
  setColorAt(i){
    assert.ok(i<this.capacity,'GPU instanceColor buffer exceeded');
  }
  computeBoundingSphere(){}
}
const THREE={
  BoxGeometry:Geometry,CylinderGeometry:Geometry,BufferGeometry:Geometry,
  Float32BufferAttribute:Geometry,Object3D,InstancedMesh,
  MeshBasicMaterial:Material,MeshStandardMaterial:Material,MeshPhysicalMaterial:Material,
  Color,Vector3:Vec,
  PointLight:class{constructor(){this.position=new Vec;this.visible=true}},
  SpotLight:class{constructor(){this.position=new Vec;this.target={position:new Vec};this.visible=true}},
  DoubleSide:2,DynamicDrawUsage:2,StaticDrawUsage:1
};
function setup(){
  const objects=[];
  const ground=(x,z)=>Math.max(8,9+(Math.abs(z)-75)*.17);
  const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
  const traffic=buildChongqingStreetlife({THREE,scene:{add(x){objects.push(x)}},ground,riverCenter});
  return {traffic,objects};
}
test('active Chongqing street traffic has 10 distinct cars including yellow taxis',()=>{
  const {traffic,objects}=setup();
  assert.equal(traffic.stats.vehicles,10);
  assert.equal(traffic.stats.taxis,5);
  assert.equal(traffic.stats.movingHeadlights,2);
  assert.ok(traffic.stats.streetLamps>=50);
  assert.ok(traffic.stats.roadMarkings>200);
  assert.equal(traffic.stats.zebraStripes,10);
  assert.equal(traffic.stats.trafficSignals,2);
  assert.ok(objects.filter(x=>x instanceof InstancedMesh).length>=15);
});
test('moving vehicles keep dynamic matrix counts inside buffers',()=>{
  const {traffic,objects}=setup();
  for(let i=0;i<100;i++)traffic.update(.016,{x:285,y:55,z:265});
  for(const x of objects.filter(x=>x instanceof InstancedMesh)){
    assert.ok(x.count<=x.capacity,'count fits allocation');
    assert.ok(x.instanceMatrix.needsUpdate,'dynamic buffers refreshed');
  }
});
test('far from the roads is safe, vehicle collision method returns boolean',()=>{
  const {traffic}=setup();
  assert.equal(traffic.nearby(5000,5000,400),false);
  assert.equal(typeof traffic.nearby(250,245,30), 'boolean');
});
test('battery mode removes decorative checker and hub detail, not actual car bodies',()=>{
  const {traffic,objects}=setup();
  const instanced=objects.filter(x=>x instanceof InstancedMesh);
  const body=instanced.find(x=>x.capacity===12&&x.castShadow);
  assert.ok(body,'body shadow caster found');
  traffic.setQuality('low');
  assert.equal(body.visible,true);
  assert.ok(instanced.filter(x=>!x.visible).length>=3);
  traffic.setQuality('normal');
  // A red traffic signal remains correctly dark while vehicle green is active.
  assert.ok(instanced.filter(x=>x.capacity!==2).every(x=>x.visible));
  assert.equal(objects.filter(x=>x instanceof THREE.SpotLight).length,2);
});
test('crossing changes its active lamp after 24 seconds and again after 36',()=>{
  const {traffic,objects}=setup();
  const reds=objects.filter(x=>x instanceof InstancedMesh&&x.capacity===2&&x.material.color===0xff4539);
  const greens=objects.filter(x=>x instanceof InstancedMesh&&x.capacity===2&&x.material.color===0x4ee28b);
  assert.equal(reds.length,1);
  assert.equal(greens.length,1);
  assert.equal(greens[0].visible,true);
  assert.equal(reds[0].visible,false);
  for(let i=0;i<510;i++)traffic.update(.05,null);
  assert.equal(greens[0].visible,false);
  assert.equal(reds[0].visible,true);
  for(let i=0;i<230;i++)traffic.update(.05,null);
  assert.equal(greens[0].visible,true);
  assert.equal(reds[0].visible,false);
});
test('westbound taxi traffic can stop at red and resume when signal turns green',()=>{
  const {traffic}=setup();
  let sawStop=false,sawRelease=false,stoppedId=-1;
  for(let frame=0;frame<3500;frame++){
    traffic.update(.04,null);
    const snap=traffic.snapshot();
    for(let i=0;i<snap.vehicles.length;i++){
      const v=snap.vehicles[i];
      if(v.side!==1||v.tier!==1||v.dir!==-1)continue;
      if(!snap.vehicleGreen&&Math.abs(v.x-297)<.08){
        sawStop=true;stoppedId=i;
      }
      if(sawStop&&snap.vehicleGreen&&i===stoppedId&&v.x<294){
        sawRelease=true;
      }
    }
  }
  assert.equal(sawStop,true,'at least one car halts before the pedestrian crossing');
  assert.equal(sawRelease,true,'held car resumes at the next green phase');
});
test('painted car body, cabin glass, wheels and white-black checker are separate batches',()=>{
  const {objects}=setup();
  const instanced=objects.filter(x=>x instanceof InstancedMesh);
  const wheelGroups=instanced.filter(x=>x.capacity===48&&x.count===40);
  assert.equal(wheelGroups.length,2);
  assert.ok(instanced.some(x=>x.capacity===72&&x.count===30));
  assert.ok(instanced.some(x=>x.capacity===12&&x.count===5));
});
test('front grille and license plate detail remains instanced and low-quality aware',()=>{
  const {traffic,objects}=setup();
  const meshes=objects.filter(x=>x instanceof InstancedMesh);
  const grille=meshes.find(x=>x.capacity===12&&x.count===10&&x.material.roughness===.82);
  const plates=meshes.find(x=>x.capacity===24&&x.count===20&&x.material.color===0xe4e7d8);
  const rearTrims=meshes.find(x=>x.capacity===24&&x.count===20&&x.material.color===0xa92a21);
  assert.ok(grille,'one GPU batch covers all ten front grilles');
  assert.ok(plates,'one GPU batch covers front and rear plates');
  assert.ok(rearTrims,'one GPU batch covers rear marker trim');
  traffic.setQuality('low');
  for(const mesh of [grille,plates,rearTrims])assert.equal(mesh.visible,false);
  traffic.setQuality('normal');
  for(const mesh of [grille,plates,rearTrims])assert.equal(mesh.visible,true);
});

test('main scene integrates real shadows and street traffic without disabling existing maps',async()=>{
  const src=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  assert.ok(src.includes("from './streetlife.js'"));
  assert.ok(src.includes('streetBuild.update(dt,state.pos)'));
  assert.ok(src.includes('streetBuild.setQuality('));
  assert.ok(src.includes('renderer.shadowMap.type=THREE.PCFSoftShadowMap'));
  assert.ok(src.includes("trees.castShadow=qualityMode==='high'"));
  assert.ok(src.includes('streetBuild.nearby('));
});
