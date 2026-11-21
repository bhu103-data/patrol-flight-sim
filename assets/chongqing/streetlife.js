// PATROL Chongqing: compact animated street layer.
// Original geometry only: yellow taxis, civilian cars, asphalt markings and streetlights.
// Yellow center-city taxis and checker waistlines match the city's official road transport guide.
export function buildChongqingStreetlife({THREE,scene,ground,riverCenter,isRoadClear=()=>true}) {
  const unit=new THREE.BoxGeometry(1,1,1);
  const temp=new THREE.Object3D();
  const white=new THREE.MeshBasicMaterial({color:0xe8dfc9,side:THREE.DoubleSide});
  const amber=new THREE.MeshBasicMaterial({color:0xffc77f});
  const pale=new THREE.MeshBasicMaterial({color:0xe4e7d8});
  const red=new THREE.MeshBasicMaterial({color:0xa92a21});
  const dark=new THREE.MeshStandardMaterial({color:0x181e23,metalness:.12,roughness:.82});
  const frame=new THREE.MeshStandardMaterial({color:0x777f83,metalness:.62,roughness:.41});
  const glass=new THREE.MeshPhysicalMaterial({
    color:0x435e6e,metalness:.48,roughness:.18,clearcoat:.52,
    clearcoatRoughness:.15,emissive:0x102631,emissiveIntensity:.26,
    side:THREE.DoubleSide
  });
  function pool(geo,mat,cap){
    const m=new THREE.InstancedMesh(geo,mat,cap);
    m.count=0;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage??THREE.StaticDrawUsage);
    m.frustumCulled=false;scene.add(m);return m;
  }
  // A gently chamfered car silhouette. Body geometry has 3D hood, glazing cap,
  // rear deck, curved window edges and proper wheel arches instead of a single cube.
  function vehicleBody(){
    const sections=[
      [-3.05,.52,.97,1.04,.83],[-2.78,.50,1.11,1.08,.87],
      [-1.54,.54,1.24,1.07,.88],[-.92,.54,1.82,.99,.82],
      [-.43,.55,2.09,.93,.74],[1.16,.54,2.08,.93,.75],
      [1.88,.56,1.39,1.03,.87],[2.92,.55,1.18,1.07,.90],
      [3.06,.63,1.04,.99,.83]
    ];
    const verts=[],uvs=[],indices=[],n=6;
    for(let i=0;i<sections.length;i++){
      const [x,lo,hi,width,topWidth]=sections[i];
      const outline=[
        [lo,-width],[hi-.26,-width],[hi,-topWidth],
        [hi,topWidth],[hi-.26,width],[lo,width]
      ];
      for(let j=0;j<n;j++){
        const [y,z]=outline[j];
        verts.push(x,y,z);uvs.push(i/(sections.length-1),j/n);
      }
    }
    for(let i=0;i<sections.length-1;i++)for(let j=0;j<n;j++){
      const a=i*n+j,b=i*n+(j+1)%n,c=(i+1)*n+j,d=(i+1)*n+(j+1)%n;
      indices.push(a,c,b,b,c,d);
    }
    for(let j=1;j<n-1;j++){
      indices.push(0,j,j+1);
      const end=(sections.length-1)*n;
      indices.push(end,end+j+1,end+j);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    g.setIndex(indices);g.computeVertexNormals();
    return g;
  }
  function glassGeom(){
    // Side panels, canted windshield and rear windscreen.
    const quads=[
      [[-.90,1.40,-1.09],[-.42,2.08,-.76],[.92,2.08,-.76],[1.73,1.41,-1.04]],
      [[1.73,1.41,1.04],[.92,2.08,.76],[-.42,2.08,.76],[-.90,1.40,1.09]],
      [[-.94,1.41,-1.03],[-.94,1.41,1.03],[-.43,2.10,.75],[-.43,2.10,-.75]],
      [[1.10,2.09,-.75],[1.10,2.09,.75],[1.84,1.40,1.03],[1.84,1.40,-1.03]]
    ];
    const pos=[],uv=[],indices=[];
    for(const q of quads){
      const j=pos.length/3;
      for(let i=0;i<4;i++){pos.push(...q[i]);uv.push(i%2,Math.floor(i/2))}
      indices.push(j,j+1,j+2,j,j+2,j+3);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const bodyMaterial=new THREE.MeshStandardMaterial({
    color:0xffffff,metalness:.34,roughness:.36,vertexColors:false,
    side:THREE.DoubleSide
  });
  const bodies=pool(vehicleBody(),bodyMaterial,12);
  bodies.castShadow=true;
  const windows=pool(glassGeom(),glass,12);
  const tireGeo=new THREE.CylinderGeometry(.52,.52,.32,14,1);
  tireGeo.rotateX(Math.PI/2);
  const hubGeo=new THREE.CylinderGeometry(.27,.27,.35,12,1);
  hubGeo.rotateX(Math.PI/2);
  const tires=pool(tireGeo,dark,48),hubs=pool(hubGeo,frame,48);
  const fronts=pool(unit,pale,24),backs=pool(unit,red,24);
  const checker=pool(unit,dark,72),checkerLight=pool(unit,white,72),taxiSigns=pool(unit,amber,12);
  const sideMirror=pool(unit,frame,24);
  const bumper=pool(unit,dark,24);
  // Recessed grille, plate reflectors and rear marker trims give the cars
  // a readable front/rear silhouette at pedestrian-camera distances.
  const grilles=pool(unit,dark,12);
  const plates=pool(unit,pale,24);
  const rearTrims=pool(unit,red,24);
  const carTypes=[0,1,0,2,0,2,0,1,0,2]; // 0=taxi, 1=dark civilian, 2=white civilian
  const carColors=[0xebd233,0x42556a,0xe7d433,0xdce2db,0xeccf2d,0x8892a0,0xe4c926,0x35516a,0xe9d02b,0xe1e5e6];
  const vehicles=[];
  let taxisPlaced=0;
  for(let i=0;i<carTypes.length;i++){
    const lane=i%2?-.28:.28;
    // Give the signalized upper road traffic in BOTH directions.
    // Previously every tier-1 car on the north bank headed west only.
    const route=i===4?1:i%4;
    vehicles.push({
      id:i,taxi:carTypes[i]===0,taxiIndex:carTypes[i]===0?taxisPlaced++:-1,
      side:route<2?1:-1,tier:route%2,
      dir:lane>0?1:-1,
      lane:lane>0?2.45:-2.45,
      start:-880+(i*177)%1710,
      speed:13+(i*7)%11,
      x:0,y:0,z:0,heading:0
    });
    bodies.setColorAt(i,new THREE.Color(carColors[i]));
  }
  bodies.count=vehicles.length;
  if(bodies.instanceColor)bodies.instanceColor.needsUpdate=true;
  // Public-road guide strips follow the existing procedural routes in chongqing.js.
  function routeZ(x,side,tier){
    return riverCenter(x)+side*(145+tier*105+14*Math.sin(x/115+tier));
  }
  function laneIsClear(v,x){
    for(const dx of [-3.5,0,3.5]){
      const bx=x+dx;
      if(bx<-935||bx>935)return false;
      const center=routeZ(bx,v.side,v.tier);
      const y=ground(bx,center)+1.65;
      // Require the whole asphalt ribbon AND the 6m car to be off footprints.
      if(!isRoadClear(bx,center,y,(13-v.tier*1.5)*.5+.98))return false;
      const laneZ=center+v.lane;
      if(!isRoadClear(bx,laneZ,ground(bx,laneZ)+1.65,3.6))return false;
    }
    return true;
  }
  function positionFor(v,x){
    const z=routeZ(x,v.side,v.tier)+v.lane;
    return {x,z,y:ground(x,z)+1.65};
  }
  function pose(mesh,index,origin,heading,offset,scale,extraRotate){
    const cs=Math.cos(heading),sn=Math.sin(heading);
    temp.position.set(
      origin.x+offset[0]*cs-offset[2]*sn,
      origin.y+offset[1],
      origin.z+offset[0]*sn+offset[2]*cs
    );
    temp.rotation.set(extraRotate??0,-heading,0);
    temp.scale.set(...scale);
    temp.updateMatrix();mesh.setMatrixAt(index,temp.matrix);
  }
  const outlines=pool(unit,white,1000);
  const curbs=pool(unit,frame,880);
  const poles=pool(unit,frame,340);
  const lanterns=pool(unit,amber,160);
  const brightGlints=pool(unit,pale,160);
  // Normalized road edge stripe and small "wet" highlight features. Instanced.
  let markCount=0,curbCount=0,lampCount=0,lanternCount=0,glintCount=0;
  for(let route=0;route<6;route++){
    const side=route<3?1:-1,tier=route%3;
    for(let i=0;i<52;i++){
      const x=-900+i*35.2;
      const z=routeZ(x,side,tier);
      if(z<-640||z>640)continue;
      const y=ground(x,z)+1.78;
      // No paint, curbs or poles on asphalt removed for a building.
      if(![-16,-8,0,8,16].every(dx=>{
        const xx=x+dx,zz=routeZ(xx,side,tier);
        return isRoadClear(xx,zz,ground(xx,zz)+1.78,(13-tier*1.5)*.5+1.3);
      }))continue;
      const dzdx=(routeZ(x+1,side,tier)-routeZ(x-1,side,tier))*.5;
      const angle=Math.atan2(dzdx,1);
      if(markCount<outlines.capacity){
        // Segmented centerline with naturally varied lengths.
        pose(outlines,markCount++,{x,y:y+.018,z},angle,[0,0,0],[7.0,.025,.12],0);
      }
      if(i%2===0)for(const railSide of [-1,1]){
        if(curbCount>=curbs.capacity)continue;
        const curbZ=z+railSide*7.3;
        if(!isRoadClear(x,curbZ,ground(x,curbZ)+1.78,1.2))continue;
        pose(curbs,curbCount++,{x,y:y-.15,z:curbZ},angle,[0,0,0],[31,.38,.38],0);
      }
      if(i%3===0&&lampCount<150){
        const place={x,y:ground(x,z+side*10.8),z:z+side*10.8};
        if(!Number.isFinite(place.y)||!isRoadClear(place.x,place.z,place.y+6,1.7))continue;
        pose(poles,lampCount++,place,0,[0,6,0],[.31,12,.32],0);
        if(lanternCount<160)pose(lanterns,lanternCount++,place,0,[0,12.25,0],[1.45,.23,1.15],0);
        if(glintCount<160)pose(brightGlints,glintCount++,place,0,[0,12.38,0],[1.85,.1,1.48],0);
      }
    }
  }
  for(const [m,n] of [[outlines,markCount],[curbs,curbCount],[poles,lampCount],[lanterns,lanternCount],[brightGlints,glintCount]]){
    m.count=n;m.instanceMatrix.needsUpdate=true;
    if(n>0)m.computeBoundingSphere();
    m.frustumCulled=true;
  }
  // A pedestrian crossing on the upper riverside road near the hotpot street.
  // White zebra strips are physically laid across the road rather than billboard text.
  // The earlier fixed crossing at x=285 could be INSIDE the hotpot building.
  // Pick the nearest collision-free patch of the actual upper riverside road.
  // Bounded midblock pedestrian crossings on the actual upper terrace road.
  // Every post is surveyed separately; a clear road center does not imply that
  // the sidewalk or the signal cabinet is clear of a building or river edge.
  const candidates=[285,360,390,420,470,520,600,-450,-600];
  const crossingSites=[];
  for(const cx of candidates){
    if(crossingSites.length>=4)break;
    if(crossingSites.some(previous=>Math.abs(previous-cx)<110))continue;
    const clearRoad=[-18,0,18].every(dx=>{
      const x=cx+dx,z=routeZ(x,1,1);
      return isRoadClear(x,z,ground(x,z)+1.78,11.2);
    });
    const clearPosts=[-1,1].every(side=>{
      const x=cx+(side<0?11:-11);
      const z=routeZ(x,1,1)+side*9.1;
      return isRoadClear(x,z,ground(x,z)+2.5,1.5);
    });
    if(clearRoad&&clearPosts)crossingSites.push(cx);
  }
  const crossingX=crossingSites[0]??null;
  const zebra=pool(unit,white,40);
  let zebraCount=0;
  for(const cx of crossingSites)for(let n=0;n<10;n++){
    const x=cx-6.75+n*1.5,z=routeZ(x,1,1);
    const y=ground(x,z)+1.80;
    const dz=(routeZ(x+1,1,1)-routeZ(x-1,1,1))*.5;
    pose(zebra,zebraCount++,{x,y,z},Math.atan2(dz,1),
      [0,0,0],[.85,.032,10.2],0);
  }
  zebra.count=zebraCount;zebra.instanceMatrix.needsUpdate=true;
  if(zebra.count)zebra.computeBoundingSphere();zebra.frustumCulled=true;
  // White stop bars are on both approaches, safely clear of zebra stripes.
  // They use the same height and tangent as the actual curving terrace road.
  const stopBars=pool(unit,white,8);
  let stopLineCount=0;
  for(const cx of crossingSites)for(const side of [-1,1]){
    const x=cx+side*11.5,z=routeZ(x,1,1),
      slope=(routeZ(x+1,1,1)-routeZ(x-1,1,1))*.5,
      y=ground(x,z)+1.82;
    pose(stopBars,stopLineCount++,{x,y,z},Math.atan2(slope,1),
      [0,0,0],[.22,.035,10.3],0);
  }
  stopBars.count=stopLineCount;stopBars.instanceMatrix.needsUpdate=true;
  if(stopBars.count)stopBars.computeBoundingSphere();
  stopBars.frustumCulled=true;
  // Chinese three-aspect signal assembly: full-height steel mast, horizontal
  // cantilever, shielded vertical head and pedestrian WALK/WAIT indicator.
  // Meshes are shared instanced batches, so four crossings never mean 8 new
  // separate draw calls per pole.
  const signalMax=8;
  // Low-poly round steel tubes and domed lamp lenses are readable at a
  // close pedestrian camera without a boxy traffic-signal silhouette.
  const mastGeo=new THREE.CylinderGeometry(.17,.19,1,12);
  const armGeo=new THREE.CylinderGeometry(.09,.09,1,12);
  armGeo.rotateX(Math.PI/2); // arm is cantilevered horizontally along Z
  const lensGeo=new THREE.SphereGeometry(.5,14,10);
  // Open-ended metal hoods keep glare off each signal lens. Their cylinder
  // axes run along the oncoming traffic direction (+/-X), with a round
  // aperture rather than a flat square face. 24 hoods share ONE draw group.
  const hoodGeo=new THREE.CylinderGeometry(.30,.30,.27,12,1,true);
  hoodGeo.rotateZ(Math.PI/2);
  const signalHoods=pool(hoodGeo,dark,signalMax*3);
  const signalSideTrim=pool(unit,new THREE.MeshStandardMaterial({
    color:0x64737a,metalness:.55,roughness:.53
  }),signalMax*2);
  const signalPosts=pool(mastGeo,frame,signalMax);
  const signalArms=pool(armGeo,frame,signalMax);
  const signalHeads=pool(unit,dark,signalMax);
  const signalPedHeads=pool(unit,dark,signalMax);
  const signalRed=pool(lensGeo,new THREE.MeshBasicMaterial({color:0xff4539}),signalMax);
  const signalAmber=pool(lensGeo,new THREE.MeshBasicMaterial({color:0xffb92f}),signalMax);
  const signalGreen=pool(lensGeo,new THREE.MeshBasicMaterial({color:0x4ee28b}),signalMax);
  // Keep the inactive bulbs visible as dark glass instead of making the
  // lens disappear completely whenever its signal aspect is switched off.
  const inactiveLenses=pool(lensGeo,new THREE.MeshStandardMaterial({
    color:0x232b30,roughness:.24,metalness:.18
  }),signalMax*3);
  const pedestrianWait=pool(unit,new THREE.MeshBasicMaterial({color:0xf45b4e}),signalMax);
  const pedestrianWalk=pool(unit,new THREE.MeshBasicMaterial({color:0x48dc94}),signalMax);
  let signalCount=0;
  for(const cx of crossingSites)for(const side of [-1,1]){
    // Two approaches face opposite travel directions. The eastbound head
    // must be mounted west of the crossing, not behind its stop line.
    const x=cx+(side<0?11:-11),baseZ=routeZ(x,1,1),
      z=baseZ+side*9.1,pavement=ground(x,z)+1.7,
      at={x,y:pavement,z},idx=signalCount++,
      face=side<0?1:-1;
    pose(signalPosts,idx,at,0,[0,3.2,0],[1,6.4,1],0);
    pose(signalArms,idx,at,0,[0,6.38,-side*2.06],[1,1,4.25],0);
    pose(signalHeads,idx,at,0,[0,6.52,-side*4.08],[.85,2.23,.74],0);
    // Each signal head has three physical lens surfaces. Only the active
    // emissive/bright overlay switches off; dark glass remains in its frame.
    const bulbZ=-side*4.08;
    for(const [n,height] of [7.13,6.52,5.91].entries()){
      pose(inactiveLenses,idx*3+n,at,0,
        [face*.445,height,bulbZ],[.235,.46,.46],0);
      pose(signalHoods,idx*3+n,at,0,
        [face*.565,height,bulbZ],[1,1,1],0);
    }
    for(let edge=0;edge<2;edge++)
      pose(signalSideTrim,idx*2+edge,at,0,
        [face*.455,6.52,bulbZ+(edge?-.345:.345)],
        [.055,2.12,.055],0);
    pose(signalRed,idx,at,0,[face*.51,7.13,bulbZ],[.24,.43,.43],0);
    pose(signalAmber,idx,at,0,[face*.51,6.52,bulbZ],[.24,.43,.43],0);
    pose(signalGreen,idx,at,0,[face*.51,5.91,bulbZ],[.24,.43,.43],0);
    pose(signalPedHeads,idx,at,0,[0,3.73,-side*.10],[.43,1.02,.62],0);
    pose(pedestrianWait,idx,at,0,[face*.23,3.96,-side*.10],
      [.05,.30,.37],0);
    pose(pedestrianWalk,idx,at,0,[face*.23,3.52,-side*.10],
      [.05,.30,.37],0);
  }
  for(const item of [signalPosts,signalArms,signalHeads,signalPedHeads,
    signalRed,signalAmber,signalGreen,pedestrianWait,pedestrianWalk]){
    item.count=signalCount;item.instanceMatrix.needsUpdate=true;
    if(item.count)item.computeBoundingSphere();item.frustumCulled=true;
  }
  inactiveLenses.count=signalHoods.count=signalCount*3;
  signalSideTrim.count=signalCount*2;
  for(const part of [inactiveLenses,signalHoods,signalSideTrim]){
    part.instanceMatrix.needsUpdate=true;
    if(part.count)part.computeBoundingSphere();
    part.frustumCulled=true;
  }
  let signalTime=0,vehicleGreen=true,signalAspect='green';
  // Five localized light sources brighten road asphalt and nearby car roofs.
  const streetLights=[];
  for(const x of [-350,115,335]){
    const z=routeZ(x,1,0)+10.8;
    if(!isRoadClear(x,z,ground(x,z)+8,2))continue;
    const light=new THREE.PointLight(0xffbf77,23,78,2);
    light.position.set(x,ground(x,z)+12,z);
    scene.add(light);streetLights.push(light);
  }
  // Only one nearby moving vehicle receives actual headlight cones at a time.
  // Two physically directed SpotLights are far cheaper than lighting all ten cars.
  const headlightCones=[];
  let allowDynamicHeadlights=true,daylight=false,lowQuality=false;
  for(let n=0;n<2;n++){
    const lamp=new THREE.SpotLight(0xffeac8,36,56,Math.PI/7,.62,2);
    lamp.visible=false;lamp.castShadow=false;
    scene.add(lamp,lamp.target);headlightCones.push(lamp);
  }
  const buffer={body:bodies,glass:windows,tires,hubs,fronts,backs,checker,checkerLight,taxiSigns,sideMirror,bumper,grilles,plates,rearTrims};
  function update(dt,player){
    signalTime+=Math.max(0,Math.min(dt,.05));
    const phase=signalTime%36;
    signalAspect=phase<22?'green':phase<25?'amber':'red';
    vehicleGreen=signalAspect==='green';
    signalGreen.visible=vehicleGreen;
    signalAmber.visible=signalAspect==='amber';
    signalRed.visible=signalAspect==='red';
    pedestrianWalk.visible=signalAspect==='red';
    pedestrianWait.visible=signalAspect!=='red';
    for(const v of vehicles){
      const loop=1770,half=885;
      if(player&&Math.abs(v.x-player.x)<10&&Math.abs(v.z-player.z)<6&&Math.abs(v.y-player.y)<5){
        v.stall=Math.min(1,(v.stall??0)+dt*2.5);
      }else v.stall=Math.max(0,(v.stall??0)-dt*.65);
      if(!v.initialized){
        // Never spawn a taxi inside a high-rise: scan to a drivable corridor
        // once, then keep its motion confined to that corridor.
        let initialX=v.start,found=laneIsClear(v,initialX);
        for(let k=1;!found&&k<=170;k++){
          for(const sign of [1,-1]){
            const probe=initialX+sign*k*5;
            if(probe>=-880&&probe<=880&&laneIsClear(v,probe)){
              v.start=probe;found=true;break;
            }
          }
        }
        v.initialized=true;
        v.disabled=!found;
      }
      const currentDist=v.distance??0;
      const currentX=((v.start+currentDist+half)%loop+loop)%loop-half;
      let nextDistance=currentDist+v.speed*Math.max(.04,1-(v.stall??0)*.95)*dt*v.dir;
      let x=((v.start+nextDistance+half)%loop+loop)%loop-half;
      // Each surveyed crossing has its own physical stop line. Yellow is a
      // stop phase, too; a car already inside the junction continues through.
      // Keep the bumper short of the zebra stripes, not inside the people.
      if(!vehicleGreen&&!v.disabled&&v.side===1&&v.tier===1){
        for(const cx of crossingSites){
          const stopX=cx+(v.dir<0?12:-12);
          const approaching=(stopX-currentX)*v.dir;
          const passed=(x-stopX)*v.dir;
          // Don't stop cars which have already cleared the crossing.
          // Keep the test symmetric for both driving directions and avoid
          // jumping between stop bars when a car changes direction.
          if(approaching>=-.005&&approaching<36&&passed>0&&
             Math.abs(x-currentX)<6){
            nextDistance=currentDist+(stopX-currentX);
            x=stopX;
            break;
          }
        }
      }
      if(!v.disabled&&!laneIsClear(v,x)){
        v.dir*=-1;
        nextDistance=currentDist;
        x=currentX;
      }
      v.distance=nextDistance;
      const sample=positionFor(v,x);
      const dz=(routeZ(x+1,v.side,v.tier)-routeZ(x-1,v.side,v.tier))*.5;
      const heading=Math.atan2(dz,1)+(v.dir<0?Math.PI:0);
      v.x=sample.x;v.y=sample.y;v.z=sample.z;v.heading=heading;
      const o=v.disabled?{x:0,y:-2000,z:0}:{x:sample.x,y:sample.y,z:sample.z},i=v.id;
      pose(bodies,i,o,heading,[0,0,0],[1,1,1],0);
      pose(windows,i,o,heading,[0,0,0],[1,1,1],0);
      pose(grilles,i,o,heading,[3.125,.91,0],[.025,.34,1.1],0);
      pose(plates,i*2,o,heading,[3.157,.66,0],[.025,.19,.58],0);
      pose(plates,i*2+1,o,heading,[-3.157,.75,0],[.025,.19,.58],0);
      for(let wheel=0;wheel<4;wheel++){
        const xw=wheel<2?-1.97:1.94,zw=wheel%2===0?-1.04:1.04;
        // Wheel geometry has already been rotated so its axle aligns with local Z.
        pose(tires,i*4+wheel,o,heading,[xw,.61,zw],[1,1,1],0);
        pose(hubs,i*4+wheel,o,heading,[xw,.61,zw+Math.sign(zw)*.01],[1,1,1],0);
      }
      for(let side=0;side<2;side++){
        const zz=side===0?-0.8:0.8;
        pose(fronts,i*2+side,o,heading,[3.07,1.04,zz],[.13,.36,.47],0);
        pose(backs,i*2+side,o,heading,[-3.08,1.08,zz],[.13,.4,.35],0);
        pose(sideMirror,i*2+side,o,heading,[.98,1.3,side===0?-1.17:1.17],[.31,.3,.19],0);
        pose(bumper,i*2+side,o,heading,[side===0?2.98:-2.98,.67,0],[.24,.22,1.95],0);
        pose(rearTrims,i*2+side,o,heading,[-3.107,1.05,side===0?-.84:.84],[.035,.18,.47],0);
      }
      if(v.taxi){
        const taxiIndex=v.taxiIndex;
        pose(taxiSigns,taxiIndex,o,heading,[-.1,2.24,0],[.75,.27,.47],0);
        for(let check=0;check<6;check++){
          const cy=check%2===0?1.01:1.17;
          const cx=-2.25+Math.floor(check/2)*2.14;
          pose(checker,taxiIndex*6+check,o,heading,[cx,cy,check%2?1.09:-1.09],[.46,.18,.045],0);
          pose(checkerLight,taxiIndex*6+check,o,heading,[cx+.48,cy,check%2?1.09:-1.09],[.46,.18,.045],0);
        }
      }
    }
    fronts.count=backs.count=sideMirror.count=bumper.count=plates.count=rearTrims.count=vehicles.length*2;
    grilles.count=vehicles.length;
    tires.count=hubs.count=vehicles.length*4;
    taxiSigns.count=vehicles.filter(v=>v.taxi).length;
    checker.count=checkerLight.count=taxiSigns.count*6;
    windows.count=vehicles.length;
    for(const mesh of Object.values(buffer)){
      mesh.instanceMatrix.needsUpdate=true;
      mesh.frustumCulled=false;
    }
    let nearest=null,nearDist=7200;
    if(player&&allowDynamicHeadlights)for(const v of vehicles){
      if(v.disabled)continue;
      const dx=v.x-player.x,dz=v.z-player.z;
      const d2=dx*dx+dz*dz;
      if(d2<nearDist&&Math.abs(v.y-player.y)<32){nearest=v;nearDist=d2;}
    }
    for(let i=0;i<headlightCones.length;i++){
      const lamp=headlightCones[i];
      lamp.visible=!!nearest;
      if(!nearest)continue;
      const dirX=Math.cos(nearest.heading),dirZ=Math.sin(nearest.heading);
      const sideX=-dirZ,sideZ=dirX;
      const side=i===0?-.73:.73;
      lamp.position.set(nearest.x+dirX*2.9+sideX*side,
        nearest.y+1.05,nearest.z+dirZ*2.9+sideZ*side);
      lamp.target.position.set(nearest.x+dirX*27+sideX*side,
        nearest.y+.36,nearest.z+dirZ*27+sideZ*side);
    }
  }
  update(0,null);
  function syncLighting(){
    allowDynamicHeadlights=!daylight&&!lowQuality;
    if(!allowDynamicHeadlights)for(const lamp of headlightCones)lamp.visible=false;
    curbs.visible=!lowQuality;
    brightGlints.visible=!daylight&&!lowQuality;
    checker.visible=!lowQuality;checkerLight.visible=!lowQuality;hubs.visible=!lowQuality;
    grilles.visible=!lowQuality;plates.visible=!lowQuality;rearTrims.visible=!lowQuality;
    // Lamp poles and car bodies remain; electric light emission depends on time.
    for(const light of streetLights)light.visible=!daylight&&!lowQuality;
  }
  function setTimeOfDay(preset){
    daylight=preset==='day';
    syncLighting();
  }
  function setQuality(mode){
    lowQuality=mode==='low';
    syncLighting();
  }
  return {
    update,setQuality,setTimeOfDay,
    // Explicit snapshots are created only when inspected/tested, never each frame.
    snapshot(){return {
      vehicleGreen,signalAspect,signalPhase:signalTime%36,crossingX,
      crossingXs:crossingSites.slice(),
      vehicles:vehicles.map(v=>({x:v.x,y:v.y,z:v.z,side:v.side,tier:v.tier,dir:v.dir,disabled:!!v.disabled}))
    }},
    stats:{vehicles:vehicles.length,taxis:vehicles.filter(v=>v.taxi).length,
      streetLamps:lanternCount,roadMarkings:markCount,curbSections:curbCount,movingHeadlights:headlightCones.length,
      zebraStripes:zebra.count,stopLines:stopBars.count,
      signalHoods:signalHoods.count,signalSideTrim:signalSideTrim.count,
      trafficSignals:signalHeads.count,
      pedestrianSignals:signalPedHeads.count,signalizedCrossings:crossingSites.length,
      drawGroups:Object.keys(buffer).length+17},
    // For collision avoidance, external consumers can check an individual 3m footprint.
    nearby(x,z,y,radius=3.8){
      return vehicles.some(v=>!v.disabled&&Math.abs(v.x-x)<radius+3.2&&Math.abs(v.z-z)<radius+1.35&&Math.abs(v.y-y)<3.4);
    }
  };
}