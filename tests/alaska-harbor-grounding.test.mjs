import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const meta=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const bytes=Buffer.from(meta.heightsBase64,'base64');
const scale=Math.min(.04,(75*.9-12.2)/meta.maxElevationMeters);
const grid=(x,z)=>{
  const cx=Math.max(0,Math.min(255,(z/1920+.5)*256-.5));
  const rz=Math.max(0,Math.min(255,(1-(x/1920+.5))*256-.5));
  const a=Math.floor(cx),b=Math.floor(rz),tx=cx-a,tz=rz-b;
  const h=(i,j)=>bytes.readUInt16LE((j*256+i)*2);
  const v=(h(a,b)*(1-tx)+h(Math.min(a+1,255),b)*tx)*(1-tz)
    +(h(a,Math.min(b+1,255))*(1-tx)+h(Math.min(a+1,255),Math.min(b+1,255))*tx)*tz;
  return 12.2+v*scale;
};
const start=game.indexOf('    function dryPad(');
const end=game.indexOf('    function hut(',start);
assert.ok(start>=0&&end>start,'harbor pad sampler present');
const obstacles=[];
const dryPad=new Function('sampleTerrainHeight','WATER_H','alaskaObstacles',
  game.slice(start,end)+';return dryPad;')(grid,12.2,obstacles);

test('surveyor-grade lake/water detection disallows roads above fjord',()=>{
  for(const x of [76,93,108,139,169])
    assert.ok(grid(x,-525)<12.3,'prior road at '+x+' is below shore');
  assert.ok(grid(192,-525)>13.2,'the actual coastline begins further inland');
  assert.match(game,/let shoreX=null;/);
  assert.match(game,/const walkwayY=x=>/);
  assert.doesNotMatch(game,/pushRoadStrip\(addQuad,dockRamp\(/);
});

test('all six hillside houses occupy dry, non-overlapping terrain',()=>{
  const huts=[[132,-538,10,16],[146,-518,11,14],[164,-531,12,12],
    [135,-499,9,12],[166,-502,8,12],[177,-549,10,15]];
  for(const [x,z,w,d] of huts){
    const site=dryPad(x,z,w,d,126,3.9);
    assert.ok(site,'no house near '+x+','+z+' may float or disappear');
    const h=[];
    for(let ix=0;ix<=6;ix++)for(let iz=0;iz<=6;iz++)
      h.push(grid(site.x+(ix/6-.5)*(w+.65),
        site.z+(iz/6-.5)*(d+.65)));
    assert.ok(Math.min(...h)>13.2,'all cabin footprint samples must be dry');
    assert.ok(Math.max(...h)-Math.min(...h)<=3.9,'reject unbuildable cliff');
    assert.ok(site.top>=Math.max(...h)-1e-6,'floor covers highest corner');
    obstacles.push({x:site.x,z:site.z,halfX:w/2,halfZ:d/2});
  }
  assert.equal(obstacles.length,6);
  assert.match(game,/const floor=pad\.top\+0\.24/);
  assert.match(game,/base=sampleTerrainHeight\(sx,sz\)/);
});

test('narrow shoreline inlet beneath a cabin is rejected before building',()=>{
  // The old 5x5 sampler misses this inlet between quarter-grid points.
  const offset=(10+.65)/3;
  const pocket=(x,z)=>Math.hypot(x-offset,z-offset)<.16?12.2:17;
  const probe=new Function('sampleTerrainHeight','WATER_H','alaskaObstacles',
    game.slice(start,end)+';return dryPad;')(pocket,12.2,[]);
  assert.equal(probe(0,0,10,10,0,3.9),null,
    'cabins require 49 dry support samples, including narrow inlets');
});

test('lighthouse retains strict slope guard independent of houses',()=>{
  const p=dryPad(-155,-610,6.4,6.4,28);
  assert.ok(p===null||(p.y>13.2&&p.top-p.y<=1.8));
});
