// PATROL airborne-only source-equation bridge for the opt-in 1:1 NYC scene.
// IMPORTANT: This retains source-index.html AIRCRAFT C185 airborne speed /
// yaw / pitch / bank and forward basis rules. It is NOT the original complete
// flight engine: no floats, gear, landing, aircraft mesh, audio or weapons.
// "World metres" are the NYC OTI horizontal tangent-frame units. PATROL's
// numeric cruise speed is game-unit/s and is not an independently calibrated
// real-life C185 airspeed or airworthiness model.
export const PATROL_C185_AIRBORNE=Object.freeze({
  name:'Cessna 185 Floatplane',cruise:19.2,boost:25.5,
  turn:.93,pitchResponse:2.05,maxPitch:.45
});
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const valid3=p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite);
export function makeC185AirborneState(position,yaw=Math.PI){
  if(!valid3(position)||!Number.isFinite(yaw)||position[1]<5)
    throw Error('Invalid source NYC aircraft launch pose');
  return {pos:[...position],yaw,pitch:0,bank:0,speed:PATROL_C185_AIRBORNE.cruise,
    gForce:1,vsi:0,collision:null,steps:0};
}
export function c185SourceAirborneStep(state,control,dt,obstruction=null){
  if(!valid3(state?.pos)||!Number.isFinite(dt)||dt<0||dt>.05)
    throw Error('Invalid airborne physics state or substep dt');
  const c=PATROL_C185_AIRBORNE;
  const turn=clamp(Number(control?.turn)||0,-1,1);
  const pitch=clamp(Number(control?.pitch)||0,-.96,1);
  const boost=Boolean(control?.boost),brake=Boolean(control?.brake);
  const prev=[...state.pos],prevYaw=state.yaw,prevPitch=state.pitch;
  const target=boost?c.boost:brake?16:c.cruise;
  // Same airborne branch equations/coefficients as PATROL index.html's
  // advanceFlight(): not a new arcade acceleration or invented aircraft.
  const speed=lerp(state.speed,target,dt*2.8);
  const yaw=state.yaw+turn*c.turn*dt;
  const nextPitch=lerp(state.pitch,pitch*c.maxPitch,dt*c.pitchResponse);
  const bank=lerp(state.bank,-turn*.92,dt*4.5);
  const cp=Math.cos(nextPitch),fwd=[
    Math.sin(yaw)*cp,Math.sin(nextPitch),Math.cos(yaw)*cp
  ];
  const candidate=prev.map((v,i)=>v+fwd[i]*speed*dt);
  // Same airborne seaplane descent term as index.html. There is no
  // water/ground-mode takeoff or landing in this experimental metric tile.
  candidate[1]-=dt*(boost?.25:1.25);
  if(!valid3(candidate)||!Number.isFinite(speed))
    throw Error('Non-finite PATROL airborne update');
  // Original flight envelope is a swept path, never point-end teleport.
  // Use the real 1:1 official footprint prism at 1m + a 1.2m wing/body
  // margin. Unverified NYC ground elevation => require safe 5m model AGL.
  const distance=Math.hypot(...candidate.map((v,i)=>v-prev[i]));
  const parts=Math.max(1,Math.ceil(distance/1));
  let safe=true,reason=null,at=null;
  for(let i=1;i<=parts;i++){
    const p=prev.map((v,j)=>v+(candidate[j]-v)*i/parts);
    if(p[1]<5){safe=false;reason='Unsurveyed model-ground clearance';at=p;break;}
    if(obstruction?.(p)){safe=false;reason='NYC official building footprint prism';at=p;break;}
  }
  const pos=safe?candidate:prev;
  const finalSpeed=safe?speed:0;
  const vsi=(pos[1]-prev[1])/Math.max(dt,.0001);
  const yawRate=(yaw-prevYaw)/Math.max(dt,.0001);
  const pitchRate=(nextPitch-prevPitch)/Math.max(dt,.0001);
  // Original aircraft HUD g-force formula from advanceFlight.
  const gForce=clamp(1+(pitchRate*finalSpeed)/14+Math.abs(yawRate)*.9,.3,7.5);
  return {pos,yaw,pitch:nextPitch,bank,speed:finalSpeed,vsi,gForce,
    collision:!safe?{reason,attempted:at}:null,
    steps:(state.steps||0)+1};
}
export function c185MetricCollision(massing,buildingContains,radius=1.2){
  if(!Array.isArray(massing?.buildings)||typeof buildingContains!=='function')
    throw Error('Source OTI footprints are required for metric C185 collision');
  const offsets=[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]];
  return pos=>offsets.some(([de,dn])=>
    buildingContains(massing,pos[0]+de,pos[2]*-1+dn,pos[1])!==null);
}
// Note: c185MetricCollision's input must be source-local easting/northing,
// NOT scene-centered [-Z north] camera coordinates. Use
// c185SceneCollision below with geometry.center for scene <-> source.
export function c185SceneCollision(massing,center,buildingContains,radius=1.2){
  if(!Number.isFinite(center?.east)||!Number.isFinite(center?.north)||
      typeof buildingContains!=='function')
    throw Error('Missing exact NYC world frame for C185 collision');
  const offsets=[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]];
  return p=>offsets.some(([e,n])=>
    buildingContains(massing,p[0]+center.east+e,
      center.north-p[2]+n,p[1])!==null);
}
