// Chongqing V5 parity: the live controller must actually wire the skylines.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=async file=>(await readFile(new URL('../'+file,import.meta.url),'utf8'));

test('Chongqing main scene wires building lights to UI and T hotkey',async()=>{
 const js=await read('assets/chongqing/chongqing.js');
 const setup=js.match(/const skyline=createChongqingUrbanArchitecture\([\s\S]*?\);[\s\S]{0,90}/)?.[0];
 assert.ok(setup);
 assert.match(setup,/skyline\.setTimeOfDay\(cqTimeSelect\.value\)/);
 assert.match(js,/cqTimeSelect\.addEventListener\('change',[\s\S]*?skyline\.setTimeOfDay\(cqTimeSelect\.value\)/);
 assert.match(js,/e\.code==='KeyT'[\s\S]*?skyline\.setTimeOfDay\(cqTimeSelect\.value\)/);
 assert.match(js,/skyline\.setQuality\(low\?'low':'normal'\)/);
 assert.match(js,/const startupLowGpu=new URLSearchParams\(location\.search\)\.get\('quality'\)==='low'/);
 assert.match(js,/antialias:!startupLowGpu/);
 assert.match(js,/renderer\.setPixelRatio\(1\)/);
});

test('Chongqing browser visual job can finish despite frequent NYC changes',async()=>{
 const yaml=await read('.github/workflows/chongqing-visual.yml');
 assert.match(yaml,/concurrency:[\s\S]*?cancel-in-progress:\s*false/);
 assert.match(yaml,/node scripts\/chongqing-browser-smoke\.mjs/);
 assert.match(yaml,/node scripts\/nyc-road-browser-smoke\.mjs/);
});
