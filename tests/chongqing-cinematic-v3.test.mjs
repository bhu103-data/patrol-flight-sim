import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {CHONGQING_BUILDING_STYLES,makeChongqingTowerProfile}
  from '../assets/chongqing/urban-architecture.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');

test('Chongqing five architecture archetypes have usable roof and facade geometry',()=>{
 assert.equal(CHONGQING_BUILDING_STYLES.length,5);
 for(const item of CHONGQING_BUILDING_STYLES){
  const model=makeChongqingTowerProfile(item);
  assert.ok(model.indices.length>100);
  assert.equal(model.positions.length/3,model.uvs.length/2);
  assert.ok(model.positions.every(Number.isFinite));
  assert.ok(model.indices.every(i=>Number.isInteger(i)&&i>=0&&i<model.positions.length/3));
  for(let i=model.indices.length-24;i<model.indices.length;i+=3){
   const a=model.indices[i]*3,b=model.indices[i+1]*3,c=model.indices[i+2]*3;
   const crossZ=(model.positions[b+2]-model.positions[a+2])*(model.positions[c]-model.positions[a]) -
     (model.positions[b]-model.positions[a])*(model.positions[c+2]-model.positions[a+2]);
   assert.ok(crossZ>0,'Tower roof must face upwards');
  }
 }
});

test('Preserves active Hongyadong GLB loader and wet street FX while replacing cube skyline',()=>{
 const cq=read('assets/chongqing/chongqing.js');
 const pbr=read('assets/chongqing/pbr.js');
 const html=read('chongqing.html');
 const main=read('index.html');
 for(const label of ['createChongqingUrbanArchitecture','loadOptionalHongyadong',
  'buildChongqingWetStreets','wetStreetBuild.update(dt)','function eatHotpot',
  'function toggleFlight','patrol:orbitLaunch','applyCinematicEnvironment'])assert.ok(cq.includes(label),label);
 assert.ok(!cq.includes('const towerMesh=new THREE.InstancedMesh(buildingBase'));
 assert.match(pbr,/residentialFacade,commercialFacade/);
 assert.match(html,/id="cqTime"/);
 assert.match(html,/type="importmap"/);
 assert.match(main,/PATROL_CQ_CINEMATIC_V3/);
 assert.match(read('assets/chongqing/atmosphere.js'),/setDaylight/);
 const existing=JSON.parse(read('assets/chongqing/scenario-manifest.json'));
 assert.equal(existing.hongyadong.enabled,true,'Activate verified CC0 GLB with original fallback');
 assert.match(existing.hongyadong.license,/CC0/);
});
