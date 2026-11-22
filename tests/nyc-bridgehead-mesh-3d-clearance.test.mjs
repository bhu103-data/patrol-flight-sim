// Evidence-backed 3D broadphase for the two real NYC bridgehead cars.
// Uses vertices emitted by the REAL buildStreetVehicle/addModelBox functions,
// not manually guessed generic car sizes. This proves disjoint upright
// bounding boxes at sampled times, NOT continuous triangle-mesh collision.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function snippet(start,end){
  const i=html.indexOf(start),j=html.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,'Missing production source: '+start);
  return html.slice(i,j);
}
const triangleBuffer=()=>{
  const v=[];
  return {
    addTri(a,b,c){v.push(...a,...b,...c);},
    addQuad(a,b,c,d){v.push(...a,...b,...c,...a,...c,...d);},
    upload(){return {vertices:v};}
  };
};
const buildVehicle=new Function('createTriangleMesh','addVegasLettering',
  snippet('  function addModelBox(','  const SHIP_TYPES = ')+
  snippet('  function buildStreetVehicle(','  const streetMeshes=')+
  'return buildStreetVehicle;')(triangleBuffer,
  ()=>{throw Error('Unexpected decorative lettering on bridgehead car');});
function modelBounds(kind){
  const points=buildVehicle(kind).vertices;
  assert.equal(points.length%9,0);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<points.length;i+=3)for(let k=0;k<3;k++){
    min[k]=Math.min(min[k],points[i+k]);
    max[k]=Math.max(max[k],points[i+k]);
  }
  return {
    kind,triangles:points.length/9,min,max,
    center:min.map((x,i)=>(x+max[i])/2),
    half:min.map((x,i)=>(max[i]-x)/2)
  };
}
const taxiBounds=modelBounds('taxi'),sedanBounds=modelBounds('sedan');
assert.ok(taxiBounds.triangles>900&&sedanBounds.triangles>900,
  'Expected actual sculpted car meshes, not test cuboids');
for(const m of [taxiBounds,sedanBounds]){
  assert.ok(Math.abs(m.min[0]+1.005)<1e-6 &&
    Math.abs(m.max[0]-1.005)<1e-6);
  assert.ok(Math.abs(m.min[2]+2)<1e-6&&Math.abs(m.max[2]-2.012)<1e-6);
}
const makeRoute=new Function(snippet('  function makeTrafficRoute(',
  '  function railPose(')+'return makeTrafficRoute;')();
const streets=JSON.parse(snippet('const CITY_STREETS = ',
  'const CENTRAL_PARK_WATERS').split('const CITY_STREETS = ')[1]
  .trim().replace(/;\s*$/,''));
const connector=new Function('makeTrafficRoute',
  snippet('  function clipAuthoredNycStreet(','  function buildStreetScene(')+
  snippet('  function makeBrooklynBridgeheadCarRoute(',
  '  function bridgeheadSignalPhase(')+
  'return makeBrooklynBridgeheadCarRoute;')(makeRoute);
const route=connector(streets,{x:82,z:-342,halfLength:109,ramp:62,deck:24},
  ()=>20,()=>null,12.2);
assert.ok(route&&Math.abs(route.total-408.0366853740041)<.0001,
  'Must use the actual five-point NYC bridge-to-DUMBO road');
const lerp=(a,b,t)=>a+(b-a)*t;
const bridgeRoadHeight=x=>lerp(24.6,14.86,Math.max(0,
  Math.min(1,(Math.abs(x-82)-109)/62)));
const pose=new Function('lerp','bridgeRoadHeight','STREET_Y',
  'sampleTerrainHeight','WATER_H','VEGAS_FAST_LANE',
  snippet('  function bridgeheadSignalPhase(','  function prepareCityTraffic(')+
  'return trafficPose;')(lerp,bridgeRoadHeight,14.86,()=>20,12.2,1.75);
assert.match(html,/bridgeheadLeader:j\?cityTraffic\.find/);
assert.match(html,/route:connector,offset:connector\.total\*\.18-\(j\?12:0\)/);
const cars=[0,1].map(j=>({
  kind:j?'sedan':'taxi',bridgehead:true,signalized:true,signalQueueSlot:j,
  bridgeSegmentCount:streets[0].length-1,route,
  offset:route.total*.18-(j?12:0),pace:5+j*.6
}));
cars[1].bridgeheadLeader=cars[0];

