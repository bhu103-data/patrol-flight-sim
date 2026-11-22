import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('NYC reflect-vector correction is a geometry/hemisphere fix, never a tint',()=>{
  assert.match(game,/vec3 reflDir = reflect\(rd, wn\);\s*\/\/ NYC-only optical correction:/);
  assert.match(game,/reflDir\.y = uManhattan \? max\(reflDir\.y, 0\.002\) : abs\(reflDir\.y\);/);
  assert.doesNotMatch(game,/reflDir\.y\s*=\s*abs\(reflDir\.y\);/);
  assert.match(game,/vec3 roughRefl = normalize\(mix\(reflDir,/);
  assert.match(game,/vec3 reflectedSky = getSky\(roughRefl\);/);
  // The old |y| sky lookup folded downward-travelling rays into a falsely
  // upward reflection which could show an Earth-like bright horizon arc.
  const normalize=v=>v.map(x=>x/Math.hypot(...v));
  const rd=normalize([0.95,-0.10,0.30]),wn=normalize([.5,.866,0]);
  const dot=rd.reduce((s,x,i)=>s+x*wn[i],0);
  const reflected=rd.map((x,i)=>x-2*dot*wn[i]);
  assert.ok(reflected[1] < -.6,'chosen grazing facet must reflect under horizon');
  assert.ok(Math.abs(reflected[1])>.6,'the old abs fold wrongly sampled high sky');
  assert.equal(Math.max(reflected[1],.002),.002,'NYC clamps to near-horizon');
});

test('NYC fake distant Earth disc was oversized moon angular projection',()=>{
  assert.match(game,/float moonAngularRadius=uManhattan\?0\.00455:0\.026;/);
  assert.match(game,/float moonMinDot=uManhattan\?0\.9999895:0\.99958;/);
  assert.match(game,/if\(moonAmt>moonMinDot && uMoon\.y>-0\.025\)/);
  assert.match(game,/vec2 uv=vec2\(dot\(rd,tangent\),dot\(rd,upMoon\)\)\/moonAngularRadius;/);
  assert.ok(0.026 / 0.00455 > 5.7);
  assert.ok(Math.cos(.00455)>.9999895,'threshold admits full NYC lunar circle');
  assert.ok(Math.cos(.026)>.99958,'nonNYC keeps original lunar gating');
});

test('Las Vegas NASA EPIC Sphere Show is not being removed/repainted or brought to NYC',()=>{
  assert.match(game,/function prepareSphereShow\(\) \{\s*disposeSceneMesh\(sphereMesh\);\s*sphereMesh=null;\s*sphereCenter=null;\s*sphereImpact=null;\s*sphereShowControl\.hidden=!selectedMap\.vegas;\s*if\(!selectedMap\.vegas\)return;/);
  assert.match(game,/function drawSphereShow\(drawMesh\) \{\s*if\(!sphereMesh\)return;/);
  assert.match(game,/if\(!flying \|\| crash \|\| !selectedMap\.vegas\)return;/);
});

test('shading-only patch retains existing C185 water, ship wakes and map toggles',()=>{
  for(const signature of [
    'function prepareCoastalTraffic()',
    'function drawCoastalTraffic(drawMesh)',
    'function updateBoatWakes()',
    'function sampleFlightEnvironment(dt)',
    'const environment=sampleFlightEnvironment(',
    'gl.uniform1f(uWorld.time, time);',
    'drawCoastalTraffic(drawMeshWithOutline);',
    'drawSphereShow(drawMeshWithOutline);'
  ])assert.ok(game.includes(signature),'Missing preserved flight or water interface: '+signature);
  assert.match(game,/if\(selectedMap\.city\) \{/);
  assert.match(game,/gl\.uniform3fv\(uWorld\.sun,environment\.sun\)/);
  assert.match(game,/gl\.uniform3fv\(uWorld\.moon,environment\.moon\)/);
});

test('Manhattan removes only nonphysical camera-facing cyan crest emission, not real sun glint',()=>{
  // The old term is tied to the 2D view/sun azimuth (not N dot L or a BRDF).
  // Component-isolation WebGL2 A/B: removing it eliminates the broad teal
  // patch while the independently computed white solar glint remains.
  assert.match(game,/float back=pow\(max\(dot\(normalize\(uSun\.xz\+vec2\(0\.0001\)\),normalize\(rd\.xz\+vec2\(0\.0001\)\)\),0\.0\),4\.0\);/);
  assert.match(game,/if\(!uManhattan\)\s*waterCol\+=vec3\(0\.025,0\.24,0\.18\)\*crest\*back\*sunAbove\*clearSky\*litFactor;/);
  assert.equal((game.match(/waterCol\+=vec3\(0\.025,0\.24,0\.18\)\*crest\*back/g)||[]).length,1);
  // Do not silently replace the residual physical sun glitter with a
  // palette edit, normal flattening or missing light contribution.
  assert.match(game,/vec3 wn = normalize\(vec3\(-slope\.x, 1\.0, -slope\.y\)\);/);
  assert.match(game,/float ggx = waterDGGX\(ndh,alpha2\) \* waterVSmith\(ndl,ndv,alpha2\) \* waterFresnel\(vdh\) \* ndl;/);
  assert.match(game,/waterCol \+= sunTint \* glitter \* clearSky \* sunAbove \* litFactor;/);
  assert.match(game,/vec3 transmitted=refract\(rd,wn,1\.0\/1\.333\);/);
});
