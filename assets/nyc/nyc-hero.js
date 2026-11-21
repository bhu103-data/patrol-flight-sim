// PATROL_NYC_HERO_CORRIDOR_V6 — bounded visual-detail asset, WebGL2 only.
// Fits PATROL's fictional X/Z scale. Inspired by 11-point Fort Wood layout;
// NOT a surveyed, real-metre reconstruction or photogrammetry capture.
export function buildNycHeroScenery({addQuad,box,beam,waterY,groundY,spawn,liberty}){
  const x0=liberty[0],z0=liberty[1],ground=groundY;
  const stone=[.54,.52,.47],limestone=[.67,.65,.60],
    coping=[.75,.72,.66],mortar=[.30,.31,.29],
    weatheredCopper=[.28,.51,.43],iron=[.25,.29,.31],
    timber=[.38,.33,.27],asphalt=[.34,.35,.33];
  // 11-pointed Fort Wood perimeter with 22 distinct inward/outward corners.
  const N=22,points=[],starTop=Math.max(waterY+.64,ground-.35);
  for(let i=0;i<N;i++){
    const angle=i*Math.PI/11-.55;
    const radius=i%2===0?24.8:18.1;
    points.push([x0+Math.sin(angle)*radius,z0+Math.cos(angle)*radius]);
  }
  for(let i=0;i<N;i++){
    const [ax,az]=points[i],[bx,bz]=points[(i+1)%N];
    addQuad([ax,waterY+.12,az],[bx,waterY+.12,bz],
      [bx,starTop,bz],[ax,starTop,az],stone);
    // Accurate-looking weathered coping and wall edge band: visual approximation.
    addQuad([ax,starTop+.10,az],[bx,starTop+.10,bz],
      [bx,starTop+.19,bz],[ax,starTop+.19,az],coping);
    if(i%2===0){
      const mx=(ax+bx)*.5,mz=(az+bz)*.5;
      const vx=mx-x0,vz=mz-z0,r=Math.hypot(vx,vz)||1;
      box(mx,starTop-.38,mz,.64,.61,.44,limestone);
      box(mx,starTop-.14,mz,.42,.30,.14,mortar);
      beam([mx,starTop-.20,mz],[mx+vx/r*.24,starTop+.06,mz+vz/r*.24],
        .056,iron);
    }
  }
  // Low, irregular hardscape concentric walks, with separate granite joints
  // and grass strips. These must not bury the existing statue pedestal.
  for(let i=0;i<44;i++){
    const a=i*Math.PI/22,b=(i+1)*Math.PI/22;
    function at(r,theta,y=ground+.055){
      return [x0+Math.sin(theta)*r,y,z0+Math.cos(theta)*r];
    }
    const p=at(10.0,a),q=at(10.0,b),r=at(13.4,b),t=at(13.4,a);
    addQuad(p,q,r,t,i%3===0?stone:limestone);
    addQuad(at(13.4,a,ground+.062),at(13.4,b,ground+.062),
      at(13.52,b,ground+.067),at(13.52,a,ground+.067),mortar);
    if(i%2===0){
      const mid=(a+b)*.5;
      const loc=at(15.4,mid,ground+.04);
      box(loc[0],ground+.14,loc[2],.50,.24,.50,stone);
    }
  }
  // Path from the star perimeter toward the airport-facing harbor spawn.
  const dx=spawn[0]-x0,dz=spawn[1]-z0,len=Math.hypot(dx,dz)||1;
  const ux=dx/len,uz=dz/len,nx=-uz,nz=ux;
  const point=(along,side,y)=>[x0+ux*along+nx*side,y,z0+uz*along+nz*side];
  const deckY=waterY+1.32;
  for(let i=0;i<8;i++){
    const u=18+i*2.5,v=u+2.5;
    const startY=i<3?ground+.05-(ground+.05-deckY)*(i/3):deckY;
    const endY=i<2?ground+.05-(ground+.05-deckY)*((i+1)/3):deckY;
    addQuad(point(u,-2.25,startY),point(v,-2.25,endY),
      point(v,2.25,endY),point(u,2.25,startY),timber);
    addQuad(point(u,-2.25,startY-.12),point(v,-2.25,endY-.12),
      point(v,2.25,endY-.12),point(u,2.25,startY-.12),iron);
    for(let side of [-1,1]){
      const edge=(u+v)*.5;
      const beamZ=point(edge,side*2.20,startY);
      box(beamZ[0],beamZ[1]+.05,beamZ[2],.10,.11,.10,coping);
    }
  }
  // Real-looking ferry jetty structure (rails/pylons/fenders/cleats).
  for(let along=19;along<=37;along+=3){
    for(const side of [-1,1]){
      const [x,y,z]=point(along,side*2.15,deckY);
      beam([x,waterY-.75,z],[x,deckY+1.04,z],.088,iron);
      const [tx,ty,tz]=point(along,side*2.15,deckY+1.07);
      box(tx,ty,tz,.12,.15,.13,coping);
      if(along<36){
        beam(point(along,side*2.15,deckY+1.02),
          point(along+3,side*2.15,deckY+1.02),.067,iron);
      }
    }
    if(along%2===1){
      const [mx,my,mz]=point(along,0,deckY+.06);
      box(mx,my,mz,4.1,.04,.070,stone);
    }
  }
  for(const along of [24,33]){
    const [px,py,pz]=point(along,2.70,deckY+.23);
    box(px,py,pz,.41,.46,.43,mortar);
    box(px,py+.28,pz,.59,.13,.55,iron);
    for(const offset of [-.42,.42]){
      const [bx,by,bz]=point(along+offset,2.83,deckY-.28);
      box(bx,by,bz,.19,.56,.18,stone);
    }
  }
  // Terminal display and safety bollards; lit by the existing city lighting.
  const [sx,sy,sz]=point(16.3,-3.25,ground+1.18);
  box(sx,sy,sz,2.10,1.78,.18,iron);
  box(sx,sy+.22,sz+.11,1.74,.93,.06,[.15,.38,.37]);
  for(let i=0;i<4;i++){
    const [bx,by,bz]=point(17+i*4.2,-3.1,deckY+.44);
    box(bx,by,bz,.22,.88,.22,weatheredCopper);
    box(bx,by+.42,bz,.29,.12,.30,stone);
  }
  // Island paths, shaded copper-green vegetation, and spot bollards.
  for(let i=0;i<16;i++){
    const a=i*2.39996323;
    const rr=15.7+2.7*(.5+.5*Math.sin(i*5.38));
    const tx=x0+Math.sin(a)*rr,tz=z0+Math.cos(a)*rr;
    // Skip the ferry approach sightline.
    if((tx-x0)*ux+(tz-z0)*uz>rr*.81)continue;
    const top=[tx-.03,ground+4.6+(i%3)*.25,tz+.04];
    beam([tx,ground+.10,tz],top,.12,[.35,.30,.24]);
    for(let b=0;b<5;b++){
      const angle=b*2.39996+i*.19,spread=1.12+(b%2)*.24;
      const tip=[top[0]+Math.cos(angle)*spread,
        top[1]-(b%3)*.20,top[2]+Math.sin(angle)*spread];
      beam([tx,ground+3.20,tz],tip,.047,[.27,.34,.27]);
      box(tip[0],tip[1]+.03,tip[2],.63,.52,.60,[.21,.39+(i%3)*.03,.27]);
    }
    const lx=x0+Math.sin(a+.36)*12.7,lz=z0+Math.cos(a+.36)*12.7;
    box(lx,ground+.37,lz,.17,.73,.17,iron);
    box(lx,ground+.73,lz,.28,.10,.28,coping);
  }
  // Low-profile high-detail shoreline fenders and repeated coastal fixtures.
  for(let j=0;j<11;j++){
    const a=(j+.33)*Math.PI*2/11;
    const tx=x0+Math.sin(a)*24.6,tz=z0+Math.cos(a)*24.6;
    box(tx,starTop-.54,tz,.42,.84,.41,mortar);
    box(tx,starTop+.09,tz,.55,.08,.53,stone);
  }
  // PATROL_NYC_LIBERTY_WEST_DOCK_V8 — visible geometry only, not navigable
  // ferry gameplay. NPS records today's ferry landing on Liberty Island's
  // west side; keep the existing spawn-facing jetty as a gameplay approach.
  // Ref: https://www.nps.gov/articles/000/stli-liberty-island-650003.htm
  // These are artistic game coordinates and NOT a surveyed shoreline.
  const mortarJoint=[.33,.34,.32], graniteFaces=[
    [.54,.52,.48],[.57,.56,.52],[.48,.49,.46],
    [.60,.58,.53],[.51,.52,.49],[.59,.56,.51]
  ],tidalStain=[.31,.38,.36];
  let masonryPanels=0;
  const wallBottom=waterY+.17, wallHeight=starTop-.12-wallBottom;
  if(wallHeight>.35){
    for(let edge=0;edge<points.length;edge++){
      const [ax,az]=points[edge],[bx,bz]=points[(edge+1)%points.length];
      const midx=(ax+bx)*.5-x0,midz=(az+bz)*.5-z0;
      const inverse=1/(Math.hypot(midx,midz)||1);
      const ox=midx*inverse*.043,oz=midz*inverse*.043;
      const along=t=>[ax+(bx-ax)*t+ox,az+(bz-az)*t+oz];
      // Thin waterline deposit reads as a separate aged stone material.
      const [w0x,w0z]=along(0),[w1x,w1z]=along(1);
      const tideTop=Math.min(starTop-.09,waterY+.49);
      if(tideTop>wallBottom)
        addQuad([w0x,wallBottom,w0z],[w1x,wallBottom,w1z],
          [w1x,tideTop,w1z],[w0x,tideTop,w0z],tidalStain);
      // Staggered ashlar blocks have shallow mortar gaps and slight
      // per-block tone variation; no additional textures or draw calls.
      for(let row=0;row<5;row++){
        const y0=wallBottom+(row/5)*wallHeight+.022;
        const y1=wallBottom+((row+1)/5)*wallHeight-.026;
        if(y1<=y0)continue;
        for(let block=0;block<6;block++){
          const stagger=row%2?-.10:0;
          const a=Math.max(0,block/5+stagger+.004);
          const b=Math.min(1,(block+1)/5+stagger-.004);
          if(b<=a)continue;
          const [p0x,p0z]=along(a),[p1x,p1z]=along(b);
          const color=graniteFaces[(edge*13+row*7+block*11)%graniteFaces.length];
          addQuad([p0x,y0,p0z],[p1x,y0,p1z],
            [p1x,y1,p1z],[p0x,y1,p0z],color);
          masonryPanels++;
        }
      }
      // The original solid wall remains behind these mortar gaps.
      if(edge%2===0){
        const [jx,jz]=along(.5);
        beam([jx,wallBottom+.04,jz],[jx,starTop-.10,jz],.022,mortarJoint);
      }
    }
  }

  // West-side ferry arrival: slightly sloped visitor gangway, timber
  // cross-planks, steel railings and paired mooring dolphins.
  const westDeckY=waterY+1.32;
  const westZ=z0+4.6;
  const wp=(along,side,y)=>[x0-along,y,westZ+side];
  const rampStartY=Math.max(waterY+.48,Math.min(ground+.07,westDeckY+.90));
  for(let i=0;i<4;i++){
    const a=19.6+i*1.35,b=a+1.35;
    const ya=rampStartY+(westDeckY-rampStartY)*i/4;
    const yb=rampStartY+(westDeckY-rampStartY)*(i+1)/4;
    addQuad(wp(a,-2.34,ya),wp(b,-2.34,yb),
      wp(b,2.34,yb),wp(a,2.34,ya),i%2?timber:limestone);
    for(const side of [-1,1]){
      beam(wp(a,side*2.22,ya+.77),wp(b,side*2.22,yb+.77),.054,iron);
    }
  }
  let westFerryDeckPanels=0;
  for(let panel=0;panel<18;panel++){
    const a=25+panel*1.44,b=a+1.44;
    const tone=panel%5===0?[.43,.36,.28]:panel%3===0?[.37,.32,.26]:timber;
    addQuad(wp(a,-2.62,westDeckY),wp(b,-2.62,westDeckY),
      wp(b,2.62,westDeckY),wp(a,2.62,westDeckY),tone);
    addQuad(wp(a,-2.62,westDeckY-.23),wp(b,-2.62,westDeckY-.23),
      wp(b,-2.62,westDeckY-.07),wp(a,-2.62,westDeckY-.07),iron);
    addQuad(wp(b,2.62,westDeckY-.23),wp(a,2.62,westDeckY-.23),
      wp(a,2.62,westDeckY-.07),wp(b,2.62,westDeckY-.07),iron);
    // Visible transverse board seams on the dock's surface.
    addQuad(wp(b-.036,-2.61,westDeckY+.007),
      wp(b+.036,-2.61,westDeckY+.007),
      wp(b+.036,2.61,westDeckY+.007),
      wp(b-.036,2.61,westDeckY+.007),mortarJoint);
    if(panel%3===0){
      for(const side of [-1,1]){
        const p=wp(a,side*2.49,westDeckY);
        beam(wp(a,side*2.49,waterY-.55),wp(a,side*2.49,westDeckY+1.03),.074,iron);
        box(p[0],p[1]+1.02,p[2],.21,.12,.21,coping);
      }
    }
    westFerryDeckPanels++;
  }
  // Parallel handrails do not overlap the existing spawn-facing walkway.
  const westEnd=25+18*1.44;
  for(const side of [-1,1]){
    for(const lift of [.48,.96]){
      beam(wp(25,side*2.49,westDeckY+lift),
        wp(westEnd,side*2.49,westDeckY+lift),.055,iron);
    }
    // Thick rubber bumper / mooring stanchion geometry at dock end.
    for(const along of [westEnd-2.4,westEnd-.4]){
      const [x,y,z]=wp(along,side*2.88,waterY+.20);
      box(x,y,z,.43,1.90,.39,[.16,.18,.19]);
      box(x,y+1.02,z,.58,.16,.55,iron);
    }
  }
  for(const along of [westEnd-3.2,westEnd-1.25]){
    const [x,y,z]=wp(along,0,waterY+.16);
    beam([x-.55,waterY-.65,z-.72],[x-.55,westDeckY+.25,z-.72],.18,stone);
    beam([x+.55,waterY-.65,z+.72],[x+.55,westDeckY+.25,z+.72],.18,stone);
    box(x,westDeckY+.18,z,2.30,.25,1.95,limestone);
  }
  // Small low-profile deck shelter with angled roof and open steel posts.
  const canopyAt=32.2;
  for(const along of [canopyAt-2.2,canopyAt+2.2])
    for(const side of [-1,1])
      beam(wp(along,side*1.94,westDeckY),
        wp(along,side*1.94,westDeckY+3.04),.092,iron);
  addQuad(wp(canopyAt-2.75,-2.38,westDeckY+3.14),
    wp(canopyAt+2.75,-2.38,westDeckY+3.14),
    wp(canopyAt+2.75,2.38,westDeckY+2.90),
    wp(canopyAt-2.75,2.38,westDeckY+2.90),[.41,.45,.46]);
  for(const side of [-1,1]){
    beam(wp(canopyAt-2.75,side*2.38,westDeckY+3.03),
      wp(canopyAt+2.75,side*2.38,westDeckY+3.03),.087,coping);
  }
  // Paired safety markers use geometry-only amber caps, not real advertising.
  for(const along of [27.1,westEnd-1.2]){
    for(const side of [-1,1]){
      const [x,y,z]=wp(along,side*2.08,westDeckY+.45);
      box(x,y,z,.19,.90,.19,iron);
      box(x,y+.48,z,.27,.17,.26,[.85,.59,.28]);
    }
  }
  return {starPoints:11,walkwayPanels:44,pierPanels:8,shorelineFixtures:11,
    masonryPanels,westFerryDeckPanels};
}


