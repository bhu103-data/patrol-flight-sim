// node --test tests/chongqing-road-scene.test.mjs
// Rebuild the combined tower, Hongyadong and major landmark collision scene.
// No GPU is required; asserts final asphalt pieces do not intersect full colliders.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async path=>readFile(new URL(path,import.meta.url),'utf8');
const toUrl=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const roadSource=await read('../assets/chongqing/road-clearance.js');
const {chongqingTerraceRoads,clipRoadToFreeSegments,sampleChongqingTerraceSurface,clipChongqingDryRoadSegments,crossesFootprint,isRoadPassableAtElevation,crossesRoadVolume}=await import(toUrl(roadSource));
const urbanSrc=(await read('../assets/chongqing/urban-architecture.js'))
  .replace("from './road-clearance.js'",'from '+JSON.stringify(toUrl(roadSource)));
const {createChongqingUrbanArchitecture}=await import(toUrl(urbanSrc));
const {buildChongqingDetails}=await import(toUrl(await read('../assets/chongqing/details.js')));
const {buildChongqingLandmarks}=await import(toUrl(await read('../assets/chongqing/landmarks.js')));
const {buildChongqingStreetlife}=await import(toUrl(await read('../assets/chongqing/streetlife.js')));

class Vec{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  copy(v){return this.set(v.x,v.y,v.z)}
  clone(){return new Vec(this.x,this.y,this.z)}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this}
  multiplyScalar(v){this.x*=v;this.y*=v;this.z*=v;return this}
  length(){return Math.hypot(this.x,this.y,this.z)}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}
  normalize(){return this.multiplyScalar(1/(this.length()||1))}
}
class Obj{
  constructor(){
    this.position=new Vec();this.scale=new Vec(1,1,1);
    this.rotation={set(){}};this.quaternion={setFromUnitVectors(){}};
    this.matrix={};this.children=[];
  }
  updateMatrix(){}
  add(o){this.children.push(o)}
}
class Geo{
  constructor(){this.attributes={};this.index=[];this.repeat={set(){}}}
  setAttribute(k,v){this.attributes[k]=v}
  setIndex(v){this.index=v}
  computeVertexNormals(){}
  rotateX(){return this}
}
class Attr{constructor(array,size){this.array=array;this.itemSize=size}}
class Mat{constructor(props={}){Object.assign(this,props)}clone(){return new Mat(this)}}
class Mesh extends Obj{constructor(g,m){super();this.geometry=g;this.material=m}}
class Instanced extends Mesh{
  constructor(g,m,c){super(g,m);this.capacity=c;this.count=0;this.visible=true;this.writes=0;this.instanceMatrix={setUsage(){},needsUpdate:false,array:new Float32Array(c*16)}}
  setMatrixAt(i){assert.ok(i<this.capacity,'GPU instance overflow');this.writes++}
  setColorAt(i){assert.ok(i<this.capacity,'color buffer overflow')}
  computeBoundingSphere(){}
}
class Color{set(){return this}}
class Spot extends Obj{constructor(){super();this.target=new Obj()}}
const THREE={
  Object3D:Obj,Group:Obj,Vector3:Vec,Color,
  BoxGeometry:Geo,PlaneGeometry:Geo,CylinderGeometry:Geo,SphereGeometry:Geo,TorusGeometry:Geo,
  IcosahedronGeometry:Geo,BufferGeometry:Geo,Float32BufferAttribute:Attr,
  Mesh,InstancedMesh:Instanced,MeshStandardMaterial:Mat,
  MeshBasicMaterial:Mat,MeshPhysicalMaterial:Mat,PointsMaterial:Mat,
  Points:class{},PointLight:Obj,SpotLight:Spot,
  DoubleSide:2,StaticDrawUsage:1,AdditiveBlending:4
};
const oldDoc=globalThis.document;
const ctx=new Proxy({createLinearGradient(){return{addColorStop(){}}}},{
  get(obj,key){return key in obj?obj[key]:()=>{}},set(){return true}
});
globalThis.document={createElement(){return {getContext(){return ctx}}}};

