import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '..', 'index.html'), 'utf8');

assert.match(source, /vec3 reflDir = reflect\(rd, wn\);\s*\/\/[\s\S]*?reflDir\.y = max\(reflDir\.y, 0\.002\);/);
assert.doesNotMatch(source, /reflDir\.y\s*=\s*abs\(reflDir\.y\)/);

// Keep the established physical-water path and the shared flight/water
// uniforms intact; this patch is shading-only and must not replace buoyancy.
assert.match(source, /float waterFresnel\(float cosI\)/);
assert.match(source, /gl\.uniform3fv\(uWorld\.sun,environment\.sun\)/);
assert.match(source, /function sampleFlightEnvironment\(dt\)/);

console.log('Tidewater water reflection horizon guard verified.');
