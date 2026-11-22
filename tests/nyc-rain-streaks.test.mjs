import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('    vec3 precipitation(vec3 scene,vec2 uv) {');
const end=html.indexOf('    vec3 emissiveAt(vec2 uv) {',start);
assert.ok(start>=0&&end>start,'production postprocess rain shader must exist');
const shader=html.slice(start,end);
const nycStart=shader.indexOf('if(uNyCinema>0.5){');
const nycEnd=shader.indexOf('}else{',nycStart);
assert.ok(nycStart>=0&&nycEnd>nycStart,'NYC-only rain path must be explicit');
const nyc=shader.slice(nycStart,nycEnd);
const legacy=shader.slice(nycEnd);

test('Manhattan rain uses sparse varied streaks instead of the dense screen-speckle grid',()=>{
  assert.match(nyc,/vec2\\(p\\.x\\+p\\.y\\*0\\.16,p\\.y\\)\\*vec2\\(96\\.0,12\\.0\\)/);
  assert.match(nyc,/float streakEnabled=step\\(0\\.68,seed\\)/);
  assert.match(nyc,/width=mix\\(0\\.040,0\\.105,/);
  assert.match(nyc,/streakLength=mix\\(0\\.18,0\\.42,/);
  assert.match(nyc,/depthFade=mix\\(0\\.72,1\\.0,/);
  assert.match(nyc,/uWeatherVisual\\.x\\*0\\.23/);
  assert.doesNotMatch(nyc,/vec2\\(194\\.0,15\\.0\\)|step\\(0\\.35,seed\\)|uWeatherVisual\\.x\\*0\\.43/);
});

test('non-Manhattan rain shader remains the original shared fallback',()=>{
  assert.match(legacy,/vec2\\(p\\.x\\+p\\.y\\*0\\.19,p\\.y\\)\\*vec2\\(194\\.0,15\\.0\\)/);
  assert.match(legacy,/step\\(0\\.35,seed\\)\\*uWeatherVisual\\.x\\*0\\.43/);
  assert.match(html,/uniform1f\\(uDither\\.nyCinema,selectedMap\\.city && !graphicsCompat/);
});

test('snow rendering and the existing WebGL compositor remain intact',()=>{
  assert.match(shader,/if\\(uWeatherVisual\\.y>0\\.003\\)/);
  assert.match(shader,/for\\(int i=0;i<2;i\\+\\+\\)/);
  assert.match(html,/precipitation\\(smoothColor,vUv\\)/);
  assert.match(html,/precipitation\\(bestCol,vUv\\)/);
});
