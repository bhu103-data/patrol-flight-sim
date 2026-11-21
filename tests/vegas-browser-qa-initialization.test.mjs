// Prevent a Playwright smoke script from referencing evidence arrays before
// they are declared. No browser or GPU is needed for this startup guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Vegas browser QA initializes its evidence buffers before listeners',async()=>{
 const src=await readFile(new URL('../scripts/vegas-core-browser-smoke.mjs',import.meta.url),'utf8');
 const declaration=src.indexOf('const errors=[],screenshots=[],shots=[],startupSnapshots=[];');
 const listener=src.indexOf("page.on('pageerror'");
 const report=src.indexOf("let result={status:'failed'");
 assert.ok(declaration>=0,'all four evidence arrays must be declared');
 assert.ok(listener>declaration,'listeners may only use initialized arrays');
 assert.ok(report>declaration,'initial report may only use initialized arrays');
 assert.match(src,/errors\.push\(e\.message\)/);
 assert.match(src,/status:'passed',qaTag/);
});
