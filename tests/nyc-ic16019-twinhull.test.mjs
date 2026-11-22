// Execute ACTUAL procedural ship builders on CPU, rather than checking a mock boat.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const game=read('index.html');
const ref=JSON.parse(read('assets/nyc/ic16019-ferry-reference.json'));
const from=game.indexOf('  function addModelBox(');
const begin=game.indexOf('  const SHIP_TYPES = {',from);
const end=game.indexOf('  function buildMooseMesh()',begin);
assert.ok(from>0&&begin>from&&end>begin,'production ship builder is present');
const builder=game.slice(from,end);
const mock=()=> {
 let count=0,primitives=0;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const submerged=[];
 function capture(vertices,col){
   count++;
   assert.ok(Array.isArray(col)&&col.length===3&&col.every(Number.isFinite),
      'renderer shader RGB color must stay valid');
   for(const p of vertices){
     assert.ok(p.every(Number.isFinite),'bad ship vertex');
     for(let i=0;i<3;i++){
       min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);
     }
     if(p[1]<=-.5)submerged.push(p);
   }
 }
 return {
   addTri:(a,b,c,col)=>{primitives++;capture([a,b,c],col);},
   addQuad:(a,b,c,d,col)=>{primitives++;capture([a,b,c],col);capture([a,c,d],col);},
   upload:()=>({triangles:count,primitives,min,max,submerged})
 };
};
const {SHIP_TYPES,buildShipMesh}=new Function('createTriangleMesh',
  builder+String.fromCharCode(10)+'return {SHIP_TYPES,buildShipMesh};')(mock);

test('IC16019 design facts are separated from operating waterline and copying permissions',()=>{
 assert.equal(ref.ship.designer,'Incat Crowther');
 assert.equal(ref.ship.overallLengthM,26);
 assert.equal(ref.ship.waterlineLengthM,23.9);
 assert.equal(ref.ship.beamM,8);
 assert.equal(ref.ship.maxDraftM,1.9);
 assert.equal(ref.ship.depthM,2.8);
 assert.equal(ref.ship.operationalDraftM,null,
   'NEVER assume maximum draft equals operating waterline');
 assert.equal(ref.ship.hullModel.type.startsWith('self-authored'),true);
 assert.equal(ref.officialRoute.validatedPATROLGameCoordinates,null);
 assert.equal(ref.officialRoute.routeGeometryVerifiedAgainstShoreAndBridges,false);
 assert.deepEqual(ref.officialRoute.stopCodes,['2319811','2319810']);
 assert.match(ref.ship.sourceRights,/NOT copied or redistributed/);
});

test('NYC has 26×8 game scale envelope and distinct under-deck twin hulls',()=>{
 assert.equal(SHIP_TYPES.nycFerry.halfLength,13);
 assert.equal(SHIP_TYPES.nycFerry.halfWidth,4);
 const mesh=buildShipMesh('nycFerry');
 const spans=mesh.max.map((n,i)=>+(n-mesh.min[i]).toFixed(2));
 assert.deepEqual([spans[0],spans[2]],[8.02,26],
   'decorative railings may extend 1cm beyond the 8m nominal beam');
 assert.equal(mesh.triangles,3150);
 assert.ok(mesh.triangles<ref.ship.hullModel.performanceGoal.trianglesUnder);
 assert.ok(mesh.submerged.length>=40,'must have visible twin submerged hulls');
 assert.ok(Math.min(...mesh.submerged.map(p=>Math.abs(p[0])))>1.6,
   'center tunnel must remain EMPTY below existing .46 local skirt');
 assert.equal(mesh.min[1],-.6,
   'existing Y placement is preserved and not derived from 1.9m MAX draft');
});

test('legacy ferry and non-NYC vessel meshes remain untouched',()=>{
 assert.deepEqual(SHIP_TYPES.ferry,{halfLength:13,halfWidth:3.3,top:7.5,name:'ferry'});
 const old=buildShipMesh('ferry'),ny=buildShipMesh('nycFerry');
 assert.equal(old.triangles,3090,'existing ferry construction must be identical');
 assert.equal(ny.triangles-old.triangles,60,'new native detail cost bounded');
 assert.ok(Math.min(...old.submerged.map(p=>Math.abs(p[0])))<.01,
   'legacy monohull remains for non-NYC maps');
 assert.equal(buildShipMesh('cruise').triangles,7341);
 assert.equal(buildShipMesh('cargo').triangles,2373);
});

test('only the already-authored NYC map selects this ferry; existing safety interfaces survive',()=>{
 assert.match(game,/baseKind==='ferry'\?'nycFerry':baseKind/);
 assert.match(game,/selectedMap\.city && baseKind==='ferry'/);
 assert.match(game,/const size = SHIP_TYPES\[kind\]/);
 assert.match(game,/const shipMeshes = Object\.fromEntries\(Object\.keys\(SHIP_TYPES\)/);
 assert.match(game,/const route = \{ x, z, rx: kind === 'cruise' \? 23 : 24, rz: 48\+index\*3 \}/);
 assert.match(game,/boatWakes\.set\(\[x-Math\.sin\(yaw\)\*length,z-Math\.cos\(yaw\)\*length,yaw,boat\.halfWidth\]/);
 assert.match(game,/const maxReach=Math\.hypot\(ship\.halfLength,ship\.halfWidth\)/);
 assert.match(game,/drawMesh\(shipMeshes\[boat\.kind\],mat4FromBasis\(\[x,WATER_H\+bob,z\]/);
 const script=game.slice(game.indexOf('<script>')+8,game.indexOf('</script>',game.indexOf('<script>')));
 assert.doesNotThrow(()=>new Script(script),'full native game JS must compile');
});

test('no third-party texture download, direct GPS path, or extra renderer added',()=>{
 assert.equal(ref.ship.hullModel.shader.includes('native PATROL WebGL2'),true);
 assert.equal(ref.officialRoute.worldToLatLonTransform,null);
 assert.equal(ref.officialRoute.status.includes('NOT replaced'),true);
 assert.ok(!builder.includes('fetch(')&&!builder.includes('GLTFLoader'),
   'must remain original procedural mesh upload and not run Gemini drafts');
});
