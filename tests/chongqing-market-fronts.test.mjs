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
  addGroup(start,count,materialIndex){
    (this.groups??=[]).push({start,count,materialIndex});
  }
  // Browser Three.js returns an Index BufferAttribute with .count.
  // Keep the raw array too so geometry/orientation assertions remain usable.
  getIndex(){return {count:this.index.length}}
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
    this.count=0;this.writes=0;this.transforms=[];
  }
  setMatrixAt(index,matrix){
    assert.ok(index>=0&&index<this.capacity,'GPU instance capacity respected');
    this.writes++;this.lastMatrix=structuredClone(matrix);
    this.transforms[index]=structuredClone(matrix);
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

test('real gallery deck, posts, roof, glass and bracing use seven bounded batches',()=>{
  const {objects,obstacles,result}=generated();
  assert.deepEqual(objects.map(m=>m.count),[57,8,27,21,82,3,21]);
  assert.equal(result.stats.sites,3);
  assert.equal(result.stats.roofTriangles,2304);
  assert.equal(result.stats.instances,219);
  assert.equal(result.stats.interiorFittings,42);
  assert.equal(result.stats.stairTreads,6);
  assert.equal(result.stats.meshes,10);
  assert.equal(result.stats.batchDraws,7);
  assert.equal(result.stats.interiorBackings,21);
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

test('two per-story facade groups preserve openings while highlighting distinct CC0 finishes',()=>{
  const {facades,objects,result}=generated();
  const [, ,stone,,trim]=objects;
  assert.equal(result.stats.facadeMaterialDraws,6,
    'one material draw for each of two stories per facade');
  assert.equal(facades.length,3);
  for(let i=0;i<facades.length;i++){
    const facade=facades[i],g=facade.geometry;
    assert.equal(g.groups.length,2,'single bounded draw per distinct story');
    const [lower,upper]=g.groups;
    assert.deepEqual([lower.start,lower.materialIndex],[0,0]);
    assert.equal(upper.materialIndex,1);
    assert.equal(upper.start,lower.count,'no overlapping or missing triangles');
    assert.equal(upper.start+upper.count,g.index.length,
      'groups cover exactly the physical 3D facade triangles');
    assert.equal(g.userData.lowerStoryTriangles,lower.count/3);
    assert.equal(g.userData.upperStoryTriangles,upper.count/3);
    assert.ok(lower.count>0&&upper.count>0&&
      lower.count%3===0&&upper.count%3===0,
      'both building stories have real indexed wall meshes');
    assert.equal(g.userData.marketOpenings.length,7,
      'two material groups must not fill any door/window hole');
    assert.equal(facade.material.length,2);
    assert.equal(facade.material[1],objects[0].material,
      'upper storey and timber supports share the original wood surface');
    assert.equal(facade.material[0],i===1?stone.material:trim.material,
      'central stone-stair shop uses stone; its neighbors have lighter carved wood');
  }
});

test('all 21 panes sit behind physical jambs with varied projecting sashes and sills',()=>{
  const {objects,obstacles,result}=generated();
  const [,,stone,glass,lattice,,interiors]=objects;
  const sites=result.snapshot();
  assert.equal(glass.transforms.length,21,'seven recessed windows per market shop');
  assert.equal(stone.count,27,'four added upper sills per shop');
  assert.equal(lattice.count,82,'varied exterior and interior timber trim in one draw');
  assert.equal(interiors.count,21,'one deep interior plane per pane');
  for(const s of sites){
    const panes=glass.transforms.filter(t=>
      Math.abs(t.pos[2]-(s.z+2.11))<.0001&&Math.abs(t.pos[0]-s.x)<9.5);
    assert.equal(panes.length,7);
    const backs=interiors.transforms.filter(t=>
      Math.abs(t.pos[2]-(s.z+.92))<.0001&&Math.abs(t.pos[0]-s.x)<9.5);
    assert.equal(backs.length,7);
    for(const backing of backs){
      assert.ok((s.z+2.11)-(backing.pos[2]+backing.scale[2]/2)>1.1,
        'interior backing must give real >1.1-unit window parallax');
    }
    for(const card of panes){
      assert.ok((s.z+2.78)-(card.pos[2]+card.scale[2]/2)>.58,
        'recessed glazing must sit at least 0.58 units behind outer wall face');
    }
    const sills=stone.transforms.filter(t=>
      Math.abs(t.pos[2]-(s.z+2.91))<.0001&&
      Math.abs(t.pos[1]-(s.base+12.03))<.0001);
    assert.equal(sills.length,4);
    assert.ok(sills.every(t=>t.scale[2]>=.45),'real sill projects toward street');
  }
  assert.equal(obstacles.length,15,'window styling must not alter shared colliders');
});

test('forty-two authentic parallax fittings stay between tinted glass and backing',()=>{
  const {objects,obstacles,result}=generated();
  const [beams,,,,lattice,,backings]=objects;
  assert.equal(result.stats.interiorFittings,42);
  for(const site of result.snapshot()){
    const x=site.x,z=site.z,y=site.base;
    const innerPieces=beams.transforms.filter(t=>
      Math.abs(t.pos[0]-x)<9.5&&
      [1.48,1.57,1.43].some(v=>Math.abs(t.pos[2]-(z+v))<.0001));
    assert.equal(innerPieces.length,6,'two lower windows each get three interior objects');
    const upperScreens=lattice.transforms.filter(t=>
      Math.abs(t.pos[0]-x)<9.5&&
      Math.abs(t.pos[2]-(z+1.61))<.0001);
    assert.equal(upperScreens.length,4,'four upstairs windows each get a privacy shutter');
    const lowerPart=lattice.transforms.filter(t=>
      Math.abs(t.pos[0]-x)<9.5&&
      Math.abs(t.pos[2]-(z+1.71))<.0001);
    assert.equal(lowerPart.length,2,'two ground shop windows each get a partition');
    const upperSlats=lattice.transforms.filter(t=>
      Math.abs(t.pos[0]-x)<9.5&&
      Math.abs(t.pos[2]-(z+1.68))<.0001);
    assert.equal(upperSlats.length,2,'upper window slats alternate per store');
    const fittings=[...innerPieces,...upperScreens,...lowerPart,...upperSlats];
    assert.equal(fittings.length,14);
    for(const f of fittings){
      assert.ok(f.pos[2]+f.scale[2]/2<z+2.06,
        'fixture must be behind the real translucent glass');
      assert.ok(f.pos[2]-f.scale[2]/2>z+.98,
        'fixture must stand in front of the matte internal backplate');
    }
    assert.ok(backings.transforms.filter(t=>
      Math.abs(t.pos[0]-x)<9.5&&Math.abs(t.pos[2]-(z+.92))<.0001).length===7);
  }
  assert.equal(obstacles.length,15,'interior furnishing must not modify collision volumes');
  assert.equal(objects.length,7,'no new draw calls or asset loads are permitted');
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
  assert.match(game,/eyeX=site\.x\+3,eyeZ=site\.z\+18/);
  assert.match(game,/viewPitch=key==='Digit8'\?-.22/);
  assert.match(html,/<kbd>8<\/kbd> 窗洞特写/);
  const terrain=game.slice(game.indexOf('const riverCenter=x=>'),
    game.indexOf('const worldGeometry='));
  const real=new Function('clamp',terrain+';return {ground};')(
    (n,min,max)=>Math.max(min,Math.min(max,n)));
  const site=CHONGQING_MARKET_SITES[1],px=site.x+3,pz=site.z+18,
    tx=site.x,tz=site.z+2.6,ty=real.ground(site.x,site.z)+9.6,
    yaw=Math.atan2(tx-px,pz-tz),pitch=-.22,dist=14;
  const ax=px-Math.sin(yaw)*Math.cos(pitch)*dist,
    az=pz+Math.cos(yaw)*Math.cos(pitch)*dist,
    ay=real.ground(px,pz)+18+4.7+Math.sin(pitch)*dist;
  assert.ok(Math.abs(Math.atan2(ax-site.x,az-site.z))<Math.PI/12,
    'close inspector must face the windowed FRONT, not the blank sidewall');
  for(let i=0;i<=36;i++){
    const t=i/36,x=ax+(tx-ax)*t,z=az+(tz-az)*t,
      y=ay+(ty-ay)*t;
    assert.ok(y>real.ground(x,z)+5,
      'close-up sightline should not clip through steep terrain');
  }
});

test('Digit8 free inspection camera remains clear on right-hand terrace',async()=>{
  const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  assert.ok(game.includes('eye:new THREE.Vector3(site.x+8,site.base+8.5,site.z+17)'));
  assert.ok(game.includes('aim:new THREE.Vector3(site.x+3.5,site.base+5.7,site.z+2.78)'));
  assert.ok(game.includes('cameraDesired.copy(marketInspect.eye)'));
  assert.ok(game.includes('marketInspectorActive:Boolean(marketInspect)'));
  assert.ok(game.includes("canvas.addEventListener('pointerdown',e=>{marketInspect=null"));
  assert.ok(game.includes("canvas.addEventListener('wheel',e=>{marketInspect=null"));
  const terrain=game.slice(game.indexOf('const riverCenter=x=>'),
    game.indexOf('const worldGeometry='));
  const real=new Function('clamp',terrain+';return {ground};')(
    (n,min,max)=>Math.max(min,Math.min(max,n)));
  const site=CHONGQING_MARKET_SITES[1],y=real.ground(site.x,site.z);
  const eye=[site.x+8,y+8.5,site.z+17],
    target=[site.x+3.5,y+5.7,site.z+2.78];
  for(let i=0;i<=50;i++){
    const t=i/50,x=eye[0]+(target[0]-eye[0])*t,
      z=eye[2]+(target[2]-eye[2])*t,
      sightY=eye[1]+(target[1]-eye[1])*t;
    assert.ok(sightY>real.ground(x,z)+7.5,
      'Digit8 facade view ray clips city terrain');
  }
  assert.ok(eye[0]>site.x+6&&eye[0]<site.x+9,
    'camera must offset away from left hillside while facing windows');
});

test('Digit8 inspector releases for mobile joystick and on-screen flight buttons',async()=>{
  const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  assert.ok(game.includes('e.preventDefault();marketInspect=null;joystickPointer=e.pointerId;'),
    'touch joystick must exit inspection view on active pointerdown');
  const press=game.slice(game.indexOf('function press(key,once=false){'),
    game.indexOf("window.addEventListener('keydown'"));
  assert.ok(press.includes("'KeyW','KeyA','KeyS','KeyD'"));
  assert.ok(press.includes("'ControlLeft','ControlRight','ArrowUp','ArrowDown','ArrowLeft'"));
  assert.ok(press.includes("'ArrowRight','KeyF'].includes(key))marketInspect=null;"),
    'touch flight controls must leave inspection mode via shared press()');
  assert.ok(game.includes("b.addEventListener('pointerdown',e=>{e.preventDefault();press(key,true);"),
    'on-screen mobile buttons must use the shared press handler');
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
