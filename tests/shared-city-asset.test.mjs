import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const file = new URL('../assets/shared/kenney-traffic-light-blender.glb', import.meta.url);

test('shared Kenney traffic light is a bounded GLB candidate', async () => {
  const bytes = await readFile(file);
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.ok(bytes.length < 8 * 1024 * 1024);
  const jsonLength = bytes.readUInt32LE(12);
  const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
  assert.equal(doc.asset.version, '2.0');
  assert.equal(doc.meshes.length, 1);
  assert.equal(doc.nodes.length, 1);
  const indexed = doc.meshes[0].primitives[0].indices;
  assert.equal(doc.accessors[indexed].count / 3, 212);
  assert.equal(doc.images[0].mimeType, 'image/png');
  assert.equal(doc.images[0].uri, undefined);
  const min = doc.accessors[doc.meshes[0].primitives[0].attributes.POSITION].min;
  assert.ok(Math.abs(min[0] + 0.423258) < 1e-5 && Math.abs(min[1]) < 1e-5 && Math.abs(min[2] + 0.26235) < 1e-5);
});
