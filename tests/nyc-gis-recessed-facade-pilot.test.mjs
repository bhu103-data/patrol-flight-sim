import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emitRecessedFacade} from '../assets/nyc/nyc-gis-recessed-facade-pilot.mjs';

const gisText=await readFile(
  new URL('../assets/nyc/nyc-gis-infill.js',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
const dataset=JSON.parse(await readFile(
  new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
const build=new Function(gisText.replace(/^export /gm,'')+
  '\nreturn buildTimesSquareGisInfill;')();

test('recessed window cuts an actual front-wall VOID rather than painting a pane',()=>{
  const quads=[];
  const spec={a:[0,0],b:[10,0],ground:0,top:17,
    wall:[.5,.45,.4],maxWindows:16,
    addQuad:(a,b,c,d,color,surface=0)=>quads.push({vertices:[a,b,c,d],surface,color})};
  const stat=emitRecessedFacade(spec);
  assert.equal(stat.reason,'ok');
  assert.ok(stat.windows>=4&&stat.windows<=16);
  assert.equal(stat.openings.length,stat.windows);
  assert.ok(stat.recess>.10&&stat.recess<=.185);
  const atWall=quads.filter(q=>q.vertices.every(v=>Math.abs(v[2])<1e-6));
  for(const o of stat.openings){
    const x=10*(o.t0+o.t1)/2,y=(o.y0+o.y1)/2;
    assert.ok(!atWall.some(q=>{
      const xs=q.vertices.map(v=>v[0]),ys=q.vertices.map(v=>v[1]);
      return x>Math.min(...xs)+1e-6&&x<Math.max(...xs)-1e-6 &&
             y>Math.min(...ys)+1e-6&&y<Math.max(...ys)-1e-6;
    }),'opaque exterior wall still covers window aperture');
  }
  assert.equal(quads.filter(q=>q.surface===7).length,stat.windows);
  assert.ok(quads.some(q=>q.vertices.some(v=>v[2]<-.10)),
    'actual negative-depth reveal missing');
  assert.ok(quads.every(q=>q.vertices.flat().every(Number.isFinite)));
});
test('actual GIS source builder chooses only bounded architectural façades',()=>{
  function run(recessedFacade){
    let quadCount=0,triCount=0;
    const out=build(dataset,{ground:14.95,
      bounds:[-34,56,-52,68],protectedSites:[],
      addQuad(){quadCount++},addTri(){triCount++},box(){quadCount+=6},
      recessedFacade});
    return {out,quadCount,triCount};
  }
  const standard=run(null),pilot=run(emitRecessedFacade);
  assert.equal(standard.out.recessedPilot.active,false);
  assert.equal(standard.out.recessedPilot.windows,0);
  assert.ok(pilot.out.recessedPilot.facades>0);
  assert.ok(pilot.out.recessedPilot.windows>0);
  assert.ok(pilot.out.recessedPilot.windows<=280);
  assert.ok(pilot.out.recessedPilot.facades<=28);
  assert.ok(pilot.out.recessedPilot.quads<=3200);
  assert.equal(pilot.out.recessedPilot.active,true);
  assert.ok(pilot.quadCount>standard.quadCount);
  assert.equal(pilot.out.sourceBuildings,standard.out.sourceBuildings,
    'building source identities must survive');
  assert.equal(pilot.out.roofTriangles,standard.out.roofTriangles,
    'no false roof/lot geometry changes');
  assert.deepEqual(pilot.out.materialSurfaceIds,[6,7,8]);
});
test('pilot is opt-in, NYC GIS-only, with unchanged normal fallback/flight',()=>{
  assert.match(index, /get\('nycArchitecture'\)==='1'/);
  assert.match(index, /architecturePilot\s*\?import\('\.\/assets\/nyc\/nyc-gis-recessed-facade-pilot\.mjs'\)/);
  assert.match(index, /:Promise\.resolve\(null\)/);
  assert.match(index, /recessedFacade:architecture\?\.emitRecessedFacade\|\|null/);
  assert.match(gisText, /recessedFacade=null/);
  assert.match(index, /if\(selectedMap\.city && nycGisMesh\?\.count\)/);
  assert.match(index, /if\(!graphicsCompat && smoothScenery\(\) &&/);
});
test('bad, very short or too-low walls have no geometric side effects',()=>{
  for(const override of [
    {top:5},{b:[.1,0]},{maxWindows:0},{a:[NaN,0]}
  ]){
    let called=0;
    const z=emitRecessedFacade({
      a:[0,0],b:[10,0],ground:0,top:18,wall:[.5,.5,.5],
      addQuad:()=>called++,...override});
    assert.equal(z.windows,0);
    assert.equal(called,0);
  }
});
