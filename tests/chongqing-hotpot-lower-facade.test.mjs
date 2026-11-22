// Live source wiring + independently executed original instanced PBR facade.
// No CDN, WebGL or external model download is required for these unit checks.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../assets/chongqing/hotpot-lower-facade.js',import.meta.url),'utf8');
const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
const {buildChongqingHotpotLowerFacade}=await import(
  'data:text/javascript;base64,'+Buffer.from(code).toString('base64')
);
class Vector{
  constructor(){this.x=0;this.y=0;this.z=0}
  set(x,y,z){this.x=x;this.y=y;this.z=z}
}
class Object3D{
  constructor(){
    this.position=new Vector;this.rotation=new Vector;this.scale=new Vector;this.matrix={};
  }
  updateMatrix(){
    this.matrix={position:{...this.position},scale:{...this.scale}};
  }
}
class BoxGeometry{constructor(...args){this.args=args}}
class Material{
  constructor(props={}){Object.assign(this,props);this.color={setHex(c){this.value=c}}}
  clone(){return new Material({...this})}
}
class Color{constructor(value){this.value=value}}
class InstancedMesh{
  constructor(geom,material,capacity){
    this.geometry=geom;this.material=material;this.capacity=capacity;this.count=0;
    this.matrices=[];this.colors=[];
    this.instanceMatrix={setUsage(){},needsUpdate:false};
    this.instanceColor={needsUpdate:false};
  }
  setMatrixAt(i,m){assert.ok(i<this.capacity);this.matrices[i]=structuredClone(m)}
  setColorAt(i,c){assert.ok(i<this.capacity);this.colors[i]=c.value}
}
const THREE={
  Object3D,BoxGeometry,MeshStandardMaterial:Material,Color,InstancedMesh,StaticDrawUsage:1
};
const cutStone=new Material({map:'existing-cut-stone-PBR',bumpMap:'tile-bump'});
const carvedWood=new Material({map:'existing-wood-PBR',normalMap:'wood-normal'});
function create(){
  const rendered=[],scene={add(x){rendered.push(x)}};
  const output=buildChongqingHotpotLowerFacade({
    THREE,scene,pbr:{cutStone,carvedWood},
    shopX:285,shopZ:225,shopFloor:44.94
  });
  return {rendered,output};
}
test('production hotpot shop integrates only a bounded ground-floor facade',()=>{
  assert.match(game,/from '\.\/hotpot-lower-facade\.js'/);
  assert.match(game,/buildChongqingHotpotLowerFacade\(\{/);
  assert.match(game,/shopX:hotpot\.x,shopZ:hotpot\.z,shopFloor:shopY/);
  assert.match(game,/hotpotLowerStoneParts:hotpotLowerFacade\.masonryCount/);
  assert.match(game,/hotpotLowerTimberParts:hotpotLowerFacade\.timberCount/);
  assert.match(game,/hotpotLowerFacadeTriangles:hotpotLowerFacade\.totalTriangles/);
});
test('batched stone plinth and wood panels reuse original physical PBR maps',()=>{
  const {rendered,output}=create();
  assert.equal(rendered.length,2);
  assert.equal(output.masonryCount,32);
  assert.equal(output.timberCount,72);
  assert.equal(output.drawCalls,2);
  assert.equal(output.totalTriangles,1248);
  assert.equal(output.masonry.material.map,cutStone.map);
  assert.equal(output.timber.material.map,carvedWood.map);
  assert.equal(output.timber.material.normalMap,carvedWood.normalMap);
  assert.equal(output.masonry.count,32);
  assert.equal(output.timber.count,72);
  assert.ok(rendered.every(x=>x.instanceMatrix.needsUpdate&&x.instanceColor.needsUpdate));
  assert.ok(!rendered.some(x=>x.castShadow));
});
test('original shop windows, timber posts, sidewalk and collision remain unobscured',()=>{
  const {output}=create();
  assert.ok(output.topY-44.94<8.55,'cladding below the original floor+9 window start');
  assert.ok(output.totalTriangles<=1500,'facade detail budget');
  for(const mesh of [output.masonry,output.timber])for(const p of mesh.matrices){
    const x=p.position.x, y=p.position.y,z=p.position.z;
    assert.ok(x-p.scale.x*.5>=285-35.5 && x+p.scale.x*.5<=285+35.5);
    assert.ok(z-p.scale.z*.5>=225+26.15 && z+p.scale.z*.5<=225+26.65);
    assert.ok(y-p.scale.y*.5>=44.94+.72);
    assert.ok(y+p.scale.y*.5<44.94+9);
  }
  assert.ok(new Set(output.timber.colors).size>=5);
  assert.ok(new Set(output.masonry.colors).size>=4);
  assert.doesNotMatch(code,/obstacles\.push\(|new THREE\.TextureLoader\(/);
  assert.match(game,/const hotpotDoor=\{x:hotpot\.x,z:hotpot\.z\+34,y:shopY\+2\.7\}/);
  assert.match(game,/hotpotPaving=buildChongqingHotpotPaving\(/);
});
test('nonfinite coordinates do not create off-map wall batches',()=>{
  assert.throws(()=>buildChongqingHotpotLowerFacade({
    THREE,scene:{add(){}},pbr:{cutStone,carvedWood},
    shopX:Infinity,shopZ:225,shopFloor:45
  }),RangeError);
});
