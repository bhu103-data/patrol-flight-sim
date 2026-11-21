// Narrow regression for the Vegas core visual sample: deliberately no GPU.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function extract(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>0&&b>a,'missing authored function '+start);
 return html.slice(a,b);
}
const sampleSource=extract('  function buildVegasCoreRidgeSample(geometry) {',
  '  function buildVegasStrip(geometry) {');
function scene(){
 const triangles=[],quads=[];
 const build=new Function('sampleTerrainHeight','VEGAS_BOULEVARD',
  sampleSource+'return buildVegasCoreRidgeSample;')(
    (x,z)=>13.6+Math.sin(x/60)*.4+Math.sin(z/75)*.7,-35);
 const stats=build({
   addTri:(a,b,c,rgb)=>triangles.push({a,b,c,rgb}),
   addQuad:(a,b,c,d,rgb)=>quads.push({a,b,c,d,rgb})
 });
 return {stats,triangles,quads};
}
test('original Vegas ridge meshes stay within tight triangle budget',()=>{
 const {stats,triangles,quads}=scene();
 assert.equal(stats.mountainTriangles,216);
 assert.equal(stats.roadTriangles,18);
 assert.equal(triangles.length,216);
 assert.equal(quads.length,9);
 assert.ok(stats.triangles<=240);
});
test('mountain wings are outside the authored casino blocks and roads',()=>{
 const {triangles}=scene();
 assert.ok(triangles.every(tri=>[tri.a,tri.b,tri.c].every(p=>
   Math.abs(p[0])>=686&&Math.abs(p[0])<=847&&
   p[2]>=-666&&p[2]<=666&&Number.isFinite(p[1]))));
 const west=triangles.filter(t=>t.a[0]<0);
 const east=triangles.filter(t=>t.a[0]>0);
 assert.equal(west.length,108);assert.equal(east.length,108);
});
test('both Vegas ridge wings have upward-facing triangle normals',()=>{
 const {triangles}=scene();
 assert.equal(triangles.length,216);
 for(const [i,{a,b,c}] of triangles.entries()){
  const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
  assert.ok(ny>0,`ridge triangle ${i} is downward-facing or degenerate`);
 }
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

test('ridge QA captures both wings from real Vegas scenic landmarks',async()=>{
 const script=await readFile(new URL('../scripts/vegas-core-browser-smoke.mjs',import.meta.url),'utf8');
 assert.match(html,/site:VEGAS_SITES\.bellagio/);
 assert.match(html,/site:VEGAS_SITES\.venetian/);
 assert.match(script,/\['west','Bellagio'\]/);
 assert.match(script,/\['east','The Venetian'\]/);
 assert.match(script,/vegas-ridge-.*-noon\.png/);
});
