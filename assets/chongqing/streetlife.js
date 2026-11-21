// PATROL Chongqing: compact animated street layer.
// Original geometry only: yellow taxis, civilian cars, asphalt markings and streetlights.
// Yellow center-city taxis and checker waistlines match the city's official road transport guide.
export function buildChongqingStreetlife({THREE,scene,ground,riverCenter}) {
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
    const route=i%4;
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
      const dzdx=(routeZ(x+1,side,tier)-routeZ(x-1,side,tier))*.5;
      const angle=Math.atan2(dzdx,1);
      if(markCount<outlines.capacity){
        // Segmented centerline with naturally varied lengths.
        pose(outlines,markCount++,{x,y:y+.018,z},angle,[0,0,0],[7.0,.025,.12],0);
      }
      if(i%2===0)for(const railSide of [-1,1]){
        if(curbCount>=curbs.capacity)continue;
        pose(curbs,curbCount++,{x,y:y-.15,z:z+railSide*7.3},angle,[0,0,0],[31,.38,.38],0);
      }
      if(i%3===0&&lampCount<150){
        const place={x,y:ground(x,z+side*10.8),z:z+side*10.8};
        if(!Number.isFinite(place.y))continue;
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
  const crossingX=285,crossingZ=routeZ(crossingX,1,1);
  const zebra=pool(unit,white,14);
  for(let n=0;n<10;n++){
    const x=crossingX-6.75+n*1.5;
    const z=routeZ(x,1,1);
    const y=ground(x,z)+1.80;
    const dz=(routeZ(x+1,1,1)-routeZ(x-1,1,1))*.5;
    pose(zebra,n,{x,y,z},Math.atan2(dz,1),[0,0,0],[.85,.032,10.2],0);
  }
  zebra.count=10;zebra.instanceMatrix.needsUpdate=true;
  zebra.computeBoundingSphere();zebra.frustumCulled=true;
  // Two six-metre traffic signal poles, black heads and alternating bulbs.
  // All visible structures use instancing; no new draw call per light.
  const signalPosts=pool(unit,frame,2);
  const signalHeads=pool(unit,dark,2);
  const signalRed=pool(unit,new THREE.MeshBasicMaterial({color:0xff4539}),2);
  const signalGreen=pool(unit,new THREE.MeshBasicMaterial({color:0x4ee28b}),2);
  for(let side=0;side<2;side++){
    const lateral=side===0?-9.1:9.1;
    const x=crossingX+11,z=crossingZ+lateral;
    const pavement=ground(x,z)+1.7;
    pose(signalPosts,side,{x,y:pavement,z},0,[0,3,0],[.32,6,.32],0);
    pose(signalHeads,side,{x,y:pavement,z},0,[0,6.8,0],[.95,1.85,.75],0);
    pose(signalRed,side,{x,y:pavement,z},0,[0,7.22,-.4],[.43,.45,.08],0);
    pose(signalGreen,side,{x,y:pavement,z},0,[0,6.33,-.4],[.43,.45,.08],0);
  }
  for(const item of [signalPosts,signalHeads,signalRed,signalGreen]){
    item.count=2;item.instanceMatrix.needsUpdate=true;
    item.computeBoundingSphere();item.frustumCulled=true;
  }
  let signalTime=0,vehicleGreen=true;
  // Five localized light sources brighten road asphalt and nearby car roofs.
  const streetLights=[];
  for(const x of [-350,115,335]){
    const z=routeZ(x,1,0)+10.8;
    const light=new THREE.PointLight(0xffbf77,23,78,2);
    light.position.set(x,ground(x,z)+12,z);
    scene.add(light);streetLights.push(light);
  }
  // Only one nearby moving vehicle receives actual headlight cones at a time.
  // Two physically directed SpotLights are far cheaper than lighting all ten cars.
  const headlightCones=[];
  let allowDynamicHeadlights=true;
  for(let n=0;n<2;n++){
    const lamp=new THREE.SpotLight(0xffeac8,36,56,Math.PI/7,.62,2);
    lamp.visible=false;lamp.castShadow=false;
    scene.add(lamp,lamp.target);headlightCones.push(lamp);
  }
  const buffer={body:bodies,glass:windows,tires,hubs,fronts,backs,checker,checkerLight,taxiSigns,sideMirror,bumper,grilles,plates,rearTrims};
  function update(dt,player){
    signalTime+=Math.max(0,Math.min(dt,.05));
    vehicleGreen=signalTime%36<24;
    signalGreen.visible=vehicleGreen;
    signalRed.visible=!vehicleGreen;
    for(const v of vehicles){
      const loop=1770,half=885;
      if(player&&Math.abs(v.x-player.x)<10&&Math.abs(v.z-player.z)<6&&Math.abs(v.y-player.y)<5){
        v.stall=Math.min(1,(v.stall??0)+dt*2.5);
      }else v.stall=Math.max(0,(v.stall??0)-dt*.65);
      const currentDist=v.distance??0;
      const currentX=((v.start+currentDist+half)%loop+loop)%loop-half;
      let nextDistance=currentDist+v.speed*Math.max(.04,1-(v.stall??0)*.95)*dt*v.dir;
      let x=((v.start+nextDistance+half)%loop+loop)%loop-half;
      // Stop cars going west on the upper riverside road at the red crossing.
      // A clamped center point holds the bumper short of the zebra stripes.
      const stopX=crossingX+12;
      if(!vehicleGreen&&v.side===1&&v.tier===1&&v.dir<0 &&
         currentX>=stopX-.005 && currentX<stopX+36 && x<stopX &&
         currentX-x<6){
        nextDistance=currentDist-(currentX-stopX);
        x=stopX;
      }
      v.distance=nextDistance;
      const sample=positionFor(v,x);
      const dz=(routeZ(x+1,v.side,v.tier)-routeZ(x-1,v.side,v.tier))*.5;
      const heading=Math.atan2(dz,1)+(v.dir<0?Math.PI:0);
      v.x=sample.x;v.y=sample.y;v.z=sample.z;v.heading=heading;
      const o={x:sample.x,y:sample.y,z:sample.z},i=v.id;
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
  function setQuality(mode){
    const low=mode==='low';
    allowDynamicHeadlights=!low;
    if(low)for(const lamp of headlightCones)lamp.visible=false;
    curbs.visible=!low;brightGlints.visible=!low;
    checker.visible=!low;checkerLight.visible=!low;hubs.visible=!low;
    grilles.visible=!low;plates.visible=!low;rearTrims.visible=!low;
    // The vehicle silhouettes, roads, headlamps and pole lamps always remain.
    for(const light of streetLights)light.visible=!low;
  }
  return {
    update,setQuality,
    // Explicit snapshots are created only when inspected/tested, never each frame.
    snapshot(){return {
      vehicleGreen,signalPhase:signalTime%36,
      vehicles:vehicles.map(v=>({x:v.x,z:v.z,side:v.side,tier:v.tier,dir:v.dir}))
    }},
    stats:{vehicles:vehicles.length,taxis:vehicles.filter(v=>v.taxi).length,
      streetLamps:lanternCount,roadMarkings:markCount,curbSections:curbCount,movingHeadlights:headlightCones.length,
      zebraStripes:zebra.count,trafficSignals:signalHeads.count,drawGroups:Object.keys(buffer).length+10},
    // For collision avoidance, external consumers can check an individual 3m footprint.
    nearby(x,z,y,radius=3.8){
      return vehicles.some(v=>Math.abs(v.x-x)<radius+3.2&&Math.abs(v.z-z)<radius+1.35&&Math.abs(v.y-y)<3.4);
    }
  };
}