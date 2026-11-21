import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Verify the actual legacy tree-patch selection expression rather than
// treating a screenshot-only check as protection against reintroduction.
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('const patches = alaska && !graphicsCompat');
const end=html.indexOf('for (const [cx,cz] of patches)',start);
assert.ok(start>=0&&end>start,'legacy landscape selection must remain testable');
const selected=html.slice(start,end).trim();
const patchesFor=new Function('selectedMap','graphicsCompat',
  'const alaska=Boolean(selectedMap.alaska);\n'+selected+'\nreturn patches;');

test('NYC Central Park does not receive old pointed conifers over Loeb Boathouse',()=>{
  for(const graphicsCompat of [false,true])
    assert.equal(patchesFor({city:true,alaska:false},graphicsCompat).length,0,
      'new dedicated park forest replaces legacy x=79,z=160 cone patches');
  assert.match(html,/buildCentralPark\(parkOpts\)/,
    'dedicated terrain/shore-cleared park vegetation remains present');
});

test('Alaska graphics fallback and other maps retain legacy patches',()=>{
  assert.equal(patchesFor({alaska:true,city:false},false).length,0,
    'Alaska high quality uses its own detailed vegetation');
  assert.equal(patchesFor({alaska:true,city:false},true).length,6,
    'Alaska compatibility fallback remains intact');
  assert.equal(patchesFor({alaska:false,city:false},false).length,2);
});
