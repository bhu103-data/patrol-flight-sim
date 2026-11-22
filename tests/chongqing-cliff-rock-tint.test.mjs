import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {marketCliffRockTint} from '../assets/chongqing/cliff-rock-tint.js';

test('market cliff slate tint is local, deterministic, finite and smoothly bounded',()=>{
  for(const [x,z] of [[150,345],[190,345],[195,345],[294,345],
    [285,260],[245,275],[245,444],[245,450],[450,345]]){
    assert.equal(marketCliffRockTint(x,z,1,110).weight,0,
      'outside actual market hillside: '+x+','+z);
  }
  const on=marketCliffRockTint(250,345,1.02,105);
  assert.ok(on.weight>.6&&on.weight<=.72,'true steep terrace receives slate tint');
  assert.deepEqual(on,marketCliffRockTint(250,345,1.02,105),
    'asset fallback remains seeded by coordinates, not runtime randomness');
  for(let x=185;x<305;x+=2.5)for(let z=267;z<455;z+=3.5){
    const shade=marketCliffRockTint(x,z,.95,75+x*.2);
    assert.ok(shade.weight>=0&&shade.weight<=.72);
    assert.ok([shade.r,shade.g,shade.b].every(Number.isFinite));
    if(shade.weight)assert.ok(shade.r>=.42&&shade.r<=.69);
    const beside=marketCliffRockTint(x+.05,z,.95,75+x*.2);
    assert.ok(Math.abs(shade.weight-beside.weight)<.008,
      'cliff tint must fade smoothly at its spatial edge');
  }
  for(const v of [NaN,Infinity,-Infinity])
    assert.equal(marketCliffRockTint(v,345,.8,120).weight,0);
  assert.equal(marketCliffRockTint(250,345,.2,105).weight,0,
    'flat walkable terrace soil must keep the original grass/rock mix');
});

test('only vertex colors change; topology and collision ground function remain intact',async()=>{
  const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  const materials=await readFile(new URL('../assets/chongqing/pbr.js',import.meta.url),'utf8');
  assert.match(game,/import \{ marketCliffRockTint \} from '\.\/cliff-rock-tint\.js';/);
  const colorStart=game.indexOf('color.setHSL(0.25-0.12*n');
  const colorTint=game.indexOf('color.lerp(cliffRockColor,tint.weight)');
  const storeColor=game.indexOf('colors.push(color.r,color.g,color.b)');
  assert.ok(colorStart>=0&&colorStart<colorTint&&colorTint<storeColor,
    'only existing ground color attribute is changed');
  assert.match(game,/const gx=208,gz=148/);
  assert.match(game,/const grade=\(ground\(x\+9,z\)-ground\(x-9,z\)\)\/18/);
  assert.match(game,/worldGeometry\.computeVertexNormals\(\)/);
  assert.match(game,/const groundMaterial=pbr\.hillside\.clone\(\)/);
  assert.match(materials,/function makeSlopeAtlas\(\)/);
  assert.match(game,/const terrainMesh=new THREE\.Mesh\(worldGeometry,groundMaterial\)/);
  assert.match(game,/const obstacleIndex=new SpatialObstacleIndex\(/);
});
