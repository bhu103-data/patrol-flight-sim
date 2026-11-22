// Exact on-screen hotpot forecourt geometry on the existing Chongqing pad.
// node --test tests/chongqing-hotpot-pavers.test.mjs (no browser dependencies).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const content=await readFile(new URL('../assets/chongqing/hotpot-forecourt.js',import.meta.url),'utf8');
const {buildChongqingHotpotPaving}=await import('data:text/javascript;base64,'+
  Buffer.from(content).toString('base64'));
const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
const details=await readFile(new URL('../assets/chongqing/details.js',import.meta.url),'utf8');

class Vector {
  constructor(){this.x=0;this.y=0;this.z=0}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
}
class Object3D {
  constructor(){this.position=new Vector;this.rotation=new Vector;this.scale=new Vector;this.matrix={}}
  updateMatrix(){this.matrix={position:{...this.position},scale:{...this.scale}}}
}
class BoxGeometry{constructor(...args){this.args=args}}
class MeshStandardMaterial{constructor(x){Object.assign(this,x)}}
class Color{constructor(hex){this.hex=hex}}
class InstancedMesh{
  constructor(geometry,material,capacity){
    this.geometry=geometry;this.material=material;this.capacity=capacity;
    this.matrices=[];this.colors=[];
    this.instanceMatrix={setUsage(){},needsUpdate:false};
    this.instanceColor={needsUpdate:false};
  }
  setMatrixAt(i,m){assert.ok(i<this.capacity);this.matrices[i]=structuredClone(m)}
  setColorAt(i,c){assert.ok(i<this.capacity);this.colors[i]=c}
}
const THREE={Object3D,BoxGeometry,MeshStandardMaterial,Color,InstancedMesh,StaticDrawUsage:7};
const originalStone={map:'CC0-concrete-diffuse',normalMap:'CC0-normal',
  roughnessMap:'CC0-ARM',clone(){
    return {...this};
  }};
function fixture(){
  const objects=[],scene={add(mesh){objects.push(mesh)}};
  const res=buildChongqingHotpotPaving({
    THREE,scene,pbr:{stone:originalStone},shopX:285,shopZ:225,shopFloor:44.94
  });
  return {objects,res};
}

test('actual playable shop uses the two existing-CC0-batch paving layers',()=>{
  assert.match(game,/buildChongqingHotpotPaving\(/);
  assert.match(game,/from '\.\/hotpot-forecourt\.js'/);
  assert.match(game,/shopX:hotpot\.x,shopZ:hotpot\.z,shopFloor:shopY/);
  assert.match(details,/put\('paving',sx,sy\+\.36,sz\+31\.3,72,\.7,14\)/);
  const {objects,res}=fixture();
  assert.equal(objects.length,2,'at most 2 new WebGL draws');
  assert.equal(res.drawCalls,2);
  assert.equal(res.stoneCount,92);
  assert.equal(res.drainBarCount,40);
  assert.equal(res.triangleBudget,1584);
  assert.equal(res.tiles.count,92);
  assert.equal(res.grate.count,40);
  assert.equal(res.tiles.material.map,originalStone.map);
  assert.equal(res.tiles.material.normalMap,originalStone.normalMap);
  assert.equal(res.tiles.material.roughnessMap,originalStone.roughnessMap);
});

test('individual stone courses are inset inside the old 72x14 entrance slab',()=>{
  const {res}=fixture();
  assert.equal(res.tiles.matrices.length,res.stoneCount);
  for(const m of res.tiles.matrices){
    assert.ok(m.scale.x>.6&&m.scale.x<4.1);
    assert.ok(m.scale.z>2&&m.scale.z<2.37);
    assert.ok(m.position.x-m.scale.x/2>=249.3);
    assert.ok(m.position.x+m.scale.x/2<=320.7);
    assert.ok(m.position.z-m.scale.z/2>=249.3);
    assert.ok(m.position.z+m.scale.z/2<=263.3);
    assert.ok(m.position.y-m.scale.y/2<44.94+.71);
    assert.ok(m.position.y+m.scale.y/2>44.94+.71);
  }
  for(const m of res.grate.matrices){
    assert.ok(m.position.x-m.scale.x/2>=249.3);
    assert.ok(m.position.x+m.scale.x/2<=320.7);
    assert.ok(m.position.z-m.scale.z/2>=249.3);
    assert.ok(m.position.z+m.scale.z/2<=263.3);
    assert.ok(m.position.y+m.scale.y/2<44.94+.77);
  }
  assert.equal(new Set(res.tiles.colors.map(c=>c.hex)).size,7,
    'weathering must not repeat one flat stone color');
});

test('bounded overlay is not a new ground collider or expensive per-tile draw',()=>{
  const {res,objects}=fixture();
  assert.equal(res.triangleBudget,12*(res.stoneCount+res.drainBarCount));
  assert.ok(res.triangleBudget<1700);
  assert.ok(res.tiles.instanceMatrix.needsUpdate);
  assert.ok(res.tiles.instanceColor.needsUpdate);
  assert.ok(res.grate.instanceMatrix.needsUpdate);
  assert.ok(objects.every(o=>o.geometry instanceof BoxGeometry));
  assert.ok(!content.includes('obstacles.push('));
  assert.ok(!content.includes('ground('));
  assert.match(game,/hotpotForecourtPavers:hotpotPaving\.stoneCount/);
});

test('invalid site coordinates cannot create invisible off-map geometry',()=>{
  assert.throws(()=>buildChongqingHotpotPaving({
    THREE,scene:{add(){}},pbr:{},shopX:NaN,shopZ:225,shopFloor:45
  }),RangeError);
});
