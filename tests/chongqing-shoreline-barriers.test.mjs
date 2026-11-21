import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildChongqingShorelineBarriers} from '../assets/chongqing/shoreline-barriers.js';
import {chongqingTerraceRoads,sampleChongqingTerraceSurface,
  clipChongqingDryRoadSegments} from '../assets/chongqing/road-clearance.js';

const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
const branchCenter=z=>-390+18*Math.sin(z/175);
const riverDist=(x,z)=>Math.min(Math.abs(z-riverCenter(x))-78,
  z<18&&z>-620?Math.abs(x-branchCenter(z))-47:Infinity);
const ground=(x,z)=>riverDist(x,z)<0?-13:Math.max(8,9+riverDist(x,z)*.172);
function endpoints(){
  const ends=[];
  for(const plan of chongqingTerraceRoads(riverCenter)){
    const center=sampleChongqingTerraceSurface(plan,ground,riverCenter);
    const paths=clipChongqingDryRoadSegments(center,plan.width,ground,riverDist);
    for(let i=0;i<paths.length-1;i++){
      const before=paths[i],after=paths[i+1];
      const a=before.at(-1),b=before.at(-2);
      const c=after[0],d=after[1];
      ends.push({point:a,tangent:[a.x-b.x,a.z-b.z],
        width:plan.width,intoRoad:-1});
      ends.push({point:c,tangent:[d.x-c.x,d.z-c.z],
        width:plan.width,intoRoad:1});
    }
  }
  return ends;
}
class Vec{
  constructor(){this.value=[]}
  set(...v){this.value=v}
}
class Object3D{
  constructor(){this.position=new Vec();this.rotation=new Vec();this.scale=new Vec()}
  updateMatrix(){this.matrix={
    p:[...this.position.value],r:[...this.rotation.value],s:[...this.scale.value]
  }}
}
class InstancedMesh{
  constructor(geo,material,capacity){
    this.geometry=geo;this.material=material;this.capacity=capacity;
    this.count=0;this.transforms=[];
    this.instanceMatrix={setUsage(){},needsUpdate:false};
  }
  setMatrixAt(i,m){
    assert.ok(i<this.capacity,'GPU instance limit');
    this.transforms[i]={p:[...m.p],r:[...m.r],s:[...m.s]};
  }
  computeBoundingSphere(){}
}
class Material{constructor(v){Object.assign(this,v)}}
const THREE={
  BoxGeometry:class {},CylinderGeometry:class {},
  MeshStandardMaterial:Material,Object3D,InstancedMesh,StaticDrawUsage:1
};
test('three unbridged tributary roads produce exactly six bounded steel end guards',()=>{
  const ends=endpoints(),meshes=[],scene={add(mesh){meshes.push(mesh)}};
  assert.equal(ends.length,6,'three roads each terminate on both banks');
  const stats=buildChongqingShorelineBarriers({THREE,scene,ends});
  assert.deepEqual(stats,{barriers:6,posts:30,rails:12,reflectors:30,skippedInvalid:0});
  assert.equal(meshes.length,4,'posts, rails and two reflector hues are four instanced batches');
  assert.deepEqual(meshes.map(m=>m.count).sort((a,b)=>a-b),[12,12,18,30]);
  for(const mesh of meshes){
    assert.ok(mesh.count<=mesh.capacity);
    assert.equal(mesh.transforms.length,mesh.count);
    assert.ok(mesh.instanceMatrix.needsUpdate);
    for(const t of mesh.transforms)
      assert.ok([...t.p,...t.r,...t.s].every(Number.isFinite));
  }
  const rails=meshes.find(m=>m.capacity===ends.length*2);
  assert.ok(rails);
  for(const t of rails.transforms){
    assert.ok(riverDist(t.p[0],t.p[2])>0,
      'landside barrier cannot be placed over the tributary');
    assert.ok(t.s[0]>=10&&t.s[0]<15,'rail spans the real road width');
  }
});
test('invalid ends are rejected without allocating a gratuitous scene batch',()=>{
  const meshes=[],scene={add(x){meshes.push(x)}};
  const stats=buildChongqingShorelineBarriers({THREE,scene,
    ends:[null,{point:{x:0,y:2,z:0},tangent:[0,0],width:12,intoRoad:1}]});
  assert.equal(stats.barriers,0);
  assert.equal(stats.skippedInvalid,2);
  assert.equal(meshes.length,0);
});
test('main Chongqing map actually installs dry-end guards after tributary clipping',()=>{
  const game=readFileSync(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  assert.match(game,/from '\.\/shoreline-barriers\.js'/);
  assert.match(game,/const dryRoads=clipChongqingDryRoadSegments/);
  assert.match(game,/shorelineRoadEnds\.push/);
  assert.match(game,/buildChongqingShorelineBarriers\(\{/);
});
