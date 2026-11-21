import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const moduleSource=fs.readFileSync(path.join(root,'assets/chongqing/hongyadong-street.js'),'utf8');
const sceneSource=fs.readFileSync(path.join(root,'assets/chongqing/chongqing.js'),'utf8');

test('walkway strip without explicit height has finite production vertices',()=>{
  const helpers=moduleSource.slice(moduleSource.indexOf('function makeRibbon('),moduleSource.indexOf('export function buildHongyadongStreetPrototype'));
  class Geometry {
    setAttribute(name,value){this[name]=value;}
    setIndex(){}
    computeVertexNormals(){}
  }
  const THREE={BufferGeometry:Geometry,
    Float32BufferAttribute:class {constructor(values){this.array=new Float32Array(values);}},
    Mesh:class {constructor(geometry){this.geometry=geometry;}}
  };
  const strip=vm.runInNewContext(helpers+';addBoxStrip',{THREE});
  const mesh=strip(THREE,{add(){}},{},[{x:96,y:11.6,z:66},{x:101,y:11.6,z:67}],12);
  assert.ok(mesh.geometry.position.array.every(Number.isFinite));
  assert.equal(mesh.geometry.position.array.length,12);
});

test('Hongyadong prototype is a localized reversible surface layer',()=>{
  assert.match(moduleSource,/HONGYADONG_STREET_SEGMENT/);
  assert.match(moduleSource,/临江步道/);
  assert.match(moduleSource,/wetAsphalt/);
  assert.match(moduleSource,/drains/);
  assert.match(moduleSource,/setQuality/);
  assert.match(moduleSource,/getDebug/);
  assert.doesNotMatch(moduleSource,/scenario|google|mapbox/i);
});

test('prototype reuses local PBR materials and is wired into quality fallback',()=>{
  assert.match(moduleSource,/pbr\.asphalt/);
  assert.match(moduleSource,/pbr\.stone/);
  assert.match(moduleSource,/pbr\.concrete/);
  assert.match(sceneSource,/buildHongyadongStreetPrototype/);
  assert.match(sceneSource,/hongyadongStreetBuild\.setQuality/);
  assert.match(sceneSource,/getChongqingStreetDebug/);
});
