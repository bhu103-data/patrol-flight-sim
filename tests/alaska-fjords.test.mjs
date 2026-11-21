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
  let iceTriangles=0,ordinaryTriangles=0;
  const addTri=(a,b,c,color,surface=0)=>{
    if(surface===12)iceTriangles++;
    else ordinaryTriangles++;
    for(const p of [a,b,c]){
      assert.equal(p.length,3);
      for(const v of p)assert.ok(Number.isFinite(v),'mesh coordinates must be finite');
      assert.ok(Math.abs(p[0])<900&&Math.abs(p[2])<900,'keep geometry within map');
      assert.ok(p[1]>=0&&p[1]<160,'avoid unbounded heights');
      points.push(p);
    }
    assert.ok(color.every(v=>v>=0&&v<=1),'valid linear colour');
  };
  const addQuad=(a,b,c,d,color,surface=0)=>{
    addTri(a,b,c,color,surface);addTri(a,c,d,color,surface);
  };
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
  assert.ok(iceTriangles>=250,'calving face and crevasses use dedicated ice PBR surface 12');
  assert.ok(ordinaryTriangles>=500,'forest and rocks retain original untextured surface tags');
  assert.ok(stats.branchlets>=80&&stats.branchlets<=850,
    'irregular bounded conifer branchlets make near-field trees less conical');
  assert.ok(stats.talus>=0&&stats.talus<=110,'terrain-filtered rock scree stays bounded');
  assert.ok(points.length<165000,'bounded terrain-aware forestry and calving GPU budget');
  assert.ok(stats.conifers>=180&&stats.conifers<=940,'dense but bounded Alaska forest');
  assert.ok(stats.foliageWhorls>=5*stats.conifers &&
            stats.foliageWhorls<=6*stats.conifers,
    'each spruce has five or six asymmetric layered bough whorls');
  assert.ok(stats.snowBoughs>=0 && stats.snowBoughs<3200,
    'snow-laden branches are altitude-dependent and bounded');
});

test('detail is gated behind the Alaska map and map-switch lifetime',()=>{
  assert.match(script,/if\(selectedMap\.alaska && !graphicsCompat && smoothScenery\(\)\)/);
  assert.match(script,/heroEpoch!==nycHeroEpoch/);
  assert.match(script,/disposeSceneMesh\(alaskaDetailMesh\)/);
  assert.match(script,/if\(selectedMap\.alaska && alaskaDetailMesh\?\.count\)/);
  assert.match(script,/vec3 alaskaAurora\(vec3 rd\)/);
  assert.match(script,/float glacier=1\.0-smoothstep/);
  assert.match(script,/float iceNear=glacier\*\(1\.0-smoothstep\(82\.0,245\.0,hitDist\)\)/);
  assert.match(script,/float clearGlance=pow/);
  assert.match(script,/float splitPhase=flow\.x\*\.31/);
  assert.match(script,/glacier\*\.31/);
  assert.match(script,/float snowTile=max\(step\(\.51,frost\),step\(\.30,glacier\)\)/);
  assert.match(script,/void alaskaGlacierFace\(/);
  assert.match(script,/uniform bool uAlaskaMesh;/);
  assert.match(script,/if\(!map\.alaska\)meshSource=meshSource\.replace/);
  assert.match(script,/gl\.uniform1i\(uMesh\.alaskaMesh,Boolean\(selectedMap\.alaska\)\)/);
  assert.match(script,/vHarborSurface<11\.5 \|\| vHarborSurface>12\.5/);
  assert.match(script,/alaskaGlacierFace\(material,n,surfaceRoughness\)/);
  assert.match(script,/alaskaPhotoAlbedo:gl\.getUniformLocation\(meshProg/);
  assert.match(script,/gl\.uniform1i\(uMesh\.alaskaPhotoReady,alaskaPhotoReady\?1:0\)/);
  assert.match(script,/col%3===0 \? \[0\.34,0\.65,0\.76\] : \[0\.61,0\.80,0\.85\],12\)/);
  assert.match(script,/glacierPoint\(col\+1,row\+1\),glacierPoint\(col\+1,row\),ice,12\)/);
});

test('ice floes avoid diagonal coastline protrusions, not just four compass points',()=>{
  const hash=n=>{const s=Math.sin(n*127.1+78.233)*43758.5453;
    return s-Math.floor(s);};
  // Reproduce the first deterministic floe's position and maximum radius.
  const east=28+hash(37)*152,north=250+hash(17)*195;
  const radius=1.35+3.9*hash(3);
  const shoreX=east+radius*Math.SQRT1_2;
  const shoreZ=north+radius*Math.SQRT1_2;
  const run=terrainAt=>buildAlaskaFjordDetail({
    addTri(){},addQuad(){},terrainAt,waterY:12.2
  }).iceFloes;
  const allWater=run(()=>11.7);
  const diagonalShore=run((x,z)=>
    Math.hypot(x-shoreX,z-shoreZ)<.18?20:11.7);
  assert.equal(allWater,86,'baseline generates the complete bounded floe set');
  assert.equal(diagonalShore,allWater-1,
    'a diagonal land intrusion must prevent ice from intersecting its shore');
});
