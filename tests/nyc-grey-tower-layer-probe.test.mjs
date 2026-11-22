import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const probe=await readFile(
  new URL('../scripts/nyc-grey-tower-layer-probe.mjs',import.meta.url),'utf8');
test('debug draw omission is explicitly opt-in and NYC-only',()=>{
  assert.match(html,/\.get\('nycVisualProbe'\)==='1'/);
  assert.match(html,/nycVisualProbeEnabled &&\s*selectedMap\.city &&/);
  assert.match(html,/let nycVisualProbeHidden='none'/);
  assert.match(html,/if\(nycVisualProbeEnabled\)\{\s*const groups=/);
  assert.match(html,/if\(!groups\.includes\(group\)\)throw Error/);
  assert.match(html,/window\.__patrolNycVisualProbe=\{/);
  assert.doesNotMatch(html,/new URLSearchParams\(location\.search\)\.get\('nycVisualProbe'\)!=='0'/);
});
test('each actual NYC mesh draw path has exactly one diagnostic layer gate',()=>{
  for(const [layer,pattern] of [
    ['background',/backgroundBuildings && !nycVisualProbeOmits\('procedural'\)/],
    ['hand-authored landmark blocks',/mapScenery && !nycVisualProbeOmits\('scenery'\)/],
    ['GIS infill',/if\(selectedMap\.city && nycGisMesh\?\.count\)\{\s*if\(!nycVisualProbeOmits\('gis'\)\)/],
    ['NYC distant hero detail',/nycHeroScenery\?\.count && !nycVisualProbeOmits\('hero'\)/],
    ['named landmark meshes',/selectedMap\.city && !nycVisualProbeOmits\('landmarks'\)/]
  ])assert.match(html,pattern,'Missing guarded '+layer);
  assert.match(html,/drawMeshWithOutline\(backgroundBuildings,identity,false,true\)/);
  assert.match(html,/drawMesh\(nycGisMesh,identity\)/);
  assert.match(html,/drawMesh\(mapScenery,identity\)/);
});
test('probe collects true camera PNGs at a fixed viewport and restores draw state',()=>{
  assert.match(probe,/viewport:\{width:1280,height:720\}/);
  assert.match(probe,/44th Street LED Canyon/);
  assert.match(probe,/focusRoi:\[600,5,800,408\]/);
  assert.match(probe,/for\(const group of groups\)await capture/);
  assert.match(probe,/await capture\('44th-restored','none'\)/);
  assert.match(probe,/getContext\('webgl2'\)/);
  assert.match(probe,/report\.ambiguous=/);
  assert.match(probe,/report\.passed=true/);
});
