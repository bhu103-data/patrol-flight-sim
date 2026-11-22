// Four-map scoped regression. Node-only geometry checks are NOT screenshot acceptance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeVegasRidgeDEM} from '../assets/vegas/usgs-ridges.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const cq=await readFile(new URL('../assets/chongqing/details.js',import.meta.url),'utf8');
const dem=JSON.parse(await readFile(new URL('../assets/vegas/strip-ridges-3dep.json',import.meta.url),'utf8'));
const sourceBetween=(first,last)=>{
  const a=html.indexOf(first),b=html.indexOf(last,a+first.length);
  assert.ok(a>0&&b>a,'missing scoped runtime segment '+first);
  return html.slice(a,b);
};

test('USGS 3DEP ridge generator is real-data guarded, with a complete flyable fallback',()=>{
  const source=sourceBetween('  function buildVegasCoreRidgeSample(geometry) {',
    '  function buildVegasStrip(geometry) {');
  const sample=(measured)=>{
    const addTri=[],addQuad=[];
    const build=new Function('sampleTerrainHeight','VEGAS_BOULEVARD','vegasMeasuredRidges',
      source+'; return buildVegasCoreRidgeSample;')(
        (x,z)=>12.0+.003*Math.sin(x+z),-35,measured);
    const stats=build({
      addTri:(a,b,c,color)=>addTri.push({a,b,c,color}),
      addQuad:(a,b,c,d,color)=>addQuad.push({a,b,c,d,color})
    });
    return {stats,triangles:addTri,quads:addQuad};
  };
  const fallback=sample(null),measured=sample(decodeVegasRidgeDEM(dem));
  assert.equal(fallback.stats.mountainTriangles,768);
  assert.equal(measured.stats.mountainTriangles,1536);
  assert.equal(measured.stats.roadTriangles,18);
  assert.equal(measured.quads.length,9);
  for(const {a,b,c} of measured.triangles){
    const normalY=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    assert.ok(normalY>0,'ridge winding must face up');
    for(const vertex of [a,b,c]){
      assert.ok(vertex.every(Number.isFinite));
      assert.ok(Math.abs(vertex[0])>=686,'mountains stay away from hotel/traffic core');
    }
  }
  assert.match(html,/if\(selectedMap\.vegas\)\{[\s\S]*?loadVegasRidgeDEM\(\)/);
  assert.match(html,/buildVegasCoreRidgeSample\(geometry\)/);
});

test('Lower Manhattan LOD relief and surveyed footprint path remain disjoint',()=>{
  const city=sourceBetween('  function buildCityBuildings(parcels,local=false) {',
    '  function buildCityTraffic(');
  assert.match(city,/if\(!local&&lot\[7\]\)\{[\s\S]*?buildOfficialFootprintMesh/);
  assert.match(city,/Selectively relieve distant Lower Manhattan silhouettes/);
  assert.match(city,/east>-185&&east<175&&north>-526&&north<-155/);
  assert.match(city,/\(\(parcelSeed>>>4\)&3\)===0/);
  assert.match(city,/addModelBox\(addQuad,x,rowY,facadeZ/);
});

test('named Times Square facades keep one ad set, survey geometry and batched mounting quads',()=>{
  const district=sourceBetween('  function buildTimesSquareDistrict(',
    '  function buildVegasRides(');
  assert.match(district,/const survey=NYC_TIMES_VERIFIED_FOOTPRINTS\[b\.name\]/);
  assert.match(district,/buildOfficialFootprintMesh\(addTri,addQuad,lot,ground,4\)/);
  assert.match(district,/Source-site screens gain lightweight mounting trusses/);
  assert.match(district,/band\(-w\*\.34,w\*\.34/);
  assert.match(district,/if\(side===b\.front\)for\(const \[hgt,size,tint,label\] of panels\)/);
});

test('Vegas major hotel crowns reuse existing geometry and avoid added colliders',()=>{
  const hotel=sourceBetween('    function hotelTower(name,','    const bellagio=VEGAS_SITES.bellagio;');
  assert.match(hotel,/if\(floors>=18\)/);
  assert.match(hotel,/Math\.min\(11,Math\.floor\(width\/3\.8\)\)/);
  const crown=hotel.slice(hotel.indexOf('// Hotel-specific roof crown relief'));
  assert.doesNotMatch(crown,/solidAt\(/);
});

test('Chongqing street textures/physical details are licensed and in existing pools',()=>{
  assert.match(cq,/const pavedStone=pbr\?\.stone\?\.clone\?\.\(\)/);
  assert.match(cq,/paving:pavedStone/);
  assert.match(cq,/River-facing service bays: recessed door transoms/);
  assert.match(cq,/put\('rail',x-2\.30,y\+5\.48,waterfront-2\.63/);
  assert.match(cq,/Narrow curb seams at a known upper-market terrace/);
  assert.doesNotMatch(cq,/googleapis\.com\/maps|google\.com\/maps\/api/);
});
