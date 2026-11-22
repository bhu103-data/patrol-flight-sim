import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const qa=readFileSync(new URL('../tools/alaska/compare_dem_normals.mjs',import.meta.url),'utf8');
const shipping=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('DEM comparison freezes only disposable browser copies, not shipping shaders',()=>{
  assert.match(qa,/gl\.uniform1f\(uWorld\.time, window\.__patrolDemFrozenTime \?\? time\)/);
  assert.match(qa,/gl\.uniform1f\(uMesh\.sceneTime, window\.__patrolDemFrozenTime \?\? sceneryTime\)/);
  assert.match(qa,/html\.split\(original\)\.length!==2/);
  assert.ok(!shipping.includes('__patrolDemFrozenTime'));
  assert.ok(qa.indexOf('qaDocument(')>0);
});

test('DEM baseline and updated screenshots use the same static phase after live pacing',()=>{
  const sample=qa.indexOf('const timing=await framePacing(page,24)');
  const freeze=qa.indexOf('window.__patrolDemFrozenTime=42');
  const screenshot=qa.indexOf('await page.screenshot(');
  assert.ok(sample>0&&freeze>sample&&screenshot>freeze);
  assert.match(qa,/window\.__patrolDemFrozenTime=null/);
  assert.match(qa,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(ok\)\)/);
  assert.match(qa,/b\.frozenShaderTime!==42\|\|n\.frozenShaderTime!==42/);
});
