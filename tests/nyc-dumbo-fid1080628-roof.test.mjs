// Exact live production geometry audit — one Brooklyn/DUMBO OTI record.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('  const DUMBO_OTI_PILOT=[');
const end=html.indexOf('  function buildCityBuildings(parcels,local=false)',begin);
assert.ok(begin>0&&end>begin);
const runtime=html.slice(begin,end);
const live=new Function('graphicsCompat','smoothScenery','selectedMap',runtime+
 'return {records:DUMBO_OTI_PILOT,match:matchingDumboOtiPilot,mesh:buildDumboOtiPilotSourceMesh}')(
 false,()=>true,{city:true});
const LOT=[366.89,-346.09,9,14.42,19.4,.44,false];
const OTHER=[
 [390.63,-346.49,9,19,13.84,.94,false],
 [358.67,-280.37,9,14.83,16.2,.05,false]
];
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);
function geometry(lot){
 const src=live.match(lot,3),tri=[],quad=[],y=14.58;
 assert.ok(src);
 const out=live.mesh((...args)=>tri.push(args),(...args)=>quad.push(args),lot,src,y);
 return {src,tri,quad,out,y};
}
test('exact official Brooklyn OTI identification is preserved',()=>{
 const one=live.records.find(x=>x.fid===1080628);
 assert.deepEqual([one.bin,one.roofHeightFt],[3389054,121]);
 assert.equal(one.ring.length,12);
 assert.ok(one.ring.every(([lon,lat])=>lon>-73.990&&lon<-73.988&&lat>40.702&&lat<40.703));
 assert.equal(live.match(LOT,2),null);
 assert.equal(live.match([...LOT.slice(0,6),true],3),null);
});
test('nonbox roof has TWO clipped source-outline facets with exact planar coverage',()=>{
 const {out,tri,quad,y}=geometry(LOT);
 assert.equal(out.fid,1080628);
 assert.equal(out.roofAreas,2);
 assert.equal(out.roofStepDrop,.64);
 assert.equal(out.roofStepFaces,2);
 assert.ok(out.facadeBands>=2);
 const roofs=tri.filter(t=>t.at(-1)===14);
 assert.ok(roofs.length>=10&&roofs.length<=14);
 const elevations=[y+LOT[4],y+LOT[4]-.64];
 const heights=new Set();
 let area=0;
 for(const t of roofs){
   const vertices=t.slice(0,3),yy=vertices[0][1];
   assert.ok(elevations.some(e=>Math.abs(e-yy)<1e-7));
   assert.ok(vertices.every(p=>Math.abs(p[1]-yy)<1e-7));
   assert.ok(cross(...vertices)<-.0000001,'upward mesh winding');
   heights.add(yy.toFixed(5));
   area+=Math.abs(cross(...vertices))/2;
 }
 assert.equal(heights.size,2);
 assert.ok(Math.abs(area-out.originalArea)<.00001,
   'source ring must not become a cube rectangle or lose roof area');
 const vertical=quad.filter(q=>q.at(-1)===12 && q.slice(0,4).every(p=>
   Math.abs(p[2]-LOT[1])<.00001) &&
   new Set(q.slice(0,4).map(p=>p[1].toFixed(3))).size===2);
 assert.ok(vertical.length>=1,'actual vertical split-step wall is rendered');
});
test('same single-city mesh, bounded cost and original full-body collision envelope',()=>{
 const {out,quad,tri,y}=geometry(LOT);
 const verts=[...tri.flatMap(t=>t.slice(0,3)),...quad.flatMap(q=>q.slice(0,4))];
 for(const p of verts){
   assert.ok(p.every(Number.isFinite));
   assert.ok(Math.abs(p[0]-LOT[0])<=LOT[2]/2+.0001);
   assert.ok(Math.abs(p[2]-LOT[1])<=LOT[3]/2+.0001);
   assert.ok(p[1]>=y-.000001&&p[1]<=y+LOT[4]+.121);
 }
 assert.ok(tri.length<=14&&quad.length<=1100);
 assert.equal(out.windows,108); assert.equal(out.doors,1);
 assert.equal(out.windowReveals,432);
 assert.equal(out.floors,12,'actual Nexus building is twelve stories');
 assert.equal(out.metalPanels,40,'distinct 3D metal facade spandrels, not one plain wall');
 assert.match(html,/matchingDumboOtiPilot\(lot,detailBand\)/);
 assert.match(html,/buildDumboOtiPilotSourceMesh\(addTri,addQuad,lot,dumbOtiPilot,y\)/);
 assert.match(html,/function isBridgeCollision\(x,y,z,radius=0\)/);
});
test('other two OTI pilot buildings and all other maps keep original flat source roofs',()=>{
 for(const lot of OTHER){
   const {out,tri}=geometry(lot);
   assert.equal(out.roofStepDrop,0);
   assert.equal(out.roofAreas,1);
   assert.equal(out.facadeBands,0);
   assert.equal(out.metalPanels,0);
   assert.notEqual(out.floors,12);
   const roof=tri.filter(t=>t.at(-1)===14);
   assert.ok(roof.every(t=>t.slice(0,3).every(p=>
     Math.abs(p[1]-(14.58+lot[4]))<1e-7)));
 }
 assert.match(html,/selectedMap\.city/);
 assert.match(html,/selectedAircraft==='seaplane'/);
 assert.match(html,/floatOceanPose\(/);
});


test('Nexus palette is 2006-era yellow brick and silver/blue/green metal, not red warehouse',()=>{
 const {out,quad}=geometry(LOT);
 assert.equal(out.fid,1080628);
 const count=quad.filter(q=>q.at(-1)===12&&
   [[.24,.43,.46],[.34,.48,.42],[.65,.70,.71]]
     .some(c=>c.every((v,i)=>Math.abs(q[4][i]-v)<1e-7))).length;
 assert.ok(count>=40,'physical metal sheets and accent courses must enter same game mesh');
 assert.ok(out.metalPanels>=30);
 assert.match(html,/source\.fid===1080628/);
 assert.match(html,/nexus\?12:Math\.max/);
});
