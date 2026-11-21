// node --test tests/nyc-street-canopies.test.mjs
// Ensure the NYC road batch passes real triangle geometry through to carts.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('hot-dog canopy uses actual triangular mesh faces',async()=>{
  const streets=await readFile(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
  const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(streets,/addQuad,\s*addTri,\s*box,\s*beam/);
  assert.match(page,/buildNycStreetNetwork\(\{\s*addQuad:detail\.addQuad,addTri:detail\.addTri,/);
  assert.match(streets,/addTri\(rim\(a\),rim\(b\),canopyTop,/);
  assert.doesNotMatch(streets,/addQuad\(rim\(a\),rim\(b\),\[x,y\+3\.57,z\],canopyTop,/);
});
