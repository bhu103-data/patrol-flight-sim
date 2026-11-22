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
const nyFogBlend=(fog,twilight,dist)=>{
  const raw=1-Math.exp(-dist*nyMeshExtinction(fog,twilight));
  return raw*(1-twilight)+Math.min(raw,.96)*twilight;
};
const worldFogBlend=(fog,dist)=>Math.min(1-Math.exp(-dist*worldExtinction(fog)),.96);
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

test('dense twilight fog retains the same 96% visibility floor as terrain and harbor',()=>{
  assert.match(world,/return mix\(col,haze,min\(fogAmt,0\.96\)\)/);
  assert.match(mesh,/haze=mix\(haze,min\(haze,0\.96\),clamp\(uAtmosphere\.y,0\.0,1\.0\)\)/);
  for(const fog of [0,.12,.88]){
    for(const distance of [20,80,220,450,700,820]){
      assert.ok(Math.abs(nyFogBlend(fog,1,distance)-worldFogBlend(fog,distance))<1e-12,
       'Manhattan peak twilight fog must match raymarched world fog');
    }
  }
  const thickFog=.88,far=700;
  assert.ok(1-Math.exp(-far*worldExtinction(thickFog))>.96,
    'far thick fog must exceed the previous unmatched mesh/world mixing cap');
  assert.equal(nyFogBlend(thickFog,1,far),.96,
    'retain 4% distant building contrast instead of fog-color clipping');
  assert.ok(nyFogBlend(thickFog,0,far)>.96,
    'noon and midnight must preserve original Manhattan mesh shader behavior');
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

test('fixed Manhattan camera captures the true summer horizon in addition to UI dusk',async()=>{
  const script=await readFile(new URL('../scripts/nyc-time-visibility-browser.mjs',import.meta.url),'utf8');
  assert.match(script,/name:'noon',value:'12'/);
  assert.match(script,/name:'dusk',value:'18\.5'/);
  assert.match(script,/name:'solar-dusk',value:'19\.5'/);
  assert.match(script,/name:'solar-dusk-fog',value:'19\.5',weather:'Fog'/);
  assert.match(script,/regionMeanLuma/);
  assert.match(script,/distantSkyline/);
  assert.match(script,/foregroundBuildings/);
  assert.match(script,/const expectedStatus=clock\+/,
    'capture must wait for actual game time and weather, not only select values');
  assert.match(script,/page\.waitForFunction\(expected=>/,
    'slow SwiftShader frames need game-state acknowledgement before screenshots');
  assert.match(script,/state\.status\?\.trim\(\)!==expectedStatus/,
    'reject screenshots whose environment status is still from the previous scene');
  assert.match(script,/requestAnimationFrame\(\(\)=>requestAnimationFrame\(/,
    'camera evidence must wait for two paint frames, not just a status label');
  assert.doesNotMatch(script,/waitForTimeout\(850\)/,
    'fixed 850 ms cannot guarantee rendering under slow SwiftShader');
  assert.match(script,/name:'midnight',value:'0'/);
  assert.match(script,/o\.value='19\.5'/,'test-only time option does not touch game UI');
  const lat=41*Math.PI/180,declination=22*Math.PI/180;
  const elevation=hour=>Math.asin(Math.sin(lat)*Math.sin(declination)+
    Math.cos(lat)*Math.cos(declination)*Math.cos((hour-12)*Math.PI/12));
  assert.ok(elevation(18.5)*180/Math.PI>8,'18:30 is still sunlit in summer');
  assert.ok(elevation(19.5)*180/Math.PI<0,'19:30 reaches the actual sun horizon');
  const sunY=Math.sin(elevation(19.5));
  const twilight=Math.max(0,Math.min(1,1-Math.abs(sunY+.04)/.31));
  assert.ok(twilight>.9,'horizon capture exercises the strongest dusk-haze blending');
});
