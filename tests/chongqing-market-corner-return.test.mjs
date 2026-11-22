// The three market facades have real two-story exterior PBR.
// Verify actual production shop loop turns the same lower-story material
// around both 90-degree facade/side-wall corners without new colliders.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const details=await readFile(new URL('../assets/chongqing/details.js',import.meta.url),'utf8');
const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
const start=details.indexOf("  const names=['山城小面'");
const end=details.indexOf('  // Hotpot shop facade:',start);
const terrainStart=game.indexOf('const riverCenter=x=>');
const terrainEnd=game.indexOf('const worldGeometry=',terrainStart);
assert.ok(start>=0&&end>start&&terrainStart>=0&&terrainEnd>terrainStart,
  'test must execute actual secondary shop loop and production terrain');
const createShops=new Function('ground','obstacles','put','sign','lantern',
  details.slice(start,end));
const ground=new Function('clamp',game.slice(terrainStart,terrainEnd)+';return ground;')(
  (v,min,max)=>Math.max(min,Math.min(max,v)));
const generated=()=>{
  const draws=[],obstacles=[];
  createShops(ground,obstacles,(...args)=>draws.push(args),()=>{},()=>{});
  return {draws,obstacles};
};

test('only three real storefront shells gain six matched PBR corner returns',()=>{
  const {draws,obstacles}=generated();
  const returns=draws.filter(a=>a[4]===.12&&a[5]===9.65&&a[6]===3.10);
  assert.equal(returns.length,6,'each physical open facade must turn on both sides');
  assert.equal(obstacles.length,14,'existing shop occupied volumes are unchanged');
  for(const x of [236,284,332]){
    const y=ground(x,345);
    const finish=x===284?'steps':'carved';
    for(const side of [-1,1]){
      const at=returns.filter(([mat,px,py,pz,w,h,d])=>
        mat===finish&&Math.abs(px-(x+side*10.04))<1e-7&&
        Math.abs(py-(y+5.475))<1e-7&&Math.abs(pz-345-.98)<1e-7);
      assert.equal(at.length,1,'one matched lower-story return for '+x+' side '+side);
      const [,px,py,pz,w,h,d]=at[0];
      assert.ok(Math.abs(py-h/2-(y+.65))<1e-6 &&
        Math.abs(py+h/2-(y+10.30))<1e-6,'cladding must stay below upper timber story');
      assert.ok(Math.abs(px-x)-w/2<10&&Math.abs(px-x)+w/2>10,
        'cladding should overlap the existing side shell only 0.02 units');
      assert.ok(pz-345+d/2>2.35&&pz-345-d/2<2.4,
        'cladding intersects the real facade rear jamb, not the window aperture');
    }
  }
  assert.ok(returns.every(([mat])=>mat==='steps'||mat==='carved'),
    'no unrelated building or faux flat-color panel uses return geometry');
});

test('corner returns only reuse already instanced licensed PBR pools',()=>{
  const {draws}=generated();
  assert.ok(details.includes('carved:pbr?.carvedWood') &&
    details.includes('steps:pbr?.cutStone'),
    'corner materials must be identical to the front facade PBR choices');
  assert.ok(details.includes("['carved',1600]")&&
    details.includes("['steps',1250]"),
    'returns must reuse existing instanced materials, no draw or texture allocation');
  const sides=draws.filter(a=>
    a[4]===.28&&a[5]===15.7&&a[6]===16.4&&
    [236,284,332].some(x=>Math.abs(a[1]-x)>9&&Math.abs(a[1]-x)<11&&
      Math.abs(a[3]-339.2)<1e-6));
  assert.equal(sides.length,6,'six original full-height side shells remain unchanged');
  const exposedFootings=draws.filter(a=>a[0]==='stone'&&a[4]===.86&&a[6]===1.12);
  assert.equal(exposedFootings.length,8,'the earlier downhill foundation geometry is retained');
});
