// Count triangles emitted by the ACTUAL production ferry/cruise/cargo
// mesh generator, without a GPU. Retains current collision/route invariants.
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const begin=html.indexOf('  const SHIP_TYPES = {');
const end=html.indexOf('  function buildMooseMesh()',begin);
if(begin<0||end<begin)throw Error('Cannot isolate production ship generator');
const stats=[];
function createTriangleMesh(){
  const counter={triangles:0,quads:0,triCalls:0};
  return {
    addTri(){counter.triangles++;counter.triCalls++;},
    addQuad(){counter.triangles+=2;counter.quads++;},
    upload(){return {count:counter.triangles*3,...counter};}
  };
}
function addModelBox(addQuad, x,y,z,width,height,length,color) {
  if([x,y,z,width,height,length].some(t=>!Number.isFinite(t))||
     width<=0||height<=0||length<=0)throw Error('Invalid procedural box');
  for(let i=0;i<6;i++)addQuad([0,0,0],[1,0,0],[1,1,0],[0,1,0],color);
}
const factory=new Function('createTriangleMesh','addModelBox',
  html.slice(begin,end)+'; return {SHIP_TYPES,buildShipMesh};');
const {SHIP_TYPES,buildShipMesh}=factory(createTriangleMesh,addModelBox);
for(const kind of ['cruise','ferry','cargo']){
  const mesh=buildShipMesh(kind),bounds=SHIP_TYPES[kind];
  if(mesh.triangles<100||mesh.triangles>15000)throw Error(kind+' triangle budget unexpected');
  stats.push({kind,triangles:mesh.triangles,quads:mesh.quads,
    emittedVertices:mesh.count,halfLength:bounds.halfLength,
    halfWidth:bounds.halfWidth,collisionTop:bounds.top});
}
const output={
  source:'index.html production SHIP_TYPES / buildShipMesh',
  scope:'actual triangle counts on current main-derived draft, prior to external visual-only LOD',
  route_count_max:4,
  animated_route_pace_method:'setBoatPace uses 96-segment arc-length table',
  collision:'vehicleAt and usableFloatWater use SHIP_TYPES for hull dimensions; must not depend on imported GLB',
  wrecks:'drawSplitShip uses procedural pieces',
  inventory:stats
};
mkdirSync('nyc-harbor-audit',{recursive:true});
writeFileSync('nyc-harbor-audit/procedural-ship-inventory.json',
  JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
