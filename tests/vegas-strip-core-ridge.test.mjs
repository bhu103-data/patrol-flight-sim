// Narrow regression for the Vegas core visual sample: deliberately no GPU.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeVegasRidgeDEM} from '../assets/vegas/usgs-ridges.js';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function extract(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>0&&b>a,'missing authored function '+start);
 return html.slice(a,b);
}
const sampleSource=extract('  function buildVegasCoreRidgeSample(geometry) {',
  '  function buildVegasStrip(geometry) {');
function scene(measured=null){
 const triangles=[],quads=[];
 const build=new Function('sampleTerrainHeight','VEGAS_BOULEVARD','vegasMeasuredRidges','vegasMeasuredStripX',
  sampleSource+'return buildVegasCoreRidgeSample;')(
    (x,z)=>13.6+Math.sin(x/60)*.4+Math.sin(z/75)*.7,-35,measured,()=>-35);
 const stats=build({
   addTri:(a,b,c,rgb)=>triangles.push({a,b,c,rgb}),
   addQuad:(a,b,c,d,rgb)=>quads.push({a,b,c,d,rgb})
 });
 return {stats,triangles,quads};
}
test('original Vegas ridge meshes stay within tight triangle budget',()=>{
 const {stats,triangles,quads}=scene();
 assert.equal(stats.mountainTriangles,768);
 assert.equal(stats.roadTriangles,114);
 assert.equal(triangles.length,768);
 assert.equal(quads.length,57);
 assert.ok(stats.triangles<=900);
});
test('mountain wings are outside the authored casino blocks and roads',()=>{
 const {triangles}=scene();
 assert.ok(triangles.every(tri=>[tri.a,tri.b,tri.c].every(p=>
   Math.abs(p[0])>=686&&Math.abs(p[0])<=847&&
   p[2]>=-666&&p[2]<=666&&Number.isFinite(p[1]))));
 const west=triangles.filter(t=>t.a[0]<0);
 const east=triangles.filter(t=>t.a[0]>0);
 assert.equal(west.length,384);assert.equal(east.length,384);
});
test('flush Strip surface repairs have no physical colliders or textures',()=>{
 const {quads}=scene();
 assert.ok(quads.every(q=>[q.a,q.b,q.c,q.d].every(p=>
   p[0]>=-44&&p[0]<=-26&&p[2]>=-210&&p[2]<=-120)));
 assert.match(html,/buildVegasRoads\(box,lamp,addQuad\);\s*\/\/ Geometry is batched/);
 assert.match(html,/buildVegasCoreRidgeSample\(geometry\)/);
 assert.match(html,/buildVegasStrip\(\{box,lamp,cylinder,solidAt,place,addTri:solid\.addTri,addQuad:solid\.addQuad/,
   'real Vegas map builder must pass triangulation callback');
 assert.doesNotMatch(sampleSource,/solidAt\(|fetch\(|import\(/);
});

test('fixed QA camera names a real Vegas scenic view',async()=>{
 const script=await readFile(new URL('../scripts/vegas-core-browser-smoke.mjs',import.meta.url),'utf8');
 assert.match(html,/site:\{name:'Strip Street View'\}/);
 assert.match(script,/selectOption\(\{label:'Strip Street View'\}\)/);
});
test('survey-backed ridge mesh truly replaces synthetic heights',async()=>{
 const payload=JSON.parse(await readFile(new URL('../assets/vegas/strip-ridges-3dep.json',import.meta.url),'utf8'));
 const measured=decodeVegasRidgeDEM(payload);
 const original=scene(),survey=scene(measured);
 assert.equal(original.stats.mountainTriangles,768);
 assert.equal(survey.stats.mountainTriangles,1536);
 assert.equal(survey.stats.triangles,1650);
 assert.notEqual(survey.triangles.length,original.triangles.length,
   'verified 2D DEM must replace four-band 1D ridge silhouette');
 const actualHeights=survey.triangles.flatMap(face=>
   [face.a,face.b,face.c].map(p=>p[1]));
 assert.ok(Math.max(...actualHeights)-Math.min(...actualHeights)>40,
   'survey DEM mesh must preserve measured mountain relief');
 assert.ok(survey.triangles.every(face=>[face.a,face.b,face.c].every(p=>
   p.every(Number.isFinite))),'no invalid game vertices');
});
test('real 2D foothills connect to desert grade and have upward-facing winding',async()=>{
 const payload=JSON.parse(await readFile(new URL('../assets/vegas/strip-ridges-3dep.json',import.meta.url),'utf8'));
 const {triangles}=scene(decodeVegasRidgeDEM(payload));
 const terrain=(x,z)=>13.6+Math.sin(x/60)*.4+Math.sin(z/75)*.7;
 let seam=0;
 for(const {a,b,c} of triangles){
   const p=[a,b,c];
   for(const [x,y,z] of p)if(Math.abs(x)===686){
     assert.ok(Math.abs(y-terrain(x,z))<1e-7,'terrain ridge edge must touch desert');
     seam++;
   }
   const crossY=(b[2]-a[2])*(c[0]-a[0])-
     (b[0]-a[0])*(c[2]-a[2]);
   assert.ok(crossY>0,'all rendered USGS mountain surface normals must face up');
 }
 assert.ok(seam>=90);
});
