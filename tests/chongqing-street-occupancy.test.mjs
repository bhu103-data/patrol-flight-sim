// node --test tests/chongqing-street-occupancy.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const load=async p=>{
 const source=await readFile(new URL(p,import.meta.url),'utf8');
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
};
const {buildChongqingStreetlife}=await load('../assets/chongqing/streetlife.js');
const {buildChongqingWetStreets}=await load('../assets/chongqing/wetstreets.js');

class Vec{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}set(x,y,z){this.x=x;this.y=y;this.z=z;return this}}
class Obj {
 constructor(){this.position=new Vec;this.scale=new Vec;this.rotation={set(){}};this.matrix={}}
 updateMatrix(){this.matrix={x:this.position.x,y:this.position.y,z:this.position.z}}
}
class Geo {
 constructor(){this.attributes={};this.index=[]}
 rotateX(){return this}
 setAttribute(k,v){this.attributes[k]=v}
 setIndex(v){this.index=v}
 computeVertexNormals(){}
}
class Mat{constructor(v={}){Object.assign(this,v)}}
class Color {constructor(value){this.value=value}}
class Instanced{
 constructor(geo,mat,cap){this.geometry=geo;this.material=mat;this.capacity=cap;this.count=0;this.matrices=new Map;
  this.instanceMatrix={setUsage(){},needsUpdate:false};this.visible=true}
 setMatrixAt(i,m){assert.ok(i<this.capacity);this.matrices.set(i,{...m})}
 setColorAt(i){assert.ok(i<this.capacity)}
 computeBoundingSphere(){}
}
class Mesh {constructor(geometry,material){this.geometry=geometry;this.material=material;this.visible=true}}
const THREE={
 BoxGeometry:Geo,CylinderGeometry:Geo,BufferGeometry:Geo,
 Float32BufferAttribute:class{constructor(array,size){this.array=array;this.itemSize=size}},
 Object3D:Obj,InstancedMesh:Instanced,Mesh,Color,
 MeshBasicMaterial:Mat,MeshStandardMaterial:Mat,MeshPhysicalMaterial:Mat,
 PointLight:class {constructor(){this.position=new Vec;this.visible=true}},
 SpotLight:class {constructor(){this.position=new Vec;this.target={position:new Vec};this.visible=true}},
 CanvasTexture:class{},DoubleSide:2,DynamicDrawUsage:3,StaticDrawUsage:1,
 SRGBColorSpace:3001,AdditiveBlending:5
};
const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
const ground=(x,z)=>Math.max(8,12+Math.abs(z)*.05);
const buildings=[
 {x:285,z:250,w:100,d:90},
 {x:-350,z:145,w:150,d:130},
 {x:490,z:-247,w:95,d:90}
];
const isRoadClear=(x,z,_y,r=0)=>buildings.every(b=>
 Math.abs(x-b.x)>=b.w*.5+r||Math.abs(z-b.z)>=b.d*.5+r);
function streetFixture(){
 const objs=[],scene={add(x){objs.push(x)}};
 return {traffic:buildChongqingStreetlife({THREE,scene,ground,riverCenter,isRoadClear}),objects:objs};
}
test('a zebra crossing is moved off the occupied hotpot building',()=>{
 const {traffic}=streetFixture(),x=traffic.snapshot().crossingX;
 assert.ok(x!==285&&x!==null,'cannot put crossing inside the shop');
 const z=riverCenter(x)+250+14*Math.sin(x/115+1);
 assert.ok(isRoadClear(x,z,ground(x,z)+1.7,9));
});
test('all active taxi bodies remain outside buildings over 3 minutes of travel',()=>{
 const {traffic}=streetFixture();
 let visible=0,turns=0;
 for(let frame=0;frame<4500;frame++){
   traffic.update(.04,null);
   if(frame%30!==0)continue;
   for(const v of traffic.snapshot().vehicles){
     if(v.disabled)continue;
     visible++;
     assert.equal(isRoadClear(v.x,v.z,v.y,3),true,
       'vehicle drove through a building at '+v.x+','+v.z);
   }
 }
 assert.ok(visible>500,'clear roads should retain moving cars');
});
test('batched lane paint, curbs and street lamps do not occupy building sites',()=>{
 const {objects}=streetFixture();
 const meshes=objects.filter(x=>x instanceof Instanced);
 const furniture=meshes.filter(m=>[1000,880,340,160].includes(m.capacity));
 assert.ok(furniture.length>=5);
 for(const mesh of furniture)for(const pose of mesh.matrices.values()){
   assert.equal(isRoadClear(pose.x,pose.z,pose.y,.1),true,
     'street decoration inside building footprint');
 }
});
test('wet road decals are omitted from building interiors',()=>{
 const old=globalThis.document;
 globalThis.document={createElement(){return {getContext(){return {
  createRadialGradient(){return {addColorStop(){}}},fillRect(){}
 }}}}};
 try{
   const meshes=[],scene={add(m){meshes.push(m)}};
   const wet=buildChongqingWetStreets({THREE,scene,ground,riverCenter,isRoadClear});
   assert.equal(meshes.length,2);
   assert.ok(wet.stats.skippedBuildingPuddles>0);
   assert.ok(wet.stats.skippedBuildingReflections>0);
   for(const mesh of meshes){
     const p=mesh.geometry.attributes.position.array;
     for(let i=0;i<p.length;i+=3)
       assert.equal(isRoadClear(p[i],p[i+2],p[i+1],.001),true,
         'wet asphalt vertex rendered inside building');
   }
 }finally{globalThis.document=old}
});