function generate() {
  const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
  const branchCenter=z=>-390+18*Math.sin(z/175);
  const riverDist=(x,z)=>Math.min(Math.abs(z-riverCenter(x))-78,
    z<18&&z>-620?Math.abs(x-branchCenter(z))-47:Infinity);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function ground(x,z){
    const d=riverDist(x,z);
    if(d<0)return -13;
    const tier=d/72,tierFrac=tier-Math.floor(tier),sm=tierFrac*tierFrac*(3-2*tierFrac);
    const terraces=(Math.floor(tier)+sm)*2.1;
    const relief=3.4*Math.sin(x/105)*Math.cos(z/150)+2.2*Math.sin(x/39+z/57);
    const cliffX=Math.exp(-Math.pow((x-153)/115,4));
    const cliffT=clamp((z-185)/120,0,1),cliffRamp=cliffT*cliffT*(3-2*cliffT);
    return Math.max(8,9+d*.172+terraces+relief+cliffX*cliffRamp*86);
  }
  let seed=9862;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const obstacles=[],sceneObjects=[],scenery={add(...xs){sceneObjects.push(...xs)}};
  const pbr={concrete:new Mat(),glass:new Mat(),curtainWall:new Mat(),
    roof:new Mat(),stone:new Mat(),window:new Mat(),carvedWood:new Mat(),
    wood:new Mat(),cutStone:new Mat(),glassPane:new Mat()};
  const box=(x,y,z,w,h,d,mat,parent=scenery)=>{
    const object=new Mesh(new Geo(),mat);
    object.position.set(x,y,z);object.scale.set(w,h,d);parent.add(object);return object;
  };
  const signs=[];
  const plans=chongqingTerraceRoads(riverCenter);
  const urban=createChongqingUrbanArchitecture({THREE,scene:scenery,ground,
    riverDist,riverCenter,rand,obstacles,pbr,plannedRoads:plans});
  const details=buildChongqingDetails({THREE,scene:scenery,ground,riverCenter,rand,
    box,ball:()=>{},sign:(...args)=>signs.push(args),hotpot:{x:285,z:225},obstacles,pbr});
  const landmark=buildChongqingLandmarks({THREE,scene:scenery,ground,pbr,box,
    sign:(...args)=>signs.push(args),obstacles});
  const paths=[],stats={clipped:0,removed:0};
  for(const road of plans){
    const pts=sampleChongqingTerraceSurface(road,ground,riverCenter);
    const drySections=clipChongqingDryRoadSegments(pts,road.width,ground,riverDist);
    for(const section of drySections){
      const trimmed=clipRoadToFreeSegments(section,road.width,obstacles,.8,2.5);
      for(const path of trimmed.paths)paths.push({width:road.width,path});
      stats.clipped+=trimmed.stats.clippedSegments;
      stats.removed+=trimmed.stats.removedLength;
    }
  }
  return {obstacles,paths,stats,urban,details,landmark,sceneObjects,ground,riverDist};
}
test('complete Chongqing road network is kept without passing through any building',()=>{
  const {paths,obstacles,stats,urban,landmark}=generate();
  assert.ok(urban.stats.towers>100);
  assert.equal(landmark.stats.towers,8);
  assert.ok(obstacles.length>200);
  assert.ok(paths.length>=6,'at least one drivable section per canonical road');
  let checked=0;
  for(const {width,path} of paths){
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i];
      for(const building of obstacles){
        if(isRoadPassableAtElevation(a,b,building))continue;
        assert.equal(crossesRoadVolume(a,b,building,width*.5,.55),false,
          'actual road surface must not penetrate a static building in 3D');
        checked++;
      }
    }
  }
  assert.ok(checked>200,'substantial complete-scene clearance audit');
  assert.ok(stats.clipped>0,'real landmarks must require at least some road clipping');
});
test('real Chongqing building parcels still leave safe usable signal crossings',()=>{
 const {obstacles,ground,riverDist}=generate();
 const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
 const roadClear=(x,z,y,radius=0)=>
   ground(x,z)>0&&riverDist(x,z)>=Math.max(3,radius+2.4)&&
   !obstacles.some(o=>Math.abs(x-o.x)<o.w*.5+radius &&
     Math.abs(z-o.z)<o.d*.5+radius &&
     y+2.2>=(o.base??-Infinity)&&y-1.6<=(o.top??Infinity));
 const props=[];
 const traffic=buildChongqingStreetlife({THREE,scene:{add(...p){props.push(...p)}},
   ground,riverCenter,isRoadClear:roadClear});
 const sites=traffic.snapshot().crossingXs;
 assert.ok(sites.length>=2,
   'multiple signalized pedestrian crossings must remain visible in the real city');
 assert.equal(traffic.stats.trafficSignals,sites.length*2);
 for(const x of sites){
   const z=riverCenter(x)+250+14*Math.sin(x/115+1);
   assert.equal(roadClear(x,z,ground(x,z)+1.78,11.2),true,
     'zebra crossings must not intersect tall or raised building volumes');
   for(const side of [-1,1]){
     const px=x+11,pz=riverCenter(px)+250+14*Math.sin(px/115+1)+side*9.1;
     assert.equal(roadClear(px,pz,ground(px,pz)+2.5,1.5),true,
       'signal pole cannot sit inside building collider or river');
   }
 }
});

