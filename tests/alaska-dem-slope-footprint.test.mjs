import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const metadata=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const start=source.indexOf('          // LAND RENDERING');
const end=source.indexOf('          float alt = th - WATER_H;',start);
assert.ok(start>0&&end>start,'real land normal path present');
const normal=source.slice(start,end);

test('Alaska DEM footprint filters distant normals, not terrain shape',()=>{
  assert.match(normal,/float eps = uAlaska\s*\? clamp\(0\.85 \+ hitDist\*0\.007, 0\.85, 3\.50\)\s*: 0\.85;/);
  assert.equal((normal.match(/terrainHeight\(/g)||[]).length,4,
    'existing four normal height lookups only');
  assert.match(normal,/normalize\(vec3\(hL - hR, 2\.0 \* eps, hD - hU\)\)/);
  for(const distance of [0,100,300,600,1000]){
    const eps=Math.max(.85,Math.min(3.5,.85+distance*.007));
    assert.ok(eps>=.85&&eps<=3.50&&eps<1920/256/2);
  }
});

test('georeferenced DEM documents the actual game scale limitation',()=>{
  assert.equal(metadata.source,'USGS 3DEP Bare Earth Elevation ImageServer (public domain)');
  assert.equal(metadata.width,256);assert.equal(metadata.height,256);
  assert.equal(metadata.crs,'EPSG:4326');
  const mPerUnitX=metadata.sampleSpacingApproxMeters[1]*metadata.height/1920;
  const mPerUnitZ=metadata.sampleSpacingApproxMeters[0]*metadata.width/1920;
  const verticalScale=Math.min(.04,(75*.9-12.2)/metadata.maxElevationMeters);
  assert.ok(mPerUnitX>4.1&&mPerUnitX<4.3);
  assert.ok(mPerUnitZ>3.9&&mPerUnitZ<4.2);
  assert.ok(1/verticalScale/mPerUnitX>7.8);
  assert.ok(1/verticalScale/mPerUnitZ<8.5);
  assert.match(source,/const x=clamp\(v\*dem\.width-\.5/);
  assert.match(source,/const z=clamp\(\(1-u\)\*dem\.height-\.5/);
});
