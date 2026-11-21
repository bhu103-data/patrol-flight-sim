// node --test tests/chongqing-riverlife.test.mjs
// Deterministic 3D ferry geometry, navigational motion, walkable decks.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const code=await readFile(new URL('../assets/chongqing/riverlife.js',import.meta.url),'utf8');
const {buildChongqingRiverlife}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

class Vec{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
}
class Object3D{
  constructor(){this.position=new Vec;this.scale=new Vec(1,1,1);this.rotation={x:0,y:0,z:0};this.children=[]}
  add(o){this.children.push(o)}
}
class Geometry{
  constructor(){this.attributes={};this.index=[]}
  setAttribute(name,array){this.attributes[name]=array}
  setIndex(idx){this.index=idx}
  computeVertexNormals(){}
}
class Material{constructor(props={}){Object.assign(this,props)}}
class Mesh extends Object3D{
  constructor(geometry,material){super();this.geometry=geometry;this.material=material;this.visible=true}
}
class Group extends Object3D {}
class Texture {}
const THREE={
  MeshStandardMaterial:Material,MeshPhysicalMaterial:Material,MeshBasicMaterial:Material,
  BoxGeometry:Geometry,BufferGeometry:Geometry,Float32BufferAttribute:class{constructor(array,size){this.array=array;this.itemSize=size}},
  TorusGeometry:Geometry,PlaneGeometry:Geometry,Mesh,Group,CanvasTexture:Texture,
  DoubleSide:2,SRGBColorSpace:3001,AdditiveBlending:4
};
const gradient={addColorStop(){}};
const context={createLinearGradient(){return gradient},fillRect(){}};
const originalDocument=globalThis.document;
globalThis.document={createElement(){return {width:0,height:0,getContext(){return context}}}};

function setup(){
  const scene={objects:[],add(x){this.objects.push(x)}};
  const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
  const river=buildChongqingRiverlife({THREE,scene,riverCenter});
  return {scene,river};
}

test('three different ferries have detailed passenger decks and solid tapered hulls',()=>{
  const {scene,river}=setup();
  assert.equal(river.stats.boats,3);
  assert.equal(scene.objects.length,3);
  const groups=scene.objects.filter(x=>x instanceof Group);
  assert.equal(groups.length,3);
  for(const ferry of groups.slice(0,3)){
    assert.ok(ferry.children.length>=22);
    const hull=ferry.children.find(c=>c instanceof Mesh&&c.geometry.attributes.position);
    assert.ok(hull);
    assert.ok(hull.geometry.index.length>=50);
    assert.ok(hull.geometry.attributes.position.array.every(Number.isFinite));
  }
});

test('ferries actually navigate in different directions along curved rivers',()=>{
  const {river}=setup();
  const start=river.snapshot();
  river.update(.05);
  const next=river.snapshot();
  assert.ok(next[0].x>start[0].x);
  assert.ok(next[1].x<start[1].x);
  assert.ok(next[2].x>start[2].x);
  for(const boat of next){
    assert.ok([boat.x,boat.y,boat.z,boat.heading].every(Number.isFinite));
    assert.ok(boat.y<0,'ferry waterline stays below zero');
  }
});

test('upper and lower boat decks accept descending pilot but not upward teleport',()=>{
  const {river}=setup();
  const a=river.snapshot()[0];
  const topY=a.y+5.7+2.35;
  const lowerY=a.y+1.755+2.35;
  assert.ok(Math.abs(river.deckSurface(a.x-2.2,a.z,topY+1,topY-.2)-topY)<1e-6);
  assert.ok(Math.abs(river.deckSurface(a.x+10,a.z,lowerY+.8,lowerY-.3)-lowerY)<1e-6);
  assert.equal(river.deckSurface(a.x-2.2,a.z,topY-3,topY-2),-Infinity);
  assert.equal(river.deckSurface(a.x+100,a.z,topY+1,topY-1),-Infinity);
});

test('standing player inherits ferry movement without allocation errors',()=>{
  const {river}=setup();
  const s=river.snapshot()[0];
  const standingY=s.y+5.7+2.35;
  river.update(.05);
  const n=river.snapshot()[0];
  const drift=river.deckDrift(n.x-2.2,n.z,standingY);
  assert.ok(drift.dx>.2);
  assert.ok(Math.abs(drift.dz)<1);
  assert.equal(river.deckDrift(3000,3000,standingY).dx,0);
});

test('battery saver hides wake effects but keeps all passenger ships',()=>{
  const {river,scene}=setup();
  const wakes=scene.objects.map(g=>g.children.find(m=>m instanceof Mesh&&m.material?.blending===THREE.AdditiveBlending));
  assert.equal(wakes.length,3);
  assert.ok(wakes.every(Boolean));
  river.setQuality('low');
  assert.ok(wakes.every(w=>w.visible===false));
  river.setQuality('normal');
  assert.ok(wakes.every(w=>w.visible===true));
});

test('main game updates ferry animation, deck contact and quality',async()=>{
  const main=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  assert.ok(main.includes("from './riverlife.js'"));
  assert.ok(main.includes('riverBuild.update(dt)'));
  assert.ok(main.includes('riverBuild.deckSurface('));
  assert.ok(main.includes('riverBuild.deckDrift('));
  assert.ok(main.includes('riverBuild.setQuality('));
});

process.on('exit',()=>{globalThis.document=originalDocument});
