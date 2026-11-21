// node --test tests/chongqing-vegetation.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const main=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
const a=main.indexOf('// Irregular subtropical street trees.');
const terminator='scene.add(trees,stems,branches);';
const b=main.indexOf(terminator,a);
assert.ok(a>=0&&b>a,'modern tree module is present');
const block=main.slice(a,b+terminator.length);

class Vec {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  copy(v){return this.set(v.x,v.y,v.z)}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  subVectors(a,b){return this.set(a.x-b.x,a.y-b.y,a.z-b.z)}
  clone(){return new Vec(this.x,this.y,this.z)}
  length(){return Math.hypot(this.x,this.y,this.z)}
  multiplyScalar(x){this.x*=x;this.y*=x;this.z*=x;return this}
  normalize(){return this.multiplyScalar(1/(this.length()||1))}
}
class Dummy {
  constructor(){
    this.position=new Vec;this.scale=new Vec;
    this.rotation={set(){}};this.quaternion={setFromUnitVectors(){}};
    this.matrix={};
  }
  updateMatrix(){}
}
class Instance {
  constructor(g,m,capacity){
    this.capacity=capacity;this.count=0;
    this.instanceMatrix={setUsage(){},needsUpdate:false};
    this.visible=true;this.written=0;
  }
  setMatrixAt(i){
    assert.ok(i<this.capacity,'GPU tree buffer overflow');
    this.written++;
  }
  setColorAt(i){assert.ok(i<this.capacity)}
  computeBoundingSphere(){}
}
class Color {setHSL(){}}
const T={
  MeshStandardMaterial:class {constructor(params){Object.assign(this,params)}},
  IcosahedronGeometry:class {},CylinderGeometry:class {},
  Vector3:Vec,InstancedMesh:Instance,Color,
  StaticDrawUsage:1,FrontSide:0
};
function setup(seed=9862){
  let n=seed;
  const rand=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
  const sceneItems=[],scene={add(...args){sceneItems.push(...args)}};
  const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
  const riverDist=(x,z)=>Math.abs(z-riverCenter(x))-78;
  const ground=(x,z)=>Math.max(8,13+Math.abs(z)*.10);
  const obstacles=[{x:285,z:225,w:72,d:50},{x:155,z:145,w:128,d:26}];
  const run=new Function('THREE','rand','dummy','ground','riverDist','riverCenter','obstacles','scene','TAU',
    block+';return {treeCount,leafCount,branchCount,trees,stems,branches};');
  return {...run(T,rand,new Dummy(),ground,riverDist,riverCenter,obstacles,scene,Math.PI*2),sceneItems};
}
test('urban foliage is no longer repeated cone geometry',()=>{
  assert.equal(main.includes('new THREE.ConeGeometry(1,2.7,6)'),false);
  assert.ok(main.includes('new THREE.IcosahedronGeometry(1,2)'));
});
test('three organic foliage lobes and two branches per tree fit GPU buffer',()=>{
  const result=setup();
  assert.ok(result.treeCount>50);
  assert.equal(result.leafCount,result.treeCount*3);
  assert.equal(result.branchCount,result.treeCount*2);
  assert.ok(result.sceneItems.length===3);
  for(const object of result.sceneItems){
    assert.ok(object.count<=object.capacity);
    assert.ok(object.written<=object.capacity);
    assert.ok(object.instanceMatrix.needsUpdate);
  }
});
test('foliage placement is seeded and deterministic',()=>{
  const a=setup(120),b=setup(120);
  assert.deepEqual([a.treeCount,a.leafCount,a.branchCount],
                   [b.treeCount,b.leafCount,b.branchCount]);
});
test('shadows are localized and disabled in battery saver',()=>{
  assert.ok(main.includes('renderer.shadowMap.type=THREE.PCFSoftShadowMap'));
  assert.ok(main.includes('renderer.shadowMap.enabled=!low'));
  assert.ok(main.includes("trees.castShadow=qualityMode==='high'"));
  assert.ok(main.includes('moon.shadow.camera.left=-145'));
});
