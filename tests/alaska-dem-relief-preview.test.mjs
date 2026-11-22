import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const dem=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const elevations=Buffer.from(dem.heightsBase64,'base64');

test('opt-in high-relief only after verified USGS decode, never for fallback',()=>{
  const reset=html.indexOf('activeAlaskaTerrainScale = ALASKA_STANDARD_SCALE;',html.indexOf('async function launchFlight'));
  const loadingGuard=html.indexOf('if (loading) return;',html.indexOf('async function launchFlight'));
  const contextGuard=html.indexOf('if(gl.isContextLost()){',html.indexOf('async function launchFlight'));
  assert.ok(loadingGuard>0&&contextGuard>loadingGuard&&reset>contextGuard,
    're-entrant or graphics-rejected launch must never reset live Alaska terrain scale');
  const decoded=html.indexOf("const dem=await loadAlaskaDEM(");
  const optIn=html.indexOf(".get('alaskaRelief')==='preview'");
  const activate=html.indexOf('activeAlaskaTerrainScale=selectedTerrainScale;');
  const nextWorker=html.indexOf('worker.postMessage(terrainOptions);',activate);
  assert.ok(reset>0&&reset<decoded,'each map launch starts with standard scale');
  assert.ok(decoded<optIn&&optIn<activate&&activate<nextWorker,'preview must activate only after DEM decode');
  assert.match(html,/const ALASKA_STANDARD_SCALE = 75;/);
  assert.match(html,/const ALASKA_DEM_RELIEF_PREVIEW_SCALE = 95;/);
  assert.match(html,/\? ALASKA_DEM_RELIEF_PREVIEW_SCALE : ALASKA_STANDARD_SCALE;/);
  assert.ok(!html.includes("alaskaRelief')==='real'"),'never claim geodetic 1:1 terrain');
});

test('worker, collision and GPU all share the same active Alaska terrain scale',()=>{
  assert.match(html,/terrainOptions\.scale=selectedTerrainScale;/);
  assert.match(html,/activeAlaskaTerrainScale=selectedTerrainScale;/);
  assert.match(html,/const terrainScaleFor = map => map\.alaska \? activeAlaskaTerrainScale : map\.vegas \? 68 : TERRAIN_SCALE;/);
  assert.match(html,/const h = lerp\(lerp\(h00, h10, tx\), lerp\(h01, h11, tx\), ty\) \* terrainScaleFor\(selectedMap\);/);
  assert.match(html,/gl\.uniform1f\(uWorld\.terrainScale,terrainScaleFor\(selectedMap\)\);/);
  assert.match(html,/height\[idx\]=clamp\(\(metres>1\s*\? water\+metres\*options\.alaskaDEM\.verticalScale\s*: water-4\.5\)\/scale,0\.02,0\.96\);/);
});

test('highest measured ridge fits existing hard flight ceiling and terrain atlas',()=>{
  assert.equal(elevations.byteLength,dem.width*dem.height*2);
  let highest=0,at=0;
  for(let i=0;i<elevations.byteLength;i+=2){
    const h=elevations.readUInt16LE(i);
    if(h>highest){highest=h;at=i/2;}
  }
  assert.equal(highest,1836);
  const peak=(scale)=>12.2+highest*Math.min(.04,(scale*.90-12.2)/highest);
  const standard=peak(75),preview=peak(95);
  assert.ok(Math.abs(standard-67.5)<.01);
  assert.ok(Math.abs(preview-85.5)<.01);
  assert.ok(preview-standard>=17.9,'mountain peak must move visually');
  assert.ok(preview<100-12,'leave at least 12 game-height units above terrain');
  assert.ok(preview/95<.96,'do not clip to worker atlas maximum');
  assert.ok(html.includes('const CEILING = 100;'));
  assert.ok(html.includes('plane.pos[1] = Math.min(plane.pos[1],'));
  assert.ok(at>=0);
});
