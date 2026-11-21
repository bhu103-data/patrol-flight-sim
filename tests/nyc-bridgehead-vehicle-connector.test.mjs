// Targeted bridge-to-DUMBO regression; no full renderer or flight tests.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function sourceBetween(begin,end){
  const a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,`missing production snippet: ${begin}`);
  return html.slice(a,b);
}
const streets=JSON.parse(sourceBetween('const CITY_STREETS = ','const CENTRAL_PARK_WATERS')
  .split('const CITY_STREETS = ')[1].trim().replace(/;\s*$/,''));
const bridge={x:82,z:-342,halfLength:109,ramp:62,deck:24};
const STREET_Y=14.86,WATER_H=12.2;
const routeSource=sourceBetween('  function makeTrafficRoute(','  function railPose(');
const clipSource=sourceBetween('  function clipAuthoredNycStreet(','  function buildStreetScene(');
const connectorSource=sourceBetween('  function makeBrooklynBridgeheadCarRoute(','  function trafficPose(');
const makeRoute=new Function(routeSource+'return makeTrafficRoute;')();
const connect=new Function('makeTrafficRoute',clipSource+connectorSource+
  'return makeBrooklynBridgeheadCarRoute;')(makeRoute);
const poseSource=sourceBetween('  function trafficPose(','  function prepareCityTraffic(');
const lerp=(a,b,t)=>a+(b-a)*t;
const bridgeRoadHeight=x=>lerp(bridge.deck+.60,STREET_Y,
  Math.max(0,Math.min(1,(Math.abs(x-bridge.x)-bridge.halfLength)/bridge.ramp)));
const pose=new Function('lerp','bridgeRoadHeight','STREET_Y','sampleTerrainHeight','WATER_H','VEGAS_FAST_LANE',
  poseSource+'return trafficPose;')(lerp,bridgeRoadHeight,STREET_Y,()=>20,WATER_H,1.75);
const clear=()=>20,empty=()=>null;
test('uses existing CITY_STREETS bridgehead and dry DUMBO branches',()=>{
  const route=connect(streets,bridge,clear,empty,WATER_H);
  assert.ok(route,'connector should be available for unobstructed bank');
  assert.deepEqual(route.points.slice(0,streets[0].length),streets[0]);
  assert.deepEqual(route.points[streets[0].length],streets[2][1]);
  assert.ok(route.points.length>=streets[0].length+1);
});
test('rejects river and full-road-sidewalk footprint intrusions',()=>{
  assert.equal(connect(streets,bridge,(x)=>x>269?WATER_H:20,empty,WATER_H),null);
  // A wall beside the centreline is still inside the 12.1-wide envelope.
  const wall=(x,z)=>x>258&&x<265&&z>-338&&z<-332?{id:'warehouse'}:null;
  assert.equal(connect(streets,bridge,clear,wall,WATER_H),null);
});
test('uses deck height only on bridge, street height after bridge and reverses',()=>{
  const route=connect(streets,bridge,clear,empty,WATER_H);
  const actor={kind:'taxi',bridgehead:true,bridgeSegmentCount:streets[0].length-1,
    route,pace:1,offset:0};
  const onSpan=pose(actor,route.lengths[1]/2);
  assert.equal(onSpan.onBridge,true);
  assert.ok(onSpan.y>STREET_Y+2,'bridge must stay elevated');
  const onStreet=pose(actor,route.lengths[1]+4);
  assert.equal(onStreet.onBridge,false);
  assert.ok(Math.abs(onStreet.y-(STREET_Y+.07))<1e-8);
  const forward=pose(actor,route.total-3),reverse=pose(actor,route.total+3);
  assert.equal(reverse.onBridge,false);
  assert.ok(Math.abs(Math.hypot(forward.x-reverse.x,forward.z-reverse.z)-2.14)<1e-8,
    'vehicle reverses into the opposite 1.07-unit offset lane');
  assert.ok(Math.abs(Math.cos(forward.yaw-reverse.yaw)+1)<1e-8,
    'heading should reverse for the return journey');
});
test('traffic visibility uses per-pose bridge exemption only',()=>{
  assert.match(html,/!\(actor\.bridgehead&&pose\.onBridge\)/);
  assert.match(html,/if\(selectedMap\.city && !actor\.bridge/);
  assert.match(html,/if\(connector\)for\(let j=0;j<2;j\+\+\)/);
});
