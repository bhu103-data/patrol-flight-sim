// node --test tests/nyc-texture-assets.test.mjs
// Keep the pre-existing CC0 photo/PBR texture pack complete and bounded.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(
  new URL('../assets/nyc/nyc-realism.js',import.meta.url),'utf8');
const match=source.match(/async function photos\(gl\)\{[\s\S]*?const names=\[([\s\S]*?)\];/);
assert.ok(match,'NYC photo asset manifest exists');
const names=[...match[1].matchAll(/'([^']+\.jpg)'/g)].map(item=>item[1]);

test('existing NYC PBR atlas has all seven distinct files',()=>{
  assert.equal(names.length,7);
  assert.equal(new Set(names).size,7);
  assert.ok(names.some(name=>name.includes('wall_008_diff')));
  assert.ok(names.some(name=>name.includes('wall_008_nor')));
  assert.ok(names.some(name=>name.includes('wall_008_arm')));
});
test('NYC textures are real, reasonably sized JPEGs',async()=>{
  for(const name of names){
    const buffer=await readFile(new URL('../assets/nyc/'+name,import.meta.url));
    assert.ok(buffer.length>1024,'texture must not be empty: '+name);
    assert.ok(buffer.length<1_500_000,'texture exceeds asset budget: '+name);
    assert.equal(buffer[0],0xff,'JPEG signature missing: '+name);
    assert.equal(buffer[1],0xd8,'JPEG signature missing: '+name);
  }
});

const viewer=await readFile(
  new URL('../assets/nyc/nyc-true-scale-flight.html',import.meta.url),'utf8');
test('true-scale viewer uses the local CC0 PBR atlas with a controlled rollback',()=>{
  assert.match(source,/export async function loadNycPbrTextures/);
  assert.match(source,/new URL\(filename,import\.meta\.url\)/);
  assert.match(viewer,/loadNycPbrTextures/);
  for(const name of ['uWallDiffuse','uWallNormal','uWallARM',
    'uAsphaltDiffuse','uAsphaltNormal','uAsphaltARM','uConcreteDiffuse'])
    assert.ok(viewer.includes(name),'missing PBR sampler '+name);
  assert.match(viewer,/params\.get\('pbr'\)==='off'/);
});
