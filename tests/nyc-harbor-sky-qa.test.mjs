// The 2026-11-20 NYC run 44865972470 reported 35 color bins and passed
// despite its tenth screenshot containing almost nothing but nearby walls.
// Test the additional spatial/sky evidence, not just color histogram counts.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {visibleHarborSkyFraction,MIN_HARBOR_SKY_FRACTION} from
  '../scripts/nyc-harbor-sky-qa.mjs';

function frame(width,height,toneAt){
  const data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const pixel=toneAt(x,y),k=(y*width+x)*4;
    data.set([...pixel,255],k);
  }
  return {width,height,data};
}
const sky=[146,190,232],wall=[61,79,102],stone=[142,137,128];
const threshold=MIN_HARBOR_SKY_FRACTION;

test('harbor-visible daytime skyline has a significant open-sky area',()=>{
  const image=frame(100,80,(_x,y)=>y<32?sky:stone);
  assert.ok(visibleHarborSkyFraction(image,4)>.75);
  assert.ok(visibleHarborSkyFraction(image,4)>threshold);
});

test('crowded building canyon fails even when there are many wall colors',()=>{
  const image=frame(100,80,(x,y)=>[wall[0]+x%8,wall[1]+y%9,wall[2]+(x+y)%11]);
  assert.equal(visibleHarborSkyFraction(image,4),0,
    '40+ unique low-light color variations do not count as open sky');
  assert.ok(visibleHarborSkyFraction(image,4)<threshold);
});

test('one little slit of sky does not pass the harbor facade camera gate',()=>{
  const image=frame(100,80,(x,y)=>y<24&&x<5?sky:wall);
  assert.ok(visibleHarborSkyFraction(image,2)<threshold);
});

test('strong blue glazing and saturated billboards alone are not daylight sky',()=>{
  const glazing=frame(100,80,()=>[42,71,112]);
  const billboard=frame(100,80,()=>[16,70,225]);
  assert.equal(visibleHarborSkyFraction(glazing),0);
  assert.equal(visibleHarborSkyFraction(billboard),0);
});

test('capture pipelines check actual sky share for the single tenth view',async()=>{
  const all=await readFile(new URL('../scripts/nyc-road-browser-smoke.mjs',import.meta.url),'utf8');
  const one=await readFile(new URL('../scripts/nyc-harbor-facade-browser-smoke.mjs',import.meta.url),'utf8');
  for(const source of [all,one]){
    assert.match(source,/visibleHarborSkyFraction/);
    assert.match(source,/MIN_HARBOR_SKY_FRACTION/);
    assert.match(source,/09-manhattan-window-facades\.png/);
    assert.match(source,/upperSkyFraction/);
  }
});

test('full ten-view tour inspects OTI facades in daylight before bridge zoom',async()=>{
  const script=await readFile(new URL('../scripts/nyc-road-browser-smoke.mjs',import.meta.url),'utf8');
  const harbor=script.indexOf("await capture('09-manhattan-window-facades.png')");
  const city=script.indexOf("await capture('01-city-loaded.png')");
  const bridge=script.indexOf("const bridgeShortcut=");
  const resume=script.indexOf("await page.locator('#resumeFlight').click");
  const lastTimes=script.indexOf("const timesViews=");
  assert.ok(city>=0&&harbor>city&&resume>harbor&&bridge>resume&&lastTimes>harbor,
    'harbor view must be early; restore original flight before bridge shortcut');
  assert.match(script,/PATROL_NYC_QA_DAYLIGHT_LOCK_V1/,
    'retain the other agent’s new noon/clear-weather lock for all ten cameras');
  assert.match(script,/\['skyTime','12'\]/,
    'ten-camera tour remains on the verified noon lighting preset');
  assert.match(script,/el\.value='42'/,
    'harbor camera zoom must match the independently verified one-view camera');
  assert.match(script,/facadeView\.zoom==='42'/,
    'the smoke must verify the correct camera zoom before screenshot');
});
