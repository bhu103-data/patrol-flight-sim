import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [html,probe,gis]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../scripts/nyc-grey-tower-layer-probe.mjs',import.meta.url),'utf8'),
  readFile(new URL('../assets/nyc/nyc-gis-infill.js',import.meta.url),'utf8')
]);

test('debug draw omission is explicitly opt-in and NYC-only',()=>{
  assert.match(html,/\.get\('nycVisualProbe'\)==='1'/);
  assert.match(html,/nycVisualProbeEnabled &&\s*selectedMap\.city &&/);
  assert.match(html,/let nycVisualProbeHidden='none'/);
  assert.match(html,/if\(nycVisualProbeEnabled\)\{\s*const groups=/);
  assert.match(html,/if\(!groups\.includes\(group\)\)throw Error/);
  assert.match(html,/window\.__patrolNycVisualProbe=\{/);
  assert.match(html,/freezeSceneryTime\(value\)/);
  assert.match(html,/nycVisualProbeFrozenSceneryTime===null/);
  assert.match(html,/window\.__patrolNycVisualProbe\.setGisSkippedFids=ids=>/);
  assert.match(html,/skipFids:new Set\(skipFids\)/);
  assert.match(gis,/skipFids!==null && !\(skipFids instanceof Set\)/);
  assert.match(gis,/sourceFids:\[\.\.\.sourceFids\]/);
  assert.doesNotMatch(html,/new URLSearchParams\(location\.search\)\.get\('nycVisualProbe'\)!=='0'/);
});

test('every previously unprobed Manhattan mesh has an isolated QA gate',()=>{
  for(const [layer,pattern] of [
    ['background buildings',/backgroundBuildings && !nycVisualProbeOmits\('procedural'\)/],
    ['landscape details',/landscapeDetails && !nycVisualProbeOmits\('landscape'\)/],
    ['hand-authored scenery',/mapScenery && !nycVisualProbeOmits\('scenery'\)/],
    ['GIS infill',/if\(selectedMap\.city && nycGisMesh\?\.count\)\{\s*if\(!nycVisualProbeOmits\('gis'\)\)/],
    ['street mesh',/nycStreetMesh\?\.count && !nycVisualProbeOmits\('street'\)/],
    ['road LOD chunks',/if\(selectedMap\.city && nycRoadChunkLevel\)\{\s*if\(!nycVisualProbeOmits\('roadChunks'\)\)\{/],
    ['hero scenery',/nycHeroScenery\?\.count && !nycVisualProbeOmits\('hero'\)/],
    ['park mesh',/nycParkMesh\?\.count && !nycVisualProbeOmits\('park'\)/],
    ['LED screens',/timesSquareScreens\?\.count && !nycVisualProbeOmits\('screens'\)/],
    ['scene lights',/mapLights\.count && !nycVisualProbeOmits\('lights'\)/],
    ['named landmarks',/selectedMap\.city && !nycVisualProbeOmits\('landmarks'\)/]
  ])assert.match(html,pattern,'Missing isolated '+layer+' render gate');
  assert.match(html,/drawMeshWithOutline\(backgroundBuildings,identity,false,true\)/);
  assert.match(html,/drawMesh\(nycGisMesh,identity\)/);
  assert.match(html,/drawMesh\(mapScenery,identity\)/);
});

test('probe measures left wall, center wall, LED and full-frame regions',()=>{
  assert.match(probe,/viewport:\{width:1280,height:720\}/);
  assert.match(probe,/44th Street LED Canyon/);
  assert.match(probe,/leftWall:\[0,0,460,720\]/);
  assert.match(probe,/centerWall:\[460,0,900,720\]/);
  assert.match(probe,/rightLed:\[900,0,1280,720\]/);
  assert.match(probe,/fullFrame:\[0,0,1280,720\]/);
  assert.match(probe,/const groups=\['none','procedural','landscape','scenery','gis','street','roadChunks','hero','park','screens','lights','landmarks'\]/);
  assert.match(probe,/for\(const group of groups\)await capture/);
  assert.match(probe,/s\?\.gisTriangles>0/);
  assert.match(probe,/typeof window\.__patrolNycVisualProbe\?\.setGisSkippedFids==='function'/);
  assert.match(probe,/await capture\('44th-restored','none'\)/);
  assert.match(probe,/report\.rankedByRoi=/);
  assert.match(probe,/freezeSceneryTime\(42\)/);
  assert.ok(probe.indexOf('freezeSceneryTime(42)')<
    probe.indexOf('report.fidScan=await page.evaluate'),
    'freeze scene before per-FID framebuffer scan');
  assert.match(probe,/baselineSourceBuildings/);
  assert.match(probe,/removedExactlyOneSourceBuilding/);
  assert.match(probe,/fidScanAmbiguous/);
  assert.match(probe,/report\.fidScan=await page\.evaluate/);
  assert.match(probe,/gl\.readPixels/);
  assert.match(probe,/report\.fidScanTop=report\.fidScan\.slice\(0,10\)/);
  assert.match(probe,/44th-skip-fid-/);
  assert.match(probe,/Left-wall source layer:/);
  assert.match(probe,/getContext\('webgl2'\)/);
  assert.match(probe,/report\.passed=true/);
});
