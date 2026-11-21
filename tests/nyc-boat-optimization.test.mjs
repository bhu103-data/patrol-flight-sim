import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('boat route setup uses a bounded shared sample count',()=>{
  const match=source.match(/const BOAT_ROUTE_SAMPLES=(\d+)/);
  assert.ok(match,'route sample constant is present');
  const samples=Number(match[1]);
  assert.ok(samples>=32&&samples<=64,`unexpected route sample count: ${samples}`);
  assert.match(source,/const divisions = BOAT_ROUTE_SAMPLES;/);
});

test('boat wake rendering keeps distance-tiered spray LOD',()=>{
  assert.match(source,/const BOAT_WAKE_FULL_DISTANCE=150/);
  assert.match(source,/const BOAT_WAKE_FOAM_DISTANCE=226/);
  assert.match(source,/const sprayPieces=distance<BOAT_WAKE_FULL_DISTANCE\?4:distance<190\?2:0;/);
  assert.match(source,/for\(const side of \[-1,1\]\)for\(let i=0;i<sprayPieces;i\+\+\)/);
});
