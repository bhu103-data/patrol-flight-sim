// C185 regression using the actual waterfront builder + landing-water checker.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const hero=await readFile(new URL('../assets/nyc/nyc-hero.js',import.meta.url),'utf8');
const {buildManhattanWaterfront}=await import(
  'data:text/javascript;base64,'+Buffer.from(hero).toString('base64'));
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  function clearOfNycHeroDocks(');
const end=html.indexOf('  function findFloatWaterStart()',start);
assert.ok(start>=0&&end>start);
const makeWater=new Function(
  'selectedMap','NYC_HERO_ROUTE','plane','sampleTerrainHeight','WATER_H',
  'cityLotAt','sceneryObstacle','alaskaObstacles',
  html.slice(start,end)+';return usableFloatWater;'
);
const waterY=12.2;
const terrain=(x,z)=>Math.abs(x-(.24*z+30))<=24?waterY+5.6:waterY;
const build=ground=>buildManhattanWaterfront({
  addQuad(){},box(){},beam(){},waterY,terrain:ground
});
const city=build(terrain);
const route={liberty:[-140,-611],spawn:[-108,-594]};
const args=[{city:true,alaska:false},route,{yaw:0},terrain,waterY,()=>null];
const free=makeWater(...args,()=>null,[]);
const blocked=makeWater(...args,(x,z)=>city.pierObstacles.find(o=>
  Math.abs(x-o.x)<=o.halfX&&Math.abs(z-o.z)<=o.halfZ)||null,[]);

test('the six real piers return six full-height, finite collision envelopes',()=>{
  assert.equal(city.pierCount,6);
  assert.equal(city.pierObstacles.length,city.pierCount);
  for(const p of city.pierObstacles){
    for(const key of ['x','z','y','top','halfX','halfZ'])
      assert.ok(Number.isFinite(p[key]),'finite '+key);
    assert.ok(p.top>waterY+5.8&&p.y<waterY);
    assert.ok(p.halfX>10&&p.halfZ>2);
    assert.equal(p.name,'Lower Manhattan pier');
  }
});
test('floatplane cannot land through any pier while open harbor remains usable',()=>{
  for(const pier of city.pierObstacles){
    const candidate=[-1,1].map(s=>[pier.x+s*(pier.halfX-4),pier.z])
      .find(([x,z])=>free(x,z,0));
    assert.ok(candidate,'pier tip has water at z='+pier.z);
    assert.equal(blocked(candidate[0],candidate[1],0),false);
  }
  assert.equal(blocked(-250,-440,0),true);
});
test('no hidden pier collider is created if the coast is fully underwater',()=>{
  const flooded=build(()=>waterY);
  assert.equal(flooded.pierCount,0);
  assert.deepEqual(flooded.pierObstacles,[]);
});
test('NYC colliders are installed after async scene epoch check',()=>{
  const hook=html.indexOf('const waterfront=buildManhattanWaterfront({');
  const guard=html.indexOf('if(heroEpoch!==nycHeroEpoch||gl.isContextLost())',hook);
  const insert=html.indexOf('sceneryObjects.push(...waterfront.pierObstacles);',hook);
  assert.ok(hook>0&&guard>hook&&insert>guard&&insert-guard<460);
  assert.match(html,/sceneryObjects=\[\];/);
});
