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
const turnSource=sourceBetween('  function bridgeheadSignalPhase(','  function trafficPose(');
const poseSource=turnSource+sourceBetween('  function trafficPose(','  function prepareCityTraffic(');
const lerp=(a,b,t)=>a+(b-a)*t;
const bridgeRoadHeight=x=>lerp(bridge.deck+.60,STREET_Y,
  Math.max(0,Math.min(1,(Math.abs(x-bridge.x)-bridge.halfLength)/bridge.ramp)));
const pose=new Function('lerp','bridgeRoadHeight','STREET_Y','sampleTerrainHeight','WATER_H','VEGAS_FAST_LANE',
  poseSource+'return trafficPose;')(lerp,bridgeRoadHeight,STREET_Y,()=>20,WATER_H,1.75);
const clear=()=>20,empty=()=>null;
test('uses existing CITY_STREETS bridgehead and dry DUMBO branches',()=>{
  const route=connect(streets,bridge,clear,empty,WATER_H);
  assert.ok(route,'connector should be available for unobstructed bank');
  assert.equal(route.points[0][1],streets[0][0][1]);
  assert.ok(route.points[0][0]>streets[0][0][0], 'turnaround is inset on deck');
  assert.deepEqual(route.points[1],streets[0][1]);
  assert.deepEqual(route.points[streets[0].length],streets[2][1]);
  assert.ok(route.points.at(-1)[0]<streets[2][3][0], 'end turn is inset from road end');
  assert.ok(route.points.length>=streets[0].length+1);
});
test('rejects river and full-road-sidewalk footprint intrusions',()=>{
  assert.equal(connect(streets,bridge,(x)=>x>269?WATER_H:20,empty,WATER_H),null);
  // A wall beside the centreline is still inside the 12.1-wide envelope.
  const wall=(x,z)=>x>258&&x<265&&z>-338&&z<-332?{id:'warehouse'}:null;
  assert.equal(connect(streets,bridge,clear,wall,WATER_H),null);
});
test('declines connector if turnaround swept vehicle envelope is occupied',()=>{
  const exposed=connect(streets,bridge,clear,empty,WATER_H);
  const terminal=exposed.points.at(-1);
  const obstacle=(x,z)=>Math.hypot(x-(terminal[0]+3.52),z-terminal[1])<.25?{id:'corner'}:null;
  const routed=connect(streets,bridge,clear,obstacle,WATER_H);
  // Safe early retreat is preferable to forcing the vehicle through a wall.
  if(routed){
    assert.ok(routed.total<exposed.total,'blocked terminal must retreat');
    assert.ok(Math.hypot(routed.points.at(-1)[0]-(terminal[0]+3.52),
      routed.points.at(-1)[1]-terminal[1])>3.52);
  }
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
  const rad=1.07,arc=Math.PI*rad,period=2*(route.total+arc);
  const headingDelta=(p,q)=>Math.abs(Math.atan2(Math.sin(p.yaw-q.yaw),Math.cos(p.yaw-q.yaw)));
  for(const boundary of [route.total,route.total+arc,2*route.total+arc,period]){
    const prev=pose(actor,boundary-0.0001),next=pose(actor,boundary+0.0001);
    assert.ok(Math.hypot(prev.x-next.x,prev.z-next.z)<0.005,
      'turn boundary must not teleport the car');
    assert.ok(headingDelta(prev,next)<0.005,
      'turn boundary must not snap heading');
    assert.ok(Math.abs(prev.y-next.y)<0.005,'height must stay continuous');
  }
  for(let d=route.lengths[1]-5;d<=route.lengths[1]+5;d+=.2){
    const a=pose(actor,d),b=pose(actor,d+.01);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.025,
      'corner lane offset must remain continuous');
    assert.ok(headingDelta(a,b)<.05,'bridgehead corner yaw must be blended');
  }
  const endTurn=pose(actor,route.total+arc/2);
  assert.equal(endTurn.turning,true);
  assert.equal(endTurn.onBridge,false);
  const startTurn=pose(actor,2*route.total+arc+arc/2);
  assert.equal(startTurn.turning,true);
  assert.equal(startTurn.onBridge,true);
});
test('traffic visibility uses per-pose bridge exemption only',()=>{
  assert.match(html,/!\(actor\.bridgehead&&pose\.onBridge\)/);
  assert.match(html,/if\(selectedMap\.city && !actor\.bridge/);
  assert.match(html,/if\(connector\)for\(let j=0;j<2;j\+\+\)/);
});

test('two live bridgehead car envelopes remain disjoint across 9000 seconds',()=>{
  const route=connect(streets,bridge,clear,empty,WATER_H);
  assert.ok(route,'full bridge-to-DUMBO connector missing');
  const cars=[0,1].map(j=>({
    kind:j?'sedan':'taxi',bridgehead:true,signalized:true,
    signalQueueSlot:j,bridgeSegmentCount:streets[0].length-1,
    route,offset:route.total*.18-(j?12:0),pace:5+j*.6
  }));
  cars[1].bridgeheadLeader=cars[0];
  // Production meshes: x-mirror extreme ~0.9955, nose and bumper
  // ~2.0 from center. Use small conservative 1.0 / 2.05 half-extents.
  const axes=p=>[[Math.cos(p.yaw),-Math.sin(p.yaw)],
    [Math.sin(p.yaw),Math.cos(p.yaw)]];
  function orientedClearance(a,b){
    const aAxes=axes(a),bAxes=axes(b),delta=[a.x-b.x,a.z-b.z];
    let maxGap=-Infinity;
    for(const axis of [...aAxes,...bAxes]){
      const extent=axes=>1.0*Math.abs(axis[0]*axes[0][0]+axis[1]*axes[0][1])+
        2.05*Math.abs(axis[0]*axes[1][0]+axis[1]*axes[1][1]);
      const gap=Math.abs(delta[0]*axis[0]+delta[1]*axis[1])-
        extent(aAxes)-extent(bAxes);
      maxGap=Math.max(maxGap,gap);
    }
    return maxGap;
  }
  let min=Infinity,checks=0,nearPasses=0;
  for(let k=0;k<=45000;k++){
    const t=k*.2,a=pose(cars[0],t),b=pose(cars[1],t);
    assert.ok([a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite));
    // Bridge deck versus dry street are different height surfaces.
    if(Math.abs(a.y-b.y)>1.5)continue;
    const gap=orientedClearance(a,b);
    min=Math.min(gap,min);checks++;
    if(gap<.5)nearPasses++;
    assert.ok(gap>=.08,
      'bridgehead car meshes overlap or lack margin at '+t+
      ' (clearance='+gap+', min='+min+')');
  }
  assert.ok(checks>1000&&nearPasses>5,
    'must cover actual close encounters, not vacuously pass');
  assert.ok(min>=.08,'unsafe minimum oriented separation: '+min);
});
