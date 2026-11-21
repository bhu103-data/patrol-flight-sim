// PATROL Chongqing — authored local architectural landmarks.
// Real architectural references are documented in docs/CHONGQING_HOTPOT_PILOT.md.
// Game-space coordinates are deliberately compressed, not surveyed geometry.
export function buildChongqingLandmarks({THREE,scene,ground,pbr,box,sign,obstacles}) {
  const makeMat=(color,metalness=.15,roughness=.55)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const steel=makeMat(0x8198a6,.72,.3);
  const silver=makeMat(0xb8c4cc,.65,.31);
  const concrete=pbr?.concrete??makeMat(0xa0a9b1);
  const glass=(pbr?.glass??makeMat(0x365869,.55,.24)).clone();
  glass.side=THREE.DoubleSide;
  const accent=new THREE.MeshBasicMaterial({color:0xa4cbd5});
  const warm=new THREE.MeshBasicMaterial({color:0xf6d5a2});
  const red=makeMat(0xa63438,.38,.4);
  const dark=makeMat(0x202b33,.4,.5);
  const white=makeMat(0xd3d8d5,.32,.47);
  const unit=new THREE.BoxGeometry(1,1,1);
  const m4=new THREE.Object3D();

  const alignBox=(mesh,i,x,y,z,w,h,d)=>{
    m4.position.set(x,y,z);m4.rotation.set(0,0,0);m4.scale.set(w,h,d);m4.updateMatrix();
    mesh.setMatrixAt(i,m4.matrix);
  };
  function solid(x,y,z,w,h,d,mat,parent=scene) {
    const mesh=new THREE.Mesh(unit,mat);
    mesh.position.set(x,y,z);mesh.scale.set(w,h,d);parent.add(mesh);return mesh;
  }

  // Raffles City Chongqing: 8 sail-like towers, six approx. 250m and two approx. 350m.
  // The Crystal's dimensions and height are taken from the architect/operator.
  const raffles={x:-355,z:176};
  const base=ground(raffles.x,raffles.z);
  const podiumY=base+11;
  obstacles.push({x:raffles.x,z:raffles.z,w:324,d:115,base,top:base+15.6});
  // A stepped waterfront shopping podium and plaza of layered stone and glazed levels.
  solid(raffles.x,base+2.5,raffles.z,335,5,130,concrete);
  solid(raffles.x,base+7.5,raffles.z,324,9,115,glass);
  solid(raffles.x,base+14,raffles.z,325,3,120,silver);
  for(let row=-4;row<=4;row++)solid(raffles.x,base+8,raffles.z+row*12,325,.22,.28,warm);
  for(let col=0;col<21;col++){
    const x=raffles.x-157+col*15;
    solid(x,base+8,raffles.z+58,.4,9,.45,steel);
    if(col%3===0){
      solid(x,base+16.5,raffles.z+58,.9,2,.8,accent);
      solid(x,base+1,raffles.z-65,1.8,1.5,7.5,concrete);
    }
  }

  // Rounded octagonal plans morph as they rise, recalling sail-like vertical curvature.
  function sailGeometry(width,depth,height,lean) {
    const perimeter=[
      [-.39,-.5],[.37,-.5],[.5,-.38],[.5,.36],
      [.38,.5],[-.34,.5],[-.5,.38],[-.5,-.38]
    ];
    const segments=24,N=perimeter.length,verts=[],uv=[],indices=[];
    for(let layer=0;layer<=segments;layer++){
      const t=layer/segments,y=t*height;
      const taper=1-.115*t,curve=lean*Math.sin(Math.PI*.62*t)*t;
      const bend=5.8*Math.sin(Math.PI*t)*t;
      for(let side=0;side<N;side++){
        const [px,pz]=perimeter[side];
        verts.push(px*width*taper+curve,y,pz*depth*taper+bend);
        uv.push(side/N*3.2,t*height/9);
      }
    }
    for(let layer=0;layer<segments;layer++)for(let i=0;i<N;i++){
      const a=layer*N+i,b=layer*N+(i+1)%N,c=(layer+1)*N+i,d=(layer+1)*N+(i+1)%N;
      indices.push(a,c,b,b,c,d);
    }
    for(let i=1;i<N-1;i++){
      indices.push(0,i,i+1);
      indices.push(segments*N,segments*N+i+1,segments*N+i);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    return geometry;
  }
  const layout=[
    [-497,144,250,-6],[-442,146,250,-8],[-385,146,250,-5],
    [-328,146,250,5],[-271,144,250,8],[-215,144,250,6],
    [-485,223,350,-11],[-235,223,350,11]
  ];
  const bands=new THREE.InstancedMesh(unit,silver,2400);
  const bright=new THREE.InstancedMesh(unit,warm,900);
  const mullions=new THREE.InstancedMesh(unit,steel,3000);
  let nb=0,nw=0,nm=0;
  for(let i=0;i<layout.length;i++){
    const [x,z,height,lean]=layout[i];
    const width=i<6?31:35,depth=i<6?27:31;
    const geometry=sailGeometry(width,depth,height,lean);
    const tower=new THREE.Mesh(geometry,glass);
    tower.position.set(x,podiumY,z);scene.add(tower);
    // The collision envelope includes the gentle curvature but not the surrounding plaza.
    obstacles.push({x:x+lean*.35,z:z+2,w:width+20,d:depth+17,base:podiumY,top:podiumY+height+2});
    const floors=Math.round(height/7.5);
    for(let floor=1;floor<floors;floor++){
      const t=floor/floors;
      const cy=podiumY+t*height;
      const cx=x+lean*Math.sin(Math.PI*.62*t)*t;
      const widthAt=width*(1-.115*t);
      const dz=5.8*Math.sin(Math.PI*t)*t;
      // Thin horizontal aluminum mullions and occasional warm occupied floors.
      if(nb<2400)alignBox(bands,nb++,cx,cy,z+depth*(1-.115*t)*.48+dz,widthAt*.92,.24,.38);
      if(nb<2400)alignBox(bands,nb++,cx,cy,z-depth*(1-.115*t)*.48+dz,widthAt*.92,.24,.38);
      if(floor%5===0&&nw<900){
        alignBox(bright,nw++,cx,cy+.6,z+depth*(1-.115*t)*.49+dz,widthAt*.65,1.1,.2);
      }
    }
    for(const side of [-1,1])for(let col=0;col<4;col++){
      const offset=width*(-.33+col*.22);
      for(let step=0;step<18;step++){
        const y0=step/18,cy=podiumY+(step+.5)*height/18;
        const leanX=lean*Math.sin(Math.PI*.62*y0)*y0;
        const dz=5.8*Math.sin(Math.PI*y0)*y0;
        const faceZ=z+side*depth*(1-.115*y0)*.49+dz;
        if(nm<3000)alignBox(mullions,nm++,x+leanX+offset,cy,faceZ,.18,height/18+.3,.28);
      }
    }
    // Rooftop mechanical enclosure and air-deflecting fin rather than boxy antennas.
    const rooftopX=x+lean*Math.sin(Math.PI*.62);
    solid(rooftopX,podiumY+height+1.1,z,16,2.2,15,silver);
    for(const sign of [-1,1]){
      const fin=solid(rooftopX+sign*5,podiumY+height+2.8,z,1.2,4.5,12,steel);
      fin.rotation.z=sign*.18;
    }
  }
  for(const [mesh,n] of [[bands,nb],[bright,nw],[mullions,nm]]){
    mesh.count=n;
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }

  // 300 x 32.5 x 26.5m Crystal at approx. 250m above ground.
  // The cross-section is glazed and oval, with individual aluminum hoop ribs.
  const crystalY=podiumY+250+13.25;
  const crystalCenter=-355;
  const crystalGlass=new THREE.MeshPhysicalMaterial({
    color:0x567783,metalness:.21,roughness:.16,transmission:0,transparent:true,
    opacity:.78,depthWrite:false,side:THREE.DoubleSide,clearcoat:.68,clearcoatRoughness:.12
  });
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(1,1,300,28,1,false),crystalGlass);
  tube.rotation.z=Math.PI/2;
  tube.scale.set(13.25,1,16.25);
  tube.position.set(crystalCenter,crystalY,146);scene.add(tube);
  // The Crystal is a real physical obstacle, with a landable roof and clear open air underneath.
  obstacles.push({x:crystalCenter,z:146,w:300,d:32.5,base:crystalY-13.25,top:crystalY+13.25});
  const ribs=new THREE.InstancedMesh(new THREE.TorusGeometry(1,.016,6,28),steel,45);
  for(let n=0;n<41;n++){
    const x=crystalCenter-148+n*7.4;
    m4.position.set(x,crystalY,146);m4.rotation.set(0,Math.PI/2,0);
    m4.scale.set(16.2,13.15,1);m4.updateMatrix();
    ribs.setMatrixAt(n,m4.matrix);
  }
  ribs.count=41;ribs.instanceMatrix.needsUpdate=true;ribs.computeBoundingSphere();scene.add(ribs);
  for(const zSide of [-1,1]){
    solid(crystalCenter,crystalY-10.3,146+zSide*8.4,299,.6,.5,steel);
    solid(crystalCenter,crystalY+9.5,146+zSide*8.5,298,.36,.55,accent);
    solid(crystalCenter,crystalY-10.9,146+zSide*9.0,295,.5,.36,warm);
  }
  // Structural bridge connections to the two taller northern towers.
  for(const [x,z] of [[-485,223],[-235,223]]){
    solid(x,crystalY-7,(z+146)/2,17,3.2,Math.abs(z-146),silver);
    solid(x,crystalY-5.1,(z+146)/2,16,.45,Math.abs(z-146),glass);
  }
  // Solar glints from the glass and restrained perimeter lighting.
  const crystalGlow=new THREE.PointLight(0x9ec4ce,52,185,2);
  crystalGlow.position.set(crystalCenter,crystalY+7,146);scene.add(crystalGlow);

  // Nearby riverside pier connects the complex with the peninsula.
  solid(-365,ground(-365,36)+1.4,55,72,2.8,102,concrete);
  for(let k=0;k<6;k++){
    solid(-396+k*12,12,6,.9,24,.9,concrete);
  }

  // Liziba Line 2 monorail integrated through floors 6–8 of a 19-storey block.
  // The tunnel is physically open along the X-axis; it is NOT a train pasted onto a wall.
  const station={x:-121,z:-235+35*Math.sin(-121/210)};
  const stationBase=ground(station.x,station.z);
  const railY=stationBase+28;
  const height=19*3.6;
  const frameDepth=40,frameLength=83;
  const stationLower=(railY-stationBase)-5.1;
  solid(station.x,stationBase+stationLower/2,station.z,frameLength,stationLower,frameDepth,concrete);
  const upperStart=railY+11.2,upperHeight=stationBase+height-upperStart;
  solid(station.x,upperStart+upperHeight/2,station.z,frameLength,upperHeight,frameDepth,concrete);
  for(const side of [-1,1]){
    solid(station.x,railY+2.9,station.z+side*18,frameLength,16.3,4,concrete);
    solid(station.x,railY+2.9,station.z+side*20.2,frameLength,13.2,.42,glass);
    solid(station.x,railY+11.2,station.z+side*19.5,frameLength,.7,2.4,steel);
  }
  // The gap is intentionally clear for the moving train and a skilled player.
  obstacles.push(
    {x:station.x,z:station.z,w:frameLength,d:frameDepth,base:stationBase,top:railY-5.1},
    {x:station.x,z:station.z,w:frameLength,d:frameDepth,base:upperStart,top:stationBase+height},
    {x:station.x,z:station.z-18,w:frameLength,d:4,base:railY-5.1,top:railY+11.2},
    {x:station.x,z:station.z+18,w:frameLength,d:4,base:railY-5.1,top:railY+11.2}
  );
  for(const side of [-1,1]){
    for(let floor=1;floor<19;floor++){
      const y=stationBase+floor*3.6;
      if(y>railY-5&&y<railY+11.5)continue;
      solid(station.x,y,station.z+side*20.55,80,.32,.32,steel);
    }
  }
  const glazing=new THREE.InstancedMesh(unit,pbr?.window??warm,700);
  let glazedCount=0;
  for(let floor=1;floor<=19;floor++){
    const y=stationBase+(floor-.48)*3.6;
    if(y>railY-6&&y<railY+11.5)continue;
    for(let col=0;col<15;col++){
      const x=station.x-37+col*5.1;
      for(const side of [-1,1]){
        if(glazedCount>=700)continue;
        alignBox(glazing,glazedCount++,x,y,station.z+side*20.75,3.2,2.55,.14);
      }
    }
  }
  glazing.count=glazedCount;glazing.instanceMatrix.needsUpdate=true;
  glazing.computeBoundingSphere();scene.add(glazing);
  solid(station.x,stationBase+height+.7,station.z,89,1.4,45,silver);
  sign('李子坝',station.x,railY+10.0,station.z+21.5,26,7.2);

  // Real motion: the Line 2 monorail follows the existing Chongqing elevated line.
  // Three articulated cars share track geometry but follow independently to bend correctly.
  const cars=[];
  const carBody=makeMat(0xb8c2c7,.46,.38);
  const stripe=new THREE.MeshBasicMaterial({color:0xa72b31});
  const cabin=new THREE.MeshStandardMaterial({color:0x1f465c,metalness:.52,roughness:.17,emissive:0x0b2632,emissiveIntensity:.3});
  for(let c=0;c<3;c++){
    const car=new THREE.Group();scene.add(car);
    solid(0,4.2,0,20.4,7.3,7.4,carBody,car);
    solid(0,6.2,-3.78,19.0,2.75,.2,cabin,car);
    solid(0,6.2,3.78,19.0,2.75,.2,cabin,car);
    solid(0,2.0,3.77,20.0,.65,.28,stripe,car);
    solid(0,2.0,-3.77,20.0,.65,.28,stripe,car);
    solid(0,.37,0,18.1,.8,4.5,dark,car);
    for(let col=-3;col<=3;col++){
      const wx=col*2.8;
      for(const side of [-1,1]){
        solid(wx,6.2,side*3.87,.15,2.5,.19,silver,car);
      }
    }
    for(const side of [-1,1]){
      solid(side*10.22,5.8,0,.28,3.9,6.6,steel,car);
      solid(side*10.40,4.95,-2.2,.18,.45,.8,warm,car);
    }
    cars.push(car);
  }
  const trackZ=x=>-235+35*Math.sin(x/210);
  const trainSpeed=24; // world units / second
  const startX=-720,trackLength=1320;
  let timer=0;
  function update(dt){
    timer+=Math.min(dt,.06);
    for(let c=0;c<cars.length;c++){
      const x=startX+((timer*trainSpeed-c*23+trackLength*10)%trackLength);
      const z=trackZ(x),y=ground(x,z)+28;
      const dz=35/210*Math.cos(x/210);
      const car=cars[c];car.position.set(x,y+.45,z);
      car.rotation.y=-Math.atan2(dz,1);
    }
  }
  update(0);
  return {
    raffles:{x:raffles.x,z:raffles.z,y:podiumY+255},
    liziba:{x:station.x,z:station.z,y:railY+5},
    update,
    setQuality(mode){
      const low=mode==='low';
      bright.visible=!low;
      mullions.visible=!low;
      glazing.visible=!low;
      crystalGlow.visible=!low;
      // Keep the eight tower cores, glass bridge, rail and moving train visible.
    },
    stats:{towers:layout.length,crystalLength:300,trainCars:cars.length,
      facadeBands:nb,mullions:nm,lizibaWindows:glazedCount}
  };
}