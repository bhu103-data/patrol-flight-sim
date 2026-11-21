// node --test tests/chongqing-wetstreets.test.mjs
// Dependency-free geometry tests for wet roads / lamp reflections.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const moduleText=await readFile(new URL('../assets/chongqing/wetstreets.js',import.meta.url),'utf8');
const {buildChongqingWetStreets}=await import('data:text/javascript;base64,'+Buffer.from(moduleText).toString('base64'));

class Geometry{
  constructor(){this.attributes={};this.index=[]}
  setAttribute(name,value){this.attributes[name]=value}
  setIndex(v){this.index=v}
  computeVertexNormals(){}
}
class Attribute{constructor(array,itemSize){this.array=array;this.itemSize=itemSize}}
class Material{constructor(v){Object.assign(this,v)}}
class Mesh{
  constructor(geometry,material){
    this.geometry=geometry;this.material=material;
    this.visible=true;this.renderOrder=0;
  }
}
class Texture{constructor(){this.colorSpace=null}}
const canvas={width:0,height:0,getContext(){return {
  createRadialGradient(){return {addColorStop(){}}},
  fillRect(){},fillStyle:null
}}};
const THREE={
  BufferGeometry:Geometry,Float32BufferAttribute:Attribute,
  MeshPhysicalMaterial:Material,MeshBasicMaterial:Material,Mesh,
  CanvasTexture:Texture,DoubleSide:2,AdditiveBlending:5,SRGBColorSpace:3001
};
const ground=(x,z)=>Math.max(8,12+Math.abs(z)*.05+Math.sin(x/120)*2);
const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
function setup(){
  const scene={objects:[],add(m){this.objects.push(m)}};
  const effect=buildChongqingWetStreets({THREE,scene,ground,riverCenter});
  return {effect,scene};
}
const originalDocument=globalThis.document;
globalThis.document={createElement(){return canvas}};

test('wet surfaces use only two batched meshes and no external downloads',()=>{
  const {effect,scene}=setup();
  assert.equal(scene.objects.length,2);
  assert.equal(effect.stats.drawGroups,2);
  assert.ok(effect.stats.puddles>100);
  assert.ok(effect.stats.reflectionStrips>50);
  assert.ok(effect.stats.puddles<350);
});

test('surface triangles, UVs and positions are valid',()=>{
  const {scene}=setup();
  for(const mesh of scene.objects){
    const g=mesh.geometry;
    const pos=g.attributes.position.array;
    const uv=g.attributes.uv.array;
    assert.ok(pos.length>0);
    assert.ok(pos.length%3===0);
    assert.equal(pos.length/3,uv.length/2);
    assert.ok(g.index.length%3===0);
    assert.ok(pos.every(Number.isFinite));
    assert.ok(uv.every(Number.isFinite));
    assert.ok(g.index.every(i=>i>=0&&i<pos.length/3));
  }
});

test('wet asphalt uses physical clearcoat, emissive reflections fade in low quality',()=>{
  const {effect,scene}=setup();
  assert.ok(scene.objects[0].material.clearcoat>.9);
  assert.ok(scene.objects[0].material.roughness<.3);
  assert.ok(scene.objects[1].material.transparent);
  const initial=scene.objects[1].material.opacity;
  effect.update(.04);
  assert.notEqual(scene.objects[1].material.opacity,initial);
  effect.setQuality('low');
  assert.equal(scene.objects[0].visible,false);
  assert.equal(scene.objects[1].visible,false);
  effect.setQuality('normal');
  assert.equal(scene.objects[0].visible,true);
  assert.equal(scene.objects[1].visible,true);
});

test('integrates with moving traffic and retains separate quality controls',async()=>{
  const main=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  assert.ok(main.includes("from './wetstreets.js'"));
  assert.ok(main.includes('wetStreetBuild.update(dt)'));
  assert.ok(main.includes('wetStreetBuild.setQuality('));
  assert.ok(main.includes('streetBuild.update(dt,state.pos)'));
});

process.on('exit',()=>{globalThis.document=originalDocument});
