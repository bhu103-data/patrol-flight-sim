import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeDumbo2014GLB} from '../assets/nyc/dumbo-bk02-glb-loader.mjs';

test('imports the bounded official 2014 BK02 source mesh as GLB 2.0',()=>{
  const bytes=readFileSync('assets/nyc/dumbo-bk02-2014-source.glb');
  const arrayBuffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const result=decodeDumbo2014GLB(arrayBuffer);
  assert.equal(result.stats.sourceVintage,2014);
  assert.equal(result.stats.triangles,8541);
  assert.equal(result.stats.visibleTriangles,7475);
  assert.equal(result.stats.vertexCount,22425);
  assert.equal(result.stats.counts.facade.patches,2093);
  assert.equal(result.stats.counts.facade.triangles,5085);
  assert.equal(result.stats.counts.roof.patches,314);
  assert.equal(result.stats.counts.roof.triangles,2390);
  assert.equal(result.stats.counts.footprint.patches,82);
  assert.equal(result.stats.counts.footprint.triangles,1066);
  assert.equal(result.stats.verticalDatumVerified,false);
  assert.equal(result.stats.diagnosticOffsetApplied,false);
  assert.ok(bytes.length<1_000_000);
  assert.throws(()=>decodeDumbo2014GLB(arrayBuffer.slice(0,64)),/GLB|chunk|header/i);
});
