import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const preview=await readFile(new URL('../tools/nyc/true-scale-preview.html',import.meta.url),'utf8');
const workflow=await readFile(new URL('../.github/workflows/nyc-times-true-scale-flight.yml',import.meta.url),'utf8');
const browser=await readFile(new URL('../tools/nyc/true-scale-flight-browser-smoke.mjs',import.meta.url),'utf8');
const production=await readFile(new URL('../index.html',import.meta.url),'utf8');
const extractor=await readFile(new URL('../tools/nyc/extract-tum-lod2-markings.py',import.meta.url),'utf8');

test('real historical polygon layer comes from same-run verified CityGML not fabricated arrays',()=>{
  assert.match(workflow,/PATROL_KEEP_GML=1 python3 tools\/nyc\/probe-tum-lod2-markings\.py/);
  assert.match(workflow,/python3 tools\/nyc\/extract-tum-lod2-markings\.py/);
  assert.match(workflow,/cp artifacts\/nyc-tum-lod2-markings\/times-square-markings-source\.json artifacts\/nyc-true-scale\/historic-markings\.json/);
  assert.match(extractor,/EPSG:32118/);
  assert.match(extractor,/Transformer\.from_crs/);
  assert.match(extractor,/hashlib\.sha256\(zip_path\.read_bytes\(\)\)\.hexdigest\(\)/);
  assert.match(extractor,/"readyToRender":False/);
  assert.ok(!production.includes('historic-markings.json'),
    'old 2017 markings must not silently enter 2026 PATROL production map');
});

test('historic true-geo overlay is optional OFF by default, retains same source local frame',()=>{
  assert.match(preview,/<input id="historicToggle" type="checkbox"\/>/);
  assert.match(preview,/fetch\('\.\/historic-markings\.json'\)/);
  assert.match(preview,/historical\.sourceCrs!=='EPSG:32118'/);
  assert.match(preview,/historical\.readyToRender!==false/);
  assert.match(preview,/for\(const row of historical\.polygons\)/);
  assert.match(preview,/historicToggle\.checked&&historicMesh\.count>0/);
  assert.match(preview,/gl\.drawArrays\(gl\.TRIANGLES,0,historicMesh\.count\)/);
  assert.match(preview,/历史.*?涂装隔离带/);
});

test('native WebGL QA takes same-view OFF/ON before flying, retains controls',()=>{
  assert.match(browser,/await shot\('01-metric-aerial'\)/);
  assert.match(browser,/await page\.locator\('#historicToggle'\)\.check\(\)/);
  assert.match(browser,/await shot\('01a-historic-CityGML-median-on'\)/);
  assert.match(browser,/await page\.locator\('#historicToggle'\)\.uncheck\(\)/);
  assert.match(browser,/await page\.click\('#toggleFlight'\)/);
  assert.match(browser,/info\.historySource\?\.actualPolygons!==17/);
  assert.match(browser,/info\.historySource\?\.crs!=='EPSG:32118'/);
  const checked=spawnSync(process.execPath,['--check',fileURLToPath(
    new URL('../tools/nyc/true-scale-flight-browser-smoke.mjs',import.meta.url))],{encoding:'utf8'});
  assert.equal(checked.status,0,checked.stderr||checked.stdout);
});
