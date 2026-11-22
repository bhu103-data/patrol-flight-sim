// Browser-only injected camera source must parse before Chromium install.
// A nested backtick in the Playwright response template previously passed
// geometry tests but made the smoke script fail instantly in CI.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('real Chongqing Chromium smoke script passes Node syntax check',()=>{
  const file=fileURLToPath(new URL('../scripts/chongqing-browser-smoke.mjs',import.meta.url));
  const check=spawnSync(process.execPath,['--check',file],{
    encoding:'utf8',timeout:12000
  });
  assert.equal(check.error,undefined,
    'unable to run syntax check: '+String(check.error));
  assert.equal(check.status,0,
    'Chromium smoke test JS fails to parse before browser launch:\n'+check.stderr);
});
