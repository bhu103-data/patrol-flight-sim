// Repo-wide Node guardrails (no npm dependency): the *actual* Earcut/source
// mesh and full rendered screenshot are validated by dedicated WebGL CI after
// installing the reviewed free earcut package.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repoURL=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,repoURL),'utf8');
test('OTI official roadbed parser is byte-identical to source-verified parent #244',async()=>{
  const code=await read('scripts/nyc-times-roadbed-polygon-source.mjs');
  const hash=createHash('sha1').update('blob '+Buffer.byteLength(code)+'\0'+code).digest('hex');
  assert.equal(hash,'b0d911143ba6cf8369059fac986086cd2274d05e');
  assert.match(code,/Roadbed_2022\/FeatureServer\/20/);
  assert.match(code,/No official OTI roadbed FeatureCollection/);
  assert.match(code,/returnGeometry:'true'/);
});
test('actual 2022 road polygon mesh keeps holes, source metres and source-only provenance',async()=>{
  const src=await read('tools/nyc/roadbed-source-mesh.mjs');
  const builder=await read('scripts/nyc-roadbed-metric-lowfly-build.mjs');
  assert.match(src,/import earcut,\{deviation\} from 'earcut'/);
  assert.match(src,/deviation\(flat,holePositions,2,indices\)/);
  assert.match(src,/err>\.0005/);
  assert.match(src,/trianglesInsideBuildings/);
  assert.match(src,/record\.objectId/);
  assert.match(src,/roadbed source coverage insufficient/i);
  assert.match(builder,/source\.projection\.originLonLat\.join/);
  assert.match(builder,/compileOfficialRoadbedMesh\(source,city\.buildings\)/);
  assert.match(builder,/trianglesInsideBuildings/);
  for(const file of ['scripts/nyc-roadbed-metric-lowfly-build.mjs',
    'tools/nyc/roadbed-source-mesh.mjs']){
    const result=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,repoURL))],
      {encoding:'utf8'});
    assert.equal(result.status,0,result.stderr||result.stdout||file+' failed Node syntax');
  }
});
test('metric low-flight uses 2022 roadbed by default; ROW hints and older medians remain optional',async()=>{
  const html=await read('tools/nyc/true-scale-preview.html');
  assert.match(html,/id="roadbedToggle" type="checkbox" checked/);
  assert.match(html,/id="rowHintToggle" type="checkbox"\/>/);
  assert.match(html,/id="historicToggle" type="checkbox"\/>/);
  assert.match(html,/fetch\('\.\/roadbed-mesh\.json'\)/);
  assert.match(html,/realRoads\.flatVerticesMetres\.length!==realRoads\.counts\.triangles\*6/);
  assert.match(html,/realRoads\.counts\.trianglesInsideBuildings>0/);
  assert.match(html,/realRoadbedSource:\{features:/);
  assert.match(html,/gl\.drawArrays\(gl\.TRIANGLES,0,realPavement\.count\)/);
  const game=await read('index.html');
  assert.ok(!game.includes('roadbed-mesh.json'),
    '2022 roadbed must NOT accidentally overwrite the current PATROL game');
});
test('original Source/CityGML QA and actual WebGL A/B remain in exact-head workflow',async()=>{
  const workflow=await read('.github/workflows/nyc-times-true-scale-flight.yml');
  const smoke=await read('tools/nyc/true-scale-flight-browser-smoke.mjs');
  assert.match(workflow,/node scripts\/nyc-times-roadbed-polygon-source\.mjs/);
  assert.match(workflow,/node scripts\/nyc-roadbed-metric-lowfly-build\.mjs/);
  assert.match(workflow,/earcut@3\.0\.1/);
  assert.match(workflow,/PATROL_KEEP_GML=1 python3 tools\/nyc\/probe-tum-lod2-markings\.py/);
  assert.match(workflow,/node tools\/nyc\/true-scale-flight-browser-smoke\.mjs/);
  assert.match(smoke,/00-oti-roadbed-off/);
  assert.match(smoke,/officialRoadbedOn===officialRoadbedOff/);
  assert.match(smoke,/info\.realRoadbedSource\?\.features<75/);
  assert.match(smoke,/info\.realRoadbedSource\?\.trianglesInsideBuildings!==0/);
  assert.match(smoke,/await page\.click\('#toggleFlight'\)/);
  assert.match(smoke,/await shot\('03-source-road-low-fly-moved'\)/);
});
