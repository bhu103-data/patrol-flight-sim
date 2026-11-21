// Native PATROL WebGL2 golden-hour sky/glint contract: source and math QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const world=source.slice(source.indexOf('  const WORLD_FS = `#version 300 es'),
  source.indexOf('  const MESH_VS =',source.indexOf('  const WORLD_FS = `#version 300 es')));
assert.ok(world.length>10000,'extract real world fragment shader');
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
const envelope=(sunY,twilight,isNatural)=>
 isNatural?twilight*smooth(-.06,.035,sunY)*(1-smooth(.12,.31,sunY)):0;
test('low sun at golden hour only; no noon, night or Vegas lighting bleed',()=>{
 assert.equal(envelope(.6,.1,true),0);
 assert.equal(envelope(-.18,.7,true),0);
 assert.equal(envelope(.025,.8,false),0);
 assert.ok(envelope(.025,.85,true)>.5);
 assert.ok(envelope(.15,.5,true)<envelope(.025,.85,true));
 for(let a=-.25;a<=.5;a+=.005){
  const v=envelope(a,.84,true);
  assert.ok(Number.isFinite(v)&&v>=0&&v<=.84);
 }
});
test('dusk horizon is altitude-graded, sunward and weather-bounded',()=>{
 assert.match(world,/float goldenHourWeight\(\)/);
 assert.match(world,/if\(!naturalLight\(\)\)return 0\.0/);
 assert.match(world,/horizonBand=1\.0-smoothstep\(0\.07,0\.77,up\)/);
 assert.match(world,/sunward=clamp\(0\.5\+0\.5\*dot\(rd\.xz,uSun\.xz\)/);
 assert.match(world,/goldenHourWeight\(\)\*\(1\.0-cloud\*0\.70\)/);
 assert.match(world,/horizon=mix\(horizon,peach,0\.58\*golden\*horizonBand\)/);
 assert.match(world,/solarTint=mix\(solarTint,vec3\(1\.0,0\.97,0\.88\),golden\*0\.62\)/);
});
test('low-angle reflection retains existing GGX/facet LOD and is capped',()=>{
 assert.match(world,/float goldenGlint=goldenHourWeight\(\)/);
 assert.match(world,/float ggx = waterDGGX\(ndh,alpha2\)/);
 assert.match(world,/float facetSparkle = mix\(0\.78,1\.24,vnoise/);
 assert.match(world,/float mirrorSun=max\(dot\(reflect\(rd,vec3\(0\.0,1\.0,0\.0\)\),uSun\),0\.0\)/);
 assert.match(world,/float longReflection=pow\(mirrorSun,48\.0\)\*/);
 assert.match(world,/float softPath=min\(0\.23,goldenGlint\*longReflection\*/);
 assert.match(world,/waterCol\+=sunTint\*softPath\*clearSky\*sunAbove\*litFactor/);
 assert.match(world,/if\(uAlaska\)\{/);
 assert.match(world,/if\(hasOceanCascades\(\)\)\{/);
});
test('reflection envelope stays finite and never creates a screen stripe',()=>{
 for(const solar of [0,.1,.35,.7,1])for(const rayY of [-1,-.7,-.3,-.05,0]){
  const mirror=Math.pow(solar,48);
  const grazing=1-smooth(.08,.56,-rayY);
  const soft=Math.min(.23,.85*mirror*grazing*1.15*.23);
  assert.ok(soft>=0&&soft<=.23&&Number.isFinite(soft));
 }
 assert.doesNotMatch(world,/gl_FragCoord\.[xy].*longReflection/);
});
