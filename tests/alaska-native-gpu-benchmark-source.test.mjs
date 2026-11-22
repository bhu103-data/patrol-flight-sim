import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const rel='tools/alaska/native-gpu-benchmark.mjs';
test('hardware GPU benchmark script parses on supported Node',()=>{
  assert.doesNotThrow(()=>execFileSync(process.execPath,['--check',rel],{
    cwd:root,encoding:'utf8'}));
});
test('hardware benchmark refuses SwiftShader flags and prevents fake certification',()=>{
  const source=readFileSync(resolve(root,rel),'utf8');
  assert.match(source,/headless:false/);
  assert.match(source,/classifyHardwareRenderer\(renderer\)/);
  assert.match(source,/assessNativeGpuRuns\(record\.runs,budgets\)/);
  assert.match(source,/status:'BLOCKED'/);
  for(const banned of ['--use-angle=swiftshader','--enable-unsafe-swiftshader',
    '--disable-gpu','--use-gl=swiftshader'])
    assert.equal(source.includes(banned),false,banned);
});
test('native benchmark compares independent exact-source baseline with candidate',()=>{
  const source=readFileSync(resolve(root,rel),'utf8');
  assert.match(source,/bc155141742811bca3c4b1988672b238bd50a98b/);
  assert.match(source,/git\('show',baselineSha\+'\:assets\/alaska\/alaska-fjord-detail\.js'\)/);
  assert.match(source,/\['baseline','updated','updated','baseline'\]/);
  assert.match(source,/moduleFetches\.length!==1/);
});

test('native benchmark measures only focused foreground Edge without throttle bypass',()=>{
  const source=readFileSync(resolve(root,rel),'utf8');
  assert.match(source,/await page\.bringToFront\(\)/);
  assert.match(source,/document\.hasFocus\(\)/);
  assert.match(source,/!health\.focused/);
  assert.equal(source.includes('--disable-background-timer-throttling'),false);
  assert.equal(source.includes('--disable-renderer-backgrounding'),false);
});
