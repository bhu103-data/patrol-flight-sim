// PATROL shared sunlight/ocean smoke without a GPU or terrain-map fixture.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('<script>'),html.lastIndexOf('</script>'));
function between(a,b){
 const start=source.indexOf(a),end=source.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'Missing marker: '+a);
 return source.slice(start,end);
}
const helper=between('  function orientSunAzimuth(sun, value){','  function sampleFlightEnvironment(dt){');
const orientSunAzimuth=new Function(helper+'return orientSunAzimuth;')();

test('default solar path is retained and invalid compass values are ignored',()=>{
 const sample=[0.28,0.82,-0.49];
 for(const value of ['-1','bad','360','-5']){
  assert.strictEqual(orientSunAzimuth(sample,value),sample);
 }
});

test('solar azimuth keeps seasonal elevation and horizontal sun radius',()=>{
 const sample=[0.28,0.82,-0.49],radius=Math.hypot(sample[0],sample[2]);
 for(const deg of [0,45,90,135,180,225,270,315,359]){
  const actual=orientSunAzimuth(sample,String(deg)),a=deg*Math.PI/180;
  assert.ok(Math.abs(actual[1]-sample[1])<1e-12);
  assert.ok(Math.abs(Math.hypot(actual[0],actual[2])-radius)<1e-12);
  assert.ok(Math.abs(actual[0]-Math.sin(a)*radius)<1e-12);
  assert.ok(Math.abs(actual[2]-Math.cos(a)*radius)<1e-12);
 }
});

