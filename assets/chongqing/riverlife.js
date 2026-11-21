// Chongqing river life: moving sightseeing ferries and wakes.
// Custom procedural hull, passenger decks, railings and navigation lighting.
// No external models, photos, licensed logos or named providers.
export function buildChongqingRiverlife({THREE,scene,riverCenter}) {
  const waveHeight=-2.4;
  const hullMat=new THREE.MeshStandardMaterial({color:0x3b4852,metalness:.46,roughness:.43,side:THREE.DoubleSide});
  const hullLight=new THREE.MeshStandardMaterial({color:0xc6c9c7,metalness:.32,roughness:.5,side:THREE.DoubleSide});
  const paintedWhite=new THREE.MeshStandardMaterial({color:0xdadfdd,metalness:.15,roughness:.49});
  const glass=new THREE.MeshPhysicalMaterial({color:0x466778,metalness:.47,roughness:.16,clearcoat:.55,clearcoatRoughness:.19,
    emissive:0x10232b,emissiveIntensity:.28,side:THREE.DoubleSide});
  const aluminum=new THREE.MeshStandardMaterial({color:0x889a9d,metalness:.78,roughness:.3});
  const brass=new THREE.MeshBasicMaterial({color:0xffc989});
  const red=new THREE.MeshBasicMaterial({color:0x9e3239});
  const green=new THREE.MeshBasicMaterial({color:0x4fa79b});
  const dark=new THREE.MeshStandardMaterial({color:0x253038,metalness:.3,roughness:.67});
  const baseBox=new THREE.BoxGeometry(1,1,1);
  const groups=[],boatStates=[];
  function hullGeometry(length,width) {
    // Two unequal-height chine rings with a tapered pointed bow.
    const segments=[
      [-.5,.17],[-.44,.63],[-.31,.92],[-.06,1],
      [.28,1],[.41,.88],[.49,.43],[.52,.02]
    ];
    const v=[],uv=[],idx=[];
    for(let level=0;level<2;level++){
      const y=level===0?-1.2:1.55,lower=level===0?.74:1;
      for(let i=0;i<segments.length;i++){
        const [u,beam]=segments[i];
        const x=u*length,z=beam*width*.5*lower;
        v.push(x,y,-z,x,y,z);
        uv.push(u+.5,level,u+.5,level);
      }
    }
    const ring=segments.length*2;
    for(let i=0;i<segments.length-1;i++){
      for(let side=0;side<2;side++){
        const a=i*2+side,b=(i+1)*2+side,c=a+ring,d=b+ring;
        if(side===0)idx.push(a,c,b,b,c,d);
        else idx.push(a,b,c,b,d,c);
      }
    }
    // Triangulate top and bottom decks so the hull reads as a solid boat.
    for(let i=1;i<segments.length-1;i++){
      idx.push(ring,ring+i*2,ring+(i+1)*2);
      idx.push(ring+1,ring+(i+1)*2+1,ring+i*2+1);
      idx.push(0,(i+1)*2,i*2);
      idx.push(1,i*2+1,(i+1)*2+1);
    }
    for(const j of [0,segments.length-1]){
      const a=j*2,b=a+1,c=a+ring,d=b+ring;
      idx.push(a,b,c,b,d,c);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(idx);g.computeVertexNormals();
    return g;
  }
  function addBox(group,material,x,y,z,w,h,d) {
    const m=new THREE.Mesh(baseBox,material);
    m.position.set(x,y,z);m.scale.set(w,h,d);
    group.add(m);return m;
  }
  const hullGeo=[hullGeometry(40,10.8),hullGeometry(35,9.2),hullGeometry(28,7.7)];
  const detailConfig=[
    {length:40,width:10.8,speed:12.5,start:-770,dir:1,lane:-19,material:hullMat},
    {length:35,width:9.2,speed:10.1,start:-40,dir:-1,lane:22,material:hullLight},
    {length:28,width:7.7,speed:15.4,start:585,dir:1,lane:-11,material:hullMat}
  ];
  for(let i=0;i<detailConfig.length;i++){
    const cfg=detailConfig[i];
    const boat=new THREE.Group();scene.add(boat);groups.push(boat);
    const length=cfg.length,width=cfg.width;
    const hull=new THREE.Mesh(hullGeo[i],cfg.material);
    hull.castShadow=true;hull.receiveShadow=true;
    boat.add(hull);
    // Two recessed deck levels; painted non-slip floor and bordered observation deck.
    addBox(boat,paintedWhite,-.8,1.52,0,length*.79,.47,width*.82);
    addBox(boat,paintedWhite,-2.2,5.4,0,length*.53,.6,width*.7);
    addBox(boat,glass,-2.2,3.62,0,length*.49,3.4,width*.6);
    addBox(boat,paintedWhite,-3.8,8.65,0,length*.42,.5,width*.64);
    addBox(boat,glass,-2.5,7.11,0,length*.37,2.6,width*.54);
    addBox(boat,aluminum,-2.2,9.12,0,length*.47,.21,width*.68);
    // Continuous decks, with steel balustrades and bright interior strip lighting.
    for(const s of [-1,1]){
      const side=s*width*.39;
      addBox(boat,aluminum,-1.0,3.0,side,length*.69,.15,.19);
      addBox(boat,aluminum,-1.0,2.05,side,length*.69,.12,.19);
      addBox(boat,brass,-2.0,5.21,s*width*.32,length*.45,.15,.16);
      addBox(boat,aluminum,-2.1,6.8,s*width*.34,length*.47,.18,.17);
      const frameCount=6;
      for(let j=0;j<frameCount;j++){
        const xx=-length*.28+j*length*.094;
        addBox(boat,aluminum,xx,3.72,s*width*.305,.15,3.3,.21);
        addBox(boat,aluminum,xx,2.55,side,.12,1.1,.16);
      }
      addBox(boat,s===1?green:red,length*.40,2.4,s*width*.27,.46,.29,.28);
    }
    for(const x of [-length*.35,length*.29]){
      addBox(boat,aluminum,x,2.6,0,.22,2.0,width*.74);
    }
    // Bridge controls, bow searchlight, roof antenna and non-branded lifebuoys.
    addBox(boat,dark,length*.25,5.45,0,3.4,1.1,width*.52);
    addBox(boat,paintedWhite,length*.43,2.45,0,.55,.45,.9);
    addBox(boat,brass,length*.44,2.55,0,.44,.35,.64);
    addBox(boat,aluminum,-length*.16,10.7,0,.13,3,.14);
    addBox(boat,red,-length*.16,12.15,0,.25,.31,.24);
    const lifeRingGeo=new THREE.TorusGeometry(.72,.19,7,14);
    for(const s of [-1,1]){
      const lifeRing=new THREE.Mesh(lifeRingGeo,red);
      lifeRing.position.set(-length*.24,3.5,s*width*.42);
      lifeRing.rotation.y=Math.PI/2;boat.add(lifeRing);
    }
    // Wakes are layered additive alpha strips, attached to each boat group.
    const wakeCanvas=document.createElement('canvas');
    wakeCanvas.width=128;wakeCanvas.height=64;
    const ctx=wakeCanvas.getContext('2d');
    const gradient=ctx.createLinearGradient(0,0,128,0);
    gradient.addColorStop(0,'rgba(188,224,231,.48)');
    gradient.addColorStop(.25,'rgba(185,227,235,.27)');
    gradient.addColorStop(.75,'rgba(185,227,235,.07)');
    gradient.addColorStop(1,'rgba(185,227,235,0)');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,64);
    const tex=new THREE.CanvasTexture(wakeCanvas);tex.colorSpace=THREE.SRGBColorSpace;
    const wake=new THREE.Mesh(new THREE.PlaneGeometry(length*1.4,width*1.35),new THREE.MeshBasicMaterial({
      map:tex,transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide,
      blending:THREE.AdditiveBlending
    }));
    wake.rotation.x=-Math.PI/2;
    wake.position.set(-length*.94,waveHeight+.05+.0,0);
    // Plane Y is in world sea-level after rotation, so compensate group translation.
    wake.position.y=-.45;
    wake.renderOrder=1;
    boat.add(wake);
    boatStates.push({...cfg,boat,wake,x:cfg.start,z:0,y:waveHeight+.5,heading:0});
  }
  const loop=1720,half=860;
  let time=0;
  function update(dt){
    time+=Math.min(Math.max(dt,0),.05);
    for(const state of boatStates){
      state.progress=(state.progress??0)+Math.max(0,dt)*state.speed*state.dir;
      const previousX=state.x,previousZ=state.z;
      const x=((state.start+state.progress+half)%loop+loop)%loop-half;
      const z=riverCenter(x)+state.lane;
      const dz=(riverCenter(x+1)-riverCenter(x-1))*.5;
      const yaw=-Math.atan2(dz,1)+(state.dir<0?Math.PI:0);
      state.x=x;state.z=z;state.y=waveHeight+.8+Math.sin(time*1.4+state.start)*.085;
      state.heading=yaw;
      state.deltaX=Math.abs(previousX-x)<15?x-previousX:0;
      state.deltaZ=Math.abs(previousZ-z)<15?z-previousZ:0;
      state.boat.position.set(x,state.y,z);
      state.boat.rotation.y=yaw;
      state.boat.rotation.z=Math.sin(time*.91+state.start)*.005;
      state.wake.material.opacity=.35+.07*Math.sin(time*2.1+state.start);
    }
  }
  update(0);
  // Boat decks are landable and carry the player between frames.
  // No static obstacles are put into the spatial grid because the ferries move.
  const drift={dx:0,dz:0};
  function eachDeck(x,z,visit){
    for(const state of boatStates){
      const yaw=state.heading,cs=Math.cos(yaw),sn=Math.sin(yaw);
      const dx=x-state.x,dz=z-state.z;
      const localX=dx*cs-dz*sn,localZ=dx*sn+dz*cs;
      const len=state.length,w=state.width;
      // Top sightseeing deck and the exposed perimeter of the lower deck.
      const decks=[
        {height:5.7,x:-2.2,width:len*.53,depth:w*.7},
        {height:1.755,x:-.8,width:len*.79,depth:w*.82}
      ];
      for(const deck of decks){
        if(Math.abs(localX-deck.x)<deck.width*.5-.35&&
           Math.abs(localZ)<deck.depth*.5-.35){
          const centerY=state.y+deck.height+2.35;
          if(visit(state,centerY))return true;
        }
      }
    }
    return false;
  }
  function deckSurface(x,z,previousY,nextY){
    if(nextY>previousY+.025)return -Infinity;
    let height=-Infinity;
    eachDeck(x,z,(_boat,centerY)=>{
      if(previousY>=centerY-.18&&nextY<=centerY+.15){
        height=Math.max(height,centerY);
      }
      return false;
    });
    return height;
  }
  function deckDrift(x,z,y){
    drift.dx=0;drift.dz=0;
    eachDeck(x,z,(state,centerY)=>{
      if(Math.abs(y-centerY)<.55){
        drift.dx=state.deltaX??0;
        drift.dz=state.deltaZ??0;
        return true;
      }
      return false;
    });
    return drift;
  }
  function setQuality(mode){
    const low=mode==='low';
    for(const state of boatStates){
      state.wake.visible=!low;
      // Core boats, windows and deck railings stay visible in every mode.
    }
  }
  return {
    update,setQuality,deckSurface,deckDrift,
    stats:{boats:boatStates.length,deckLevels:2,visibleDeckRailSections:boatStates.length*4},
    snapshot(){return boatStates.map(s=>({x:s.x,y:s.y,z:s.z,heading:s.heading}))}
  };
}
