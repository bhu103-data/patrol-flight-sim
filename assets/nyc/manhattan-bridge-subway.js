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
  trackOffsets:Object.freeze([-9.5,-6.3,6.3,9.5]),
  towerXs:Object.freeze([31,150]), pace:7.4, carPitch:13.35
});
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
    visible:x>=SPEC.west-6&&x<=SPEC.east+6
  });
}
function build({box,addQuad,beam}){
  if(typeof box!=='function'||typeof addQuad!=='function'||typeof beam!=='function')
    throw Error('Manhattan Bridge requires the existing WebGL geometry callbacks');
  const structural=[.29,.35,.40],rivets=[.20,.26,.29],
    walkway=[.52,.54,.51],deckColor=[.23,.28,.31],
    trackBed=[.25,.29,.33],rail=[.56,.60,.62],
    sleeper=[.38,.39,.37],anchor=[.54,.51,.47],
    light=[.86,.75,.52];
  let beams=0,boxes=0,quads=0;
  const B=(a,b,w,color)=>{beam(a,b,w,color);beams++};
  const X=(x,y,z,w,h,d,color)=>{box(x,y,z,w,h,d,color);boxes++};
  const Q=(a,b,c,d,color)=>{addQuad(a,b,c,d,color);quads++};
  // Two side trackways and a higher, recessed roadway. No rails on Brooklyn Bridge.
  for(let x=SPEC.west;x<SPEC.east;x+=3.5){
    const nx=Math.min(x+3.5,SPEC.east);
    for(const side of [-1,1]){
      const inner=side*4.15,outer=side*11.75;
      Q(point(x,inner,SPEC.deck-.29),point(nx,inner,SPEC.deck-.29),
        point(nx,outer,SPEC.deck-.29),point(x,outer,SPEC.deck-.29),trackBed);
      B(point(x,side*12.0,SPEC.deck-.10),point(nx,side*12.0,SPEC.deck-.10),.31,structural);
      B(point(x,side*3.9,SPEC.deck-.23),point(nx,side*3.9,SPEC.deck-.23),.24,structural);
    }
    Q(point(x,-3.75,SPEC.deck+4.55),point(nx,-3.75,SPEC.deck+4.55),
      point(nx,3.75,SPEC.deck+4.55),point(x,3.75,SPEC.deck+4.55),deckColor);
    // The elevated road and train decks have distinct structural elevations.
    B(point(x,-3.95,SPEC.deck+4.36),point(nx,-3.95,SPEC.deck+4.36),.32,structural);
    B(point(x,3.95,SPEC.deck+4.36),point(nx,3.95,SPEC.deck+4.36),.32,structural);
  }
  for(const side of SPEC.trackOffsets){
    for(const railSide of [-.72,.72]){
      for(let x=SPEC.west;x<SPEC.east;x+=5.6){
        B(point(x,side+railSide,SPEC.deck+.18),
          point(Math.min(x+5.6,SPEC.east),side+railSide,SPEC.deck+.18),.095,rail);
      }
    }
    for(let x=SPEC.west+.42;x<SPEC.east;x+=3.1)
      B(point(x,side-1.24,SPEC.deck+.065),
        point(x,side+1.24,SPEC.deck+.065),.16,sleeper);
  }
  // Portal-frame bridge: physical compression path into tower piers, not floating walls.
  for(const tx of SPEC.towerXs){
    for(const side of [-1,1]){
      const z=at(tx,side*12.65);
      const pierHeight=SPEC.deck-SPEC.water+2.8;
      X(tx,SPEC.water-1.6+pierHeight*.5,z,3.25,pierHeight,3.05,anchor);
      X(tx,SPEC.deck+21.5,z,2.45,43.6,2.30,structural);
      X(tx,SPEC.deck+43.12,z,4.0,1.15,3.4,anchor);
      for(const h of [7,22,37])
        X(tx,SPEC.deck+h,z,2.70,.36,2.55,rivets);
    }
    for(const h of [12.8,33.4])
      B(point(tx,-12.65,SPEC.deck+h),point(tx,12.65,SPEC.deck+h),
        .61,structural);
    B(point(tx,-12.65,SPEC.deck+30.5),
      point(tx,12.65,SPEC.deck+12.8),.35,structural);
    B(point(tx,12.65,SPEC.deck+30.5),
      point(tx,-12.65,SPEC.deck+12.8),.35,structural);
  }
  function cableHeight(x){
    // A bounded catenary approximation: highest at the towers, lowest midspan.
    const t=Math.max(0,Math.min(1,(x-SPEC.towerXs[0])/
      (SPEC.towerXs[1]-SPEC.towerXs[0])));
    if(x<SPEC.towerXs[0])return SPEC.deck+42-14*(SPEC.towerXs[0]-x)/(SPEC.towerXs[0]-SPEC.west);
    if(x>SPEC.towerXs[1])return SPEC.deck+42-14*(x-SPEC.towerXs[1])/(SPEC.east-SPEC.towerXs[1]);
    return SPEC.deck+18+24*Math.pow(2*t-1,2);
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
  spec:SPEC,runs:RUNS,at,point,trainPose,build
});
})(typeof window==='undefined'?globalThis:window);
