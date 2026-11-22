// The CC0 candidate is a *real submitted GLB* (not procedural boxes), with
// deterministic source hash and bounded actual model collisions from PR #103.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const moduleSource=readFileSync(new URL('../assets/nyc/nyc-realism.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../assets/nyc/scenario-manifest.json',import.meta.url)));
const glb=readFileSync(new URL('../assets/nyc/scenario/liberty.glb',import.meta.url));
const expected='34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225';
test('actual licensed 15,900 triangle GLB is committed with stable source fingerprint',()=>{
  assert.equal(createHash('sha256').update(glb).digest('hex'),expected);
  assert.equal(glb.toString('ascii',0,4),'glTF');
  assert.equal(glb.readUInt32LE(8),glb.length);
  assert.ok(glb.length<8388608 && glb.length>100000);
  const doc=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
  const tri=doc.accessors[doc.meshes[0].primitives[0].indices].count/3;
  assert.equal(tri,15900,'real noncuboid author mesh; do not substitute a box');
  assert.equal(doc.images.length,1,'existing CC0 atlas stays embedded');
});
test('no default enable, only a named Liberty trial with SHA preflight',()=>{
  assert.equal(manifest.landmarks.liberty.enabled,false);
  assert.equal(manifest.landmarks.liberty.file,'scenario/liberty.glb');
  assert.ok(!manifest.landmarks.liberty.license,'global manifest remains unapproved');
  assert.match(moduleSource,/get\('nycModels'\)==='libertyCC0'/);
  assert.match(moduleSource,/kind==='liberty'/);
  assert.match(moduleSource,/cc0Trial=libertyCC0Trial && kind==='liberty'/);
  assert.match(moduleSource,/spec\.enabled===false && spec\.file==='scenario\/liberty\.glb'/);
  assert.match(moduleSource,/crypto\.subtle\.digest\('SHA-256',bytes\)/);
  assert.ok(moduleSource.includes(expected));
  assert.match(moduleSource,/mesh\.triangleCount!==15900/);
  assert.match(moduleSource,/mesh\.source='scenario'/);
  assert.match(moduleSource,/gl\.deleteBuffer\(buffer\)/);
  assert.match(moduleSource,/keep original collider/i);
});
test('existing real swept collision and other maps remain untouched',()=>{
  assert.match(html,/const libertyScenarioBandRadii = Object\.freeze/);
  assert.match(html,/mesh\.triangleCount===15900/);
  assert.match(html,/libertyScenarioRadialCollision\(x-mark\.x,z-mark\.z,level\)/);
  assert.match(html,/new URLSearchParams\(location\.search\)/);
  assert.match(moduleSource,/get\('nycModels'\)==='legacy'/);
  assert.doesNotMatch(html,/libertyCC0|nycModels=libertyCC0/);
});
