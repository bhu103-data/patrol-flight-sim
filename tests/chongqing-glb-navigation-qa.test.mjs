// Earlier real GLB run 44921175892 loaded the model and screenshot, then
// falsely failed when the second navigation waited >30s for DOMContentLoaded.
// Read the actual workflow; never downgrade the scene 'ready'/'off' gates.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../.github/workflows/chongqing-scenario-browser.yml',import.meta.url),'utf8');
test('Chongqing GLB browser rollback has bounded response navigation independent of slow DOM parsing',()=>{
 assert.match(source,/group: chongqing-pbr-browser-\$\{\{ github\.ref \}\}/);
 assert.match(source,/timeout-minutes: 12/);
 for(const path of [
  "http://127.0.0.1:8127/chongqing.html?scenario=original",
  "http://127.0.0.1:8127/chongqing.html"
 ]) {
  // Require the closing quote/comma. A bare /chongqing.html prefix would
  // accidentally match the earlier ?scenario=hongyadong navigation.
  const at=source.indexOf("await page.goto('"+path+"',");
  assert.ok(at>0,'Missing production/rollback URL '+path);
  assert.match(source.slice(at,at+180),/waitUntil:'commit',timeout:75000/);
 }
 assert.match(source,/scenarioHongyadong==='off'/);
 assert.match(source,/scenarioHongyadong==='ready'/);
 assert.match(source,/report.scenario!=='ready'\|\|!report.webgl2/);
 assert.match(source,/sha256sum -c -/);
});
test('workflow preserves fallback screenshots and never upgrades default GLB without proof',()=>{
 assert.match(source,/chongqing-original-clean\.png/);
 assert.match(source,/chongqing-default-hd\.png/);
 assert.match(source,/if: always\(\)/);
 assert.match(source,/upload-artifact@v4/);
});
