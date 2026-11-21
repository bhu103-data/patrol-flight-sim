// Regression for deterministic bridgehead infill priority and bounded footprint checks.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('const bridgeheadCandidates=[];');
const end=html.indexOf('let brooklynGapFills=0;',begin);
assert.ok(begin>=0&&end>begin,'bridgehead priority generator is present');
const buildCandidates=new Function('city',html.slice(begin,end)+'return bridgeheadCandidates;');
const city={blockWidth:24,blockLength:33,tilt:.24,offset:30};

test('bridgehead fill candidates prioritize bridge view instead of the southern row',()=>{
  const candidates=buildCandidates(city);
  assert.equal(candidates.length,160);
  assert.equal(new Set(candidates.map(p=>p.ix+':'+p.iz)).size,160);
  for(let i=1;i<candidates.length;i++)
    assert.ok(candidates[i].score>=candidates[i-1].score-1e-9);
  const first=candidates.slice(0,32);
  assert.ok(new Set(first.map(p=>p.iz)).size>=4,
    'bridgehead infill should cover multiple streets');
  assert.ok(first.some(p=>p.ix<=14),'include DUMBO approach');
  assert.ok(first.some(p=>p.ix>=16),'include inland bridgehead');
  assert.ok(first.every(p=>p.iz>-13),
    'nearby bridge blocks win before southern fringe');
});

test('bridgehead infill remains bounded and cannot bypass spatial safeguards',()=>{
  const section=html.slice(begin,html.indexOf('for(let i=0;i<officialLots.length;i++)',end));
  assert.match(section,/brooklynGapFills>=32/);
  assert.match(section,/if\(base<=water\+1\.2\)continue/);
  assert.match(section,/generatedCityRoadOverlap\(\[x,z,width,length\],5\.85\)/);
  assert.match(section,/if\(officialLots\.some\(overlaps\)\)continue/);
  assert.match(section,/if\(occupied\)continue/);
  assert.match(section,/cityParcels\.set\(key,\[x,z,width,length,height,tone/);
});
