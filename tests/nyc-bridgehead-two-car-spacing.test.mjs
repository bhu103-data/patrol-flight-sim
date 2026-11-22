// Guard against long-session overlap of the two real bridge-to-DUMBO actors.
// Uses the production route, signal and pose functions from index.html; the
// segment-clearance stub is valid only for this already-accepted five-point
// NYC connector and is not a replacement for browser road/parcel QA.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const streetMatch=html.match(/const CITY_STREETS = (\[[\s\S]*?\]);\s*const CENTRAL_PARK_WATERS/);
assert.ok(streetMatch,'Real authored NYC street definitions not found');
const streets=new Function('return ('+streetMatch[1]+');')();

function sliceFunctions(startMarker,endMarker){
  const start=html.indexOf(startMarker);
  const end=html.indexOf(endMarker,start);
  assert.ok(start>=0&&end>start,'Source span not found: '+startMarker);
  return html.slice(start,end);
}

const routeSource=sliceFunctions('  function makeTrafficRoute(points) {',
  '  function railPose(actor,distance) {');
const bridgeSource=sliceFunctions('  function makeBrooklynBridgeheadCarRoute(',
  '  function bridgeheadSignalPhase(time){');
const motionSource=sliceFunctions('  function bridgeheadSignalPhase(time){',
  '  function trafficPose(actor,time) {');
const engine=new Function('CITY_STREETS',
  'const STREET_Y=14.86;'+
  'const bridgeRoadHeight=()=>STREET_Y;'+
  'const clipAuthoredNycStreet=(a,b)=>[[a,b]];'+
  routeSource+bridgeSource+motionSource+
  'return {route:makeBrooklynBridgeheadCarRoute(CITY_STREETS,'+
  '{x:82,halfLength:109,ramp:62},()=>14.86,()=>null,12.2),'+
  'pose:bridgeheadTrafficPose};')(streets);

assert.ok(engine.route&&engine.route.points.length===5,
  'Expected existing live bridge/DUMBO connector geometry');
assert.ok(Math.abs(engine.route.total-408.0366853740041)<.0001,
  'Real connector route differs from 44985238284 WebGL runtime fixture');
assert.match(html,
  /route:connector,offset:connector\.total\*\(\.18-j\*\.02\),\s*pace:5\.0,livery:j/,
  'Production car offsets/speeds must match the pair-spacing acceptance test');

// Conservative flat-ground swept-center check for the existing sculpted
// taxi/sedan meshes (approx. 3.95 long x 2.07 wide, including mirrors).
// Rotated enclosing rectangles are deliberately slightly larger; this is
// not a simulation of chassis suspension or damage physics.
function bodyRectanglesOverlap(a,b){
  const af=[Math.sin(a.yaw),Math.cos(a.yaw)],
    ar=[Math.cos(a.yaw),-Math.sin(a.yaw)],
    bf=[Math.sin(b.yaw),Math.cos(b.yaw)],
    br=[Math.cos(b.yaw),-Math.sin(b.yaw)];
  const dot=(u,v)=>u[0]*v[0]+u[1]*v[1];
  const delta=[b.x-a.x,b.z-a.z];
  for(const axis of [af,ar,bf,br]){
    const extent=2.05*(Math.abs(dot(axis,af))+Math.abs(dot(axis,bf)))+
      1.05*(Math.abs(dot(axis,ar))+Math.abs(dot(axis,br)));
    if(Math.abs(dot(axis,delta))>=extent)return false;
  }
  return true;
}

test('NYC two bridge connector cars keep a safe same-direction gap over 1 hour',()=>{
  const route=engine.route;
  const common={bridgehead:true,signalized:true,bridgeSegmentCount:streets[0].length-1,
    route,laneOffset:1.07,pace:5.0};
  const taxi={...common,kind:'taxi',signalQueueSlot:0,offset:route.total*.18};
  const sedan={...common,kind:'sedan',signalQueueSlot:1,offset:route.total*.16};
  let minSame=Infinity,minOpposite=Infinity,sameSamples=0,oppositeSamples=0;
  // This is deliberate long-horizon coverage: the original unequal-speed
  // actors overlap after about 1941s, outside the usual one-loop QA.
  for(let tick=0;tick<=3600*4;tick++){
    const time=tick/4,A=engine.pose(taxi,time),B=engine.pose(sedan,time);
    const separation=Math.hypot(A.x-B.x,A.z-B.z);
    assert.ok(Number.isFinite(separation)&&[A.yaw,B.yaw].every(Number.isFinite),
      'Nonfinite bridgehead vehicle pose at '+time);
    const headingDot=Math.cos(A.yaw-B.yaw);
    assert.equal(bodyRectanglesOverlap(A,B),false,
      'Oriented vehicle bodies overlap in bridgehead runtime at '+time+
      ', taxi='+JSON.stringify(A)+', sedan='+JSON.stringify(B));
    if(headingDot>.9){
      sameSamples++;
      minSame=Math.min(minSame,separation);
      assert.ok(separation>=4.7,
        'Unsafe same-direction taxi/sedan spacing at '+time+': '+separation);
    }else if(headingDot<-.9){
      oppositeSamples++;
      minOpposite=Math.min(minOpposite,separation);
      // Opposing cars occupy separate signed 1.07-unit lanes. A 2.0-unit
      // center margin is the existing lane model, not a swept-hull proof.
      assert.ok(separation>=2.0,
        'Opposite-lane centers overlap at '+time+': '+separation);
    }
  }
  assert.ok(sameSamples>100&&oppositeSamples>50);
  assert.ok(minSame<8&&minOpposite<3,
    'Spacing probe did not exercise close traffic in both directions');
});
