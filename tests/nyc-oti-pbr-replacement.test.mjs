// Run: node --test tests/nyc-oti-pbr-replacement.test.mjs
// 100 official OTI Financial District buildings: true polygon geometry,
// separate masonry/window/roof PBR tags, no fake procedural window overlay.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const asset=JSON.parse(await readFile(
  new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
const begin=html.indexOf('  function buildOfficialFootprintMesh(');
const end=html.indexOf('  function buildCityBuildings(',begin);
assert.ok(begin>0&&end>begin,'OTI mesh helper must be present');
const make=new Function(html.slice(begin,end)+'return buildOfficialFootprintMesh;')();

const area3=(a,b,c)=>{
  const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
  return .5*Math.hypot(u[1]*v[2]-u[2]*v[1],
    u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
};
const roofArea=(a,b,c)=>Math.abs(
  (b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))*.5;
function trace(){
  const count=new Map();let invalid=0,fronts=0,roofTris=0;
  const record=(surface,geometry)=>{
    assert.ok([9,10,11].includes(surface),
      'municipal buildings must not reuse vehicle surface 5');
    count.set(surface,(count.get(surface)||0)+1);
    for(const xyz of geometry)if(!Array.isArray(xyz)||xyz.length!==3||
       !xyz.every(Number.isFinite))invalid++;
    if(area3(...geometry.slice(0,3))<=.000001)invalid++;
  };
  for(const [id,x,z,w,d,h,poly] of asset.footprints){
    const stats=make((a,b,c,color,surface)=>{
      record(surface,[a,b,c]);roofTris++;
      if(surface!==11||roofArea(a,b,c)<.000001)invalid++;
    },(a,b,c,d,color,surface)=>{
      record(surface,[a,b,c,d]);fronts++;
      if(surface===11)invalid++;
    },[x,z,w,d,h,(id%101)/101,false,poly,id],14.58,3);
    assert.ok(stats.walls>0&&stats.roof>0);
  }
  return {count,invalid,fronts,roofTris};
}
test('all 100 government polygons use tagged render faces, never vehicle glass',()=>{
  assert.equal(asset.footprints.length,100);
  const {count,invalid,fronts,roofTris}=trace();
  assert.equal(invalid,0,'no degenerate or invalid polygon faces');
  assert.ok(count.get(9)>=700,'enough stone and architectural frames');
  assert.ok(count.get(10)>=1000,'high-detail windows are real geometry');
  assert.ok(count.get(11)>=500,'all surveyed rooftops preserved');
  assert.ok(fronts<9000&&roofTris<1500,
    'budget for 100 municipal shells, including authentic windows and roof triangulation');
});
test('both municipal sources share PBR classes, not generic box shader',()=>{
  assert.match(html,/PATROL_NYC_GIS_PBR_V13/);
  assert.match(html,/float materialClass=surveyedWall\?0\.0:mod\(floor\(vHarborSurface\+\.5\),3\.0\)/);
  assert.match(html,/nyOfficialGisPbr\(material,n,surfaceRoughness\)/);
  assert.match(html,/vHarborSurface>14\.5 && !surveyedWall\)\)return/);
  assert.match(html,/vHarborSurface==10\.0/);
  assert.match(html,/!realGlass &&\s*!\(vHarborSurface>8\.5 && vHarborSurface<14\.5\)/);
});
test('actual municipal footprint replacement keeps original airport, jet and sea',()=>{
  assert.match(html,/buildOfficialFootprintMesh\(addTri,addQuad,lot,y,detailBand\)/);
  assert.match(html,/officialLotAt\(east,north\)\|\|cityParcels\.get/);
  assert.match(html,/float waterReflectance/);
  assert.match(html,/function advanceFlight\(dt\)/);
  assert.match(html,/nycGisMesh\?\.count/);
});
