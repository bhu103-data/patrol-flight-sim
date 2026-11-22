/* PATROL Manhattan Bridge rail pilot: original hand-authored geometry, no vendor asset copied.
 * NYC uses compressed game-space coordinates. Not a surveyed Manhattan Bridge mesh.
 * Source routing: MTA B/D (north tracks), N/Q (south tracks); Brooklyn Bridge has no active subway.
 * Geometry is emitted ONCE to the native WebGL2 street batch; trains reuse streetMeshes.train.
 */
(function(root){
'use strict';
const SPEC=Object.freeze({
  name:'Manhattan Bridge — four subway tracks', west:-30, east:201,
  cx:85, z:-285, slope:-0.105, deck:26.0, water:12.2,
  trackOffsets:Object.freeze([-9.5,-6.3,6.3,9.5]), serviceWalkInner:11.15,
  // A train is exposed up to 6 units beyond the nominal deck; its carbody
  // has 6.41 units of half-length. Keep a conservative 13-unit track apron.
  carHalfLength:6.42, visibleMargin:6, approachLength:13,
  towerXs:Object.freeze([31,150]), pace:7.4, carPitch:13.35
});
// Derived from Ethical Tech CoLab's source-governed control skeleton (CC BY 4.0).
// The dimensions are prototype metres; PATROL compresses them into game space.
// Attribution: https://github.com/Ethical-Tech-CoLab/manhattan-bridge-3d
// Source: viewer/metadata/build_report.json, CTL-005 / 008 / 020 / 022 etc.
const CONTROL=Object.freeze({
  lowerDeckAboveMhw:42.18432, upperDeckAboveMhw:49.3776,
  saddleAboveMhw:98.298, cableMidAboveMhw:49.3776,
  anchorageCableAboveMhw:41.148, mainSpan:448.056,
  suspendedSpan:890.016
});
const vScale=(SPEC.deck-SPEC.water)/CONTROL.lowerDeckAboveMhw;
const sourceY=metres=>SPEC.water+metres*vScale;
// Preserve 3.13-unit NYC train's existing roof clearance despite compact world.
const UPPER_ROAD_Y=Math.max(sourceY(CONTROL.upperDeckAboveMhw),SPEC.deck+4.25);
const TOWER_SADDLE_Y=sourceY(CONTROL.saddleAboveMhw);
const CABLE_MID_Y=Math.max(sourceY(CONTROL.cableMidAboveMhw),UPPER_ROAD_Y+0.24);
const CABLE_ANCHOR_Y=sourceY(CONTROL.anchorageCableAboveMhw);
const RUNS=Object.freeze([
  Object.freeze({service:'D',side:6.3,direction:1,phase:16.0}),
  Object.freeze({service:'Q',side:-6.3,direction:-1,phase:103.0})
]);
const point=(x,side=0,y=SPEC.deck)=>[x,y,SPEC.z+(x-SPEC.cx)*SPEC.slope+side];
const at=(x,side=0)=>point(x,side)[2];
const activeLength=SPEC.east-SPEC.west;
function trainPose(time,run,car){
  if(!RUNS.includes(run)||!Number.isFinite(time)||!Number.isInteger(car)||car<0||car>3)
    throw Error('Invalid Manhattan Bridge train request');
  // The extra 72 units on both sides are the off-scene tunnel turnaround interval.
  const travel=activeLength+144;
  const progress=((time*SPEC.pace+run.phase)%travel+travel)%travel;
  const x=run.direction===1?SPEC.west-72+progress-car*SPEC.carPitch:
    SPEC.east+72-progress+car*SPEC.carPitch;
  return Object.freeze({
    x,y:SPEC.deck+0.22,z:at(x,run.side),
    yaw:Math.atan2(run.direction,run.direction*SPEC.slope),
    visible:x>=SPEC.west-SPEC.visibleMargin&&x<=SPEC.east+SPEC.visibleMargin
  });
}
function build({box,addQuad,beam}){
  if(typeof box!=='function'||typeof addQuad!=='function'||typeof beam!=='function')
    throw Error('Manhattan Bridge requires the existing WebGL geometry callbacks');
  const structural=[.19,.32,.43],rivets=[.22,.29,.33],
    walkway=[.52,.54,.51],deckColor=[.23,.28,.31],
    trackBed=[.25,.29,.33],rail=[.56,.60,.62],
    sleeper=[.38,.39,.37],anchor=[.54,.51,.47],
    light=[.86,.75,.52];
  let beams=0,boxes=0,quads=0;
  const B=(a,b,w,color)=>{beam(a,b,w,color);beams++};
  const X=(x,y,z,w,h,d,color)=>{box(x,y,z,w,h,d,color);boxes++};
  // All Q calls are horizontal road/track slabs. The original construction
  // wound the +Z-side roadway downward, producing inverted face normals.
  // Native mesh shading uses those normals even with back-face culling disabled.
  const Q=(a,b,c,d,color)=>{
    const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    if(!Number.isFinite(ny)||Math.abs(ny)<1e-9)
      throw Error('Degenerate Manhattan Bridge road or rail quad');
    if(ny>0)addQuad(a,b,c,d,color);
    else addQuad(d,c,b,a,color);
    quads++;
  };
  // All these strips are exactly planar in the compressed bridge coordinate
  // system. Emit one long quad per track/road lane instead of re-tessellating
  // each 3.5-unit panel: same visible contour, fewer fragments and normals.
  const serviceWalk=[.41,.42,.37],safetyYellow=[.85,.67,.17];
  for(const side of [-1,1]){
    const inner=side*4.15,outer=side*11.75;
    Q(point(SPEC.west,inner,SPEC.deck-.29),
      point(SPEC.east,inner,SPEC.deck-.29),
      point(SPEC.east,outer,SPEC.deck-.29),
      point(SPEC.west,outer,SPEC.deck-.29),trackBed);
    const upperInner=Math.min(side*4.05,side*11.65);
    const upperOuter=Math.max(side*4.05,side*11.65);
    Q(point(SPEC.west,upperInner,UPPER_ROAD_Y),
      point(SPEC.east,upperInner,UPPER_ROAD_Y),
      point(SPEC.east,upperOuter,UPPER_ROAD_Y),
      point(SPEC.west,upperOuter,UPPER_ROAD_Y),deckColor);
    // First-person railway photographs show a narrow maintenance walkway
    // and yellow rails outside the two outboard track pairs.
    const walkwayNear=side*SPEC.serviceWalkInner,walkwayFar=side*11.68;
    Q(point(SPEC.west,walkwayNear,SPEC.deck+.105),
      point(SPEC.east,walkwayNear,SPEC.deck+.105),
      point(SPEC.east,walkwayFar,SPEC.deck+.105),
      point(SPEC.west,walkwayFar,SPEC.deck+.105),serviceWalk);
    for(const h of [.62,1.32])
      B(point(SPEC.west,side*11.93,SPEC.deck+h),
        point(SPEC.east,side*11.93,SPEC.deck+h),.075,safetyYellow);
    for(let x=SPEC.west+2.5;x<SPEC.east-1;x+=12.0)
      B(point(x,side*11.93,SPEC.deck+.16),
        point(x,side*11.93,SPEC.deck+1.37),.072,safetyYellow);
  }
  Q(point(SPEC.west,-3.75,SPEC.deck+.04),
    point(SPEC.east,-3.75,SPEC.deck+.04),
    point(SPEC.east,3.75,SPEC.deck+.04),
    point(SPEC.west,3.75,SPEC.deck+.04),deckColor);
  // Six continuous straight girders replace hundreds of collinear pieces.
  // The actual cross-girders and truss web panels remain independent below.
  for(const side of [-1,1]){
    for(const [offset,level,gauge] of [
      [12.0,SPEC.deck-.10,.31],
      [3.9,SPEC.deck-.23,.24],
      [12.0,UPPER_ROAD_Y-.21,.32]
    ])B(point(SPEC.west,side*offset,level),
      point(SPEC.east,side*offset,level),gauge,structural);
  }
  // Do not make the train vanish halfway off a raw end of track. The game
  // still has no surveyed subway portals, so use only short rail aprons at
  // the Manhattan and Brooklyn bridgeheads, never fictional tunnel geometry.
  const apronEnds=[[SPEC.west-SPEC.approachLength,SPEC.west],
    [SPEC.east,SPEC.east+SPEC.approachLength]];
  for(const side of [-1,1]){
    const near=side*4.15,far=side*11.75;
    for(const [a,b] of apronEnds){
      Q(point(a,near,SPEC.deck-.29),point(b,near,SPEC.deck-.29),
        point(b,far,SPEC.deck-.29),point(a,far,SPEC.deck-.29),trackBed);
      // Short under-deck girders and limited cross braces give the rail apron
      // a visible load path without guessing the land foundation height.
      for(const offset of [side*4.08,side*11.90])
        B(point(a,offset,SPEC.deck-.43),
          point(b,offset,SPEC.deck-.43),.22,structural);
    }
  }
  // Extend all eight steel running rails into the supported aprons.
  for(const side of SPEC.trackOffsets){
    for(const railSide of [-.72,.72])
      B(point(SPEC.west-SPEC.approachLength,side+railSide,SPEC.deck+.18),
        point(SPEC.east+SPEC.approachLength,side+railSide,SPEC.deck+.18),.095,rail);
    for(let x=SPEC.west+.42;x<SPEC.east;x+=3.1)
      B(point(x,side-1.24,SPEC.deck+.065),
        point(x,side+1.24,SPEC.deck+.065),.16,sleeper);
    for(const [a,b] of apronEnds)
      for(let x=a+.55;x<b-.12;x+=3.1)
        B(point(x,side-1.24,SPEC.deck+.065),
          point(x,side+1.24,SPEC.deck+.065),.16,sleeper);
  }
  // Portal-frame bridge: physical compression path into tower piers, not floating walls.
  for(const tx of SPEC.towerXs){
    for(const side of [-1,1]){
      const z=at(tx,side*12.65);
      const pierHeight=SPEC.deck-SPEC.water+2.8;
      X(tx,SPEC.water-1.6+pierHeight*.5,z,3.25,pierHeight,3.05,anchor);
      const towerH=TOWER_SADDLE_Y-SPEC.deck;
      // Split each side pylon into two upright legs. This leaves a readable
      // structural archway instead of an unscaled monolithic high-rise box.
      for(const xx of [tx-1.22,tx+1.22])
        X(xx,SPEC.deck+towerH*.5,z,1.02,towerH+.1,1.55,structural);
      X(tx,TOWER_SADDLE_Y,z,4.0,1.15,3.4,anchor);
      for(const f of [.19,.52,.83])
        X(tx,SPEC.deck+towerH*f,z,3.72,.29,2.34,rivets);
    }
    const towerH=TOWER_SADDLE_Y-SPEC.deck;
    for(const f of [.30,.73])
      B(point(tx,-12.65,SPEC.deck+towerH*f),
        point(tx,12.65,SPEC.deck+towerH*f),.55,structural);
    B(point(tx,-12.65,SPEC.deck+towerH*.67),
      point(tx,12.65,SPEC.deck+towerH*.30),.30,structural);
    B(point(tx,12.65,SPEC.deck+towerH*.67),
      point(tx,-12.65,SPEC.deck+towerH*.30),.30,structural);
  }
  function cableHeight(x){
    // A bounded catenary approximation: highest at the towers, lowest midspan.
    const t=Math.max(0,Math.min(1,(x-SPEC.towerXs[0])/
      (SPEC.towerXs[1]-SPEC.towerXs[0])));
    if(x<SPEC.towerXs[0])
      return TOWER_SADDLE_Y-(TOWER_SADDLE_Y-CABLE_ANCHOR_Y)*
        (SPEC.towerXs[0]-x)/(SPEC.towerXs[0]-SPEC.west);
    if(x>SPEC.towerXs[1])
      return TOWER_SADDLE_Y-(TOWER_SADDLE_Y-CABLE_ANCHOR_Y)*
        (x-SPEC.towerXs[1])/(SPEC.east-SPEC.towerXs[1]);
    return CABLE_MID_Y+(TOWER_SADDLE_Y-CABLE_MID_Y)*Math.pow(2*t-1,2);
  }
  for(const side of [-1,1]){
    const spanSide=side*12.35;
    for(let x=SPEC.west;x<SPEC.east;x+=3){
      const x2=Math.min(x+3,SPEC.east);
      B(point(x,spanSide,cableHeight(x)),point(x2,spanSide,cableHeight(x2)),.19,structural);
    }
    for(let x=SPEC.west+8;x<SPEC.east-7;x+=9.5){
      B(point(x,spanSide,SPEC.deck+.15),
        point(x,spanSide,cableHeight(x)),.11,structural);
      X(x,SPEC.deck+.88,at(x,side*12.1),.22,1.5,.24,anchor);
    }
  }
  // Lower deck X-bracing and cross girders are spatial geometry, not face decals.
  for(let x=SPEC.west+2;x<SPEC.east-4;x+=10.5){
    B(point(x,-12.0,SPEC.deck-1.05),
      point(x+7.6,12.0,SPEC.deck-1.05),.23,structural);
    B(point(x,12.0,SPEC.deck-1.05),
      point(x+7.6,-12.0,SPEC.deck-1.05),.23,structural);
    B(point(x,-12.0,SPEC.deck-1.28),
      point(x,12.0,SPEC.deck-1.28),.35,structural);
    for(const side of [-1,1]){
      // Separated parabolic truss webs are immediately visible on low fly-bys.
      B(point(x,side*12.0,SPEC.deck+.03),
        point(x+7.6,side*12.0,SPEC.deck+4.45),.17,structural);
      B(point(x,side*12.0,SPEC.deck+4.45),
        point(x+7.6,side*12.0,SPEC.deck+.03),.17,structural);
    }
  }
  // Tunnel-side parapets and signal heads rather than floating trains at a dead end.
  for(const tx of [SPEC.west+3,SPEC.east-3]){
    for(const side of [-1,1]){
      X(tx,SPEC.deck+.75,at(tx,side*12.1),3.4,1.5,.38,anchor);
      X(tx,SPEC.deck+2.95,at(tx,side*11.85),.18,2.3,.18,rivets);
      X(tx,SPEC.deck+4.08,at(tx,side*11.85),.36,.34,.29,light);
    }
  }
  // Merely decorative lights; native sunlight, weather and flight physics unchanged.
  for(let x=SPEC.west+17;x<SPEC.east-15;x+=21)
    for(const side of [-1,1])
      X(x,SPEC.deck+.9,at(x,side*12.15),.17,.13,.33,walkway);
  return Object.freeze({beams,boxes,quads,total:beams+boxes+quads});
}
root.PatrolNycManhattanSubway=Object.freeze({
  spec:SPEC,engineering:CONTROL,
  calibratedHeights:Object.freeze({lower:SPEC.deck,upper:UPPER_ROAD_Y,
    saddle:TOWER_SADDLE_Y,cableMid:CABLE_MID_Y,anchorage:CABLE_ANCHOR_Y}),
  runs:RUNS,at,point,trainPose,build
});
})(typeof window==='undefined'?globalThis:window);
