// PATROL_NYC_ROAD_MARKINGS_V12 — material and markings upgrade retaining V11.
// Game-space representation of Manhattan avenues and cross streets, not GIS
// coordinates. No Google Maps imagery or proprietary vehicle models copied.
// Roads reuse PATROL's CC0 Photo/PBR street materials in the main mesh shader.
export function buildNycStreetNetwork({
  addQuad, addTri, box, beam, ribbon, terrainAt, detailBand,
  grid, streetY, waterY, timesBounds, existingStreets, lettering, pavementText, isClear=()=>true
}) {
  const asphalt=[.25,.28,.30],sidewalk=[.53,.54,.51],granite=[.59,.58,.54],
    paint=[.85,.86,.81],yellow=[.83,.73,.45],iron=[.26,.30,.32],
    gutter=[.17,.19,.21],patch=[.22,.25,.27],steel=[.45,.48,.49],
    leaf=[.22,.42,.31],hydrant=[.72,.18,.13],signalYellow=[.86,.69,.24];
  const roadY=streetY+.086,markY=streetY+.117,paveY=streetY+.154;
  const stats={avenues:0,streets:0,intersections:0,signals:0,
    crosswalks:0,hotDogCarts:0,streetFixtures:0,civilianCars:0,brooklynStreetFurniture:0,
    skippedWater:0,skippedLOD:0,skippedPark:0,streetFurniture:0,
    busShelters:0,bikeRacks:0,wayfinding:0,treePits:0,streetlamps:0,
    accessibleCorners:0,skippedBuildings:0,skippedRoadFootprints:0,
    preservedRoadSections:0,
    bikeLaneSegments:0,busLaneSegments:0,bikeSymbols:0,
    intersectionHatching:0,streetNamePlates:0,sidewalkJoints:0};
  const hash=(x,z,k=0)=>{
    let n=Math.imul(Math.floor(x),374761393)^Math.imul(Math.floor(z),668265263)^
      Math.imul(k+1,1442695041);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967295;
  };
  const avenueX=(i,z)=>i*grid.blockWidth+grid.tilt*z+grid.offset;
  const point=(x,z,y=roadY)=>[x,y,z];
  const slab=(a,b,width,col,y=roadY)=>ribbon(point(a[0],a[1],y),
    point(b[0],b[1],y),width,col);
  const shift=(a,b,d)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
    return [[a[0]+dz/l*d,a[1]-dx/l*d],[b[0]+dz/l*d,b[1]-dx/l*d]];
  };
  const inTimes=(x,z)=>{
    const [l,r,s,n]=timesBounds;
    return x>l-9&&x<r+9&&z>s-8&&z<n+8;
  };
  function permitted(x,z){
    // Never paint a city grid through the park. Transverse drives are built
    // by central-park.js instead, with paths aligned to the park itself.
    const u=x-grid.tilt*z-grid.offset;
    if(Math.abs(u)<grid.parkHalfWidth+1.7 &&
       Math.abs(z-grid.parkCenter)<grid.parkHalfLength+1.7){
      stats.skippedPark++;return false;
    }
    if(inTimes(x,z)||detailBand(x,z)<2){stats.skippedLOD++;return false;}
    if(terrainAt(x,z)<waterY+1.55){stats.skippedWater++;return false;}
    return true;
  }
  function nearOld(x,z,clearance=5.8){
    for(const path of existingStreets)for(let k=1;k<path.length;k++){
      const a=path[k-1],b=path[k],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,
        ((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
      if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<clearance)return true;
    }
    return false;
  }
  function siteClear(x,z,radius=.5){
    if(!Number.isFinite(x)||!Number.isFinite(z)||
       !Number.isFinite(radius)||radius<0)return false;
    // Sidewalk kiosks, shelters and food carts occupy an AREA, not a point.
    // Sample their entire dry-ground bounding square so coastal fixtures
    // cannot stand on a dry center with corners hanging into the harbor.
    // Larger furniture gets half-step samples to catch narrow inlets.
    const offsets=radius>1.5?[-1,-.5,0,.5,1]:[-1,0,1];
    for(const u of offsets)for(const v of offsets){
      if(terrainAt(x+u*radius,z+v*radius)<waterY+1.58){
        stats.skippedWater++;return false;
      }
    }
    if(!isClear(x,z,radius)){stats.skippedBuildings++;return false;}
    return true;
  }
  function streetFurniture(a,b,kind,i,j,width){
    // NYC DOT furniture strip: grouped by block, not repeated at every lamp.
    // Keep a clear inner walking zone and never populate a building footprint.
    // Bridgehead roads are LOD2 at their featured camera, whereas Manhattan
    // tourist streets normally reach LOD3. Reserve a small independent 22-piece
    // budget so the Manhattan draw order cannot starve Brooklyn of fixtures.
    const bridgehead=i>=9&&i<=20&&j>=-13&&j<=-7;
    const usedHere=bridgehead?stats.brooklynStreetFurniture:
      stats.streetFurniture-stats.brooklynStreetFurniture;
    const capHere=bridgehead?22:82;
    if(usedHere>=capHere ||
       detailBand((a[0]+b[0])/2,(a[1]+b[1])/2)<(bridgehead?2:3))
      return;
    const chance=hash(i,j,49);
    if(chance<.76)return;
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<13)return;
    const side=hash(i,j,58)<.5?-1:1;
    const mid=[a[0]*.54+b[0]*.46,a[1]*.54+b[1]*.46];
    const normal=[dz/length,-dx/length],along=[dx/length,dz/length];
    const d=width*.5+1.18;
    const x=mid[0]+normal[0]*side*d,z=mid[1]+normal[1]*side*d;
    if(!siteClear(x,z,2.35))return;
    const base=streetY+.18,frame=[.27,.31,.34],
      aluminum=[.62,.67,.69],glass=[.19,.33,.40],
      green=[.18,.38,.30],navy=[.12,.23,.42];
    // Vary furniture types by parcel: glass shelter, WalkNYC, bike rack,
    // paved tree pit, or black lamp post. Max one item per selected block.
    const variant=Math.floor(hash(i,j,50)*5);
    const at=(sideways,forward,y)=>[
      x+normal[0]*sideways+along[0]*forward,y,
      z+normal[1]*sideways+along[1]*forward];
    const bar=(u,v,r,color)=>beam(u,v,r,color);
    if(variant===0 && stats.busShelters<12+(bridgehead?6:0)){
      // Narrow JCDecaux-style transparent shelter on a local sidewalk bulb-out,
      // not an actual mapped MTA stop or franchised ad placement.
      if(!siteClear(x+along[0]*.78,z+along[1]*.78,1.04))return;
      const bottom=base+.06,roof=base+2.80;
      const col=[.35,.40,.44];
      box(x,bottom-.035,z,1.65,.08,3.30,[.49,.51,.49]);
      for(const side2 of [-1,1]){
        bar(at(-.57,side2*1.18,bottom),
          at(-.57,side2*1.18,roof),.055,col);
        bar(at(.57,side2*1.18,bottom),
          at(.57,side2*1.18,roof),.055,col);
        bar(at(-.57,side2*1.18,roof),
          at(.57,side2*1.18,roof),.065,aluminum);
      }
      // Transparent tempered glazing plus dark protective kickplate.
      for(const side2 of [-1,1]){
        const q=side2*1.18;
        addQuad(at(-.56,q,bottom+.34),at(.56,q,bottom+.34),
          at(.56,q,roof-.16),at(-.56,q,roof-.16),glass,5);
      }
      box(x,roof+.06,z,1.59,.17,2.93,col);
      box(x,roof+.19,z,.58,.09,2.25,aluminum);
      const stop=at(-.67,.76,base+1.57);
      box(stop[0],stop[1],stop[2],.04,1.92,.76,navy);
      box(stop[0],stop[1]+.60,stop[2],.052,.45,.72,[.85,.86,.81]);
      if(lettering)lettering('BUS',at(-.70,.74,base+2.08),
        .64,.19,[.93,.94,.91]);
      stats.busShelters++;
    }else if(variant===1 && stats.bikeRacks<26+(bridgehead?6:0)){
      // Three steel NYC CityRack-like hoops, spaced along the sidewalk.
      for(let k=-1;k<=1;k++){
        const forward=k*.63;
        const bottomA=at(-.28,forward,base),bottomB=at(.28,forward,base);
        const highA=at(-.28,forward,base+.91),
          highB=at(.28,forward,base+.91);
        bar(bottomA,highA,.042,aluminum);
        bar(highA,highB,.045,aluminum);
        bar(highB,bottomB,.042,aluminum);
        const anchor=at(0,forward,base-.01);
        box(anchor[0],anchor[1],anchor[2],.44,.065,.085,frame);
      }
      stats.bikeRacks++;
    }else if(variant===2 && stats.wayfinding<17+(bridgehead?6:0)){
      // Slim WalkNYC-style walking map kiosk. Original simulated diagram.
      box(x,base+1.26,z,.19,2.49,.78,frame);
      for(const way of [-1,1]){
        const p=at(way*.11,0,base+1.50);
        box(p[0],p[1],p[2],.07,1.39,.68,[.73,.76,.75]);
        const panel=at(way*.15,0,base+1.41);
        box(panel[0],panel[1],panel[2],.03,.93,.50,
          [way<0?.28:.19,.50,.54]);
      }
      const cap=at(0,0,base+2.55);
      box(cap[0],cap[1],cap[2],.33,.13,.91,navy);
      stats.wayfinding++;
    }else if(variant===3 && stats.treePits<26+(bridgehead?6:0)){
      // Granite tree bed with non-cartoon separated branches and leaf clusters.
      box(x,base-.05,z,1.42,.08,1.28,[.55,.55,.51]);
      for(const turn of [-1,1]){
        box(x+turn*.48,base-.008,z,.055,.023,1.20,frame);
        box(x,base-.008,z+turn*.41,1.28,.023,.044,frame);
      }
      bar(at(0,0,base),at(.06,.03,base+3.45),.11,[.31,.29,.25]);
      for(let k=0;k<7;k++){
        const angle=k*2.399963,dist=.60+(k%3)*.18;
        const leafPoint=at(Math.cos(angle)*dist,Math.sin(angle)*dist,
          base+3.36+(k%3)*.19);
        bar(at(0,0,base+2.56),leafPoint,.038,[.34,.32,.25]);
        // Multiple smaller angled leaf clusters avoid a single green cube.
        for(let j=0;j<3;j++){
          const a=angle+j*2.10;
          const t=at(Math.cos(angle)*dist+Math.cos(a)*.18,
            Math.sin(angle)*dist+Math.sin(a)*.16,leafPoint[1]-.13+j*.09);
          const c=j===0?[.24,.42,.29]:j===1?[.32,.46,.31]:[.19,.37,.27];
          addQuad([t[0]-.20,t[1]-.09,t[2]-.10],
            [t[0]+.19,t[1]-.11,t[2]+.05],
            [t[0]+.12,t[1]+.23,t[2]+.17],
            [t[0]-.16,t[1]+.17,t[2]-.14],c);
        }
      }
      stats.treePits++;
    }else if(variant===4 && stats.streetlamps<25+(bridgehead?6:0)){
      // Tapered NYC-style streetlight with cantilever and compact luminaire.
      bar(at(0,0,base),at(0,0,base+5.5),.088,frame);
      bar(at(0,0,base+5.32),at(-.62,.64,base+5.49),.074,frame);
      const p=at(-.62,.64,base+5.49);
      box(p[0],p[1],p[2],.37,.11,.48,[.63,.66,.62]);
      box(p[0],p[1]-.07,p[2],.25,.03,.36,[.89,.85,.70]);
      stats.streetlamps++;
    }else return;
    stats.streetFurniture++;
    if(bridgehead)stats.brooklynStreetFurniture++;
  }
  // PATROL_NYC_ROAD_MARKINGS_V12 — orient road paint to the slanted avenue
  // tangent instead of placing axis-aligned white rectangles.
  function orientedRect(x,z,w,length,tangent,color,y=markY){
    const mag=Math.hypot(tangent[0],tangent[1])||1;
    const f=[tangent[0]/mag,tangent[1]/mag],n=[f[1],-f[0]];
    const at=(u,v)=>[x+n[0]*u+f[0]*v,y,z+n[1]*u+f[1]*v];
    // Upward +Y normals are essential for the existing NYC photo/PBR
    // shader. The previous clockwise XZ winding faced downward.
    addQuad(at(-w*.5,-length*.5),at(-w*.5,length*.5),
      at(w*.5,length*.5),at(w*.5,-length*.5),color);
  }
  const mag=Math.hypot(grid.tilt,1);
  const ave=[grid.tilt/mag,1/mag],cross=[ave[1],-ave[0]];
  function bikeIcon(x,z,side){
    // Small white bike lane stencil, visible from aircraft and street level.
    const pos=(u,v)=>[x+cross[0]*(side*2.45+u)+ave[0]*v,
      markY+.028,z+cross[1]*(side*2.45+u)+ave[1]*v];
    for(const dv of [-.40,.43])for(let k=0;k<10;k++){
      const a=k*2*Math.PI/10,b=(k+1)*2*Math.PI/10,r=.20;
      ribbon(pos(Math.sin(a)*r,dv+Math.cos(a)*r),
        pos(Math.sin(b)*r,dv+Math.cos(b)*r),.052,[.84,.86,.81]);
    }
    for(const [a,b] of [[[0,-.40],[.15,0]],[[.15,0],[0,.43]],[[0,.43],[0,-.40]]])
      ribbon(pos(...a),pos(...b),.046,[.87,.87,.83]);
    stats.bikeSymbols++;
  }
  function rect(x,z,w,d,color,y=roadY){
    addQuad([x-w/2,y,z-d/2],[x-w/2,y,z+d/2],
      [x+w/2,y,z+d/2],[x+w/2,y,z-d/2],color);
  }
  // Test the *full* asphalt + sidewalk corridor against the buildings, not
  // only the center of a road segment. Previous center-only furniture checks
  // allowed a curb and half a road to pass directly through a wall.
  function roadCorridorClear(a,b,width){
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<1e-6)return false;
    const nx=-dz/length,nz=dx/length;
    const margin=width*.5+1.32;
    const steps=Math.max(1,Math.ceil(length/1.8));
    for(let step=0;step<=steps;step++){
      const t=step/steps,x=a[0]+dx*t,z=a[1]+dz*t;
      for(const across of [-1,-.73,-.39,0,.39,.73,1]){
        const sx=x+nx*margin*across,sz=z+nz*margin*across;
        // Both the road center and sidewalk edge must remain on land.
        // Endpoint/midpoint-only water tests miss narrow shoreline inlets.
        if(terrainAt(sx,sz)<waterY+1.58)return false;
        // A footprint lookup is cheap via the game's spatial lot index.
        // A conservative .95-unit square probe closes gaps between samples.
        if(!isClear(sx,sz,.95))return false;
      }
    }
    return true;
  }
  // An intersection exists only if painted asphalt actually reaches the node.
  // Clipped remote portions must not count as connected streets.
  const connectedStreetNodes=new Set();
  function streetSegment(a,b,kind,i,j,allowClip=true){
    const mid=[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
    if(!permitted(...mid)||!permitted(...a)||!permitted(...b)||
      nearOld(...mid,7.8))return false;
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(distance<4)return false;
    const width=kind==='avenue'?6.35:5.65,half=width/2;
    if(!roadCorridorClear(a,b,width)){
      stats.skippedRoadFootprints++;
      if(!allowClip)return false;
      // Preserve individually safe stretches without letting a road ribbon
      // or sidewalk pass through an occupied building footprint.
      const steps=Math.ceil(distance/1.2),lerp=t=>[
        a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t
      ];
      let start=-1,rendered=false;
      const flush=end=>{
        if(start<0)return;
        // Conservative clear approach on BOTH sides of occupied parcels.
        // Keep the last 3 sample cells unpainted before rejoining a wall;
        // a ~3.6-unit buffer also leaves room for a sidewalk apron.
        const edgeMargin=3;
        const first=start+(start>0?edgeMargin:0);
        const last=end-(end<steps?edgeMargin:0);
        if(last<=first){start=-1;return;}
        const p=lerp(first/steps),q=lerp(last/steps);
        if(Math.hypot(q[0]-p[0],q[1]-p[1])>=4 &&
           streetSegment(p,q,kind,i,j,false)){
          stats.preservedRoadSections++;
          rendered=true;
        }
        start=-1;
      };
      for(let n=0;n<steps;n++){
        const safe=roadCorridorClear(lerp(n/steps),lerp((n+1)/steps),width);
        if(safe&&start<0)start=n;
        if(!safe)flush(n);
      }
      flush(steps);
      return rendered;
    }
    const dx=b[0]-a[0],dz=b[1]-a[1],
      normal=[dz/distance,-dx/distance];
    slab(a,b,width,asphalt);
    // Only selected game corridors receive red bus and green bike lanes;
    // these are DOT-inspired, NOT an inventory of actual Manhattan routes.
    const greenBike=kind==='avenue' && (i===1||i===-3) &&
      mid[1]>-390 && mid[1]<135;
    const redBus=kind==='avenue' && (i===-1||i===3) &&
      mid[1]>-270 && mid[1]<145;
    if(greenBike){
      const side=1,lane=shift(a,b,side*(half-.67));
      slab(lane[0],lane[1],1.15,[.13,.33,.28],roadY+.015);
      const separator=shift(a,b,side*(half-1.30));
      slab(separator[0],separator[1],.066,paint,markY+.008);
      if(j%3===0 && distance>16)bikeIcon(mid[0],mid[1],side);
      stats.bikeLaneSegments++;
    }
    if(redBus){
      const side=-1,lane=shift(a,b,side*(half-1.05));
      slab(lane[0],lane[1],1.65,[.49,.17,.16],roadY+.016);
      const separator=shift(a,b,side*(half-2.00));
      slab(separator[0],separator[1],.076,paint,markY+.008);
      if(pavementText && j%4===0 && stats.busLaneSegments<14){
        const p=[mid[0]+cross[0]*side*(half-.96),markY+.026,
          mid[1]+cross[1]*side*(half-.96)];
        pavementText('BUS',p,1.28,.54,paint);
      }
      stats.busLaneSegments++;
    }
    // Independent stone sidewalks, raised curb faces and drainage channels.
    // They sit OUTSIDE the asphalt: no two large overlapping quads.
    for(const side of [-1,1]){
      const p=shift(a,b,side*(half+.53));
      // Wider concrete frontage leaves space for a furnishings strip.
      slab(p[0],p[1],1.42,sidewalk,paveY);
      const c=shift(a,b,side*(half+.035));
      slab(c[0],c[1],.22,granite,roadY+.127);
      const g=shift(a,b,side*(half-.18));
      slab(g[0],g[1],.115,gutter,markY);
      addQuad(point(c[0][0],c[0][1],roadY),
        point(c[1][0],c[1][1],roadY),
        point(c[1][0],c[1][1],roadY+.128),
        point(c[0][0],c[0][1],roadY+.128),granite);
      // Concrete saw-cut lines break the unrealistic uninterrupted sidewalk.
      if(detailBand(...mid)>=3 && hash(i,j,71)>.39){
        for(let along=6.2;along<distance-1.5;along+=8.9){
          const t=along/distance,x=a[0]+dx*t,z=a[1]+dz*t,
            offs=side*(half+.53);
          orientedRect(x+normal[0]*offs,z+normal[1]*offs,1.34,.025,
            [dx,dz],[.39,.40,.38],paveY+.004);
          stats.sidewalkJoints++;
        }
      }
    }
    const lines=kind==='avenue'?2:1;
    for(let along=4;along<distance-1.5;along+=7.4){
      const t=along/distance,u=Math.min(1,(along+2.6)/distance);
      const p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],
        q=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
      slab(p,q,.105,lines===2?yellow:paint,markY);
      if(lines===2){
        const off=shift(p,q,.20);
        slab(off[0],off[1],.065,yellow,markY);
      }
    }
    if(hash(i,j,9)>.65){
      const c=[a[0]*.64+b[0]*.36,a[1]*.64+b[1]*.36],
        d=[a[0]*.42+b[0]*.58,a[1]*.42+b[1]*.58];
      const p=shift(c,d,(hash(i,j,7)-.5)*2.2);
      slab(p[0],p[1],.46,patch,roadY+.007);
    }
    const center=[a[0]*.65+b[0]*.35,a[1]*.65+b[1]*.35];
    if(hash(i,j,12)>.68 && !nearOld(...center,13)){
      const a1=shift(center,[center[0]+.01,center[1]+1],half-.30)[0];
      // Flush, dark drainage grate, with ribs rather than a flat metal patch.
      rect(a1[0],a1[1],.51,.38,iron,markY);
      for(let k=-2;k<=2;k++)rect(a1[0]+k*.073,a1[1],.019,.30,steel,markY+.006);
      stats.streetFixtures++;
    }
    if(kind==='avenue')stats.avenues++;else stats.streets++;
    const startNode=[avenueX(i,j*grid.blockLength),j*grid.blockLength];
    const endNode=kind==='avenue'
      ?[avenueX(i,(j+1)*grid.blockLength),(j+1)*grid.blockLength]
      :[avenueX(i+1,j*grid.blockLength),j*grid.blockLength];
    const closeTo=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<1.35;
    if(closeTo(a,startNode))connectedStreetNodes.add(
      (kind==='avenue'?'a':'s')+i+':'+j);
    if(closeTo(b,endNode))connectedStreetNodes.add(
      (kind==='avenue'?'a':'s')+(kind==='avenue'?i:i+1)+':'+
      (kind==='avenue'?j+1:j));
    streetFurniture(a,b,kind,i,j,width);
    return true;
  }
  // Unified surface-road generation. Positions align with the EXISTING
  // Manhattan building parcel basis (24 x 33 compressed game units).
  const segmentMap=new Set();
  for(let i=-10;i<=8;i++)for(let j=-17;j<=12;j++){
    const a=[avenueX(i,j*grid.blockLength),j*grid.blockLength],
      b=[avenueX(i,(j+1)*grid.blockLength),(j+1)*grid.blockLength],
      key='a'+i+':'+j;
    if(segmentMap.has(key))continue;
    segmentMap.add(key);
    streetSegment(a,b,'avenue',i,j);
  }
  for(let j=-16;j<=12;j++)for(let i=-10;i<=7;i++){
    const z=j*grid.blockLength;
    streetSegment([avenueX(i,z),z],[avenueX(i+1,z),z],'street',i,j);
  }
  // PATROL_BROOKLYN_BRIDGE_STREET_INFILL: compact bridgehead neighborhood.
  // Streets use the SAME road/sidewalk clearances and game-space 24x33 lot
  // grid as adjacent buildings. This is not a surveyed Brooklyn street plan.
  // Keep the extra draw work within a small Brooklyn/DUMBO viewport.
  for(let i=9;i<=20;i++)for(let j=-13;j<=-7;j++){
    const a=[avenueX(i,j*grid.blockLength),j*grid.blockLength],
      b=[avenueX(i,(j+1)*grid.blockLength),(j+1)*grid.blockLength];
    streetSegment(a,b,'avenue',i,j);
  }
  for(let j=-12;j<=-7;j++)for(let i=9;i<=19;i++){
    const z=j*grid.blockLength;
    streetSegment([avenueX(i,z),z],[avenueX(i+1,z),z],'street',i,j);
  }
  function signal(x,z,phase=0,i=0,j=0){
    const base=streetY+.16;
    // NYC yellow traffic signal heads and dark pedestrian walk/countdown box.
    box(x,base+2.52,z,.115,5.04,.115,iron);
    box(x,base+4.08,z,.20,.14,.20,iron);
    beam([x,base+3.93,z],[x-.96,base+3.93,z],.075,steel);
    box(x-.96,base+3.59,z,.36,.84,.35,signalYellow);
    box(x-.96,base+3.59,z+.194,.265,.75,.045,iron);
    const lights=[[.26,[.72,.12,.11]],[.0,[.67,.50,.12]],[-.26,[.15,.60,.28]]];
    for(let k=0;k<lights.length;k++){
      const [delta,active]=lights[k];
      const bright=k===(phase%3);
      const rgb=bright?active:active.map(v=>v*.26);
      const px=x-.96,py=base+3.59+delta,pz=z+.226;
      // Octagonal glass/lens geometry reads round rather than a square box
      // at close camera distances; inner light and metallic edge are separate.
      for(let segment=0;segment<10;segment++){
        const a=segment*Math.PI/5,b=(segment+1)*Math.PI/5;
        const ring=(ang,r,zLift)=>[px+Math.cos(ang)*r,
          py+Math.sin(ang)*r,pz+zLift];
        addQuad(ring(a,.108,-.019),ring(b,.108,-.019),
          ring(b,.080,.001),ring(a,.080,.001),[.13,.15,.17]);
        addQuad(ring(a,.078,.002),ring(b,.078,.002),
          ring(b,.024,.004),ring(a,.024,.004),rgb);
      }
      box(x-.96,base+3.59+delta,z+.184,.25,.04,.12,iron);
    }
    box(x,base+2.48,z+.13,.37,.58,.26,iron);
    box(x,base+2.53,z+.278,.25,.40,.028,
      phase%2===0?[.82,.49,.22]:[.15,.60,.47]);
    box(x,base+.56,z,.18,1.13,.18,steel);
    // NYC DOT green street-name blades and ONE WAY wayfinding; labels are
    // simulated in the compressed game grid, not official surveyed signs.
    if(lettering && stats.streetNamePlates<88 && (i+j)%2===0){
      const named=j===-1?'W 42 ST':j===0?'W 44 ST':
        j===1?'W 46 ST':j===2?'W 48 ST':'ONE WAY';
      box(x,base+4.65,z+.025,1.62,.32,.12,[.055,.31,.22]);
      box(x,base+4.65,z+.093,1.46,.245,.022,[.09,.41,.31]);
      lettering(named,[x,base+4.65,z+.111],1.34,.19,[.90,.94,.88]);
      stats.streetNamePlates++;
    }
    stats.signals++;
  }
  function crosswalk(x,z,i,j){
    const s=grid.blockWidth;
    // Opposing ladder crosswalks plus recessed stop bars.
    for(const side of [-1,1]){
      // Avenue crosses this junction on a slight diagonal. All ladder bars
      // and stop bars follow that road bearing, avoiding the previous
      // axis-aligned, visibly pasted-on road markings.
      const c=[x+ave[0]*side*3.75,z+ave[1]*side*3.75];
      for(let k=-3;k<=3;k++){
        orientedRect(c[0]+cross[0]*k*.77,
          c[1]+cross[1]*k*.77,.47,1.30,ave,paint,markY+.006);
        stats.crosswalks++;
      }
      orientedRect(x+ave[0]*side*5,z+ave[1]*side*5,
        s*.32,.10,ave,paint,markY+.004);
      // Second pedestrian crossing, across the numbered east-west side street
      // where the narrow side-road corridor is present.
      if(detailBand(x,z)>=3 && hash(i,j,31)>.30){
        for(let k=-3;k<=3;k++){
          orientedRect(x+side*4.20,z+k*.73,
            .46,1.21,[1,0],paint,markY+.009);
          stats.crosswalks++;
        }
      }
    }
    // Rare edge hatching and corner protection, not repeated at every block.
    if(hash(i,j,72)>.77){
      for(const side of [-1,1])for(let k=0;k<3;k++){
        orientedRect(x+side*(4.80+k*.39),z+side*4.92,
          .085,1.0,[.64,side*.76],paint,markY+.009);
        stats.intersectionHatching++;
      }
    }
    // Sewer chamber and slab-joint at the crosswalk nose.
    if((i+j)%3===0){
      const xx=x+4.33,zz=z+4.38;
      rect(xx,zz,.72,.50,iron,markY+.007);
      for(let k=-2;k<=2;k++)
        rect(xx+k*.115,zz,.034,.41,steel,markY+.010);
    }
    const cornerX=x+4.48,cornerZ=z+4.55;
    if(hash(i,j,3)>.40 && siteClear(cornerX,cornerZ,.30)){
      // Alternating red and green visual state, rather than random yellow
      // at most corners. Still static, not a vehicle control simulation.
      signal(cornerX,cornerZ,(Math.abs(i+j)%2)?2:0,i,j);
      stats.intersections++;
    }
    // Pedestrian tactile curb ramp pads; restricted to featured intersections.
    if(stats.accessibleCorners<65 && detailBand(x,z)>=3 &&
      hash(i,j,62)>.71 && siteClear(x-4.2,z+3.9,.35)){
      const px=x-4.20,pz=z+3.92;
      rect(px,pz,1.15,.84,[.67,.65,.54],paveY+.012);
      for(let row=-2;row<=2;row++)for(let col=-3;col<=3;col++)
        rect(px+col*.145,pz+row*.13,.037,.036,
          [.46,.44,.34],paveY+.027);
      stats.accessibleCorners++;
    }
    // A curb-side NYC red hydrant and street waste bin, with restrained count.
    if(hash(i,j,4)>.71 && siteClear(x-4.20,z-4.56,.36)){
      box(x-4.20,streetY+.48,z-4.56,.23,.75,.24,hydrant);
      box(x-4.2,streetY+.83,z-4.56,.35,.14,.36,hydrant);
      if(siteClear(x+4.35,z-4.65,.46)){
        box(x+4.35,streetY+.41,z-4.65,.53,.61,.47,iron);
        box(x+4.35,streetY+.75,z-4.65,.61,.08,.55,steel);
      }
      stats.streetFixtures+=2;
    }
  }
  // Apply the same full-footprint intersection clearance in both Manhattan
  // and Brooklyn/DUMBO. Previously Brooklyn roads were drawn without any
  // crossings or signals because the intersection loop stopped at avenue 8.
  const intersectionDistricts=[
    {minI:-10,maxI:8,minJ:-16,maxJ:9},
    {minI:9,maxI:20,minJ:-12,maxJ:-7}
  ];
  for(const district of intersectionDistricts)
  for(let j=district.minJ;j<=district.maxJ;j++)
  for(let i=district.minI;i<=district.maxI;i++){
    const z=j*grid.blockLength,x=avenueX(i,z);
    // Extra conservative building/bridge and Times Square safety margin.
    if(!permitted(x,z)||nearOld(x,z,11.2)||
      !permitted(x-4,z-4)||!permitted(x+4,z+4))continue;
    // An intersection cannot have painted zebra stripes unless both the
    // approaching avenue AND cross street survived full-footprint clearance.
    const hasAvenue=connectedStreetNodes.has('a'+i+':'+j);
    const hasStreet=connectedStreetNodes.has('s'+i+':'+j);
    if(!hasAvenue||!hasStreet)continue;
    // Crossings are drawn independently of road strips, so they must also
    // reserve the full intersection box. Otherwise zebra paint and yellow
    // signal supports could still be rendered inside a corner building.
    let freeIntersection=true,wetIntersection=false;
    // The zebra ladder and signal supports extend beyond the old 5-unit
    // center grid. Inspect the entire corner envelope for shallow water
    // and collision geometry before creating crossing paint.
    for(const dx of [-7.5,-5,-2.5,0,2.5,5,7.5]){
      for(const dz of [-7.5,-5,-2.5,0,2.5,5,7.5]){
        const sx=x+dx,sz=z+dz;
        if(terrainAt(sx,sz)<waterY+1.58){
          freeIntersection=false;wetIntersection=true;break;
        }
        if(!isClear(sx,sz,.45)){freeIntersection=false;break;}
      }
      if(!freeIntersection)break;
    }
    if(!freeIntersection){
      if(wetIntersection)stats.skippedWater++;
      else stats.skippedRoadFootprints++;
      continue;
    }
    crosswalk(x,z,i,j);
  }
  // Hot-dog sidewalk cart — visibly stainless steel with under-counter
  // storage, 10-sided umbrella, menu, condiment bottles and a small wheelbase.
  // Original generic text; no food-cart brand names or artwork reproduced.
  function hotDogCart(x,z,variant=0){
    const y=streetY+.18, blue=[.12,.31,.65],gold=[.96,.77,.17],
      stainless=[.67,.71,.72],dark=[.20,.24,.26],bread=[.75,.48,.26];
    // Slightly elevated paving / curb plaza, never in an existing car lane.
    box(x,y-.05,z,3.45,.09,2.70,sidewalk);
    box(x,y+.87,z,2.48,1.54,1.41,stainless);
    box(x,y+1.58,z,2.65,.15,1.55,[.82,.83,.79]);
    box(x,y+.86,z+.735,2.44,1.36,.055,blue);
    box(x,y+.86,z-.735,2.44,1.36,.055,gold);
    for(const side of [-1,1])for(const zz of [-.52,.52]){
      const cx=x+side*1.03,cz=z+zz;
      for(let k=0;k<10;k++){
        const a=k*Math.PI/5,b=(k+1)*Math.PI/5;
        // Polygonal rubber wheels with lighter circular wheel hubs.
        const A=[cx,.25+y+Math.sin(a)*.26,cz+Math.cos(a)*.26],
          B=[cx,.25+y+Math.sin(b)*.26,cz+Math.cos(b)*.26];
        addQuad(A,B,[cx+side*.11,B[1],B[2]],
          [cx+side*.11,A[1],A[2]],dark);
      }
      box(cx+side*.11,y+.25,cz,.055,.20,.20,steel);
    }
    box(x,y+2.42,z,.085,1.82,.082,steel);
    const canopyTop=[x,y+3.57,z],N=10,rad=2.05;
    const rim=a=>[x+Math.cos(a)*rad,y+3.06,z+Math.sin(a)*rad*.76];
    for(let k=0;k<N;k++){
      const a=2*Math.PI*k/N,b=2*Math.PI*(k+1)/N;
      addTri(rim(a),rim(b),canopyTop,
        (k+variant)%2===0?blue:gold);
      beam(rim(a),canopyTop,.027,steel);
    }
    // Refrigerator vents, steel drawers and steaming hot-dog roller.
    for(let k=-2;k<=2;k++)box(x+k*.40,y+.93,z+.77,.21,.07,.04,dark);
    box(x,y+1.72,z-.25,1.18,.14,.72,dark);
    for(let k=-2;k<=2;k++)
      box(x+k*.215,y+1.84,z-.24,.14,.09,.55,bread);
    for(const [k,col] of [[-1,[.90,.15,.12]],[0,[.88,.76,.18]],[1,[.87,.88,.74]]])
      box(x+k*.32,y+1.93,z+.32,.13,.40,.14,col);
    box(x-.85,y+1.74,z-.28,.46,.39,.30,stainless);
    box(x-.85,y+1.93,z-.28,.51,.04,.34,gold);
    if(lettering){
      lettering('HOT DOGS',[x-.88,y+1.02,z+.77],1.77,.28,[.97,.94,.83]);
      lettering('PRETZELS',[x-.95,y+.68,z+.77],1.87,.21,[.98,.92,.69]);
    }
    stats.hotDogCarts++;
  }
  // Two tourist-vendor stands within the dedicated, wide Times Square
  // pedestrian plaza; no guesswork on actual permit/vendor coordinates.
  // Times Square vendors only stand on exposed, dry pedestrian paving.
  for(const [x,z,v] of [[-4.4,9.1,0],[-4.2,24.0,1]]){
    if(siteClear(x,z,2.35))hotDogCart(x,z,v);
  }
  // Downtown commercial corridor: two hand-placed pedestrian corners,
  // skipping any place that is flooded or inside the building heightfield.
  for(const [x,z,k] of [[-58,-345,2],[-33,-390,3],[-14,-314,4]]){
    if(detailBand(x,z)>=2 && siteClear(x,z,2.35) && !nearOld(x,z,3.1))
      hotDogCart(x,z,k);
  }
  return stats;
}
