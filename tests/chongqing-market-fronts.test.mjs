// node --test tests/chongqing-market-fronts.test.mjs
// No browser needed for physical roof winding, grounded posts, collision and LOD.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/chongqing/market-fronts.js',import.meta.url),'utf8');
const {CHONGQING_MARKET_SITES,makeChongqingMarketTileRoof,buildChongqingMarketFronts}=
  await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

class Geo{
  setAttribute(key,attribute){this[key]=attribute}
  setIndex(indices){this.index=indices}
  computeVertexNormals(){this.normalsReady=true}
}
class Obj{
  constructor(){
    const snapshot={};
    this.position={set(...a){snapshot.pos=a}};
    this.rotation={set(...a){snapshot.rot=a}};
    this.scale={set(...a){snapshot.scale=a}};
    this.matrix=snapshot;
  }
  updateMatrix(){}
}
class Batch{
  constructor(geometry,material,capacity){
    this.geometry=geometry;this.material=material;this.capacity=capacity;
    this.instanceMatrix={count:capacity,needsUpdate:false,setUsage(){}};
    this.count=0;this.writes=0;
  }
  setMatrixAt(index,matrix){
    assert.ok(index>=0&&index<this.capacity,'GPU instance capacity respected');
    this.writes++;this.lastMatrix=structuredClone(matrix);
  }
  computeBoundingSphere(){this.boundsUpdated=true}
}
const THREE={
  BoxGeometry:Geo,BufferGeometry:Geo,Object3D:Obj,
  Float32BufferAttribute:class{constructor(array,itemSize){this.array=array;this.itemSize=itemSize}},
  MeshStandardMaterial:class{constructor(props){Object.assign(this,props)}},
  InstancedMesh:Batch,StaticDrawUsage:1,DoubleSide:2
};
const ground=(x,z)=>43+.17*(z-345)+.003*x;
const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
function generated(riverDist=()=>100){
  const objects=[],obstacles=[];
  const result=buildChongqingMarketFronts({
    THREE,scene:{add(x){objects.push(x)}},ground,riverDist,obstacles
  });
  return {objects,obstacles,result};
}

test('roof is actual two-slope tiled geometry with normals facing the sky',()=>{
  const roof=makeChongqingMarketTileRoof(THREE);
  assert.equal(roof.index.length/3,768);
  assert.equal(roof.position.array.length/3,429);
  assert.ok(roof.normalsReady,'Three can shade the procedural stone tiles');
  const p=roof.position.array;
  for(let i=0;i<roof.index.length;i+=3){
    const [a,b,c]=roof.index.slice(i,i+3).map(j=>j*3);
    const vx=p[b]-p[a],vz=p[b+2]-p[a+2],
      wx=p[c]-p[a],wz=p[c+2]-p[a+2];
    assert.ok(vz*wx-vx*wz>0,'roof face points OUT toward street and sky');
  }
  assert.ok(Math.max(...p.filter((_,i)=>i%3===1))>2.3,
    'roof has ridge height, not a flat billboard');
});

test('three neighbor shops are NOT PR #93 own first corner building',()=>{
  assert.deepEqual(CHONGQING_MARKET_SITES.map(x=>x.x),[236,284,332]);
  assert.ok(CHONGQING_MARKET_SITES.every(s=>s.z===345));
  assert.ok(CHONGQING_MARKET_SITES.every(s=>s.x!==212||s.z!==303));
});

test('real gallery deck, posts, roof, glass and bracing use six bounded batches',()=>{
  const {objects,obstacles,result}=generated();
  assert.deepEqual(objects.map(m=>m.count),[36,6,9,9,27,3]);
  assert.equal(result.stats.sites,3);
  assert.equal(result.stats.roofTriangles,2304);
  assert.equal(result.stats.instances,90);
  assert.equal(result.stats.meshes,6);
  assert.equal(obstacles.length,9);
  assert.ok(objects.every(m=>m.count<=m.capacity&&m.writes<=m.capacity),
    'no GPU instance overflow');
  assert.ok(objects.every(m=>m.instanceMatrix.needsUpdate&&m.boundsUpdated));
  result.setQuality('low');
  assert.equal(objects[4].visible,false,'only tiny facade lattice hidden on low');
  assert.notEqual(objects[5].visible,false,'silhouette-defining roof remains');
  assert.notEqual(objects[0].visible,false,'load-bearing timber remains');
  result.setQuality('normal');
  assert.equal(objects[4].visible,true);
});

test('physical balcony and all six timber posts are correctly grounded',()=>{
  const {result,obstacles}=generated(),sites=result.snapshot();
  for(const s of sites){
    const deck=obstacles.find(o=>o.marketGallery&&o.x===s.x);
    assert.ok(deck&&deck.base>ground(s.x,s.z),'gallery elevated above storefront');
    assert.ok(deck.top>deck.base,'walkable nonzero-thickness gallery');
    assert.ok(Math.abs((deck.z+deck.d*.5)-(s.z+5.73))<.0001,
      'stone balcony and its collider agree about front edge');
    const posts=obstacles.filter(o=>o.marketGalleryPost&&
      Math.abs(o.x-s.x)<9.3);
    assert.equal(posts.length,2);
    for(const post of posts){
      assert.ok(Math.abs(post.base-(ground(post.x,post.z)-.05))<.0001,
        'timber post MUST connect to sampled local hillside, not to sea level');
      assert.ok(post.top>post.base+6);
      // Existing secondary commercial row lies between the two surveyed
      // terrace roads, away from the protected carriageway shoulders.
      const routeZ=riverCenter(post.x)+355+14*Math.sin(post.x/115+2);
      assert.ok(Math.abs(post.z-routeZ)>14,'grounded support not on through-road');
    }
  }
});

test('invalid flooded or unbuildable pads must render no gallery or collider',()=>{
  const {objects,obstacles,result}=generated(()=>-1);
  assert.equal(result.stats.sites,0);
  assert.equal(obstacles.length,0);
  assert.ok(objects.every(m=>m.count===0));
});

test('main game builds galleries BEFORE shared collisions and has a QA shortcut',async()=>{
  const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../chongqing.html',import.meta.url),'utf8');
  const i=game.indexOf('const marketFronts=buildChongqingMarketFronts(');
  assert.ok(i>=0&&i<game.indexOf('const obstacleIndex=new SpatialObstacleIndex('),
    'new protruding decks/posts must be in real flight/traffic obstacle index');
  assert.match(game,/marketFronts\.setQuality\(low\?'low':'normal'\)/);
  assert.match(game,/key==='Digit7'/);
  assert.match(html,/<kbd>7<\/kbd> 山城商铺/);
});
