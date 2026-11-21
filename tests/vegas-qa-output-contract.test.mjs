// Regression for the integrated two-server Vegas capture contract.
// This tests the real script's output-directory initializer without launching
// Chromium, and keeps the production mountain/aircraft behavior untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const src=await readFile(new URL('../scripts/vegas-core-browser-smoke.mjs',import.meta.url),'utf8');
const compare=await readFile(new URL('../scripts/vegas-compare-qa.mjs',import.meta.url),'utf8');
const start=src.indexOf('const qaTag=');
const end=src.indexOf(';await mkdir(output,',start);
assert.ok(start>=0&&end>start,'Vegas capture must define a tagged output initializer');
const prelude=src.slice(start,end);
const initialize=new Function('process',prelude+';return {qaTag,output};');

test('candidate and baseline reports stay in separate directories',()=>{
  assert.deepEqual(initialize({env:{PATROL_QA_TAG:'candidate'}}),{
    qaTag:'candidate',output:'artifacts/vegas/candidate'
  });
  assert.deepEqual(initialize({env:{PATROL_QA_TAG:'baseline-6d50bfd'}}),{
    qaTag:'baseline-6d50bfd',output:'artifacts/vegas/baseline-6d50bfd'
  });
  assert.equal(initialize({env:{}}).output,'artifacts/vegas/candidate');
  assert.match(compare,/read\('candidate'\)/);
  assert.match(compare,/read\('baseline-6d50bfd'\)/);
});

test('tagged captures reject paths outside their artifacts directory',()=>{
  for(const tag of ['../escape','a/b','a\\b','', ' '.repeat(2),'x'.repeat(49)])
    if(tag)assert.throws(()=>initialize({env:{PATROL_QA_TAG:tag}}),/Invalid PATROL_QA_TAG/);
  assert.match(src,/qaTag,loadMs/,'passed JSON retains the identifying tag');
  assert.match(src,/status:'failed',qaTag/,'failed JSON retains the identifying tag');
  assert.match(src,/triangles:234/,'retain the integrated 234-triangle visual pilot budget');
});