// The renderer uses mat4FromBasis(pose, [cos(yaw),0,-sin(yaw)],
// worldUp, [sin(yaw),0,cos(yaw)], scale=1). Both meshes stay upright.
// For their 3D OBBs, the only SAT axes are the two XZ right/forward pairs
// and the shared world Y axis. All eight model extrema are captured above.
function clearance3D(p,q,ma=taxiBounds,mb=sedanBounds){
  const c=[Math.cos(p.yaw),Math.cos(q.yaw)],
    s=[Math.sin(p.yaw),Math.sin(q.yaw)];
  const ca=ma.center,cb=mb.center,ra=ma.half,rb=mb.half;
  const ax=p.x+c[0]*ca[0]+s[0]*ca[2],
    az=p.z-s[0]*ca[0]+c[0]*ca[2],
    ay=p.y+ca[1];
  const bx=q.x+c[1]*cb[0]+s[1]*cb[2],
    bz=q.z-s[1]*cb[0]+c[1]*cb[2],
    by=q.y+cb[1];
  const dx=ax-bx,dz=az-bz;
  let separatingGap=Math.abs(ay-by)-ra[1]-rb[1];
  for(const [u,v] of [
    [c[0],-s[0]],[s[0],c[0]],[c[1],-s[1]],[s[1],c[1]]
  ]){
    const ext=ra[0]*Math.abs(u*c[0]-v*s[0])+
      ra[2]*Math.abs(u*s[0]+v*c[0])+
      rb[0]*Math.abs(u*c[1]-v*s[1])+
      rb[2]*Math.abs(u*s[1]+v*c[1]);
    separatingGap=Math.max(separatingGap,Math.abs(dx*u+dz*v)-ext);
  }
  return separatingGap;
}

test('mesh-derived 3D hull handles coincident and vertically separated cars',()=>{
  const p=pose(cars[0],0);
  assert.ok(clearance3D(p,p)<0,'Coincident vehicles must overlap');
  const above={...p,y:p.y+4};
  assert.ok(clearance3D(p,above)>0,
    'Vertical separation must clear correctly in 3D');
  assert.ok(taxiBounds.max[1]>sedanBounds.max[1],
    'Actual taxi roof sign should be included in vehicle height');
});

test('full NYC real-mesh 3D hull sweep stays disjoint through 9000 seconds',()=>{
  let min=Infinity,at=null,bad=0,refined=0,near=0;
  for(let k=0;k<=90000;k++){
    const t=k*.1,d=clearance3D(pose(cars[0],t),pose(cars[1],t));
    assert.ok(Number.isFinite(d));
    if(d<min){min=d;at=t;}
    if(d<.5)near++;
    if(d<0)bad++;
    // Refine each near pass to 0.005s (20x denser than the 0.1s
    // coarse sweep). Samples can still miss a contact between instants.
    if(d<.9 && k>0)for(let j=1;j<20;j++){
      const rt=t-.1+j*.005;
      const r=clearance3D(pose(cars[0],rt),pose(cars[1],rt));
      if(r<min){min=r;at=rt;}
      if(r<0)bad++;
      refined++;
    }
  }
  assert.ok(near>50&&refined>2000,'No real near-collision exercise');
  assert.equal(bad,0,'3D model-derived vehicle envelopes overlap');
  assert.ok(min>=.08,'Insufficient true-mesh-bounds OBB margin: '+min);
  console.log('NYC_MESH_3D_QA '+JSON.stringify({
    sampled:90001,refined,near,bad,min,at,
    models:[taxiBounds,sedanBounds]
  }));
});

test('negative control: original faster sedan really overlapped by 1943s',()=>{
  const oldTaxi={...cars[0],offset:route.total*.18};
  const oldSedan={...cars[1],offset:route.total*.64,
    bridgeheadLeader:null};
  let smallest=Infinity;
  for(let i=19300;i<=19500;i++){
    const t=i*.1;
    smallest=Math.min(smallest,clearance3D(
      pose(oldTaxi,t),pose(oldSedan,t)));
  }
  assert.ok(smallest<-.1,
    'Control must reject the original delayed car-overlap regression');
});

