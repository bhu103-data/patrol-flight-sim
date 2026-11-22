// Verify actual secondary-market shop loop against the actual published
// Chongqing terrain function. No duplicated fixture or fake flat ground.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const details=await readFile(new URL('../assets/chongqing/details.js',import.meta.url),'utf8');
const start=details.indexOf("  const names=['山城小面'");
const end=details.indexOf('  // Hotpot shop facade:',start);
assert.ok(start>=0&&end>start,'real second-row commercial loop must exist');
const createShops=new Function('ground','obstacles','put','sign','lantern',
  details.slice(start,end));
const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
const terrainStart=game.indexOf('const riverCenter=x=>');
const terrainEnd=game.indexOf('const worldGeometry=',terrainStart);
assert.ok(terrainStart>=0&&terrainEnd>terrainStart,
  'must use actual Chongqing terrain evaluator');
const ground=new Function('clamp',game.slice(terrainStart,terrainEnd)+';return ground;')(
  (v,min,max)=>Math.max(min,Math.min(max,v)));

function generated(){
  const draws=[],obstacles=[];
  createShops(ground,obstacles,(...args)=>draws.push(args),()=>{},()=>{});
  return {draws,obstacles};
}

test('actual hillside drops under first two market shop eastern sidewalls',()=>{
  for(const [x,minimumDrop] of [[236,7],[284,5]]){
    const central=ground(x,345);
    const downhill=ground(x+9.45,345+1.2);
    assert.ok(central-downhill>minimumDrop,
      'this is a measurable missing support, not invented decoration');
    assert.ok(ground(x-9.45,345)>central,
      'only the downhill east side requires exposed piers');
  }
  const third=ground(332,345)-ground(332+9.45,345+1.2);
  assert.ok(third<1,'third shop must not receive a gratuitous tall front pier');
});

test('eight licensed stone piers actually touch hillside and overlap original floor',()=>{
  const {draws,obstacles}=generated();
  assert.equal(obstacles.length,14,'preserve all original commercial occupancy volumes');
  let piers=0;
  for(const x of [236,284,332]){
    const z=345,y=ground(x,z),supportX=x+9.45;
    for(const dz of [-11.5,-5,1.2]){
      const supportZ=z+dz,foot=ground(supportX,supportZ);
      const capY=y+.82,bottomY=foot-.60,rise=capY-bottomY;
      const match=draws.filter(([kind,px,py,pz,w,h,d])=>
        kind==='stone'&&Math.abs(px-supportX)<1e-7&&
        Math.abs(pz-supportZ)<1e-7&&w===.86&&d===1.12);
      const shoe=draws.filter(([kind,px,py,pz,w,h,d])=>
        kind==='steps'&&Math.abs(px-supportX)<1e-7&&
        Math.abs(pz-supportZ)<1e-7&&w===1.55&&d===1.55);
      if(rise<=1.85){
        assert.equal(match.length,0,'do not build shallow buried pillars');
        assert.equal(shoe.length,0);
        continue;
      }
      piers++;
      assert.equal(match.length,1,'one real stone pier below each exposed wall segment');
      assert.equal(shoe.length,1,'one visible foot on local terrain per pier');
      const [,px,py,pz,w,h,d]=match[0];
      assert.ok(Math.abs(py-h/2-(foot-.60))<1e-7,
        'pier bottom must penetrate real sampled terrain by 0.60');
      assert.ok(Math.abs(py+h/2-(y+.82))<1e-7,
        'pier top must meet existing solid floor slab');
      assert.ok(Math.abs(shoe[0][2]-(foot+.03))<1e-7,
        'footing must follow real terrain');
      assert.ok(px>x+8.9&&px<x+10,
        'pier aligns underneath existing shop wall, not street/window');
      assert.ok(pz>=z-14&&pz<=z+2.4,
        'footing remains within original sidewall depth');
    }
  }
  assert.equal(piers,8,'only grade-exposed footing sites get real geometry');
});

test('foundation remains pooled, license-free and collision-neutral',()=>{
  const {draws,obstacles}=generated();
  assert.equal(draws.filter(a=>a[0]==='stone'&&a[4]===.86&&a[6]===1.12).length,8);
  assert.equal(draws.filter(a=>a[0]==='steps'&&a[4]===1.55&&a[6]===1.55).length,8);
  assert.ok(details.includes("['stone',2700]")&&details.includes("['steps',1250]"),
    'use existing CC0 PBR-backed stone and steps pools; no draw or shader added');
  assert.equal(obstacles.filter(o=>o.x===236||o.x===284||o.x===332).length,3,
    'original shop collider extents remain unchanged');
  assert.ok(obstacles.every(o=>!o.marketFoundation),
    'pure under-floor detail must not register incompatible flight colliders');
  assert.ok(game.includes('const gx=208,gz=148;'),
    'terrain geometry resolution unchanged');
});
