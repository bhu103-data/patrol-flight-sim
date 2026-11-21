import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const moduleSource=fs.readFileSync(path.join(root,'assets/chongqing/hongyadong-street.js'),'utf8');
const sceneSource=fs.readFileSync(path.join(root,'assets/chongqing/chongqing.js'),'utf8');

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
