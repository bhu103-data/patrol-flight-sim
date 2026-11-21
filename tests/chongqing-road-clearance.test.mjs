import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const toURL=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const moduleText=await readFile(new URL('../assets/chongqing/road-clearance.js',import.meta.url),'utf8');
const {sweptSegmentInterval,crossesFootprint,clipRoadToFreeSegments,roadReserveAtSite,chongqingTerraceRoads,sampleChongqingTerraceSurface}=await import(toURL(moduleText));

test('road collision checks entire asphalt width and exact segment interval',()=>{
 const b={x:0,z:0,w:8,d:8};
 assert.equal(crossesFootprint({x:-20,z:11},{x:20,z:11},b,5),false);
 assert.equal(crossesFootprint({x:-20,z:8},{x:20,z:8},b,5),true);
 assert.deepEqual(sweptSegmentInterval({x:-20,z:0},{x:20,z:0},b,2,1),[.325,.675]);
});
test('Chongqing road mesh follows curved taxi centerline and every local hillside grade',()=>{
 const riverCenter=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
 const ground=(x,z)=>55+18*Math.sin(x/7)+z*.019;
 for(const plan of chongqingTerraceRoads(riverCenter)){
   const points=sampleChongqingTerraceSurface(plan,ground,riverCenter);
   assert.ok(points.length>plan.points.length*4,'curves must be densified');
   assert.equal(points[0].x,plan.points[0].x);
   assert.equal(points.at(-1).x,plan.points.at(-1).x);
   for(let i=0;i<points.length;i++){
     const p=points[i];
     const expectedZ=riverCenter(p.x)+plan.side*
       (145+plan.tier*105+14*Math.sin(p.x/115+plan.tier));
     assert.ok(Math.abs(p.z-expectedZ)<1e-9,'asphalt and taxis follow one route');
     assert.ok(Math.abs(p.y-ground(p.x,p.z)-1.6)<1e-9,
       'road surface samples the exact local elevation, not interpolated guide heights');
     if(i)assert.ok(Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)<=5.6);
   }
 }
 assert.deepEqual(sampleChongqingTerraceSurface(null,ground,riverCenter),[]);
});

test('building removes only the occupied portion of road',()=>{
 const b={x:0,z:0,w:12,d:15,base:0,top:70};
 const road=clipRoadToFreeSegments([{x:-40,z:0,y:1.6},{x:0,z:0,y:1.6},{x:40,z:0,y:1.6}],8,[b],1);
 assert.equal(road.paths.length,2);
 assert.ok(road.stats.removedLength>19);
 for(const p of road.paths)for(let k=1;k<p.length;k++){
   const m={x:(p[k-1].x+p[k].x)*.5,z:0};
   assert.equal(crossesFootprint(m,m,b,4,.85),false);
 }
});
test('street is preserved under an elevated bridge',()=>{
 const p=[{x:-40,y:5,z:0},{x:0,y:5,z:0},{x:40,y:5,z:0}];
 assert.equal(clipRoadToFreeSegments(p,8,[{x:0,z:0,w:18,d:18,base:70,top:95}]).paths.length,1);
});
test('sloped road stays intact when its crossing is below a hillside building',()=>{
 const road=[{x:-100,y:0,z:0},{x:100,y:100,z:0}];
 const highBuilding={x:-70,z:0,w:20,d:20,base:60,top:120};
 const result=clipRoadToFreeSegments(road,8,[highBuilding],1);
 assert.equal(result.paths.length,1);
 assert.equal(result.stats.clippedSegments,0);
});
test('sloped road clips only where its local elevation reaches a building',()=>{
 const road=[{x:-100,y:0,z:0},{x:100,y:100,z:0}];
 const building={x:0,z:0,w:20,d:20,base:40,top:60};
 const result=clipRoadToFreeSegments(road,8,[building],1);
 assert.equal(result.paths.length,2);
 assert.equal(result.stats.clippedSegments,1);
});
test('sloped road remains clear when the crossed building is entirely below it',()=>{
 const road=[{x:-100,y:80,z:0},{x:100,y:100,z:0}];
 const lowBuilding={x:0,z:0,w:20,d:20,base:0,top:55};
 const result=clipRoadToFreeSegments(road,8,[lowBuilding],1);
 assert.equal(result.paths.length,1);
 assert.equal(result.stats.clippedSegments,0);
});
test('six canonical terrace paths and building reservations agree',()=>{
 const center=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
 const road=chongqingTerraceRoads(center);
 assert.equal(road.length,6);
 assert.ok(road.every(p=>p.points.length===73));
 const c=road[0].points[24];
 assert.equal(roadReserveAtSite({x:c.x,z:c.z,w:16,d:12},road,0,1),true);
 assert.equal(roadReserveAtSite({x:2000,z:2000,w:16,d:12},road,0,1),false);
});
const urbanText=(await readFile(new URL('../assets/chongqing/urban-architecture.js',import.meta.url),'utf8'))
 .replace("from './road-clearance.js'",'from '+JSON.stringify(toURL(moduleText)));
const {createChongqingUrbanArchitecture}=await import(toURL(urbanText));
class Geo{setAttribute(){}setIndex(){}computeVertexNormals(){}}
class Mat{constructor(x={}){Object.assign(this,x)}}
class Color{set(){return this}}
class Obj{constructor(){this.position={set(){}},this.scale={set(){}},this.rotation={set(){}},this.matrix={}}updateMatrix(){}}
class Instanced{
 constructor(g,m,n){this.capacity=n;this.count=0;this.instanceMatrix={setUsage(){}}}
 setMatrixAt(i){assert.ok(i<this.capacity)}
 setColorAt(i){assert.ok(i<this.capacity)}
 computeBoundingSphere(){}
}
const THREE={BufferGeometry:Geo,Float32BufferAttribute:Geo,InstancedMesh:Instanced,
 Mesh:class{constructor(geometry,material){this.geometry=geometry;this.material=material}},
 BoxGeometry:Geo,PlaneGeometry:Geo,MeshStandardMaterial:Mat,MeshBasicMaterial:Mat,
 Object3D:Obj,Color,StaticDrawUsage:1,DoubleSide:2};
test('procedural Chongqing towers leave roads, bridges and each other clear',()=>{
 let seed=9862;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const center=x=>14*Math.sin(x/130)+29*Math.sin(x/340);
 const roads=chongqingTerraceRoads(center),obstacles=[];
 const result=createChongqingUrbanArchitecture({THREE,scene:{add(){}},
  ground:()=>25,riverDist:(x,z)=>Math.abs(z-center(x))-78,riverCenter:center,
  rand,obstacles,pbr:{},plannedRoads:roads});
 assert.ok(result.stats.towers>60);
 for(let i=0;i<obstacles.length;i++){
   const b=obstacles[i];
   assert.equal(roadReserveAtSite(b,roads,0,2),false,'tower overlaps road '+i);
   for(const bx of [40,470])assert.ok(
     Math.abs(b.x-bx)>=b.w*.5+8.5||Math.abs(b.z)>=b.d*.5+167.5,
     'tower overlaps bridge '+i);
   for(let j=0;j<i;j++){const a=obstacles[j];
     assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)*.5-2||
       Math.abs(a.z-b.z)>=(a.d+b.d)*.5-2,'adjacent towers intersect');
   }
 }
 assert.ok(result.stats.skippedRoadOverlap+result.stats.skippedBridgeOverlap+
   result.stats.skippedAdjacentBuilding>0);
});
