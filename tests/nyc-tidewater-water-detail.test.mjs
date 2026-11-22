// NYC Tidewater-inspired native WebGL2 water: bounded, reversible visual layer.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const at=html.indexOf('  const WORLD_FS = ');
assert.ok(at>0,'existing native WebGL2 terrain + ocean shader is required');
const shader=html.slice(at,html.indexOf('  const WORLD_',at+20)>at?
  html.indexOf('  const WORLD_',at+20):at+64000);
test('NYC water detail is compile-time reversible and guarded by city and pixel size',()=>{
  assert.match(shader,/const bool NYC_TIDEWATER_DETAIL = true;/);
  assert.match(shader,/if\(uManhattan && uNYCSeaDetail && NYC_TIDEWATER_DETAIL && pixel < 14\.0\)/);
  assert.match(shader,/if\(uManhattan && uNYCSeaDetail && NYC_TIDEWATER_DETAIL && pixel < 2\.0\)/);
  assert.equal(html.split('const bool NYC_TIDEWATER_DETAIL = true;').length-1,1);
});
test('dark water gusts stay world-space and do not touch wave displacement or C185',()=>{
  assert.match(shader,/vnoise\(xz\*0\.0068\+/);
  assert.match(shader,/nycGustPatch=smoothstep/);
  assert.match(shader,/roughness=clamp\(roughness\*\(1\.0\+0\.20\*nycGustPatch\)/);
  assert.match(shader,/waterCol \*= 1\.0-0\.058\*nycGustPatch/);
  assert.match(html,/float oceanHeight\(vec2 xz, float depth, float pixel\)/);
  assert.match(html,/floatOceanPose\(x,z,plane\.yaw/);
  assert.match(html,/sampleFloatOceanFloor\(x,z\)/);
});
test('fragmented foam fades into stable distant average without new textures',()=>{
  assert.match(shader,/foamFragment=smoothstep\(0\.30,0\.70/);
  assert.match(shader,/foamResolve=1\.0-smoothstep\(0\.42,2\.0,pixel\)/);
  assert.match(shader,/caps \*= fragmented;/);
  assert.match(shader,/shore \*= fragmented;/);
  assert.doesNotMatch(shader,/uniform sampler2D uTidewater/);
});
test('subpixel caustics are filtered only in NYC',()=>{
  assert.match(shader,/causticFootprint=\(uManhattan && uNYCSeaDetail && NYC_TIDEWATER_DETAIL\)/);
  assert.match(shader,/focus=oceanCaustic\(floorXZ,depth\)\*localDetail\*/);
});
test('existing same-camera A/B harness covers crest and sea-detail independently',()=>{
  const testTool=readFileSync(new URL('../tools/aircraft/nyc-water-crest-compare.mjs',import.meta.url),'utf8');
  assert.match(testTool,/PATROL_COMPARE_MODE==='sea-detail'/);
  assert.match(testTool,/const bool NYC_TIDEWATER_DETAIL = false;/);
  assert.match(testTool,/nyc-water-'\+report\.mode/);
  assert.match(testTool,/gpuFrameMs:null/);
});
test('graphics compat and NYC Basic bypass extra visual noise without touching water physics',()=>{
  assert.match(shader,/uniform bool uNYCSeaDetail;/);
  assert.match(html,/nycSeaDetail:gl\.getUniformLocation\(worldProg,'uNYCSeaDetail'\)/);
  assert.match(html,/gl\.uniform1i\(uWorld\.nycSeaDetail,/);
  assert.match(html,/selectedMap\.city && !graphicsCompat &&/);
  assert.match(html,/Number\(nyStreetQuality\.value\) >= 2/);
});
test('NYC far-water long-wave optical filter preserves original physical wave',()=>{
  assert.match(shader,/const bool NYC_HORIZON_SLOPE_FILTER = true;/);
  assert.match(shader,/nycLongSlopeVisibility/);
  assert.match(shader,/1\.0-0\.72\*smoothstep\(0\.80,4\.40,pixel\)/);
  assert.match(shader,/swell\.yz\*nycLongSlopeVisibility\+chop\.yz/);
  assert.match(shader,/swell\.x \* 0\.045 \*/);
  assert.match(shader,/nycLongSlopeVisibility \+ chop\.x \* 0\.19/);
  assert.match(html,/function floatOceanHeight\(x,z,t,depth,map\)/);
  assert.match(html,/height\+=Math\.sin\(kx\*x\+kz\*z-omega\*t\+phase\)\*amp/);
  assert.doesNotMatch(html,/NYC_CREST_BEND/);
});
test('band-filter A/B toggles only shader optical filter and validates flight form',()=>{
  const qa=readFileSync(new URL('../tools/aircraft/nyc-water-crest-compare.mjs',import.meta.url),'utf8');
  assert.match(qa,/PATROL_COMPARE_MODE==='band-filter'/);
  assert.match(qa,/const bool NYC_HORIZON_SLOPE_FILTER = false;/);
  assert.match(qa,/src\.replace\(bandEnabled,bandDisabled\)/);
  assert.match(qa,/new FormData\(document\.getElementById\('flightSetup'\)\)/);
  assert.match(qa,/Water QA form selection not stable/);
});

test('NYC optical far-water fix does not reintroduce a physical crest phase bend',()=>{
  const start=html.indexOf('  const oceanBands =');
  const end=html.indexOf('  const oceanVec4 =',start);
  assert.ok(start>0&&end>start,'CPU wave spectrum can be isolated');
  const {floatOceanHeight,oceanModes}=new Function(
    html.slice(start,end)+'return {floatOceanHeight,oceanModes};')();
  const x=-84,z=-593,t=20,depth=9;
  assert.equal(oceanModes.length,18);
  const unwarped=oceanModes.reduce((sum,[kx,kz,omega,phase,,amp])=>
    sum+Math.sin(kx*x+kz*z-omega*t+phase)*amp,0);
  const city=floatOceanHeight(x,z,t,depth,{city:true});
  assert.ok(Number.isFinite(city));
  assert.ok(Math.abs(city-unwarped)<1e-12,
    'deep open-harbor C185 height must remain the original 18-mode phase');
  assert.ok(Math.abs(floatOceanHeight(x,z,t,depth,{alaska:true})-unwarped*.30)<1e-12,
    'Alaska scale remains unchanged by NYC optical filtering');
  assert.equal(floatOceanHeight(x,z,t,depth,{dc:true}),0);
  assert.doesNotMatch(html,/nycCrestBend|NYC_CREST_BEND/,
    'rejected physical crest warp must not return');
});

test('fixed-camera water QA reports ROI stripe gradients without gating visual acceptance',()=>{
  const qa=readFileSync(new URL('../tools/aircraft/nyc-water-crest-compare.mjs',import.meta.url),'utf8');
  assert.match(qa,/const roi=\{x:20,y:205,width:600,height:90\};/);
  assert.match(qa,/verticalRms=Math\.sqrt\(vertical\/count\)/);
  assert.match(qa,/horizontalRms=Math\.sqrt\(horizontal\/count\)/);
  assert.match(qa,/stripeDirectionRatio:verticalRms\/Math\.max\(horizontalRms,1e-9\)/);
  assert.match(qa,/report\.farWaterComparison=\{/);
  assert.match(qa,/stripeDirectionRatioChangePct:pctChange\(/);
  assert.match(qa,/not GPU time, sea-state measurement, or an automated visual pass/);
});
