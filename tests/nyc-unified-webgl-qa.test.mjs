// Check that normal NYC changes trigger one real, pixel-audited browser tour.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scriptUrl=new URL('../scripts/nyc-road-browser-smoke.mjs',import.meta.url);
const workflowUrl=new URL('../.github/workflows/nyc-bridgehead-browser.yml',import.meta.url);
const script=await readFile(scriptUrl,'utf8');
const workflow=await readFile(workflowUrl,'utf8');

test('nine NYC cameras are captured with nonblank PNG checks',()=>{
 const named=[
  '00-harbor.png','01-city-loaded.png','02-brooklyn-bridgehead.png',
  '03-dumbo-warehouse.png','04-liberty-crown.png',
  '05-times-square-street.png','06-times-square-led-canyon.png',
  '07-one-times-square.png','08-duffy-square.png'
 ];
 for(const file of named){
  assert.ok(script.includes(file),'missing actual screenshot '+file);
 }
 for(const label of ['Times Square Street Level','44th Street LED Canyon',
   'One Times Square','Duffy Square Street View','Statue of Liberty',
   'DUMBO · Warehouse Blocks']){
  assert.ok(script.includes(label),'missing physical camera '+label);
 }
 assert.match(script,/function screenshotPixels\(bytes\)/);
 assert.match(script,/PNG\.sync\.read\(bytes\)/);
 assert.match(script,/stats\.colorBins>32/);
 assert.match(script,/stats\.nearBlackFraction<\.97/);
 assert.match(script,/result=\{passed:true,state,bridge,dumbo,liberty,screenshots,pixels,warnings\}/);
});
test('same workflow installs the screenshot analyzer and triggers on NYC visuals',()=>{
 assert.match(workflow,/playwright pngjs@7\.0\.0/);
 assert.match(workflow,/scripts\/nyc-road-browser-smoke\.mjs/);
 assert.match(workflow,/- "index\.html"/);
 assert.match(workflow,/- "assets\/nyc\/\*\*"/);
 assert.match(workflow,/upload-artifact@v4/);
});
test('Playwright browser script parses as valid JavaScript',()=>{
 execFileSync(process.execPath,['--check',fileURLToPath(scriptUrl)],{stdio:'pipe'});
});
