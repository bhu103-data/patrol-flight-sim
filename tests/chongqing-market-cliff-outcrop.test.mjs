import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MARKET_ROCK_BOUNDS,sampleChongqingRenderedTerrain,
  buildChongqingMarketRockOutcrop} from '../assets/chongqing/market-cliff-outcrop.js';

const gx=208,gz=148,x0=-990,z0=-690,dx=1980/gx,dz=1380/gz;
// Intentionally nonlinear, to prove GPU triangle interpolation is NOT
// mistaken for an analytic ground() sample across a coarse grid cell.
const soil=(x,z)=>65-.76*(x-284)+.18*(z-345)+1.3*Math.sin(x*.17+z*.1);
class Geometry{
  setIndex(a){this.index=a}
  setAttribute(k,v){this.attributes??={};this.attributes[k]=v}
  computeVertexNormals(){this.hasNormals=true}
}
class BufferAttr{constructor(array,itemSize){this.array=array;this.itemSize=itemSize}}
class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material}}
const THREE={BufferGeometry:Geometry,Float32BufferAttribute:BufferAttr,Mesh};

test('terrain-surface height uses the exact existing +Y 208x148 indexed triangles',()=>{
  for(const [ix,iz] of [[0,0],[22,40],[125,105],[132,112],[207,147]]){
    const x=x0+ix*dx,z=z0+iz*dz;
    assert.ok(Math.abs(sampleChongqingRenderedTerrain(x,z,soil)-soil(x,z))<1e-8);
  }
  const ix=132,iz=112,xx=x0+ix*dx,zz=z0+iz*dz;
  const h00=soil(xx,zz),h10=soil(xx+dx,zz),
    h01=soil(xx,zz+dz),h11=soil(xx+dx,zz+dz);
  for(const [u,v,expected] of [
    [.2,.3,h00*.5+h01*.3+h10*.2],
    [.7,.8,h10*.2+h01*.3+h11*.5]
  ]){
    const actual=sampleChongqingRenderedTerrain(xx+u*dx,zz+v*dz,soil);
    assert.ok(Math.abs(actual-expected)<1e-8,
      'must match the actual triangle plane, not bilinear interpolation');
  }
  assert.throws(()=>sampleChongqingRenderedTerrain(NaN,300,soil));
});

test('one bounded rock skin stays glued ABOVE original terrain, adds no new geometry pool',()=>{
  const scene={objects:[],add(m){this.objects.push(m)}};
  const oldAtlas={id:'existing-textured-hillside'};
  const hillside={
    map:oldAtlas,bumpMap:oldAtlas,vertexColors:true,color:{setHex(v){this.hex=v}},
    clone(){return {map:this.map,bumpMap:this.bumpMap,color:{setHex(v){this.hex=v}}}}
  };
  const result=buildChongqingMarketRockOutcrop({THREE,scene,ground:soil,
    pbr:{hillside}});
  assert.equal(scene.objects.length,1);
  assert.equal(scene.objects[0],result.mesh);
  assert.equal(result.stats.triangleCount,864);
  assert.equal(result.stats.vertices,475);
  assert.equal(result.stats.drawCalls,1);
  assert.equal(result.stats.patches,1);
  assert.ok(result.stats.verticalReliefMax<.62);
  assert.equal(result.mesh.material.map,oldAtlas,'reuse existing rocky photo/procedural atlas');
  assert.equal(result.mesh.material.bumpMap,oldAtlas);
  assert.equal(result.mesh.material.vertexColors,true);
  assert.equal(result.mesh.material.color.hex,0xe0ddd1);
  assert.equal(result.mesh.castShadow,false);
  assert.equal(result.mesh.receiveShadow,true);
  const geo=result.mesh.geometry;
  assert.equal(geo.hasNormals,true);
  assert.equal(geo.index.length,864*3);
  const positions=geo.attributes.position.array,uv=geo.attributes.uv.array,
    colors=geo.attributes.color.array;
  assert.equal(positions.length,475*3);
  assert.equal(uv.length,475*2);
  assert.equal(colors.length,475*3);
  for(let n=0;n<475;n++){
    const x=positions[n*3],y=positions[n*3+1],z=positions[n*3+2];
    assert.ok(x>=MARKET_ROCK_BOUNDS.minX&&x<=MARKET_ROCK_BOUNDS.maxX);
    assert.ok(z>=MARKET_ROCK_BOUNDS.minZ&&z<=MARKET_ROCK_BOUNDS.maxZ);
    assert.ok(Number.isFinite(y)&&Number.isFinite(uv[n*2])&&
      Number.isFinite(colors[n*3]));
    const clearance=y-sampleChongqingRenderedTerrain(x,z,soil);
    assert.ok(clearance>=.05&&clearance<.62,
      'rock relief must never clip under mesh or float above one meter');
  }
  for(let i=0;i<geo.index.length;i+=3){
    const a=geo.index[i]*3,b=geo.index[i+1]*3,c=geo.index[i+2]*3;
    const ax=positions[a],az=positions[a+2],
      bx=positions[b],bz=positions[b+2],
      cx=positions[c],cz=positions[c+2];
    assert.ok((bz-az)*(cx-ax)-(bx-ax)*(cz-az)>0,
      'original terrain upward winding preserved');
  }
});

test('rock outcrop attaches after existing terrain, before river, without terrain or collisions mutations',async()=>{
  const scene=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  assert.match(scene,/import \{ buildChongqingMarketRockOutcrop \} from '\.\/market-cliff-outcrop\.js'/);
  const terrain=scene.indexOf('scene.add(terrainMesh);'),
    rock=scene.indexOf('const marketRockOutcrop=buildChongqingMarketRockOutcrop('),
    water=scene.indexOf('const waterUniforms=');
  assert.ok(terrain>=0&&rock>terrain&&water>rock);
  assert.match(scene,/marketCliffOutcropTriangles:marketRockOutcrop.stats.triangleCount/);
  assert.match(scene,/marketCliffOutcropDraws:marketRockOutcrop.stats.drawCalls/);
  assert.match(scene,/const gx=208,gz=148/);
  assert.match(scene,/const obstacleIndex=new SpatialObstacleIndex\(/);
  const helper=await readFile(new URL('../assets/chongqing/market-cliff-outcrop.js',import.meta.url),'utf8');
  assert.ok(!helper.includes('obstacles.push('));
  assert.ok(!helper.includes('setQuality('),'one outcrop remains part of low preset terrain silhouette');
});
