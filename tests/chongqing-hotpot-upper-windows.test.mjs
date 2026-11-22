// Check the real isolated Three.js geometry generator without WebGL/CDN.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(
  new URL('../assets/chongqing/hotpot-upper-windows.js',import.meta.url),'utf8');
const game=await readFile(
  new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
const {buildChongqingHotpotUpperWindows}=await import(
  'data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Vector3{
  constructor(){this.x=0;this.y=0;this.z=0}
  set(x,y,z){this.x=x;this.y=y;this.z=z}
}
class Object3D{
  constructor(){
    this.position=new Vector3;this.rotation=new Vector3;
    this.scale=new Vector3;this.matrix={};
  }
  updateMatrix(){this.matrix={
    position:{...this.position},scale:{...this.scale}
  }}
}
class BoxGeometry{constructor(...args){this.args=args}}
class Material{
  constructor(o={}){Object.assign(this,o);this.color={setHex(c){this.value=c}}}
  clone(){return new Material({...this})}
}
class Color{constructor(hex){this.hex=hex}}
class InstancedMesh{
  constructor(geo,material,capacity){
    this.geometry=geo;this.material=material;
    this.capacity=capacity;this.count=0;this.matrices=[];this.colors=[];
    this.instanceMatrix={setUsage(){},needsUpdate:false};
    this.instanceColor={needsUpdate:false};
  }
  setMatrixAt(i,m){
    assert.ok(i>=0&&i<this.capacity);
    this.matrices[i]=structuredClone(m);
  }
  setColorAt(i,c){this.colors[i]=c.hex}
}
const THREE={Vector3,Object3D,BoxGeometry,MeshStandardMaterial:Material,
  InstancedMesh,Color,StaticDrawUsage:1,DoubleSide:2};
const carvedWood=new Material({map:'licensed wood texture',bumpMap:'wood height'});
const glassPane=new Material({metalness:.39,roughness:.26});
function build(){
  const objects=[],scene={add(mesh){objects.push(mesh)}};
  const result=buildChongqingHotpotUpperWindows({
    THREE,scene,pbr:{glassPane,carvedWood},
    shopX:285,shopZ:225,shopFloor:44.94
  });
  return {objects,result};
}
test('production old seven-bay frontage remains in place under overlay',()=>{
  assert.match(game,/import \{ buildChongqingHotpotUpperWindows \}/);
  assert.match(game,/buildChongqingHotpotUpperWindows\(\{/);
  assert.match(game,/shopX:hotpot\.x,shopZ:hotpot\.z,shopFloor:shopY/);
  assert.match(game,/const hotpotDoor=\{x:hotpot\.x,z:hotpot\.z\+34,y:shopY\+2\.7\}/);
  assert.match(game,/hotpotLowerFacade=buildChongqingHotpotLowerFacade/);
  assert.match(game,/hotpotPaving=buildChongqingHotpotPaving/);
  assert.match(game,/hotpotUpperWindowBays:hotpotUpperWindows\.bays/);
});
test('3 batches, 7 glass windows, varied joinery and small triangle budget',()=>{
  const {objects,result}=build();
  assert.equal(objects.length,3);
  assert.equal(result.bays,7);
  assert.equal(result.glassCount,7);
  assert.equal(result.frameCount,59);
  assert.equal(result.drawCalls,3);
  assert.equal(result.triangles,876);
  assert.ok(result.depth>.6&&result.depth<.9);
  assert.equal(result.backMesh.count,7);
  assert.equal(result.glassMesh.count,7);
  assert.equal(result.frameMesh.count,59);
  assert.ok(objects.every(m=>m.instanceMatrix.needsUpdate&&
    m.instanceColor.needsUpdate&&!m.castShadow));
  assert.equal(result.frameMesh.material.map,carvedWood.map);
  assert.equal(result.glassMesh.material.metalness,glassPane.metalness);
  assert.notEqual(result.frameMesh.material,carvedWood);
  assert.equal(result.maxY<16,true);
});
test('physical glass is recessed behind projecting timber frames, in shop bounds',()=>{
  const {result}=build();
  for(const m of [result.backMesh,result.glassMesh,result.frameMesh])
    for(const b of m.matrices){
      const {x,y,z}=b.position,{x:wx,y:hy,z:dz}=b.scale;
      assert.ok(x-wx/2>=249.4&&x+wx/2<=320.51);
      assert.ok(y-hy/2>=44.94+8.3&&y+hy/2<=44.94+16);
      assert.ok(z-dz/2>=225+26.5&&z+dz/2<=225+27.55);
    }
  const backMax=Math.max(...result.backMesh.matrices
    .map(m=>m.position.z+m.scale.z/2));
  const paneMax=Math.max(...result.glassMesh.matrices
    .map(m=>m.position.z+m.scale.z/2));
  const frameMax=Math.max(...result.frameMesh.matrices
    .map(m=>m.position.z+m.scale.z/2));
  assert.ok(frameMax>paneMax+.35);
  assert.ok(paneMax>backMax+.10);
  assert.ok(result.maxX<=285+35.5&&result.minX>=285-35.5);
  assert.ok(result.bayWidths[6]<result.bayWidths[0],
    'Return bay must not overhang the existing shop right wall');
});
test('nonuniform fenestration visible in actual deterministic mullion patterns',()=>{
  const {result}=build();
  assert.deepEqual(result.styles.map(x=>x.mullions),[1,2,3,1,2,3,1]);
  assert.deepEqual(result.styles.filter(x=>x.blinds).map(x=>x.bay),[1,5]);
  assert.ok(new Set(result.styles.map(x=>x.height)).size===7);
  assert.equal(new Set(result.glassMesh.colors).size,7);
  assert.ok(result.triangles<1000);
  assert.doesNotMatch(source,/obstacles\.push\(|new THREE\.TextureLoader\(/);
  assert.throws(()=>buildChongqingHotpotUpperWindows({
    THREE,scene:{add(){}},pbr:{glassPane,carvedWood},
    shopX:NaN,shopZ:225,shopFloor:45
  }),RangeError);
});
