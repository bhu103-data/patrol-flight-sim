// Tidewater-inspired NYC sky/sun refinement: bounded native WebGL2 path.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  const WORLD_FS = ');
assert.ok(start>0,'existing native WebGL2 world shader is required');
const next=html.indexOf('  const WORLD_',start+20);
const shader=html.slice(start,next>start?next:start+70000);

test('Tidewater sky refinement is reversible, Manhattan-only and shares the reflection shader',()=>{
  assert.equal(shader.split('const bool NYC_TIDEWATER_SKY = true;').length-1,1);
  assert.match(shader,/if\(uManhattan && NYC_TIDEWATER_SKY\)/);
  assert.match(shader,/vec3 getSky\(vec3 rd, float pixelAngle\)/);
  assert.match(shader,/getSky\(rd,pixelAngle\)/);
  assert.match(shader,/getSky\(roughRefl,pixelAngle\)/);
  assert.match(shader,/uniform bool uNYCSeaDetail;/);
});

test('sun disk uses physical angular size and pixel-footprint antialiasing',()=>{
  assert.match(shader,/solarRadius=0\.00538/);
  assert.match(shader,/solarAA=max\(pixelAngle\*0\.72,0\.00025\)/);
  assert.match(shader,/solarEdge=1\.0-smoothstep\(solarRadius-solarAA,solarRadius\+solarAA,solarAngle\)/);
  assert.match(shader,/sunVisible=smoothstep\(-0\.018,0\.025,uSun\.y\)/);
});

test('Manhattan daylight stars fade with sun elevation instead of cloud/clock heuristics',()=>{
  assert.match(shader,/float starsVisible=1\.0-day;/);
  assert.match(shader,/starsVisible=1\.0-smoothstep\(-0\.20,-0\.05,uSun\.y\)/);
  assert.match(shader,/star\*starsVisible\*\(1\.0-cloud\)/);
});

test('forward Mie aureole follows the sun and is attenuated by cloud and fog cover',()=>{
  assert.match(shader,/mieG=0\.78/);
  assert.match(shader,/mieDenom=max\(1\.0\+mieG\*mieG-2\.0\*mieG\*sunAmt,0\.035\)/);
  assert.match(shader,/miePhase=\(1\.0-mieG\*mieG\)\/\(mieDenom\*sqrt\(mieDenom\)\)/);
  assert.match(shader,/miePhase\*0\.0090\*openness\*sunVisible/);
});

test('warm horizon and aerial haze use the same solar elevation and twilight',()=>{
  assert.match(shader,/horizonTint=mix\(vec3\(0\.88,0\.49,0\.33\),vec3\(0\.58,0\.71,0\.82\),sunHeight\)/);
  assert.match(shader,/haze=mix\(haze,horizonHaze,uAtmosphere\.y\*\(0\.12\+0\.12\*sunward\)\)/);
});

test('sky polish adds no texture, raymarch or ocean/aircraft physics changes',()=>{
  assert.doesNotMatch(shader,/uniform sampler2D uTidewaterSky/);
  assert.match(html,/float oceanHeight\(vec2 xz, float depth, float pixel\)/);
  assert.match(html,/floatOceanPose\(x,z,plane\.yaw/);
  assert.match(html,/checkFlightCollision/);
});

test('same-camera sunrise A/B pins the sun, weather and aircraft state',()=>{
  const compare=readFileSync(new URL('../tools/aircraft/nyc-water-crest-compare.mjs',import.meta.url),'utf8');
  assert.match(compare,/PATROL_COMPARE_MODE==='sky-atmosphere'/);
  assert.match(compare,/const bool NYC_TIDEWATER_SKY = false;/);
  assert.match(compare,/const skyMode=window\.PatrolCrestCompare\?\.skyMode===true/);
  assert.match(compare,/eye:\[x-sun\[0\]\*28,WATER_H\+3\.0,z-sun\[2\]\*28\]/);
  assert.match(compare,/JSON\.stringify\(a\.state\.sky\)!==JSON\.stringify\(b\.state\.sky\)/);
  assert.match(compare,/gpuFrameMs:null/);
});
