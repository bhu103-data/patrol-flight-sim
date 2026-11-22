// Source regression for QA-only matched-time Alaska material A/B PNGs.
// Runtime index.html and the real game are intentionally not modified.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const qa=readFileSync(new URL('../tools/alaska/compare_realtime_material.mjs',import.meta.url),'utf8');
const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('shader time is patched only into separately generated QA copies',()=>{
  assert.match(qa,/qaDocument\('alaska-material-base\.html','alaska-material-base-qa\.html'\)/);
  assert.match(qa,/qaDocument\('index\.html','alaska-material-head-qa\.html'\)/);
  assert.match(qa,/html\.split\(original\)\.length!==2/);
  for(const source of ['gl.uniform1f(uWorld.time, time);',
                       'gl.uniform1f(uMesh.sceneTime,sceneryTime);']){
    assert.equal(game.split(source).length-1,1,
      'QA replacement must match exactly one real shader uniform call');
  }
  assert.match(qa,/window\.__patrolMaterialFrozenTime \?\? time/);
  assert.match(qa,/window\.__patrolMaterialFrozenTime \?\? sceneryTime/);
  assert.doesNotMatch(game,/__patrolMaterialFrozenTime/,
    'time freezing must never ship in the playable game');
});

test('live RAF interval sampling precedes matched-time visual snapshots',()=>{
  const scene=qa.indexOf('const timing=await framePacing(page,24);');
  const frozen=qa.indexOf('window.__patrolMaterialFrozenTime=42;');
  const png=qa.indexOf('await page.screenshot({path:');
  assert.ok(scene>0&&frozen>scene&&png>frozen,
    'live performance measurement must finish before static PNG time lock');
  assert.match(qa,/window\.__patrolMaterialFrozenTime=null; \/\/ keep RAF performance samples live/);
  assert.match(qa,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(ok\)\)/);
  assert.match(qa,/frozenShaderTime:42/);
  assert.match(qa,/b\.frozenShaderTime!==42\|\|n\.frozenShaderTime!==42/);
});
