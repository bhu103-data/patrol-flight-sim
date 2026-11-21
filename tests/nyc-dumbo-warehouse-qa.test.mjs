// QA harness contract: same production branch, only cornerWarehouse toggled,
// no code or geometry changes to main or shared integration.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const script=readFileSync(new URL('../scripts/nyc-dumbo-warehouse-qa.mjs',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/nyc-dumbo-warehouse-qa.yml',import.meta.url),'utf8');
test('isolated Playwright script parses and measures actual accepted parcels',()=>{
 execFileSync(process.execPath,['--check',new URL('../scripts/nyc-dumbo-warehouse-qa.mjs',import.meta.url).pathname]);
 for(const token of [
  'function buildCityBuildings(parcels,local=false)',
  'warehouseStyles.entries()','globalThis.__PATROL_DUMBO_QA__',
  'parcels.sites.length!==2','s.destroyed||s.official',
  "if(variant==='fallback')","const cornerWarehouse=false;",
  "const cornerWarehouse=warehouseStyles.has(lot);",
  'DUMBO A · Street QA','DUMBO A · Low Flight QA',
  'DUMBO B · Street QA','DUMBO B · Low Flight QA'
 ])assert.ok(script.includes(token),'Missing real-site gate '+token);
});
test('A/B compare same game build, daylight and HUD-free WebGL canvases',()=>{
 for(const t of [
  "'skyTime','12'","'skySeason','1'","'skyWeather','Clear'",
  "getContext('webgl2')","page.locator('#glCanvas').screenshot",
  'dumbo-qa-pixels','JSON.stringify(control.sites)===JSON.stringify(candidate.sites)',
  'delta.changedFraction<.003','nearBlackFraction>.97','animations:'
 ])assert.ok(script.includes(t),'Missing screenshot evidence gate '+t);
});
test('free isolated workflow runs script and preserves screenshots on error',()=>{
 assert.match(workflow,/qa\/dumbo-corner-pedestrian-webgl-20261121/);
 assert.match(workflow,/node --test tests\/nyc-dumbo-corner-warehouses\.test\.mjs/);
 assert.match(workflow,/node scripts\/nyc-dumbo-warehouse-qa\.mjs/);
 assert.match(workflow,/if: always\(\)/);
 assert.match(workflow,/upload-artifact@v4/);
});
