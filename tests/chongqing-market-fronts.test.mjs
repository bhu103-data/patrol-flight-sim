// node --test tests/chongqing-market-fronts.test.mjs
// No browser needed for physical roof winding, grounded posts, collision and LOD.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/chongqing/market-fronts.js',import.meta.url),'utf8');
const {CHONGQING_MARKET_SITES,makeChongqingMarketTileRoof,
  makeChongqingMarketOpenFacade,buildChongqingMarketFronts}=
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
class StaticMesh{
  constructor(geometry,material){
    this.geometry=geometry;this.material=material;
    this.position={set(...v){this.values=v}};
  }
}
const THREE={
  BoxGeometry:Geo,BufferGeometry:Geo,Object3D:Obj,Mesh:StaticMesh,
  Float32BufferAttribute:class{constructor(array,itemSize){this.array=array;this.itemSize=itemSize}},
  MeshStandardMaterial:class{constructor(props){Object.assign(this,props)}},
  InstancedMesh:Batch,StaticDrawUsage:1,DoubleSide:2
};
const ground=(x,z)=>43+.17*(z-345)+.003*x;
const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
function generated(riverDist=()=>100){
  const all=[],obstacles=[];
  const result=buildChongqingMarketFronts({
    THREE,scene:{add(x){all.push(x)}},ground,riverDist,obstacles
  });
  return {objects:all.filter(x=>x instanceof Batch),
    facades:all.filter(x=>x instanceof StaticMesh),obstacles,result};
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
  assert.deepEqual(objects.map(m=>m.count),[39,8,15,21,31,3]);
  assert.equal(result.stats.sites,3);
  assert.equal(result.stats.roofTriangles,2304);
  assert.equal(result.stats.instances,117);
  assert.equal(result.stats.stairTreads,6);
  assert.equal(result.stats.meshes,9);
  assert.equal(result.stats.batchDraws,6);
  assert.equal(result.stats.openFacades,3);
  assert.equal(result.stats.openFacadeTriangles,1872);
  assert.equal(obstacles.length,15);
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

test('three genuine open storefronts preserve empty windows, deep jambs and original colliders',()=>{
  const {facades,obstacles,result}=generated();
  assert.equal(facades.length,3);
  assert.equal(result.stats.openFacades,3);
  const isInsideTri=(x,y,p)=>{
    const [[ax,ay],[bx,by],[cx,cy]]=p;
    const area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
    const a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/area;
    const b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/area;
    return a>1e-6&&b>1e-6&&a+b<1-1e-6;
  };
  const signatures=[];
  for(const facade of facades){
    const g=facade.geometry,verts=g.position.array,uv=g.uv.array;
    const openings=g.userData.marketOpenings,ix=g.index;
    assert.equal(openings.length,7,'door, two storefronts, four upper windows');
    assert.equal(g.userData.wallThickness,.43,'front wall has real Z-depth');
    assert.ok(g.userData.frontQuads>10&&ix.length/3<900);
    assert.ok(verts.every(Number.isFinite)&&uv.every(Number.isFinite));
    for(const hole of openings){
      const x=(hole.left+hole.right)*.5,y=(hole.bottom+hole.top)*.5;
      let filled=false;
      for(let i=0;i<ix.length;i+=3){
        const points=[ix[i],ix[i+1],ix[i+2]]
          .map(k=>[verts[k*3],verts[k*3+1],verts[k*3+2]]);
        if(points.every(p=>Math.abs(p[2])<1e-8)&&
          isInsideTri(x,y,points.map(p=>p.slice(0,2))))filled=true;
      }
      assert.equal(filled,false,'front mesh must have EMPTY aperture, not fake glass rectangle');
    }
    signatures.push(openings.map(o=>[o.left,o.right]));
  }
  assert.notDeepEqual(signatures[0],signatures[1],
    'the three shopfront window rhythms are not identical clones');
  assert.notDeepEqual(signatures[1],signatures[2]);
  assert.equal(obstacles.length,15,'original 3 decks, 6 posts, 6 steps unchanged');
  result.setQuality('low');
  assert.ok(facades.every(m=>m.visible),'solid architectural reveals remain at low quality');
});

test('market materials reuse the game CC0 PBR instances, not new downloads',()=>{
  const pbr={wood:{id:'cc0-wood'},cutStone:{id:'cc0-stone'},
    glass:{id:'game-glass'},carvedWood:{id:'cc0-carving'},roof:{id:'cc0-tiles'}};
  const objects=[];
  const detail=buildChongqingMarketFronts({
    THREE,scene:{add:x=>objects.push(x)},ground,riverDist:()=>100,obstacles:[],pbr
  });
  assert.equal(detail.stats.sites,3);
  for(const [mesh,index] of [['wood',0],['wood',1],['cutStone',2],
    ['glass',3],['carvedWood',4],['roof',5]]){
    assert.equal(objects[index].material,pbr[mesh]);
  }
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

test('ACTUAL published Chongqing cliff terraces ground every pillar above dry terrain',async()=>{
  const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  const terrain=game.slice(game.indexOf('const riverCenter=x=>'),
    game.indexOf('const worldGeometry='));
  assert.ok(terrain.includes('function ground(x,z)'));
  const real=new Function('clamp',terrain+';return {ground,riverDist,riverCenter};')(
    (v,min,max)=>Math.max(min,Math.min(max,v)));
  const objects=[],obstacles=[];
  const market=buildChongqingMarketFronts({
    THREE,scene:{add(x){objects.push(x)}},...real,obstacles
  });
  assert.equal(market.stats.sites,3,'all three hero shops stay on dry ground');
  assert.equal(obstacles.filter(o=>o.marketGalleryPost).length,6);
  for(const post of obstacles.filter(o=>o.marketGalleryPost)){
    assert.ok(real.ground(post.x,post.z)>0&&real.riverDist(post.x,post.z)>8);
    assert.ok(Math.abs(post.base-real.ground(post.x,post.z)+.05)<.001);
    assert.ok(post.top-post.base>1.0,'no hill-clipped pillar or floating support');
    const carriage=real.riverCenter(post.x)+355+14*Math.sin(post.x/115+2);
    assert.ok(Math.abs(post.z-carriage)>14,'no column in main hillside traffic lane');
  }
});

test('six stone stair treads match the true sloped pavement and have a real collision top',()=>{
  const {result,obstacles}=generated();
  const stairs=obstacles.filter(o=>o.marketStep);
  assert.equal(result.stats.stairTreads,6);
  assert.equal(stairs.length,6);
  assert.ok(stairs.every(o=>o.x===284+5.8),'only the distinctive middle shop has steps');
  for(let i=0;i<stairs.length;i++){
    const step=stairs[i];
    assert.ok(step.top>step.base&&step.top-step.base<1.6,
      'real-size stone tread, not a giant unrealistic staircase cube');
    assert.ok(Math.abs(step.base-(ground(step.x,step.z)-.02))<.001);
    if(i)assert.ok(step.z<stairs[i-1].z);
  }
  assert.ok(result.stats.sites===3,'vary shop appearance without adding or replacing blocks');
});

test('invalid flooded or unbuildable pads must render no gallery or collider',()=>{
  const {objects,obstacles,result}=generated(()=>-1);
  assert.equal(result.stats.sites,0);
  assert.equal(obstacles.length,0);
  assert.ok(objects.every(m=>m.count===0));
});

test('market viewpoint 7 has a real unoccluded line above the existing cliff',async()=>{
  const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  assert.match(game,/eyeX=site\.x\+31,eyeZ=site\.z\+35/);
  assert.match(game,/viewPitch=key==='Digit8'\?-.22:key==='Digit7'\?-.28/);
  const terrain=game.slice(game.indexOf('const riverCenter=x=>'),
    game.indexOf('const worldGeometry='));
  const {ground:terrainY}=new Function('clamp',
    terrain+';return {ground};')((v,a,b)=>Math.max(a,Math.min(b,v)));
  const site=CHONGQING_MARKET_SITES[1],eyeX=site.x+31,eyeZ=site.z+35;
  const targetX=site.x,targetZ=site.z+2.6,targetY=terrainY(site.x,site.z)+12;
  const yaw=Math.atan2(targetX-eyeX,eyeZ-targetZ),pitch=-.28,dist=14;
  const ax=eyeX-Math.sin(yaw)*Math.cos(pitch)*dist,
    az=eyeZ+Math.cos(yaw)*Math.cos(pitch)*dist,
    ay=terrainY(eyeX,eyeZ)+18+4.7+Math.sin(pitch)*dist;
  for(let i=0;i<=30;i++){
    const t=i/30,x=ax+(targetX-ax)*t,z=az+(targetZ-az)*t,
      y=ay+(targetY-ay)*t;
    assert.ok(y>terrainY(x,z)+3,
      'street photo sightline must not pass through the scenic cliff');
  }
});

test('Digit8 facade close-up avoids the cliff without moving original Digit7',async()=>{
  const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../chongqing.html',import.meta.url),'utf8');
  assert.match(game,/if\(key==='Digit8'\)/);
  assert.match(game,/eyeX=site\.x\+16,eyeZ=site\.z\+10/);
  assert.match(game,/viewPitch=key==='Digit8'\?-.22/);
  assert.match(html,/<kbd>8<\/kbd> 窗洞特写/);
  const terrain=game.slice(game.indexOf('const riverCenter=x=>'),
    game.indexOf('const worldGeometry='));
  const real=new Function('clamp',terrain+';return {ground};')(
    (n,min,max)=>Math.max(min,Math.min(max,n)));
  const site=CHONGQING_MARKET_SITES[1],px=site.x+16,pz=site.z+10,
    tx=site.x,tz=site.z+2.6,ty=real.ground(site.x,site.z)+9.6,
    yaw=Math.atan2(tx-px,pz-tz),pitch=-.22,dist=14;
  const ax=px-Math.sin(yaw)*Math.cos(pitch)*dist,
    az=pz+Math.cos(yaw)*Math.cos(pitch)*dist,
    ay=real.ground(px,pz)+18+4.7+Math.sin(pitch)*dist;
  for(let i=0;i<=36;i++){
    const t=i/36,x=ax+(tx-ax)*t,z=az+(tz-az)*t,
      y=ay+(ty-ay)*t;
    assert.ok(y>real.ground(x,z)+5,
      'close-up sightline should not clip through steep terrain');
  }
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
