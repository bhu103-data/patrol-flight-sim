import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Chongqing visual evidence runs before unrelated Manhattan checks',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/chongqing-visual.yml',import.meta.url),'utf8');
 const pipeline=[
   'Validate Chongqing road/building occupancy',
   'Install headless Chromium',
   'Chongqing screenshot and high-rise climb checks',
   'Validate NYC road/building occupancy',
   'New York real-browser skyline and road check'
 ];
 const positions=pipeline.map(name=>workflow.indexOf('- name: '+name));
 assert.ok(positions.every((pos,i)=>pos>=0&&(i===0||pos>positions[i-1])),
   'Chongqing screenshots must not be blocked by NYC regressions');
 assert.match(workflow,/cancel-in-progress:\s*false/);
 assert.match(workflow,/node --test tests\/chongqing-\*\.test\.mjs/);
 assert.match(workflow,/node --test tests\/nyc-road-clearance\.test\.mjs/);
 assert.match(workflow,/name: Upload screenshots, WebGL report and failure evidence\s+if: always\(\)/);
 assert.doesNotMatch(workflow,/continue-on-error:\s*true/);
});
