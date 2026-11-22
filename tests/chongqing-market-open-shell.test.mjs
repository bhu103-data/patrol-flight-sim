// Focused runtime extraction of the actual secondary-market shop loop.
// Do not duplicate the shop specification in tests: execute production source.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/chongqing/details.js',import.meta.url),'utf8');
const begin=source.indexOf("  const names=['山城小面'");
const end=source.indexOf('  // Hotpot shop facade:',begin);
assert.ok(begin>=0&&end>begin,'actual secondary-shop construction must exist');
const shopLoop=source.slice(begin,end);

// The gap check uses the actual facade generator and real shop-loop draw
// transforms, not hard-coded assumptions about the shop-box dimensions.
const marketSource=await readFile(new URL('../assets/chongqing/market-fronts.js',import.meta.url),'utf8');
const {makeChongqingMarketOpenFacade}=await import(
  'data:text/javascript;base64,'+Buffer.from(marketSource).toString('base64'));
class FacadeGeometry {
  setAttribute(k,a){this[k]=a}
  setIndex(a){this.index=a}
  addGroup(start,count,materialIndex){
    (this.groups??=[]).push({start,count,materialIndex});
  }
  computeVertexNormals(){}
}
const facadeThree={
  BufferGeometry:FacadeGeometry,
  Float32BufferAttribute:class{constructor(a,n){this.array=a;this.itemSize=n}}
};

function generated(){
  const draws=[],signs=[],obstacles=[];
  const ground=(x,z)=>43+.003*x+.17*(z-345);
  new Function('ground','obstacles','put','sign','lantern',shopLoop)(
    ground,obstacles,(...values)=>draws.push(values),
    (...values)=>signs.push(values),()=>{});
  return {draws,signs,obstacles,ground};
}

test('exact three gallery shells retain sides/back but no opaque original front slab',()=>{
  const {draws,signs,obstacles,ground}=generated();
  assert.equal(obstacles.length,14,'unchanged shop occupancy for collision indexing');
  for(const x of [236,284,332]){
    const z=345,base=ground(x,z),y=base+7.9;
    const walls=draws.filter(([kind,px,py,pz])=>
      (kind==='terra'||kind==='timber')&&Math.abs(py-y)<1e-6&&
      Math.abs(px-x)<10.1&&pz>=z-14.2&&pz<=z-5.7);
    assert.equal(walls.length,3,'back wall + exactly two sides of '+x);
    assert.ok(walls.some(m=>Math.abs(m[1]-x)<1e-6&&m[6]<.4),
      'back is narrow, not filled box');
    assert.equal(walls.filter(m=>m[4]>19&&m[6]>15).length,0,
      'cannot leave old 20x16 opaque box behind apertures');
    assert.equal(draws.filter(m=>m[0]==='window'&&
      Math.abs(m[1]-x)<1e-6&&Math.abs(m[3]-(z+2.15))<.01).length,0,
      'old navy 16-wide window overlay may not fill new holes');
    const entry=signs.find(s=>s[1]===x-2.5||s[1]===x+2.5);
    assert.ok(entry&&entry[5]===1.35&&entry[4]===9,
      'market sign should be a small unique plaque, above the windows');
    assert.ok(obstacles.some(o=>o.x===x&&o.z===z-6&&o.w===20&&o.d===16),
      'existing collision shell stays unchanged');
  }
});

test('real open facades overlap side walls and rear walls without daylight cracks',()=>{
  assert.ok(marketSource.includes('frontWall.position.set(x,earth,z+2.78)'),
    'actual facade must stay anchored at original z+2.78 front plane');
  const facade=makeChongqingMarketOpenFacade(facadeThree);
  const verts=facade.position.array;
  const facadeHalfWidth=Math.max(...verts.filter((_,i)=>i%3===0).map(Math.abs));
  const frontBack=2.78-facade.userData.wallThickness;
  assert.equal(facade.index.length/3,624,'unchanged 3D wall triangle budget');
  assert.equal(facade.groups.length,2,'two real material groups per facade');
  assert.equal(facade.groups[0].start,0);
  assert.equal(facade.groups[0].materialIndex,0);
  assert.equal(facade.groups[1].materialIndex,1);
  assert.equal(facade.groups[0].count,facade.groups[1].start);
  assert.equal(facade.groups[1].start+facade.groups[1].count,
    facade.index.length,'two groups must cover entire original wall');

  const {draws,ground}=generated();
  for(const x of [236,284,332]){
    const z=345,base=ground(x,z);
    const sides=draws.filter(([kind,px,py,pz,w,h,d])=>
      (kind==='terra'||kind==='timber')&&Math.abs(py-(base+7.9))<1e-6&&
      Math.abs(px-x)>9&&Math.abs(px-x)<10&&w<.5&&h>15&&d>15);
    assert.equal(sides.length,2,'only original two side walls for shop '+x);
    for(const side of sides){
      const [kind,px,py,pz,w,h,d]=side;
      const sideInner=Math.abs(px-x)-w/2;
      const forwardEdge=pz-z+d/2;
      const rearEdge=pz-z-d/2;
      assert.ok(facadeHalfWidth>=sideInner+.02,
        'front facade must overlap inner side wall instead of leaving horizontal light gap');
      assert.ok(forwardEdge>=frontBack+.02,
        'side wall front must overlap back of 0.43-deep facade wall');
      assert.ok(rearEdge<=-13.98,'extended side must still meet original rear wall');
    }
  }
});

test('non-gallery shops still have original solid bodies and standard signage',()=>{
  const {draws,signs,ground}=generated();
  const x=212,z=303,y=ground(x,z);
  assert.ok(draws.some(m=>(m[0]==='timber'||m[0]==='terra')&&
    m[1]===x&&Math.abs(m[2]-(y+7.9))<1e-6&&
    m[4]===20&&m[6]===16));
  assert.ok(draws.some(m=>m[0]==='window'&&m[1]===x&&m[4]===16));
  assert.ok(signs.some(s=>s[1]===x&&s[4]===17&&s[5]===4.5));
});