test('sun angle UI updates live in shared environment, independent of map',()=>{
 assert.match(html,/<option value="19">Golden Hour<\/option>/);
 assert.match(html,/id="skyAzimuth" type="range" min="-1" max="359" step="1" value="-1"/);
 assert.match(html,/id="skyAzimuthValue"/);
 assert.match(source,/skyAzimuth\.addEventListener\('input'/);
 assert.match(source,/const sun=orientSunAzimuth\(horizontal\(hourAngle\),skyAzimuth\.value\)/);
 assert.match(source,/return \{sun,moon,atmosphere:/);
});

test('atmosphere retains moon, Alaska aurora and physically motivated sun glow',()=>{
 const sky=between('    vec3 getSky(vec3 rd) {','    vec3 applyFog(vec3 col, vec3 rd, float dist) {');
 for(const token of ['rayleighPhase','miePhase','airMass','forwardScatter',
   'solarRadius','solarEdge','alaskaAurora(rd)','moonAmt','star=']){
  assert.ok(sky.includes(token),'Missing sky term: '+token);
 }
 assert.match(sky,/float solarRadius=0\.0058/);
 assert.match(sky,/float starVisibility=1\.0-smoothstep\(-0\.14,-0\.04,uSun\.y\)/);
 assert.doesNotMatch(sky,/\*star\*\(1\.0-day\)/);
});

test('twilight cloud warm-light gate retains existing fixed seven ray-march steps',()=>{
 const clouds=between('      // Cumulus cloud layer below cruise altitude',
   '      gl_FragDepth = 1.0;');
 assert.match(clouds,/float golden=smoothstep\(-0\.08,0\.0,uSun\.y\)/);
 assert.match(clouds,/float forward=max\(dot\(rd,uSun\),0\.0\)/);
 assert.match(clouds,/for \(int c = 0; c < 7; c\+\+\)/);
});

test('cloud masses favor broad scales with a feathered and density-shaped ceiling',()=>{
 const density=between('    float cloudDensity(vec2 xz) {','    vec4 sampleMap(vec2 xz) {');
 assert.match(density,/xz \* 0\.011/);
 assert.match(density,/float large=vnoise\(p\)/);
 assert.match(density,/float middle=vnoise\(p\*2\.23\+7\.1\)/);
 assert.match(density,/float fine=vnoise\(p\*4\.4-3\.4\)/);
 assert.match(density,/float n=large\*0\.59\+middle\*0\.29\+fine\*0\.12/);
 assert.match(density,/return coverage\*mix\(0\.56,1\.0,smoothstep\(0\.24,0\.71,middle\)\)/);
 assert.equal((density.match(/vnoise\(/g)||[]).length,3,
   'keep cloud density at three spatial-noise calls');
 const cloud=between('      \/\/ Cumulus cloud layer below cruise altitude',
   '      gl_FragDepth = 1.0;');
 assert.match(cloud,/float cloudEnvelope=smoothstep\(0\.0,0\.11,hFrac\)/);
 assert.match(cloud,/float cloudCrown=smoothstep\(0\.18,0\.85,d\)/);
 assert.match(cloud,/float cloudPeak=0\.54\+0\.36\*cloudCrown/);
 assert.match(cloud,/1\.0-smoothstep\(cloudPeak-0\.13,cloudPeak\+0\.07,hFrac\)/);
 assert.match(cloud,/d\*=cloudEnvelope/);
});

test('ocean normals become irregular without editing shared 18-mode buoyancy',()=>{
 const water=between('          float gust = mix(0.82, 1.18,', '          vec3 wn = normalize');
 assert.match(water,/float swellShear=mix\(0\.79,1\.19,/);
 assert.match(water,/float warpFade=1\.0-smoothstep\(0\.45,1\.85,pixel\)/);
 assert.match(water,/if\(uManhattan\)\{/);
 assert.match(water,/swell=oceanCascade\(oceanNormalXZ,uTime,pixel,0\)/);
 assert.match(water,/chop=oceanCascade\(oceanNormalXZ,uTime,pixel,6\)/);
 assert.match(water,/ripple=oceanCascade\(oceanNormalXZ,uTime,pixel,12\)/);
 assert.doesNotMatch(water,/oceanHeight\s*=\s*/);
 assert.match(water,/float smallWavePatch=mix\(0\.80,1\.20,noiseH\)/);
 assert.match(water,/float patchLod=1\.0-smoothstep\(0\.22,1\.28,pixel\)/);
 assert.match(water,/\+noiseSlope\*patchLod\*\(0\.31\+0\.20\*openWater\)/);
 assert.match(water,/if\(hasOceanCascades\(\)\)/);
});

test('ocean glints use angular LOD and beach foam follows falling crests',()=>{
 const water=between('          float alpha2=max(roughness*roughness','          // Bow pressure, hull wash');
 assert.match(water,/max\(0\.0012,pixelAngle\*pixelAngle\*0\.48\)/);
 assert.match(water,/if\(sparkleMip>0\.015\)/);
 assert.match(water,/float postCrest=smoothstep\(0\.04,0\.68,-cos\(shoalPhase\)\)/);
 assert.match(water,/float coastalPatch=vnoise/);
 assert.match(water,/shore = smoothstep\(0\.36, 0\.88, pulse\) \* postCrest/);
});

test('existing wave-height and floatplane sampling model stays intact',()=>{
 assert.match(source,/const oceanBands = \[\[35,0\.00284,0\.73\]/);
 assert.match(source,/function floatOceanHeight\(x,z,t,depth,map\)/);
 assert.match(source,/function floatOceanPose\(x,z,yaw,t,map,water,terrain\)/);
 assert.match(source,/const vec4 OCEAN_PHASE\[18\]/);
 assert.match(source,/hasOceanCascades\(\)/);
});

test('browser QA captures normal full renderer and labels compatibility separately',async()=>{
 const script=await readFile(new URL('../scripts/nyc-tidewater-sun-sea-browser-qa.mjs',import.meta.url),'utf8');
 const workflow=await readFile(new URL('../.github/workflows/nyc-tidewater-sun-sea.yml',import.meta.url),'utf8');
 assert.match(script,/const graphicsMode=process\.env\.PATROL_GRAPHICS_MODE==='compat'\?'compat':'full'/);
 assert.match(script,/const path=graphicsMode==='compat'\?'\/index\.html\?graphics=compat':'\/index\.html'/);
 assert.match(script,/graphicsCompat:new URLSearchParams\(location\.search\)/);
 assert.match(script,/state\.graphicsCompat===\(graphicsMode==='compat'\)/);
 assert.match(script,/const dest='artifacts\/nyc-tidewater-sun-sea\/'\+graphicsMode/);
 assert.match(workflow,/PATROL_GRAPHICS_MODE: full/);
 assert.match(workflow,/PATROL_GRAPHICS_MODE: compat/);
 assert.match(workflow,/Capture true full-quality NYC Harbor dusk and noon/);
});

test('top-left live FPS meter uses real rAF intervals and reports internal resolution',async()=>{
 assert.match(html,/#fpsCounter\{position:absolute;top:12px;left:14px/);
 assert.match(html,/<output id="fpsCounter"[^>]*hidden>/);
 assert.match(source,/const fpsCounter=document\.getElementById\('fpsCounter'\)/);
 assert.match(source,/fpsWindowSeconds\+=rawDt/);
 assert.match(source,/fpsWindowFrames\+\+/);
 assert.match(source,/Math\.round\(fpsWindowFrames\/fpsWindowSeconds\)/);
 assert.match(source,/fpsCounter\.textContent='FPS '\+fps\+' · '\+fboW\+'×'\+fboH/);
 assert.match(source,/fpsCounter\.hidden=true/);
 const script=await readFile(new URL('../scripts/nyc-tidewater-sun-sea-browser-qa.mjs',import.meta.url),'utf8');
 assert.match(script,/internalWidth:canvas\?\.width\|\|0/);
 assert.match(script,/displayedWidth:Math\.round/);
 assert.match(script,/fpsShown:document\.getElementById\('fpsCounter'\)\?\.hidden===false/);
});

test('adaptive cloud ray budget retains high-quality 7 steps and lowers only under load',()=>{
 const snippet=between('  function cloudStepsForScale(scale,direct){','  function resizeTargets() {');
 const cloudStepsForScale=new Function(snippet+'return cloudStepsForScale;')();
 assert.equal(cloudStepsForScale(1,false),7);
 assert.equal(cloudStepsForScale(.84,false),7);
 assert.equal(cloudStepsForScale(.76,false),5);
 assert.equal(cloudStepsForScale(.55,false),4);
 assert.equal(cloudStepsForScale(.9,true),4);
 const cloud=between('      // Cumulus cloud layer below cruise altitude',
   '      gl_FragDepth = 1.0;');
 assert.match(source,/uniform float uCloudSteps;/);
 assert.match(source,/gl\.uniform1f\(uWorld\.cloudSteps,cloudStepsForScale\(resScale,directRendering\)\)/);
 assert.match(source,/cloudSteps:gl\.getUniformLocation\(worldProg,'uCloudSteps'\)/);
 assert.match(cloud,/float steps = clamp\(uCloudSteps,4\.0,7\.0\)/);
 assert.match(cloud,/float opticalWeight=7\.0\/steps/);
 assert.match(cloud,/if\(float\(c\)>=steps\)break/);
 assert.match(cloud,/opticalWeight\) \* \(1\.0 - accum\)/);
 assert.match(cloud,/for \(int c = 0; c < 7; c\+\+\)/,
   'keep shader static loop bound for WebGL2 portability');
});
