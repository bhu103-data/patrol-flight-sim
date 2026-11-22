// Fixed-scene signal ROI selector from the production Playwright QA script.
// RGB fixtures are measured from actual 1280x720 SwiftShader PNGs:
// #175 artifact 14740302590, #205 failed artifact 14740514625.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../scripts/nyc-bridgehead-full-footprint-qa.mjs',
  import.meta.url),'utf8');
const begin=source.indexOf('function selectRedLampRoi(candidates){');
const end=source.indexOf('const injection=String.raw`',begin);
assert.ok(begin>=0&&end>begin,'Browser ROI selector not found');
const select=new Function(source.slice(begin,end)+'return selectRedLampRoi;')();

function candidates({legacyRed,legacyGreen,shiftedRed,shiftedGreen}){
  return [
    {label:'red-original',red:legacyRed,green:legacyGreen},
    {label:'red-shifted',red:shiftedRed,green:shiftedGreen}
  ];
}

test('original #175 red lamp is still detected at original ROI',()=>{
  const r=select(candidates({
    legacyRed:[122.7,44.3,43],legacyGreen:[42.4,39.2,42.4],
    shiftedRed:[112.2,95.1,56.6],shiftedGreen:[112.2,95.1,56.6]
  }));
  assert.equal(r.selectedRedRoi,'red-original');
  assert.ok(r.upperRedGain>=75);
});

test('relocated BQE #205 red lamp is detected 14px higher',()=>{
  const r=select(candidates({
    legacyRed:[42.3,42.2,37.1],legacyGreen:[42.3,42.2,37.1],
    shiftedRed:[231.2,34.2,23.6],shiftedGreen:[39.5,19.4,20.3]
  }));
  assert.equal(r.selectedRedRoi,'red-shifted');
  assert.ok(r.upperRedGain>=180);
});

test('warm amber must never substitute for a visibly red lens',()=>{
  const r=select(candidates({
    legacyRed:[217,176,42],legacyGreen:[39,20,20],
    shiftedRed:[42,42,37],shiftedGreen:[42,42,37]
  }));
  assert.equal(r.selectedRedRoi,null);
  assert.equal(r.upperRedGain,0);
});

test('no illuminated red lamp stays a failed visual gate',()=>{
  const r=select(candidates({
    legacyRed:[43,43,37],legacyGreen:[42,43,37],
    shiftedRed:[48,45,40],shiftedGreen:[40,40,37]
  }));
  assert.equal(r.selectedRedRoi,null);
  assert.equal(r.upperRedGain,0);
});

test('browser QA preserves all three physical lens and WebGL error gates',()=>{
  assert.match(source,/upperRedShifted:\[633,330,648,342\]/);
  assert.match(source,/upperRedGain>=25&&lowerGreenGain>=40&&amberMiddleGain>=25/);
  assert.match(source,/assert\(gl===0,'Signal close-up WebGL error/);
  assert.match(source,/\['amber',27\.1,'05-bridge-signal-close-amber\.png'\]/);
});
