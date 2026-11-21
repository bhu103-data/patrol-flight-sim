import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('../assets/alaska/alaska-ice-motion.js',import.meta.url),'utf8');
const {createAlaskaIceActors,poseAlaskaIce}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));
const main=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../assets/alaska/alaska-photo-manifest.json',import.meta.url),'utf8'));

function testMeshFactory(){
  return ()=>{
    let count=0;
    function addTri(a,b,c,col){
      for(const p of [a,b,c]){
        assert.ok(p.length===3&&p.every(Number.isFinite),'finite chunk position');
        assert.ok(Math.hypot(p[0],p[2])<16,'localized geometry');
      }
      assert.ok(col.length===3&&col.every(v=>v>=0&&v<=1),'bounded color');
      count+=3;
    }
    return {addTri,addQuad:(a,b,c,d,color)=>{
      addTri(a,b,c,color);addTri(a,c,d,color);
    },upload:()=>({vao:1,count})};
  };
}
const flatWater=()=>11.7;
test('Alaska floating ice is finite, limited, and original geometry',()=>{
  const actors=createAlaskaIceActors({
    makeMesh:testMeshFactory(),terrainAt:flatWater,waterY:12.2
  });
  assert.equal(actors.length,11);
  assert.ok(actors.every(a=>a.mesh.count<180&&a.mesh.count>30),'bounded chunk mesh');
  assert.equal(actors.filter(a=>a.kind==='calving').length,3);
  for(const t of [0,1.4,5,22.3,68,120,10000]){
    for(const actor of actors){
      const pose=poseAlaskaIce(actor,t,flatWater,12.2);
      if(!pose.visible)continue;
      assert.ok([pose.x,pose.y,pose.z,pose.yaw].every(Number.isFinite));
      assert.ok(pose.y>=12.2 && pose.y<21);
      assert.ok(Math.hypot(pose.x,pose.z)<780);
    }
  }
});
test('floe drifts away from the measured shoreline only while water is safe',()=>{
  const water=(x)=>x>0?11.8:26;
  const actors=createAlaskaIceActors({
    makeMesh:testMeshFactory(),terrainAt:water,waterY:12.2
  });
  assert.ok(actors.length>2);
  for(const actor of actors)for(const t of [0,50,220,310,800]){
    const pose=poseAlaskaIce(actor,t,water,12.2);
    if(pose.visible)assert.ok(pose.x>0,'must stay over navigable sea');
  }
});
test('low-quality Alaska keeps procedural fallback without runtime image fetch',()=>{
  assert.match(main,/if\(selectedMap\.alaska\)loadAlaskaPhotoTextures\(\);/);
  assert.match(main,/else disposeAlaskaPhotoTextures\(\);/);
  assert.match(main,/if\(selectedMap\.alaska && !graphicsCompat && smoothScenery\(\)\)/);
  assert.match(main,/if\(uAlaskaPhotoReady\)/);
  assert.match(main,/textureLod\(uAlaskaPhotoAlbedo/);
  assert.match(main,/textureLod\(uAlaskaPhotoNormalRough/);
  assert.match(main,/alaskaPhotoReady:gl\.getUniformLocation/);
  assert.match(main,/disposeSceneMesh\(actor\.mesh\)/);
  assert.match(main,/alaskaIcePose\(actor,sceneryTime,sampleTerrainHeight,WATER_H\)/);
  assert.ok(main.includes('assets/alaska/alaska-ice-motion.js'));
  assert.ok(main.includes('alaska-photo-albedo.webp'));
  assert.ok(main.includes("img.src='./assets/alaska/'+name"));
});
test('four bounded CC0 photographic PBR materials are present',()=>{
  assert.equal(manifest.format,'patrol-alaska-pbr-atlas-v1');
  assert.deepEqual(manifest.columns,['rock_01','snow_02','forest_ground_04','forrest_ground_03']);
  assert.equal(manifest.license,'CC0');
  assert.equal(manifest.normalConvention,'OpenGL');
  assert.equal(manifest.roughnessChannel,'A');
  assert.equal(manifest.width,1024);
  assert.equal(manifest.height,256);
  for(const filename of Object.values(manifest.maps)){
    assert.ok(/\.webp$/.test(filename),'encoded WebP');
    const path=new URL('../assets/alaska/'+filename,import.meta.url);
    const size=statSync(path).size;
    assert.ok(size>5000&&size<950_000,'strict mobile atlas budget');
    const header=readFileSync(path).subarray(0,12);
    assert.equal(header.subarray(0,4).toString(),'RIFF');
    assert.equal(header.subarray(8,12).toString(),'WEBP');
  }
});

test('drifting floe checks diagonal banks across its complete rotating hull',()=>{
  const actor={kind:'floe',anchor:[0,0],radius:4,phase:0,yaw:0};
  const edge=actor.radius*1.12*Math.SQRT1_2;
  // At time zero the drift is +5.1 z units. The diagonal shore is outside
  // the old center / four-cardinal probes, but inside the real floe width.
  const land=(x,z)=>Math.hypot(x-edge,z-(5.1+edge))<.22?20:11.7;
  const pose=poseAlaskaIce(actor,0,land,12.2);
  assert.equal(pose.visible,true);
  assert.deepEqual([pose.x,pose.z],actor.anchor,
    'unsafe diagonal drift must fall back to its verified mooring');
});

test('initial Alaska ice anchorage reserves full mesh radius',()=>{
  const makeMesh=testMeshFactory();
  const clean=createAlaskaIceActors({makeMesh,terrainAt:flatWater,waterY:12.2});
  const first=clean[0],edge=first.radius*1.12*Math.SQRT1_2;
  const land=(x,z)=>Math.hypot(x-(first.anchor[0]+edge),
    z-(first.anchor[1]+edge))<.22?20:11.7;
  const coast=createAlaskaIceActors({makeMesh,terrainAt:land,waterY:12.2});
  assert.ok(coast.length>2,'waterborne actors remain viable');
  assert.notDeepEqual(coast[0].anchor,first.anchor,
    'initial placement must avoid terrain under a diagonal hull corner');
});

test('an interior shoal between center and rim cannot carry drifting ice',()=>{
  const actor={kind:'floe',anchor:[0,0],radius:4,phase:0,yaw:0};
  const inner=actor.radius*1.12*.66,angle=Math.PI/4;
  const shoal=[Math.cos(angle)*inner,5.1+Math.sin(angle)*inner];
  const terrain=(x,z)=>Math.hypot(x-shoal[0],z-shoal[1])<.19?21:11.7;
  const pose=poseAlaskaIce(actor,0,terrain,12.2);
  assert.equal(pose.visible,true);
  assert.deepEqual([pose.x,pose.z],actor.anchor,
    'floe must fall back to its verified anchor when an internal shoal is hit');
});

test('unknown DEM values are never assumed to mean open water',()=>{
  const actor={kind:'floe',anchor:[0,0],radius:4,phase:0,yaw:0};
  const missing=(x,z)=>Math.abs(x)<.01&&Math.abs(z-5.1)<.01?NaN:11.7;
  const pose=poseAlaskaIce(actor,0,missing,12.2);
  assert.deepEqual([pose.x,pose.z],actor.anchor,
    'a no-data drift position cannot be treated as safe water');
  const valid=createAlaskaIceActors({
    makeMesh:testMeshFactory(),terrainAt:flatWater,waterY:12.2
  });
  const first=valid[0];
  const corrupted=(x,z)=>Math.hypot(x-first.anchor[0],
    z-first.anchor[1])<.2?Infinity:11.7;
  const relocated=createAlaskaIceActors({
    makeMesh:testMeshFactory(),terrainAt:corrupted,waterY:12.2
  });
  assert.ok(relocated.length>2);
  assert.notDeepEqual(relocated[0].anchor,first.anchor,
    'initial ice placement must reject invalid terrain samples as well');
});

test('ice drift interior terrain checks stay within a fixed frame budget',()=>{
  const actor={kind:'floe',anchor:[0,0],radius:4,phase:0,yaw:0};
  let probes=0;
  const pose=poseAlaskaIce(actor,0,()=>{probes++;return 11.7;},12.2);
  assert.equal(pose.visible,true);
  assert.ok(probes>=33,'center, perimeter and interior rings were all checked');
  assert.ok(probes<=33,'each ice actor must use a bounded terrain query budget');
});
