import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const url=new URL('../assets/alaska/alaska-fjord-detail.js',import.meta.url);
const script=readFileSync(new URL('../index.html',import.meta.url),'utf8');
// Load as an ESM data URL; the repository intentionally has no package.json.
const {buildAlaskaFjordDetail}=await import('data:text/javascript;base64,'+
  Buffer.from(readFileSync(url,'utf8')).toString('base64'));

test('Alaska detail draws one bounded, finite scene batch',()=>{
  const points=[];
  const addTri=(a,b,c,color)=>{
    for(const p of [a,b,c]){
      assert.equal(p.length,3);
      for(const v of p)assert.ok(Number.isFinite(v),'mesh coordinates must be finite');
      assert.ok(Math.abs(p[0])<900&&Math.abs(p[2])<900,'keep geometry within map');
      assert.ok(p[1]>=0&&p[1]<160,'avoid unbounded heights');
      points.push(p);
    }
    assert.ok(color.every(v=>v>=0&&v<=1),'valid linear colour');
  };
  const addQuad=(a,b,c,d,color)=>{addTri(a,b,c,color);addTri(a,c,d,color);};
  const terrainAt=(x,z)=>{
    if(z>410) return 21+Math.cos(x/75)*2;
    if(x<-215)return 35+Math.cos(z/120)*4;
    return 12.2;
  };
  const stats=buildAlaskaFjordDetail({addTri,addQuad,terrainAt,waterY:12.2});
  assert.ok(stats.crevasses>=15,'multiple glacier fissures');
  assert.ok(stats.iceFloes>=25,'irregular floes along the fjord');
  assert.ok(stats.rockBands>=1,'terrain-clamped geological exposure');
  assert.equal(stats.seracs,28,'broad glacier front avoids repetitive ice-pillar fence');
  assert.equal(stats.iceStrata,62,'sparse uneven glacier strata without repeated stripes');
  assert.ok(stats.branchlets>=80&&stats.branchlets<=850,
    'irregular bounded conifer branchlets make near-field trees less conical');
  assert.ok(stats.talus>=0&&stats.talus<=110,'terrain-filtered rock scree stays bounded');
  assert.ok(points.length<116000,'bounded terrain-aware forestry and calving GPU budget');
  assert.ok(stats.conifers>=180&&stats.conifers<=940,'dense but bounded Alaska forest');
});

test('detail is gated behind the Alaska map and map-switch lifetime',()=>{
  assert.match(script,/if\(selectedMap\.alaska && !graphicsCompat && smoothScenery\(\)\)/);
  assert.match(script,/heroEpoch!==nycHeroEpoch/);
  assert.match(script,/disposeSceneMesh\(alaskaDetailMesh\)/);
  assert.match(script,/if\(selectedMap\.alaska && alaskaDetailMesh\?\.count\)/);
  assert.match(script,/vec3 alaskaAurora\(vec3 rd\)/);
  assert.match(script,/float glacier=1\.0-smoothstep/);
});
