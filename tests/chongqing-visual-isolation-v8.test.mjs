import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Chongqing screenshots are isolated from Manhattan browser work',()=>{
 const cq=readFileSync(new URL('../.github/workflows/chongqing-visual.yml',import.meta.url),'utf8');
 const ny=readFileSync(new URL('../.github/workflows/nyc-bridgehead-browser.yml',import.meta.url),'utf8');
 const steps=[
   'Validate Chongqing road/building occupancy',
   'Install headless Chromium',
   'Chongqing screenshot and high-rise climb checks',
   'Upload Chongqing screenshots, WebGL report and failure evidence'
 ];
 const positions=steps.map(name=>cq.indexOf('- name: '+name));
 assert.ok(positions.every((pos,i)=>pos>=0&&(i===0||pos>positions[i-1])),
   'Chongqing screenshot QA must execute and upload without NYC dependencies');
 assert.match(cq,/cancel-in-progress:\s*false/);
 assert.match(cq,/node --test tests\/chongqing-\*\.test\.mjs/);
 assert.match(cq,/node scripts\/chongqing-browser-smoke\.mjs/);
 assert.doesNotMatch(cq,/node scripts\/nyc-road-browser-smoke\.mjs/);
 assert.doesNotMatch(cq,/- name: Validate NYC road\/building occupancy/);
 assert.doesNotMatch(cq,/- "index\.html"/,
   'unrelated general launcher edits must not restart Chongqing screenshots');
 assert.doesNotMatch(cq,/continue-on-error:\s*true/);
 assert.match(ny,/node scripts\/nyc-road-browser-smoke\.mjs/,
   'Manhattan/Brooklyn still have independent actual WebGL screenshot QA');
 assert.match(ny,/node --test tests\/nyc-road-clearance\.test\.mjs/);
});
