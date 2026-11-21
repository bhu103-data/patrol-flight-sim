// node --test tests/chongqing-visual.test.mjs
// Browser-independent regression smoke tests for procedural materials and night sky.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

async function loadModule(relative){
  const js=await readFile(new URL(relative,import.meta.url),'utf8');
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
class FakeTexture{
  constructor(){this.repeat={set(){}};this.wrapS=null;this.wrapT=null;this.colorSpace=null}
}
class FakeMaterial {
  constructor(options={}){Object.assign(this,options)}
  clone(){return new FakeMaterial(this)}
  dispose(){}
}
class FakeVector {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  copy(p){this.x=p.x;this.y=p.y;this.z=p.z;return this}
}
class FakeGeometry{dispose(){}}
class FakeMesh {
  constructor(geometry,material){this.geometry=geometry;this.material=material;this.position=new FakeVector()}
}
const requests=[];
const three={
  TextureLoader:class{load(url,onLoad){requests.push(url);const texture=new FakeTexture();onLoad?.(texture);return texture}},
  CanvasTexture:FakeTexture,MeshStandardMaterial:FakeMaterial,MeshPhysicalMaterial:FakeMaterial,
  MeshBasicMaterial:FakeMaterial,ShaderMaterial:FakeMaterial,
  Vector2:FakeVector,SphereGeometry:FakeGeometry,Mesh:FakeMesh,
  RepeatWrapping:1000,SRGBColorSpace:3001,DoubleSide:2,BackSide:1
};
const gradient={addColorStop(){}};
const context=new Proxy({createLinearGradient(){return gradient}},{get(target,key){return key in target?target[key]:()=>{}},set(){return true}});
const oldDocument=globalThis.document;
globalThis.document={createElement(){return {width:0,height:0,getContext(){return context}}}};

test('six local photographic surfaces plus two optional CC0 real wood/tile photos',async()=>{
  const {createChongqingPBR}=await loadModule('../assets/chongqing/pbr.js');
  requests.length=0;
  const pbr=createChongqingPBR(three);
  assert.equal(requests.length,8);
  assert.ok(requests.slice(0,6).every(url=>url.startsWith('./assets/nyc/')&&url.endsWith('_1k.jpg')));
  assert.ok(requests.slice(6).every(url=>url.startsWith('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/')));
  assert.equal(pbr.cc0Status.attempted,2);
  assert.equal(pbr.cc0Status.loaded,2);
  assert.equal(pbr.cc0Status.failed,0);
  assert.ok(pbr.wood.map,'CC0 timber has a texture');
  assert.ok(pbr.carvedWood.map,'CC0 carved wood has a texture');
  assert.ok(pbr.curtainWall.map,'curtain-wall façade is textured');
  assert.ok(pbr.hillside.map,'the cliff is not plain concrete');
  assert.ok(pbr.glassPane,'physical single-pane material exists');
  assert.ok(pbr.roof.map,'ceramic roof tiles exist');
});

test('offline photo fallback retains local wooden beams and ceramic roof tiles',async()=>{
  const {createChongqingPBR}=await loadModule('../assets/chongqing/pbr.js');
  const offline={
    ...three,
    TextureLoader:class {
      load(url,loaded,progress,failed) {
        const tex=new FakeTexture();
        if(url.startsWith('https://'))failed?.(new Error('network unreachable'));
        else loaded?.(tex);
        return tex;
      }
    }
  };
  const previous=console.warn;console.warn=()=>{};
  let pbr;
  try{pbr=createChongqingPBR(offline)}finally{console.warn=previous}
  assert.equal(pbr.cc0Status.attempted,2);
  assert.equal(pbr.cc0Status.failed,2);
  assert.equal(pbr.cc0Status.loaded,0);
  assert.ok(pbr.wood.map instanceof FakeTexture);
  assert.ok(pbr.roof.map instanceof FakeTexture);
});

test('sky has humid glow and follows the camera without texture downloads',async()=>{
  const {createChongqingAtmosphere}=await loadModule('../assets/chongqing/atmosphere.js');
  const nodes=[];
  const scene={add(mesh){nodes.push(mesh)},remove(mesh){nodes.splice(nodes.indexOf(mesh),1)}};
  const camera={position:new FakeVector(15,40,-60)};
  const sky=createChongqingAtmosphere(three,scene,camera);
  assert.equal(nodes.length,1);
  assert.equal(nodes[0].material.depthWrite,false);
  assert.equal(nodes[0].material.side,three.BackSide);
  sky.update(.016);
  assert.deepEqual([nodes[0].position.x,nodes[0].position.y,nodes[0].position.z],[15,40,-60]);
  assert.ok(nodes[0].material.fragmentShader.includes('horizon'));
  assert.ok(nodes[0].material.fragmentShader.includes('cloud'));
  camera.position=new FakeVector(22,84,-130);
  sky.update(.04);
  assert.deepEqual([nodes[0].position.x,nodes[0].position.y,nodes[0].position.z],[22,84,-130]);
  sky.dispose();
  assert.equal(nodes.length,0);
});

test('map material bindings and riverfront building placement remain wired',async()=>{
  const source=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  const detail=await readFile(new URL('../assets/chongqing/details.js',import.meta.url),'utf8');
  const landmark=await readFile(new URL('../assets/chongqing/landmarks.js',import.meta.url),'utf8');
  assert.ok(source.includes("from './atmosphere.js'"));
  assert.ok(source.includes('pbr.hillside.clone()'));
  assert.ok(source.includes('cliffX*cliffRamp*86'));
  assert.ok(detail.includes("obstacles.push({x,z,w:7,d:5.25"));
  assert.ok(detail.includes('traditionalRoofGeometry()'));
  assert.ok(detail.includes('curvedRoofs.computeBoundingSphere()'));
  assert.ok(landmark.includes('const sailGlass=(pbr?.curtainWall??glass).clone()'));
  assert.ok(source.includes('landmarkBuild.update(dt)'));
});

process.on('exit',()=>{globalThis.document=oldDocument});
