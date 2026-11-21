import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHONGQING_BUILDING_STYLES, makeChongqingTowerProfile,
  chongqingTowerEnvelopeAt, createChongqingUrbanArchitecture
} from '../assets/chongqing/urban-architecture.js';

test('each terraced tower has real shrinking facade and physically distinct window rhythm',()=>{
 const floors=new Set();
 for(const style of CHONGQING_BUILDING_STYLES){
   floors.add(style.facadeFloors);
   const low=chongqingTowerEnvelopeAt(style,-.5);
   const top=chongqingTowerEnvelopeAt(style,.5);
   assert.equal(low.width,1);
   assert.equal(low.depth,1);
   assert.ok(top.width<low.width);
   assert.ok(top.depth<low.depth);
   for(let i=0;i<=100;i++){
     const q=chongqingTowerEnvelopeAt(style,-.5+i/100);
     assert.ok(q.width<=1&&q.width>.2&&q.depth<=1&&q.depth>.2);
   }
   const geo=makeChongqingTowerProfile(style);
   assert.ok(geo.indices.length>0);
   assert.equal(geo.positions.length/3,geo.uvs.length/2);
   assert.ok(geo.positions.every(Number.isFinite)&&geo.uvs.every(Number.isFinite));
   // Roof should not reprint window decals from the vertical facade.
   assert.ok(geo.uvs.slice(-48).every(v=>Math.abs(v-.04)<1e-9));
 }
 assert.equal(floors.size,5,'Adjacent building styles must vary window density');
});

test('emissive window decals sit on their actual stepped facade, not in mid-air',()=>{
 const created=[],obstacles=[];
 class Geometry{
   constructor(){this.attributes={};this.index=[]}
   setAttribute(name,x){this.attributes[name]=x}
   setIndex(x){this.index=x}
   computeVertexNormals(){}
 }
 class Attribute{
   constructor(data,itemSize){this.array=data;this.count=data.length/itemSize}
 }
 class Object3D{
   constructor(){
     this.position={set:(...v)=>{this._pos=v}};
     this.rotation={set:(...v)=>{this._rot=v}};
     this.scale={set:(...v)=>{this._scale=v}};
   }
   updateMatrix(){
     this.matrix={p:[...this._pos],s:[...this._scale]};
   }
 }
 class Instance{
   constructor(geometry,material,capacity){
     this.geometry=geometry;this.material=material;this.capacity=capacity;
     this.count=0;this.records=[];
     this.instanceMatrix={setUsage(){},needsUpdate:false};
     created.push(this);
   }
   setMatrixAt(i,m){assert.ok(i<this.capacity);this.records[i]={p:[...m.p],s:[...m.s]}}
   setColorAt(i,c){assert.ok(i<this.capacity);this.instanceColor={needsUpdate:false}}
   computeBoundingSphere(){}
 }
 class Color{set(){return this}}
 class Material{}
 const THREE={BufferGeometry:Geometry,Float32BufferAttribute:Attribute,
   Object3D,InstancedMesh:Instance,MeshStandardMaterial:Material,
   MeshBasicMaterial:Material,BoxGeometry:Geometry,PlaneGeometry:Geometry,
   Color,DoubleSide:2,StaticDrawUsage:1};
 let seed=100384;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const scene={add(){}};
 const built=createChongqingUrbanArchitecture({
   THREE,scene,ground:()=>65,riverDist:()=>180,riverCenter:()=>0,
   rand,obstacles,pbr:{residentialFacade:{},curtainWall:{},commercialFacade:{}},
   plannedRoads:[]
 });
 assert.ok(built.stats.towers>70);
 const towers=created.slice(0,5).flatMap((mesh,style)=>
   mesh.records.slice(0,mesh.count).map(r=>({...r,style})));
 const glass=created.find(m=>m.capacity===4800);
 assert.ok(glass?.count>100);
 for(const decal of glass.records.slice(0,glass.count)){
   const [x,y,z]=decal.p;
   const t=towers.find(t=>{
     const [bx,by,bz]=t.p,[w,h,d]=t.s;
     return y>by-h/2&&y<by+h/2 &&
       Math.abs(x-bx)<=w*.51 && Math.abs(z-bz)<=d*.52;
   });
   assert.ok(t,'Each glowing pane is near a generated building');
   const frac=(y-(t.p[1]-t.s[1]/2))/t.s[1]-.5;
   const outline=chongqingTowerEnvelopeAt(CHONGQING_BUILDING_STYLES[t.style],frac);
   const actualZ=t.p[2]+t.s[2]*outline.depth*.5+.075;
   assert.ok(Math.abs(z-actualZ)<1e-6,
     'Window must hug setback face; gap '+Math.abs(z-actualZ).toFixed(3));
 }
 built.setQuality('low');
 assert.equal(glass.visible,false);
 built.setQuality('normal');
 assert.equal(glass.visible,true);
});
