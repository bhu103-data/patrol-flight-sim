// Scoped regression for Manhattan dusk haze parity, without changing terrain,
// NYC geometry, the shared world fog function or other map render paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const world=html.slice(html.indexOf('const WORLD_FS = '),html.indexOf('const MESH_VS = '));
const mesh=html.slice(html.indexOf('const MESH_FS = '),html.indexOf('const DITHER_FS = '));
const oldMeshExtinction=(fog)=>0.00096+0.009*fog;
const worldExtinction=(fog)=>0.0008+0.009*fog;
const nyMeshExtinction=(fog,twilight)=>oldMeshExtinction(fog)*(1-twilight)+
  worldExtinction(fog)*twilight;
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
const origin=(day)=>mix([.084,.10,.17],[.64,.73,.79],day);
const oldMeshTint=(day,twilight)=>mix(origin(day),[.48,.33,.35],twilight*.58);
const sceneTint=(day,twilight,sunward)=>mix(origin(day),
  [.42+.28*sunward,.29+.08*sunward,.35],twilight*.58);

test('world fog and NYC mesh sunset use the same sun-directional color target',()=>{
  assert.match(world,/vec3 applyFog\(vec3 col, vec3 rd, float dist\)/);
  assert.match(world,/0\.0008\+0\.009\*uAtmosphere\.w/);
  assert.match(world,/vec3\(0\.42,0\.29,0\.35\)\+vec3\(0\.28,0\.08,0\.0\)\*sunward/);
  assert.match(mesh,/NYC_TWILIGHT_HAZE_PARITY_V1/);
  assert.match(mesh,/float sunward=max\(dot\(normalize\(vWorld-uEye\),uSun\),0\.0\)/);
  assert.match(mesh,/vec3 warmMist=vec3\(0\.42,0\.29,0\.35\)\+vec3\(0\.28,0\.08,0\.0\)\*sunward/);
  assert.match(mesh,/fogExtinction=mix\(fogExtinction,0\.0008\+0\.009\*uAtmosphere\.w,/);
});

test('at peak dusk Manhattan fog matches at near and far ranges',()=>{
  for(const fog of [0,.12,.88]){
    assert.ok(Math.abs(nyMeshExtinction(fog,1)-worldExtinction(fog))<1e-12);
    for(const dist of [20,80,220,450]){
      const worldMix=1-Math.exp(-dist*worldExtinction(fog));
      const meshMix=1-Math.exp(-dist*nyMeshExtinction(fog,1));
      assert.ok(Math.abs(worldMix-meshMix)<1e-12);
    }
  }
  for(const sunward of [0,.3,.7,1]){
    const tint=sceneTint(.4,1,sunward);
    assert.ok(tint.every(x=>x>0&&x<1));
    assert.ok(sceneTint(.4,1,1)[0]>sceneTint(.4,1,0)[0],
      'sun-facing dusk mist must be warmer than anti-solar mist');
  }
});

test('noon, midnight and non-Manhattan shaders keep their original result',()=>{
  assert.ok(mesh.includes('if(uManhattanView){'));
  assert.match(mesh,/\}else\{\s+horizon=mix\(horizon,vec3\(0\.48,0\.33,0\.35\)/);
  for(const day of [0,1]){
    for(const fog of [0,.12,.88]){
      assert.equal(nyMeshExtinction(fog,0),oldMeshExtinction(fog));
      assert.deepEqual(sceneTint(day,0,.8),oldMeshTint(day,0));
    }
  }
  assert.match(world,/float fogAmt=1\.0-exp\(-dist\*\(0\.0008\+0\.009\*uAtmosphere\.w\)\)/,
    'world terrain fog and other worlds are unchanged');
});
