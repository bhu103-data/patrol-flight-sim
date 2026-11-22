// Validate the *production* NYC expressway route, not a mock replacement.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('  const CITY_EXPRESSWAY={');
const otherMap=html.indexOf('  const VEGAS_EXPRESSWAY={',start);
const routeStart=html.indexOf('  function expresswayRoute(design,points=design.points){',otherMap);
const routeEnd=html.indexOf('  function renderExpressway(design,',routeStart);
assert.ok(start>=0&&otherMap>start&&routeStart>otherMap&&routeEnd>routeStart);
const production=html.slice(start,otherMap)+html.slice(routeStart,routeEnd);
const {city,route}=new Function('STREET_Y','sampleTerrainHeight','lerp',production+
  'return {city:CITY_EXPRESSWAY,route:expresswayRoute};')(
  14.86,()=>14.86,(a,b,t)=>a+(b-a)*t);

const bridge=Object.freeze({x:82,z:-342,halfLength:109,ramp:62,halfWidth:4.2});
const signal=Object.freeze({x:bridge.x+bridge.halfLength+bridge.ramp,
  z:bridge.z-(bridge.halfWidth+.36)+1.05});
const nearCamera=Object.freeze({x:247.5,z:-347.4});
const samples=route(city,city.ramp);
const planar=(a,b)=>Math.hypot(a[0]-b.x,a[1]-b.z);

test('BQE exit branches from an existing road node and remains game-scale',()=>{
  assert.deepEqual(city.ramp[0],city.points[2],
    'exit must connect to an actual main expressway anchor');
  assert.ok(city.ramp.length>=5&&samples.length>city.ramp.length);
  for(const p of samples)assert.ok(p.every(Number.isFinite));
  for(let i=1;i<city.ramp.length;i++){
    const a=city.ramp[i-1],b=city.ramp[i];
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
    assert.ok(distance>=4,'avoid degenerate elevated road faces');
    assert.ok(Math.abs(b[2]-a[2])/distance<0.25,
      'exit grade must remain driveable for existing ramp vehicles');
    assert.ok(b[2]>=0,'do not push exit below the city street height');
  }
  assert.match(html,/expresswayRoute\(design,design\.ramp\)/,
    'existing traffic must still use the ramp rather than being removed');
});

test('full ramp path cannot occlude Brooklyn Bridge east-side signal or lane',()=>{
  let minimumSignal=Infinity,minimumCamera=Infinity;
  const margin=bridge.halfWidth+2.5+2.0;
  for(const p of samples){
    minimumSignal=Math.min(minimumSignal,planar(p,signal));
    minimumCamera=Math.min(minimumCamera,planar(p,nearCamera));
    if(p[0]>=230&&p[0]<=290)assert.ok(
      Math.abs(p[1]-bridge.z)>margin,
      '5-unit-wide BQE ramp clips the live bridge/road lane at '+p);
    assert.ok(!(p[0]>=272&&Math.abs(p[1]+389)<8),
      'ramp must not pierce the existing harbor runway footprint');
  }
  assert.ok(minimumSignal>17,
    'new elevated exit still casts a road deck over the traffic light');
  assert.ok(minimumCamera>18,
    'near-pole QA camera must no longer sit inside elevated exit');
});

test('NYC-only geometry and collision sources remain unchanged',()=>{
  assert.match(html,/renderExpressway\(CITY_EXPRESSWAY,/);
  assert.match(html,/renderExpressway\(VEGAS_EXPRESSWAY,/);
  assert.match(html,/function bridgeRoadHeight\(x\)/);
  assert.match(html,/function isBridgeCollision\(x,y,z,radius=0\)/);
  assert.match(html,/signalized:true,signalQueueSlot:j/);
});
