// Execute the production NYC OTI facade builder against the bundled official
// polygon snapshot. The geometry is game-scale and the window design is authored,
// not surveyed NYC window/door measurements.
// Run: node --test tests/nyc-oti-harbor-window-depth.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const snapshot=JSON.parse(await readFile(
  new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'
)).footprints;
const start=html.indexOf('function buildOfficialFootprintMesh(');
assert.ok(start>0,'production polygon generator exists');
const open=html.indexOf('{',start);
let level=0,end=-1;
for(let i=open;i<html.length;i++){
  if(html[i]==='{')level++;
  else if(html[i]==='}'&&--level===0){end=i+1;break;}
}
assert.ok(end>start);
const implementation=html.slice(start,end);
const gate='const detailedHarborFront=detailBand===3 && y<20 &&';
assert.ok(implementation.includes(gate),'bounded near-harbor window gate exists');
const compile=src=>new Function(src+';return buildOfficialFootprintMesh')();
const detailed=compile(implementation);
const disabled=compile(implementation.replace(gate,
  'const detailedHarborFront=false &&'));

function render(builder,row,band=3,demolished=false){
  const quads=[],triangles=[];
  const tone=((row[0]%101)+101)%101/101;
  const lot=[row[1],row[2],row[3],row[4],row[5],tone,demolished,row[6],row[0]];
  const stats=builder((...args)=>triangles.push(args),
    (...args)=>quads.push(args),lot,14.58,band);
  return {quads,triangles,stats};
}
function extrasAndInvariants(record,band=3,demolished=false){
  const old=render(disabled,record,band,demolished);
  const next=render(detailed,record,band,demolished);
  let cursor=0;
  const added=[];
  for(const quad of next.quads){
    if(cursor<old.quads.length &&
       JSON.stringify(quad)===JSON.stringify(old.quads[cursor]))cursor++;
    else added.push(quad);
  }
  assert.equal(cursor,old.quads.length,
    'new facade details may not delete or reorder original window/wall geometry');
  assert.deepEqual(next.triangles,old.triangles,'GIS roof triangulation is unchanged');
  assert.deepEqual(next.stats,old.stats,'GIS wall, window and roof counts unchanged');
  return {old,next,added};
}
function distanceToSegment(vertex,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],dist=dx*dx+dz*dz;
  if(dist===0)return Math.hypot(vertex[0]-a[0],vertex[2]-a[1]);
  const t=Math.max(0,Math.min(1,
    ((vertex[0]-a[0])*dx+(vertex[2]-a[1])*dz)/dist));
  return Math.hypot(vertex[0]-a[0]-dx*t,vertex[2]-a[1]-dz*t);
}

test('real OTI snapshot gains bounded depth on a few waterfront-facing facades',()=>{
  assert.ok(snapshot.length>=60,'bundled city-footprint fixture expected');
  let enriched=0,additionalFaces=0,checkedVertices=0;
  for(const row of snapshot){
    const {added}=extrasAndInvariants(row);
    if(added.length)enriched++;
    additionalFaces+=added.length;
    for(const quad of added){
      assert.equal(quad.at(-1),9,'relief is material-tagged exterior masonry/metal');
      for(const vertex of quad.slice(0,4)){
        assert.ok(vertex.every(Number.isFinite));
        assert.ok(vertex[1]>=14.58&&vertex[1]<14.58+row[5],
          'window relief stays between base and original roof elevation');
        let nearest=Infinity;
        const polygon=row[6];
        for(let i=0;i<polygon.length;i++)
          nearest=Math.min(nearest,distanceToSegment(vertex,
            polygon[i],polygon[(i+1)%polygon.length]));
        assert.ok(nearest<.164,'window must project <0.164 beyond source footprint');
        checkedVertices++;
      }
    }
  }
  assert.ok(enriched>=12&&enriched<=35,
    'use a limited harbor-focused set of GIS buildings');
  assert.ok(additionalFaces>=350&&additionalFaces<=1600,
    'single-batch near-camera window geometry budget');
  assert.equal(additionalFaces%10,0,
    'each improved window has 10 face elements: jambs, head, sill and reveals');
  assert.ok(checkedVertices>1000);
});

test('exterior windows stay unchanged for distant, low-LOD and demolished lots',()=>{
  const within=snapshot.find(row=>row[1]>-108&&row[1]<-65&&
    row[2]>-495&&row[2]<-410);
  assert.ok(within,'one near-front fixture must be present');
  for(const band of [1,2]){
    assert.deepEqual(extrasAndInvariants(within,band).added,[],
      'distant LOD should not get physical window frames');
  }
  assert.deepEqual(extrasAndInvariants(within,3,true).added,[],
    'destroyed building cannot grow glass details');
  const outside=snapshot.find(row=>row[1]<-110||row[1]>-60||
    row[2]<-500||row[2]>-400);
  assert.ok(outside,'a non-focus lot must be present');
  assert.deepEqual(extrasAndInvariants(outside).added,[],
    'other NYC neighborhoods retain the original facade budget');
});

test('all new window details remain in original GIS geometry batch',()=>{
  const src=html.slice(html.indexOf('function buildCityBuildings('),
    html.indexOf('function tintSeed(',html.indexOf('function buildCityBuildings(')));
  assert.match(src,/buildOfficialFootprintMesh\(addTri,addQuad,lot,y,detailBand\)/,
    'same geometry batch as real polygon mesh');
  assert.doesNotMatch(implementation,/createTriangleMesh|\.upload\(/,
    'window reveal must not create per-window buffers or draws');
});
