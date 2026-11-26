/**
 * Manhattan / Central Park — terrain-aware single-batch landmark geometry.
 * A compressed game-scale reconstruction, NOT a GIS or survey-accurate model.
 * South: 59th St (z=55); north: 110th St (z=357).
 * x is the cross-island coordinate relative to MANHATTAN_GRID's tilted center.
 * No external GLTF, satellite texture, or copyrighted map assets are needed.
 */
export const PARK_SITES=[
  {name:'Central Park Pond',u:21,z:73},
  {name:'The Mall / Literary Walk',u:7,z:111},
  {name:'Bethesda Terrace',u:5,z:134},
  {name:'The Lake / Bow Bridge',u:-17,z:151},
  {name:'Belvedere Castle',u:-15,z:178},
  {name:'Great Lawn',u:6,z:196},
  {name:'Jacqueline Kennedy Onassis Reservoir',u:0,z:245},
  {name:'North Meadow',u:-9,z:303},
  {name:'Harlem Meer',u:18,z:338}
];
export const PARK_WATERS=[
  {name:'Reservoir',cx:0,cz:245,rx:29.5,rz:28.0,phase:.45},
  {name:'The Lake',cx:-14,cz:150,rx:24.0,rz:16.2,phase:1.15},
  {name:'The Pond',cx:21,cz:73,rx:12.4,rz:8.6,phase:2.75},
  {name:'Harlem Meer',cx:17,cz:339,rx:16.5,rz:10.2,phase:1.7},
  {name:'Turtle Pond',cx:6,cz:177,rx:7.7,rz:5.3,phase:3.85},
  {name:'Conservatory Water',cx:26,cz:146,rx:9.2,rz:6.7,phase:0.85}
];
export const PARK_LAWNS=[
  {name:'Sheep Meadow',u:-16,z:112,rx:19,rz:18},
  {name:'Great Lawn',u:4,z:194,rx:23,rz:14},
  {name:'North Meadow',u:-13,z:302,rx:22,rz:14},
  {name:'East Meadow',u:20,z:309,rx:12,rz:11}
];
const TAU=Math.PI*2;
const clamp=(v,low,high)=>Math.max(low,Math.min(high,v));
export function shoreRadius(a,feature){
  return 1+.055*Math.sin(3*a+feature.phase)+.025*Math.cos(7*a-feature.phase);
}
export function normalizedWaterDistance(u,z,feature){
  const vx=(u-feature.cx)/feature.rx,vz=(z-feature.cz)/feature.rz;
  return Math.hypot(vx,vz)/shoreRadius(Math.atan2(vz,vx),feature);
}
export function isParkInterior(u,z,grid,margin=0){
  return Math.abs(u)<grid.parkHalfWidth-margin &&
    Math.abs(z-grid.parkCenter)<grid.parkHalfLength-margin;
}
export function buildCentralPark({
  addQuad,addTri,box,beam,ribbon,terrainAt,grid,waterY,streetY,
  quality='high'
}){
  const high=quality==='high';
  const stats={trees:0,waterBodies:0,shoreTriangles:0,paths:0,
    skippedWetPaths:0,reroutedPathPoints:0,majorLandmarks:0,verticesEstimate:0};
  const granite=[.52,.52,.47],pale=[.70,.69,.60],limestone=[.75,.70,.59],
    gravel=[.56,.51,.43],asphalt=[.27,.30,.28],pathShade=[.64,.61,.54],
    bronze=[.43,.34,.22],dark=[.21,.25,.24],water=[.12,.28,.34],
    darkWater=[.09,.23,.31],lawn=[.29,.43,.24],sandy=[.65,.58,.39];
  const ex=(u,z)=>grid.tilt*z+grid.offset+u;
  const ground=(u,z)=>terrainAt(ex(u,z),z);
  const p=(u,z,lift=.13)=>[ex(u,z),ground(u,z)+lift,z];
  const waterTop=waterY+2.83;
  let seed=0x712A18;
  const rand=()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    return seed/4294967296;
  };
  // The previous looping paths crossed the Reservoir, The Lake and Turtle Pond.
  // Route the path consistently on one shore instead of projecting each point
  // to its nearest bank (which would flip sides and draw across the water).
  const dryPoint=(u,z,vertical,sides,width)=>{
    let outU=u,outZ=z;
    for(let pass=0;pass<2;pass++)for(let i=0;i<PARK_WATERS.length;i++){
      const feature=PARK_WATERS[i];
      const dx=(outU-feature.cx)/feature.rx,dz=(outZ-feature.cz)/feature.rz;
      const angle=Math.atan2(dz,dx);
      const shore=shoreRadius(angle,feature);
      const buffer=1.19+Math.min(width*.5,2.3)/
        Math.min(feature.rx,feature.rz);
      const distance=Math.hypot(dx,dz)/shore;
      if(distance>=buffer)continue;
      const threshold=buffer*shore;
      if(vertical){
        const needed=Math.sqrt(Math.max(0,threshold*threshold-dz*dz));
        outU=feature.cx+sides[i]*feature.rx*needed;
      }else{
        const needed=Math.sqrt(Math.max(0,threshold*threshold-dx*dx));
        outZ=feature.cz+sides[i]*feature.rz*needed;
      }
      stats.reroutedPathPoints++;
    }
    return [outU,outZ];
  };
  const waterClear=(a,b,clearance=1.055)=>{
    const mid=[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
    return [a,b,mid].every(([u,z])=>
      PARK_WATERS.every(f=>normalizedWaterDistance(u,z,f)>=clearance));
  };
  const band=(a,b,width,color,offset=.17)=>{
    if(!isParkInterior(a[0],a[1],grid,-4) ||
       !isParkInterior(b[0],b[1],grid,-4))return;
    if(!waterClear(a,b)){
      stats.skippedWetPaths++;
      return;
    }
    ribbon(p(a[0],a[1],offset),p(b[0],b[1],offset),width,color);
    stats.paths++;
  };
  function trail(points,width=1.2,color=gravel){
    if(points.length<2)return;
    const start=points[0],end=points[points.length-1];
    const vertical=Math.abs(end[1]-start[1])>=Math.abs(end[0]-start[0]);
    const center=[points.reduce((s,p)=>s+p[0],0)/points.length,
      points.reduce((s,p)=>s+p[1],0)/points.length];
    // Stable per-lake shore choice prevents discontinuous underwater chords.
    const sides=PARK_WATERS.map(f=>
      (vertical?center[0]-f.cx:center[1]-f.cz)>=0?1:-1);
    let prev=dryPoint(start[0],start[1],vertical,sides,width);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      const d=Math.hypot(a[0]-b[0],a[1]-b[1]);
      const n=Math.max(1,Math.ceil(d/2.25));
      for(let j=1;j<=n;j++){
        const t=j/n,raw=[a[0]+(b[0]-a[0])*t,
          a[1]+(b[1]-a[1])*t];
        const next=dryPoint(raw[0],raw[1],vertical,sides,width);
        band(prev,next,width,color);
        prev=next;
      }
    }
  }
  function riverContour(f,i,scale=1){
    const a=i/64*TAU;
    const r=shoreRadius(a,f)*scale;
    return [f.cx+Math.cos(a)*f.rx*r,f.cz+Math.sin(a)*f.rz*r];
  }
  function lake(f,k){
    const center=[ex(f.cx,f.cz),waterTop,f.cz];
    // Interpolate a shared shoreline color at each vertex. A different
    // flat color per triangle produced a pinwheel visible from the air.
    const centerTint=k===0?[.088,.208,.274]:darkWater;
    const shoreTint=(u,z)=>{
      const swell=Math.sin(u*.13+z*.082)*.006+Math.sin(z*.21-u*.09)*.004;
      return [.124+swell,.275+swell,.315+swell];
    };
    const N=64;
    for(let i=0;i<N;i++){
      const [u0,z0]=riverContour(f,i),[u1,z1]=riverContour(f,i+1);
      const a=[ex(u0,z0),waterTop,z0],b=[ex(u1,z1),waterTop,z1];
      // Water and ring are separate surfaces with coherent upward normals.
      addTri(center,b,a,[centerTint,shoreTint(u1,z1),shoreTint(u0,z0)]);
      // Shoreline restores the terrain above the water surface.
      const [ou0,oz0]=riverContour(f,i,1.09);
      const [ou1,oz1]=riverContour(f,i+1,1.09);
      const o0=p(ou0,oz0,.17),o1=p(ou1,oz1,.17);
      addQuad(a,b,o1,o0,i%4===0?limestone:granite);
      // Gray path follows the actual shoreline, not a rectangular city grid.
      const t0=riverContour(f,i,1.16),t1=riverContour(f,i+1,1.16);
      band(t0,t1,k===0?1.35:1.03,k===0?pathShade:gravel,.24);
    }
    // Small sparse wind ripples break the unrealistically flat water.
    for(let i=0;i<(high?22:10);i++){
      const a=rand()*TAU,rad=.25+.60*rand();
      const u=f.cx+f.rx*rad*Math.cos(a),z=f.cz+f.rz*rad*Math.sin(a);
      if(normalizedWaterDistance(u,z,f)>.85)continue;
      const w=.7+rand()*1.6,dx=w*.5,dz=.09;
      addQuad([ex(u-dx,z-dz),waterTop+.013,z-dz],
        [ex(u-dx,z+dz),waterTop+.013,z+dz],
        [ex(u+dx,z+dz),waterTop+.013,z+dz],
        [ex(u+dx,z-dz),waterTop+.013,z-dz],
        [[.12,.27,.32],[.12,.27,.32],[.15,.30,.34],[.15,.30,.34]]);
    }
    stats.waterBodies++;
    stats.shoreTriangles+=64*3;
  }
  // One of the very few city features with its own shallow terrain cutout:
  // the park geometry uses the same footprint definition as the worker.
  PARK_WATERS.forEach(lake);
  // The drives are not a continued street grid. Four arterial transverses
  // cross the park where they occur in the real park (approximate scale).
  // Shift the compressed 79th and 86th crossings away from small Turtle
  // Pond and the Reservoir shore. The real streets use depressed transverses;
  // in PATROL their uninterrupted road ribbon stays above dry terrain.
  for(const [street,z] of [[65,91],[79,170],[86,209],[97,280]]){
    const points=[];
    for(let j=0;j<=20;j++){
      const u=-41+j*4.1;
      const zz=z+((street===79||street===86)?0:Math.sin(j*.22+street)*1.2);
      points.push([u,zz]);
    }
    trail(points,4.35,asphalt);
    for(let j=0;j<points.length-1;j+=3){
      const a=points[j],b=points[j+1];
      band(a,b,.075,[.83,.78,.58],.205);
    }
  }
  // A continuous, gently winding loop drive and a secondary pedestrian
  // network. Unlike a random grid, these paths maintain the park's N/S axis.
  const west=[],east=[],midWest=[],midEast=[];
  for(let j=0;j<=60;j++){
    const z=58+j*4.89;
    west.push([-32+2.5*Math.sin(z/19),z]);
    east.push([32+2.9*Math.sin(z/17+1.3),z]);
    midWest.push([-18+3.6*Math.cos(z/16),z]);
    midEast.push([16+3.5*Math.cos(z/22+2),z]);
  }
  trail(west,2.6,asphalt);trail(east,2.6,asphalt);
  trail(midWest,.91,gravel);trail(midEast,.97,gravel);
  trail([[-31,60],[-20,78],[-6,86],[7,90],[30,91]],1.3,gravel);
  trail([[-26,104],[-14,113],[-6,126],[5,135],[15,141],[31,143]],1.15,gravel);
  trail([[-31,172],[-18,179],[-8,185],[7,185],[29,179]],1.15,pathShade);
  trail([[-30,302],[-13,306],[2,314],[21,326],[33,343]],1.2,gravel);
  trail([[-31,330],[-15,332],[0,325],[16,327],[29,345]],1.12,pathShade);
  for(const u of [-41.6,41.6]){
    const border=[];
    for(let i=0;i<=54;i++)border.push([u,56+i*5.55]);
    trail(border,.76,granite);
  }
  for(const z of [55.6,356.3])trail([[-41,z],[41,z]],1.3,granite);
  // Meadow surface follows the terrain; the opening between crown clusters
  // keeps all three recognisable lawns green and unobstructed from above.
  function lawnEllipse(meadow){
    const N=32,center=p(meadow.u,meadow.z,.105);
    for(let i=0;i<N;i++){
      const angle=i/N*TAU,next=(i+1)/N*TAU;
      const r0=.96+.018*Math.sin(5*angle),r1=.96+.018*Math.sin(5*next);
      const b=p(meadow.u+Math.cos(angle)*meadow.rx*r0,
        meadow.z+Math.sin(angle)*meadow.rz*r0,.10);
      const c=p(meadow.u+Math.cos(next)*meadow.rx*r1,
        meadow.z+Math.sin(next)*meadow.rz*r1,.10);
      // lawn is the outer RGB material, not the current meadow definition.
      addTri(center,c,b,i%4===0?[.27,.42,.23]:lawn);
    }
  }
  PARK_LAWNS.forEach(lawnEllipse);
  // A few realistic NY baseball diamonds on the Great Lawn and North Meadow.
  // Small sand infield triangles rather than large cartoon rectangles.
  for(const [u,z,scale] of [[-4,197,1],[14,198,.9],[-21,306,.88]]){
    const c=p(u,z,.155);
    const radius=3.1*scale;
    const q=(a)=>p(u+Math.cos(a)*radius,z+Math.sin(a)*radius,.159);
    addTri(c,q(.25*Math.PI),q(.75*Math.PI),sandy);
    addTri(c,q(.75*Math.PI),q(1.25*Math.PI),sandy);
    addTri(c,q(1.25*Math.PI),q(1.75*Math.PI),sandy);
    addTri(c,q(1.75*Math.PI),q(.25*Math.PI),sandy);
  }
  // Smooth, multi-shell deciduous canopies. No stacks of square foliage cubes.
  function crown(u,z,top,height,radius,colors){
    const y=ground(u,z)+height,centerX=ex(u,z);
    const n=9;
    const topPoint=[centerX, y+radius*.52,z],bottomPoint=[centerX,y-radius*.34,z];
    for(let j=0;j<n;j++){
      const a=j/n*TAU,b=(j+1)/n*TAU;
      const ring=(t)=>[centerX+Math.cos(t)*radius,
        y+Math.sin(t*3+top)*radius*.10,z+Math.sin(t)*radius*.85];
      const p0=ring(a),p1=ring(b);
      addTri(p0,p1,topPoint,colors[j%colors.length]);
      addTri(bottomPoint,p1,p0,colors[(j+1)%colors.length]);
    }
  }
  function tree(u,z,variant=0){
    const base=ground(u,z),height=3.4+rand()*3.7,
      cx=ex(u,z),branch=[.26,.21,.17];
    const palette=variant%4===0
      ? [[.19,.35,.20],[.24,.39,.21],[.31,.45,.23]]
      : variant%4===1
      ? [[.14,.29,.22],[.18,.37,.24],[.23,.41,.29]]
      : [[.21,.37,.17],[.28,.45,.22],[.33,.42,.23]];
    beam([cx,base+.07,z],[cx,height+base-.9,z],.18,branch);
    for(const side of [-1,1]){
      const a=variant*.5+side*2.3;
      beam([cx,base+height*.6,z],
        [cx+Math.cos(a)*1.12,base+height*.88,z+Math.sin(a)*1.0],
        .092,branch);
    }
    crown(u,z,variant,height-.65,1.75+rand()*.64,palette);
    const b1=variant*1.11;
    crown(u+Math.cos(b1)*.76,z+Math.sin(b1)*.67,variant+2,
      height-1.31,1.43,palette);
    stats.trees++;
  }
  // A forest canopy gives the park its readable silhouette from the air.
  // Density and vertex count are bounded, deterministic and device adaptive.
  const target=high?330:145;
  let tries=0;
  while(stats.trees<target && tries<target*13){
    tries++;
    const z=58+rand()*296,u=-38+rand()*76;
    if(!isParkInterior(u,z,grid,4))continue;
    if(PARK_WATERS.some(f=>normalizedWaterDistance(u,z,f)<1.28))continue;
    if(PARK_LAWNS.some(f=>
      Math.hypot((u-f.u)/f.rx,(z-f.z)/f.rz)<1.10))continue;
    if((Math.abs(u)<4 && z>101 && z<137) ||
      (Math.abs(z-174)<3.5)||(Math.abs(z-215)<3.5) ||
      (Math.abs(z-280)<3.5))continue;
    // Keep perimeter clear for the actual Fifth Avenue / Central Park West.
    tree(u,z,Math.floor(rand()*10));
  }
  // Central Park Mall: two rows of larger mature trees flanking the promenade.
  trail([[6,106],[7,113],[6,121],[5,129],[4,135]],3.45,pathShade);
  for(let i=0;i<10;i++){
    const z=104+i*3.14;
    for(const offset of [-5.5,5.5]){
      const u=6+offset;
      if(PARK_WATERS.every(f=>normalizedWaterDistance(u,z,f)>1.1))
        tree(u,z,i);
    }
  }
  // Bethesda Terrace — layered limestone steps and a working-scale fountain.
  const terraceU=5,terraceZ=132,terrace=ground(terraceU,terraceZ)+.28;
  const tx=ex(terraceU,terraceZ);
  box(tx,terrace+.05,terraceZ,13.6,.18,6.8,limestone);
  box(tx,terrace+.40,terraceZ+2.15,12.7,.16,.34,granite);
  for(let i=0;i<4;i++){
    box(tx,terrace+.12+i*.10,terraceZ-4.1+i*.75,
      11.1-i*.37,.12,.68,i%2===0?limestone:granite);
  }
  for(const side of [-1,1]){
    box(tx+side*6.5,terrace+.54,terraceZ, .58,1.04,6.4,granite);
    for(let j=0;j<6;j++){
      const z=terraceZ-2.8+j*1.07;
      box(tx+side*6.52,terrace+1.12,z,.68,.20,.28,pale);
    }
  }
  const fountainU=5,fountainZ=137.8,fx=ex(fountainU,fountainZ);
  const fy=ground(fountainU,fountainZ)+.43;
  for(let i=0;i<32;i++){
    const a=i/32*TAU,b=(i+1)/32*TAU;
    const ring=(r,y,t)=>[fx+Math.cos(t)*r,fy+y,fountainZ+Math.sin(t)*r];
    addQuad(ring(3.0,.08,a),ring(3.0,.08,b),
      ring(2.60,.09,b),ring(2.60,.09,a),limestone);
    addTri([fx,fy+.12,fountainZ],ring(2.58,.12,b),ring(2.58,.12,a),water);
  }
  beam([fx,fy+.10,fountainZ],[fx,fy+1.90,fountainZ],.22,bronze);
  for(let i=0;i<12;i++){
    const t=i/12*TAU;
    beam([fx,fy+1.75,fountainZ],
      [fx+Math.cos(t)*1.16,fy+.31,fountainZ+Math.sin(t)*1.16],
      .045,[.65,.80,.81]);
  }
  stats.majorLandmarks++;
  // Bow Bridge: add its visible cast-iron arch, spandrels and abutments.
  // The previous single-sided stone strip had no underside or structure;
  // viewed from a low aircraft it appeared to hover above the Lake.
  // This is a compact artistic reconstruction in game coordinates, not a
  // surveyed Bow Bridge model. Everything is baked into the park mesh.
  const bowZ=151,bowU=-14;
  const whiteIron=[.57,.61,.60],shadowIron=[.25,.31,.31];
  const bridgeDeckY=t=>waterTop+1.12+Math.sin(t*Math.PI)*.85;
  const bridgeArchY=t=>waterTop+.28+Math.sin(t*Math.PI)*.86;
  stats.bowBridgeTrussMembers=0;
  stats.bowBridgeAbutments=0;
  for(let j=0;j<20;j++){
    const t0=j/20,t1=(j+1)/20;
    const u0=bowU-11+t0*22,u1=bowU-11+t1*22;
    const y0=bridgeDeckY(t0),y1=bridgeDeckY(t1);
    const arch0=bridgeArchY(t0),arch1=bridgeArchY(t1);
    const px0=ex(u0,bowZ),px1=ex(u1,bowZ);
    const left=bowZ-1.32,right=bowZ+1.32;
    // Walkable top, continuous dark soffit and two stone edge fascias;
    // keeping the former surface makes existing scenic views compatible.
    addQuad([px0,y0,left],[px0,y0,right],
      [px1,y1,right],[px1,y1,left],limestone);
    addQuad([px0,y0-.19,left],[px1,y1-.19,left],
      [px1,y1-.19,right],[px0,y0-.19,right],shadowIron);
    for(const side of [-1,1]){
      const edge=bowZ+side*1.32,rail=bowZ+side*1.35,
        truss=bowZ+side*1.25;
      addQuad([px0,y0-.19,edge],[px1,y1-.19,edge],
        [px1,y1,edge],[px0,y0,edge],granite);
      // The arch is a structural curve below the deck, NOT a railing
      // floating at the same height. Cast-iron webbing meets the bridge
      // fascia and includes real diagonal bracing at high quality.
      beam([px0,arch0,truss],[px1,arch1,truss],.091,shadowIron);
      beam([px0,y0-.12,truss],[px1,y1-.12,truss],.057,whiteIron);
      stats.bowBridgeTrussMembers+=2;
      if(j%2===0){
        beam([px0,arch0,truss],[px0,y0-.12,truss],.040,whiteIron);
        stats.bowBridgeTrussMembers++;
      }
      if(high){
        const diagStart=j%2===0?[px0,arch0,truss]:
          [px0,y0-.12,truss];
        const diagEnd=j%2===0?[px1,y1-.12,truss]:
          [px1,arch1,truss];
        beam(diagStart,diagEnd,.031,whiteIron);
        stats.bowBridgeTrussMembers++;
      }
      // Existing graceful two-rail barrier now sits on a built-up deck.
      beam([px0,y0+.17,rail],[px1,y1+.17,rail],.062,whiteIron);
      beam([px0,y0+1.06,rail],[px1,y1+1.06,rail],.055,whiteIron);
      if(j%2===0)
        beam([px0,y0+.18,rail],[px0,y0+1.06,rail],.037,whiteIron);
    }
    if(j%5===0){
      // Cross-girders connect the two arch ribs beneath the deck.
      beam([px0,y0-.19,bowZ-1.25],
        [px0,y0-.19,bowZ+1.25],.085,shadowIron);
      stats.bowBridgeTrussMembers++;
    }
  }
  // Exposed, masonry-faced pier ends tie the arch into the underlying
  // terrain. Their feet extend below both the waterline and local terrain
  // height instead of starting visibly in mid-air.
  for(const side of [-1,1]){
    const endU=bowU+side*11,endX=ex(endU,bowZ),
      footingBase=Math.min(waterTop-.55,ground(endU,bowZ)-.18),
      cap=bridgeDeckY(side<0?0:1)-.19,
      height=Math.max(.35,cap-footingBase);
    box(endX,footingBase+height*.5,bowZ,1.54,height,2.78,granite);
    box(endX,cap+.04,bowZ,1.75,.14,3.00,limestone);
    // Stone joints and slightly projecting spring blocks make the load
    // path legible without burying or replacing the existing lake mesh.
    for(const edge of [-1,1])
      box(endX,cap-.29,bowZ+edge*1.41,1.61,.15,.10,dark);
    stats.bowBridgeAbutments++;
  }
  stats.majorLandmarks++;
  // Belvedere Castle: textured limestone keep, asymmetric turrets and roofline.
  const castleU=-16,castleZ=181,castleX=ex(castleU,castleZ);
  const castleGround=ground(castleU,castleZ)+.26;
  box(castleX,castleGround+2.3,castleZ,5.6,4.6,4.2,limestone);
  box(castleX,castleGround+4.54,castleZ,6.1,.35,4.7,granite);
  for(let k=0;k<5;k++)for(const side of [-1,1]){
    box(castleX+side*2.8,castleGround+4.94,
      castleZ-1.8+k*.9,.47,.48,.48,limestone);
  }
  for(const [u,z,r,h] of [[-19,179,1.28,6.1],[-13,184,1.05,5.2]]){
    const x=ex(u,z);
    box(x,castleGround+h*.5,z,r*2.1,h,r*2.1,granite);
    box(x,castleGround+h+.12,z,r*2.38,.25,r*2.38,limestone);
    for(const side of [-1,1])for(const zoff of [-.69,.69])
      box(x+side*(r+.08),castleGround+h*.67,z+zoff,
        .08,.67,.28,dark);
  }
  for(const u of [-17.8,-16.0,-14.2])
    box(ex(u,castleZ),castleGround+2.6,castleZ+2.17,
      .42,1.02,.09,dark);
  stats.majorLandmarks++;
  // Entrance pillars and low iron rail: no giant wall sealing the park.
  for(const z of [56,355])for(const u of [-37,37]){
    const y=ground(u,z),x=ex(u,z);
    box(x,y+.80,z,.70,1.6,.65,granite);
    box(x,y+1.64,z,.91,.18,.82,limestone);
    beam([x,y+1.78,z],[x,y+2.04,z],.07,bronze);
  }
  // The Conservatory Garden is formal geometry, not a second generic pond.
  const gZ=324;
  for(const u of [18,24,30]){
    const x=ex(u,gZ),y=ground(u,gZ);
    box(x,y+.08,gZ,3.5,.12,7.4,u===24?pathShade:lawn);
    for(const zz of [gZ-3.8,gZ+3.8])
      beam([x,y+.13,zz],[x,y+1.05,zz],.07,bronze);
  }
  stats.verticesEstimate=stats.trees*3*18*3+stats.waterBodies*64*9;
  return stats;
}