// PATROL_NYC_FINANCIAL_DISTRICT_WATERFRONT_V1
// Shore-dependent, batched piers in the bounded Lower Manhattan corridor.
// All coordinates use the game's compressed flight units, not survey metres.
// Skip geometry when the source terrain has no land/water transition.
export function buildManhattanWaterfront({addQuad,box,beam,waterY,terrain}) {
  const stone=[.55,.54,.50], curb=[.72,.70,.63], worn=[.37,.35,.32],
    darkSteel=[.23,.28,.31], handrail=[.53,.57,.57], timber=[.44,.34,.24],
    deckPaint=[.65,.63,.56], blackRubber=[.12,.15,.17], glass=[.16,.28,.33];
  let pierCount=0;
  // Use the EXACT rendered pier sites as flight collision bounds, rather than
  // a second guessed list of waterfront obstacle coordinates.
  const pierObstacles=[];
  // Recover the existing coastline rather than guessing a fixed X position.
  function bank(z,side){
    const center=.24*z+30.0;
    if(terrain(center,z)<=waterY+1.15)return null;
    let last=center;
    for(let offset=3;offset<145;offset+=1.6){
      const x=center+side*offset;
      if(terrain(x,z)<=waterY+.55)return last;
      last=x;
    }
    return null;
  }
  // Retain the real coast shape; masonry facing is generated only on a
  // found land-to-water interface.
  for(const side of [-1,1]){
    let prev=null;
    for(let z=-491;z<=-348;z+=4.4){
      const x=bank(z,side);
      if(x===null){prev=null;continue;}
      const top=Math.min(waterY+2.90,Math.max(waterY+1.65,terrain(x,z)+.08));
      if(prev && Math.abs(x-prev.x)<7){
        addQuad([prev.x,waterY-.30,prev.z],[x,waterY-.30,z],
          [x,top,z],[prev.x,prev.top,prev.z],stone,1);
        beam([prev.x,prev.top+.06,prev.z],[x,top+.06,z],.09,curb);
        if(Math.floor((z+491)/4.4)%3===0){
          const backX=x-side*.13;
          box(backX,waterY+1.03,z,.12,1.66,.32,worn);
        }
      }
      prev={x,z,top};
    }
  }
  // Different pier lengths and fittings are deliberate; no random identical
  // clones. Avoid Liberty Island and the Brooklyn Bridge collision footprint.
  const sites=[
    {z:-475,side:-1,length:25,width:5.1,type:0},
    {z:-448,side:-1,length:33,width:6.3,type:1},
    {z:-411,side:-1,length:22,width:4.6,type:2},
    {z:-377,side:-1,length:27,width:5.5,type:0},
    {z:-456,side:1,length:20,width:4.8,type:1},
    {z:-384,side:1,length:26,width:5.8,type:2}
  ];
  for(const site of sites){
    const {z,side,length,width,type}=site;
    const edge=bank(z,side);
    if(edge===null)continue;
    // Inland connection is anchored before the coastline and extends over
    // water. The cap retains the same number of fixed-size deck segments.
    const root=edge-side*1.6,tip=edge+side*length,top=waterY+1.18;
    // A one-dimensional bank query alone can bridge a shallow inlet or end
    // on a dry promontory. The entire landing edge must be on solid ground,
    // while the outer half of the deck must stand over open water. Check all
    // three longitudinal strips, including the actual lateral deck corners.
    const transverse=[-width*.5,0,width*.5];
    if(transverse.some(dz=>terrain(root,z+dz)<=waterY+1.15))continue;
    // Check the whole offshore span, not just three positions. A small
    // island between the old 45/72/100% samples could intersect the actual
    // pier deck even though both end and landing appeared safe. Keep the
    // start of the ramp exempt: it intentionally rests on the shore.
    let openWater=true;
    const clearStart=Math.min(3.4,length*.18);
    const spans=Math.ceil((length-clearStart)/1.55);
    const offsets=[-width*.5,-width*.25,0,width*.25,width*.5];
    for(let step=0;step<=spans&&openWater;step++){
      const deckX=edge+side*(clearStart+(length-clearStart)*step/spans);
      for(const dz of offsets){
        const sampled=terrain(deckX,z+dz);
        if(!Number.isFinite(sampled)||sampled>waterY+.55){
          openWater=false;break;
        }
      }
    }
    if(!openWater)continue;
    const landY=Math.min(waterY+2.75,terrain(root,z)+.07);
    const panelCount=Math.max(3,Math.ceil(length/2.2));
    const lengthX=tip-root;
    const cross=(x,y,w)=>[[x,y,z-w*.5],[x,y,z+w*.5]];
    for(let j=0;j<panelCount;j++){
      const t0=j/panelCount,t1=(j+1)/panelCount;
      const x0=root+lengthX*t0,x1=root+lengthX*t1;
      const y0=top+(landY-top)*Math.max(0,1-t0*7);
      const y1=top+(landY-top)*Math.max(0,1-t1*7);
      const a=cross(x0,y0,width),b=cross(x1,y1,width);
      addQuad(a[0],b[0],b[1],a[1],
        j%5===0?deckPaint:timber,2);
      // Wooden seams remain visible close to the dock.
      beam(a[0],a[1],.027,worn);
      for(const lane of [-.30,.30]){
        beam([x0,y0+.014,z+lane*width],
          [x1,y1+.014,z+lane*width],.021,worn);
      }
    }
    // No unsupported floating decks: paired piles and cross-bracing reach
    // beneath the water surface at regular intervals.
    for(let pos=4;pos<=length;pos+=7.1){
      const px=edge+side*pos;
      for(const railSide of [-1,1]){
        const pz=z+railSide*(width*.42);
        beam([px,waterY-.95,pz],[px,top+.08,pz],.15,darkSteel);
        box(px,waterY+.06,pz,.42,.18,.42,blackRubber);
      }
      beam([px,waterY+.22,z-width*.42],
        [px+side*2.9,top-.09,z+width*.42],.057,darkSteel);
    }
    // Coherent physical safety rails and mooring hardware.
    for(const railSide of [-1,1]){
      const rz=z+railSide*(width*.5-.16);
      for(let pos=2;pos<=length-2;pos+=2.7){
        const px=edge+side*pos;
        beam([px,top+.04,rz],[px,top+.98,rz],.048,handrail);
      }
      beam([edge+side*2,top+.97,rz],
        [tip-side*1.4,top+.97,rz],.056,handrail);
      for(const pos of [3.2,length-2.2]){
        const px=edge+side*pos;
        box(px,top+.20,z+railSide*(width*.48),.37,.33,.29,darkSteel);
        box(px,top+.38,z+railSide*(width*.48),.53,.075,.30,handrail);
      }
      for(let pos=5;pos<length-3;pos+=7.3){
        const px=edge+side*pos;
        box(px,top-.37,z+railSide*width*.48,.35,.67,.36,blackRubber);
      }
    }
    // Ferry dock versus workboat pier versus service pier: recognizable
    // silhouettes with different hardware, without copying proprietary art.
    if(type===1){
      const hx=root-side*1.1;
      box(hx,top+1.62,z,3.2,2.58,width*.70,[.62,.64,.61]);
      box(hx,top+2.99,z,3.65,.19,width*.84,curb);
      for(const zSide of [-1,1]){
        box(hx,top+1.76,z+zSide*width*.351,2.78,1.21,.055,glass);
        box(hx,top+1.76,z+zSide*width*.375,.09,1.42,.07,handrail);
      }
      box(tip-side*.60,top+.18,z,1.15,.20,width*.73,[.75,.65,.39]);
      for(const lane of [-1,1])
        box(tip-side*.26,top+.35,z+lane*width*.30,.20,.38,.24,darkSteel);
    }else if(type===2){
      const hx=edge+side*(length*.68);
      for(const railSide of [-1,1]){
        const zz=z+railSide*width*.26;
        box(hx,top+.43,zz,.82,.62,.52,[.67,.47,.28]);
        box(hx,top+.77,zz,.90,.10,.60,handrail);
      }
      beam([edge+side*5,top+.18,z],[edge+side*5,top+4.8,z],
        .11,darkSteel);
      beam([edge+side*5,top+4.70,z],
        [edge+side*10.5,top+4.12,z],.09,handrail);
    }else{
      for(let pos=6;pos<length-2;pos+=9.4){
        const px=edge+side*pos;
        box(px,top+.40,z,1.35,.70,1.15,[.57,.60,.58]);
        box(px,top+.79,z,1.48,.08,1.27,darkSteel);
      }
      box(tip-side*1.6,top+.36,z,.68,.56,1.12,[.79,.34,.15]);
    }
    // The deck is above water, so terrain sampling alone cannot stop a
    // floatplane from landing through it. Include the entire structure,
    // including landside terminal and tall workboat boom, with a small
    // pontoon/wing clearance margin in the same compressed game coordinates.
    pierObstacles.push({
      name:'Lower Manhattan pier',
      x:(root+tip)*.5,z,y:waterY-1.0,top:waterY+6.15,
      halfX:Math.abs(tip-root)*.5+2.0,halfZ:width*.5+.95,
      roofSlope:0,roofSlopeZ:0
    });
    pierCount++;
  }
  return {pierCount,coastRange:[-491,-348],pierObstacles};
}
