// Run in Node: verify Brooklyn-only masonry shading and stable running bond.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=page.indexOf('void nyOfficialGisPbr(');
const end=page.indexOf('void alaskaGlacierFace(',start);
assert.ok(start>0&&end>start,'NYC source-aware masonry shader exists');
const pbr=page.slice(start,end);

test('brick courses are applied only to NYC procedural Brooklyn wall material 12',()=>{
 assert.match(pbr,/!uManhattanView/,'other maps cannot inherit NYC bricks');
 assert.match(pbr,/if\(vHarborSurface>11\.5 && vHarborSurface<12\.5\)/,
   'only procedural brick 12, not glass 13, gravel 14, OTI 9 or GIS 6');
 assert.match(pbr,/PATROL_DUMBO_RUNNING_BOND_V1/);
 assert.match(pbr,/roughness=mix\(roughness,\.85,mortar\*nearDetail\*\.45\)/);
});
test('brick coursing alternates half-width joints across neighboring rows',()=>{
 const wrap=n=>n-Math.floor(n);
 const joint=(x,row)=>wrap(x*1.36+(row%2)*.5);
 assert.ok(Math.abs(joint(.21,0)-joint(.21,1))>.45);
 assert.equal(joint(.21,0),joint(.21,2));
 assert.equal(joint(.21,1),joint(.21,3));
 assert.match(pbr,/brick\.x\+=mod\(course,2\.0\)\*\.5/);
});
test('mortar edge is antialiased and has restrained nearby wear variation',()=>{
 assert.match(pbr,/fwidth\(brick\)\*1\.25/);
 assert.match(pbr,/smoothstep\(\.022,\.054\+aa\.x,edge\.x\)/);
 assert.match(pbr,/smoothstep\(\.025,\.054\+aa\.y,edge\.y\)/);
 assert.match(pbr,/nyStreetNoise\(vec2\(floor\(brick\.x\),course\)/);
 assert.match(pbr,/mortar\*nearDetail\*\.76/);
});
