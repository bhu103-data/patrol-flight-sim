import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const binary=await readFile(new URL('assets/nyc/scenario/liberty-3dystopia-1k.glb',root));
const provenance=JSON.parse(await readFile(new URL(
  'assets/nyc/scenario/liberty-3dystopia-1k-provenance.json',root)));
const manifest=JSON.parse(await readFile(new URL('assets/nyc/scenario-manifest.json',root)));

function gltfFromGlb(bytes){
  assert.equal(bytes.toString('ascii',0,4),'glTF');
  assert.equal(bytes.readUInt32LE(4),2);
  const jsonLength=bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
}

test('3Dystopia Liberty GLB is imported, licensed, embedded-textured and budgeted',()=>{
  const gltf=gltfFromGlb(binary);
  let triangles=0;
  for(const mesh of gltf.meshes||[]){
    for(const primitive of mesh.primitives||[]){
      const accessor=gltf.accessors[primitive.indices ?? primitive.attributes.POSITION];
      triangles+=accessor.count/3;
    }
  }
  assert.equal(triangles,19776);
  assert.ok(binary.length<8388608);
  assert.equal(gltf.images.length,3);
  assert.deepEqual(gltf.extensionsRequired||[],[]);
  assert.equal(manifest.landmarks.liberty.enabled,true);
  assert.equal(manifest.landmarks.liberty.file,'scenario/liberty-3dystopia-1k.glb');
  assert.match(manifest.landmarks.liberty.license,/CC BY 4\.0/);
  assert.equal(provenance.author,'3Dystopia (@Dystopia)');
  assert.equal(provenance.license,'CC BY 4.0');
  assert.equal(provenance.review_status,'enabled-for-review-branch');
});