test('landmark and background geometry still fit instance buffers',()=>{
  const {sceneObjects,urban,details}=generate();
  assert.ok(urban.stats.towers>100);
  // The first Hongyadong-neighbor storefront now contributes one authentic
  // curved roof to the previous 33. The existing GPU batch holds 96 roofs.
  assert.equal(details.stats.curvedRoofs,34,
    '33 existing curved roofs plus one stepped-neighbor roof');
  const roofs=sceneObjects.filter(m=>m instanceof Instanced&&m.capacity===96);
  assert.equal(roofs.length,1,'share the single existing curved-roof instance batch');
  assert.equal(roofs[0].count,34);
  for(const mesh of sceneObjects.filter(m=>m instanceof Instanced)){
    assert.ok(mesh.count<=mesh.capacity);
    assert.ok(mesh.writes<=mesh.capacity);
  }
});
test('scenic Chongqing facades have real window reveal, glass, mullion and sill geometry',()=>{
  const {sceneObjects,urban,obstacles}=generate();
  assert.ok(urban.stats.facadeBuildings>=8,'close riverfront still has architectural details');
  assert.ok(urban.stats.facadeBuildings<=44,'detail stays bounded to hero towers');
  assert.ok(urban.stats.facadePanels>=150,'enough 3D window bays to avoid empty box faces');
  assert.ok(urban.stats.facadePanels<=3200,'bounded glass and trim budgets');
  const groups=sceneObjects.filter(m=>m instanceof Instanced&&m.capacity===3200);
  assert.equal(groups.length,4,'four facade instanced batches, not per-window draw calls');
  for(const group of groups){
    assert.equal(group.count,urban.stats.facadePanels);
    assert.ok(group.writes<=group.capacity,'no GPU instance overflow');
  }
  const shops=sceneObjects.filter(m=>m instanceof Instanced&&m.capacity===32);
  assert.equal(shops.length,2,'shared storefront glazing and canopy batches');
  assert.ok(urban.stats.storefronts<=32);
  assert.ok(shops.every(g=>g.count===urban.stats.storefronts));
  // The facade glass is retained for low-detail aircraft views; tiny physical
  // trims and projecting canopies are only drawn in higher-quality scenes.
  urban.setQuality('low');
  assert.equal(groups[0].visible,false);
  assert.equal(groups[1].visible,true);
  assert.equal(groups[2].visible,false);
  assert.equal(groups[3].visible,false);
  urban.setQuality('normal');
  assert.ok(groups.every(g=>g.visible!==false));
  assert.ok(obstacles.length>200,'building collisions remain in the scene');
});

test('clipping is deterministic and does not accidentally empty the city',()=>{
  const a=generate(),b=generate();
  assert.equal(a.urban.stats.towers,b.urban.stats.towers);
  assert.equal(a.paths.length,b.paths.length);
  assert.equal(a.stats.clipped,b.stats.clipped);
  assert.ok(a.paths.length>=6);
});
test('sloped riverside road passes under raised volume but rejects true building collision',()=>{
  const a={x:186.66666666666674,z:285.94341853810994,y:124.26855229174254};
  const b={x:213.33333333333326,z:284.9475248827785,y:116.84346280131302};
  const raised={x:212,z:297,w:20,d:16,base:124.93075748156431,top:141.0307574815643};
  assert.equal(crossesFootprint(a,b,raised,5.75,.55),true,'2D outlines overlap');
  assert.equal(isRoadPassableAtElevation(a,b,raised),false,'whole-segment test falsely flags road');
  assert.equal(crossesRoadVolume(a,b,raised,5.75,.55),false,'actual crossing descends safely beneath raised structure');
  assert.equal(crossesRoadVolume({...a,y:133},{...b,y:133},raised,5.75,.55),true,'road through the same occupied volume is blocked');
});
process.on('exit',()=>{globalThis.document=oldDoc});

test('background towers stand on surveyed dry terraces with bounded retaining walls',()=>{
  const {obstacles,urban,sceneObjects,ground,riverDist}=generate();
  const pads=obstacles.filter(o=>Number.isFinite(o.padBase));
  assert.equal(pads.length,urban.stats.towers);
  assert.ok(pads.length>120,'retain realistic skyline density rather than deleting city');
  assert.ok(urban.stats.skippedUnbuildableTerrain>0,
    'very steep cliff towers must be rejected rather than left floating');
  assert.ok(urban.stats.maxAcceptedGrade<=10+1e-9);
  assert.equal(urban.stats.retainingWallTriangles,pads.length*16,
    'eight hillside wall panels per building, one bounded mesh batch');
  for(const p of pads){
    let min=Infinity,max=-Infinity;
    for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++){
      const x=p.x+(p.w-2)*ix/4,z=p.z+(p.d-2)*iz/4;
      const y=ground(x,z);
      assert.ok(riverDist(x,z)>=5,'tower foundation enters river or shoreline');
      min=Math.min(min,y);max=Math.max(max,y);
    }
    assert.ok(max-min<=10+1e-7,'building straddles a steep cliff');
    assert.ok(p.padBase>=max+.2399,'tower wall bottom cannot bury into uphill terrain');
    assert.ok(p.base<=min-.3499,'collision includes the downhill retaining foundation');
  }
  const retaining=sceneObjects.filter(o=>o instanceof Mesh&&
    o.geometry?.index?.length===urban.stats.retainingWallTriangles*3);
  assert.equal(retaining.length,1,'all foundation faces share a single GPU draw batch');
  const vertices=retaining[0].geometry.attributes.position.array;
  assert.ok(vertices.every(Number.isFinite),'no invalid foundation vertex');
  assert.ok(vertices.length<=pads.length*8*12,'bounded real geometry allocation');
});
