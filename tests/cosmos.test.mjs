import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const get=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('cosmos JS source parses',()=>{
  const source=get('assets/cosmos/cosmos.js').replace(/^import .*;\s*$/gm,'');
  assert.doesNotThrow(()=>new Script(source));
});
test('all maps link to the orbit portal',()=>{
  const portal=get('assets/cosmos/portal.js');
  for(const map of ['manhattan','dc','vegas','alaska','coast','valley','chongqing'])
    assert.ok(portal.includes("'"+map+"'"));
  assert.match(get('index.html'),/assets\/cosmos\/portal\.js/);
  assert.match(get('chongqing.html'),/assets\/cosmos\/portal\.js/);
});
test('flight restoration validates finite coordinates',()=>{
  assert.match(get('index.html'),/save\.position\.every\(Number\.isFinite\)/);
  assert.match(get('assets/chongqing/chongqing.js'),/saved\.position\.every\(Number\.isFinite\)/);
});
test('J2000 sky catalog and fallback remain available',()=>{
  const scene=get('assets/cosmos/cosmos.js');
  assert.match(scene,/sky\/stars\.bin/);
  assert.match(scene,/buffer\.byteLength%24!==0/);
  assert.match(scene,/equatorialDirection\(270,66\.5607\)/);
  assert.match(scene,/Star catalog fallback/);
});

test('main flight and Chongqing engine JavaScript parse',()=>{
  const html=get('index.html');
  const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(inline && inline[1].length>1000,'main flight script must exist');
  assert.doesNotThrow(()=>new Script(inline[1]));
  const chongqing=get('assets/chongqing/chongqing.js').replace(/^import .*;\s*$/gm,'');
  assert.doesNotThrow(()=>new Script(chongqing));
});
