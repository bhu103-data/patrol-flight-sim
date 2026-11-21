import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {CHONGQING_BUILDING_STYLES,makeChongqingTowerProfile} from
  '../assets/chongqing/urban-architecture.js';
import {validateChongqingScenarioManifest} from
  '../assets/chongqing/scenario-assets.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFileSync(path.join(ROOT,name),'utf8');

test('five architectural profiles have finite coordinates, UVs and roof normals',()=>{
  assert.equal(CHONGQING_BUILDING_STYLES.length,5);
  const sizes=[];
  for(const style of CHONGQING_BUILDING_STYLES){
    const d=makeChongqingTowerProfile(style);
    assert.ok(d.positions.length>300);
    assert.equal(d.positions.length/3,d.uvs.length/2);
    assert.equal(d.indices.length%3,0);
    assert.ok(d.positions.every(Number.isFinite));
    assert.ok(d.uvs.every(Number.isFinite));
    assert.ok(d.indices.every(n=>Number.isInteger(n)&&n>=0&&n<d.positions.length/3));
    for(let i=d.indices.length-24;i<d.indices.length;i+=3){
      const ax=d.indices[i]*3,bx=d.indices[i+1]*3,cx=d.indices[i+2]*3;
      const ux=d.positions[bx]-d.positions[ax];
      const uz=d.positions[bx+2]-d.positions[ax+2];
      const vx=d.positions[cx]-d.positions[ax];
      const vz=d.positions[cx+2]-d.positions[ax+2];
      assert.ok(uz*vx-ux*vz>0,'Each tower roof face must point upward');
    }
    sizes.push(d.indices.length);
  }
  assert.ok(new Set(sizes).size>=3);
});

test('Scenario manifest is reviewed-only and refuses unsafe assets',()=>{
  const manifest=JSON.parse(read('assets/chongqing/scenario-manifest.json'));
  assert.equal(validateChongqingScenarioManifest(manifest),true);
  assert.deepEqual(manifest.entries.map(x=>x.id),
    ['hongyadong','qiansimen','raffles','liziba']);
  assert.ok(manifest.entries.every(x=>x.enabled===false));
  for(const tamper of [
    e=>{e.entries[0].enabled=true;e.entries[0].license='';},
    e=>{e.entries[0].enabled=true;e.entries[0].license='CC0';e.entries[0].file='https://bad.example/x.glb';},
    e=>{e.entries[0].scale=Infinity;}
  ]){
    const unsafe=structuredClone(manifest);tamper(unsafe);
    assert.throws(()=>validateChongqingScenarioManifest(unsafe));
  }
});

test('Chongqing and Manhattan use one launcher but keep their gameplay',()=>{
  const html=read('index.html');
  const cq=read('assets/chongqing/chongqing.js');
  const page=read('chongqing.html');
  const pbr=read('assets/chongqing/pbr.js');
  const atmo=read('assets/chongqing/atmosphere.js');
  assert.match(html,/PATROL_CQ_CINEMATIC_V2/);
  assert.match(html,/chongqing[.]html[?]/);
  assert.match(cq,/createChongqingUrbanArchitecture/);
  assert.match(cq,/applyCinematicEnvironment/);
  assert.match(cq,/function eatHotpot/);
  assert.match(cq,/function toggleFlight/);
  assert.match(cq,/patrol:orbitLaunch/);
  assert.match(cq,/previewChongqingScenarioAssets/);
  assert.match(page,/id="cqTime"/);
  assert.match(page,/type="importmap"/);
  assert.match(pbr,/residentialFacade,commercialFacade/);
  assert.match(atmo,/setDaylight/);
});