/**
 * Conservative continuous-time exclusion for the current, specifically
 * guarded pair of cars (not all NYC road actors).
 *
 * At t0, SAT supplies a world-space separating direction. For that FIXED
 * direction, moving either containing 3D car box changes its projected
 * extremity no faster than a bound on its world-space vertex velocity.
 * Thus gap(t0) - (vTaxi+vSedan)*dt > safetyMargin proves the boxes remain
 * separated throughout [t0,t0+dt], not just at the sampled endpoints.
 *
 * Velocity budget: route-distance derivative <=5.6; horizontal lane
 * offset 1.07; blend radius 4 with <1.2 rad adjacent bends; U-turn yaw
 * derivative 1/1.07 per distance; bridge ramp slope <0.16; widest
 * vertex radial reach <2.25. These yield a conservative <25 game units/s
 * maximum world vertex velocity; use 40 per car to retain headroom.
 * Any source/route changes invalidating these guards require re-audit.
 *
 * This certifies disjoint upright containing OBBs under those derivative
 * bounds; it does NOT trace triangle-triangle contacts, handle other
 * vehicles, or prove unrelated physics/collision routines.
 */
test('certify EVERY intersample interval over 9000s using guarded vertex-speed bounds',()=>{
  assert.match(html,/blend=4;/,
    'corner tangent interpolation changed: re-audit vertex velocity bound');
  assert.match(html,/const turnLength=Math.PI\*rad,period=/,
    'U-turn parametrization changed: re-audit angular velocity');
  assert.ok(cars.every(c=>c.pace>0&&c.pace<=5.6));
  assert.ok(cars.every(c=>(c.laneOffset??1.07)>=1.07));
  const segments=route.points.slice(1).map((p,i)=>{
    const last=route.points[i],d=[p[0]-last[0],p[1]-last[1]];
    const length=Math.hypot(...d);
    return {length,unit:d.map(v=>v/length)};
  });
  let maxBend=0;
  for(let k=1;k<segments.length;k++){
    const a=segments[k-1].unit,b=segments[k].unit;
    const angle=Math.acos(Math.max(-1,Math.min(1,
      a[0]*b[0]+a[1]*b[1])));
    maxBend=Math.max(maxBend,angle);
  }
  assert.ok(segments.every(s=>s.length>8)&&maxBend<1.2,
    'Authored road curvature or blend zones changed: invalidate swept bound');
  const radial=Math.max(...[taxiBounds,sedanBounds].map(m=>
    Math.hypot(m.half[0]+Math.abs(m.center[0]),
      m.half[2]+Math.abs(m.center[2]))));
  assert.ok(radial<2.3,'Unexpected new body/roof geometry, re-audit bound');
  // 40 units/s per car is deliberately >2x this route's derived ~20-25
  // world-space extremal vertex velocity (translation plus rotation).
  const maxRelativeVertexSpeed=80,requiredClearance=.08;
  const at=t=>clearance3D(pose(cars[0],t),pose(cars[1],t));
  let certified=0,subdivisions=0,maxDepth=0,minObserved=Infinity,
    lowestGuaranteed=Infinity,firstIssue=null;
  function certify(t0,t1,atStart,depth){
    minObserved=Math.min(minObserved,atStart);
    if(!Number.isFinite(atStart))
      assert.fail('Non-finite 3D projection at '+t0);
    const guaranteed=atStart-maxRelativeVertexSpeed*(t1-t0);
    if(guaranteed>requiredClearance){
      certified++;lowestGuaranteed=Math.min(lowestGuaranteed,guaranteed);
      maxDepth=Math.max(maxDepth,depth);
      return;
    }
    if(depth>=17){
      firstIssue={t0,t1,atStart,guaranteed};
      assert.fail('Unable to certify continuous 3D hull separation: '+
        JSON.stringify(firstIssue));
    }
    subdivisions++;
    const mid=(t0+t1)/2,atMid=at(mid);
    certify(t0,mid,atStart,depth+1);
    certify(mid,t1,atMid,depth+1);
  }
  let start=at(0);
  for(let k=0;k<90000;k++){
    const t0=k*.1,t1=(k+1)*.1;
    certify(t0,t1,start,0);
    start=at(t1);
  }
  assert.ok(certified>=90000&&subdivisions>3000,
    'Intersample check must exercise close approaches, not vacuously pass');
  assert.ok(maxDepth>=7&&maxDepth<17);
  assert.ok(minObserved>.12&&lowestGuaranteed>.08);
  console.log('NYC_3D_INTERVAL_CERT '+JSON.stringify({
    horizonSeconds:9000,baseIntervals:90000,certified,subdivisions,
    maxDepth,maxBend,radial,maxRelativeVertexSpeed,
    minObserved,lowestGuaranteed,firstIssue
  }));
});
