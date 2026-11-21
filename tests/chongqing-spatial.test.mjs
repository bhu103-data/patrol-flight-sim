// Run with: node --test tests/chongqing-spatial.test.mjs
// No npm install required. The browser game itself uses native ES modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../assets/chongqing/spatial.js',import.meta.url),'utf8');
// A data URL avoids changing PATROL's static-site module / package configuration.
const { SpatialObstacleIndex }=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

const index=()=>new SpatialObstacleIndex([
  {x:100,z:100,w:20,d:20,base:20,top:70},
  {x:200,z:110,w:22,d:24,base:28,top:125},
  {x:100,z:100,w:14,d:14,base:71,top:90}
],72);

test('blocks side entry but leaves open space and high-altitude flight clear',()=>{
  const c=index();
  assert.equal(c.collides(100,40,100),true);
  assert.equal(c.collides(145,40,100),false);
  assert.equal(c.collides(200,130,110),false);
});

test('respects building base instead of blocking flight underneath elevated volumes',()=>{
  const c=new SpatialObstacleIndex([{x:0,z:0,w:25,d:25,base:82,top:110}]);
  assert.equal(c.collides(0,30,0),false);
  assert.equal(c.collides(0,92,0),true);
});

test('finds colliders across spatial hash cell boundaries',()=>{
  const c=new SpatialObstacleIndex([{x:71,z:71,w:25,d:25,base:10,top:60}],72);
  for(const [x,z] of [[60,60],[80,80],[71,71]]){
    assert.equal(c.collides(x,30,z),true);
  }
});

test('land on the highest crossed roof, not a lower stacked tier',()=>{
  const c=index();
  assert.equal(c.landingSurface(100,100,95,91,18),92.35);
  assert.equal(c.landingSurface(100,100,74,71,18),72.35);
  assert.equal(c.landingSurface(100,100,50,48,18),20.35);
});

test('stays standing on a roof and never teleports up from underneath',()=>{
  const c=index();
  assert.equal(c.landingSurface(100,100,92.35,92.31,18),92.35);
  assert.equal(c.landingSurface(100,100,35,32,18),20.35);
});

test('empty city has no false-positive collision and preserves ground height',()=>{
  const c=new SpatialObstacleIndex([]);
  assert.equal(c.collides(0,0,0),false);
  assert.equal(c.landingSurface(5,5,30,25,-2),.35);
});
