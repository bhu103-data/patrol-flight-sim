// Regression for the real screenshot runner's headless WebGL frame-rate guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Chongqing screenshot flight test observes simulated altitude, not elapsed wall-clock',()=>{
 const source=readFileSync(new URL('../scripts/chongqing-browser-smoke.mjs',import.meta.url),'utf8');
 assert.match(source,/const starting=await page\.evaluate/);
 assert.match(source,/starting\.avatarFlying/);
 assert.match(source,/page\.waitForFunction\(target=>/);
 assert.match(source,/state\.altitude>target/);
 assert.match(source,/timeout:45000/);
 assert.match(source,/keyboard\.up\('Space'\)/);
 assert.doesNotMatch(source,/waitForTimeout\(2100\)/);
 assert.match(source,/capture\('04-high-rise-climb'\)/);
 assert.match(source,/selectOption\('day'\)/);
 assert.match(source,/capture\('05-day-cinematic'\)/);
 assert.match(source,/selectOption\('night'\)/);
 assert.match(source,/capture\('06-night-cinematic'\)/);
});
