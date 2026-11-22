// Three bounded, close-range secondary Chongqing market facades.
// Source-informed authored geometry, NOT 1:1 survey or imported photo mesh.
// The city chronicles describe staggered eaves, timber galleries and bracing:
// https://dfz.cq.gov.cn/zqlswh/fjms_417821/202311/t20231102_12510878.html
// Existing shops, signs, roadway and all original collision volumes remain.
export const CHONGQING_MARKET_SITES=Object.freeze([
  Object.freeze({id:'tea-lane',x:236,z:345,roofRise:2.25,doorSide:-1}),
  Object.freeze({id:'stone-stair',x:284,z:345,roofRise:2.65,doorSide:1}),
  Object.freeze({id:'river-market',x:332,z:345,roofRise:2.05,doorSide:-1})
]);

// One tessellated, raised tile silhouette, reused as a single instanced draw.
// A real pitched grid with upturned corners replaces the straight box-only
// skyline; panel grooves are 3D vertex displacement, not pasted imagery.
export function makeChongqingMarketTileRoof(THREE){
  const vertices=[],uvs=[],indices=[],nx=32,nz=12;
  for(let i=0;i<=nx;i++){
    const x=-11.8+23.6*i/nx;
    for(let j=0;j<=nz;j++){
      const z=-10.4+20.8*j/nz;
      const shoulder=Math.max(0,1-Math.abs(z)/10.4);
      const rib=.052*Math.cos(i*Math.PI/2)*shoulder;
      const corner=.23*Math.pow(Math.abs(x)/11.8,8);
      vertices.push(x,.18+2.2*shoulder+rib+corner,z);
      uvs.push(i/8,j/4);
    }
  }
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
    const a=i*(nz+1)+j,b=a+(nz+1);
    // +Y outward winding: the roof must be visible from ABOVE the street.
    indices.push(a,a+1,b,b,a+1,b+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Real segmented wall geometry with EMPTY door and window apertures.
// Front and inner jamb surfaces are 0.43 world-units apart, with the
// original shop shell remaining deeper behind as a reversible fallback.
export function makeChongqingMarketOpenFacade(THREE,{doorSide=-1,variant=0}={}){
  // 0.04 overlap of side wall inner faces at x=±9.72 prevents daylight seams.
  const vertices=[],uvs=[],indices=[],front=0,back=-.43,edge=9.76;
  let frontQuads=0,lowerStoryIndexEnd=0;
  const quad=(a,b,c,d,face='side')=>{
    const start=vertices.length/3;
    // Each perpendicular reveal needs its own UV plane: without this,
    // timber texture collapses to a line across the window jamb.
    const constantX=[b,c,d].every(p=>Math.abs(p[0]-a[0])<1e-8);
    const constantY=[b,c,d].every(p=>Math.abs(p[1]-a[1])<1e-8);
    for(const p of [a,b,c,d]){
      vertices.push(...p);
      uvs.push(constantX?p[2]*2:p[0]/3.4,
        constantY?p[2]*2:p[1]/3.4);
    }
    indices.push(start,start+1,start+2,start,start+2,start+3);
    if(face==='front')frontQuads++;
  };
  const block=(x0,x1,y0,y1)=>{
    quad([x0,y0,front],[x1,y0,front],[x1,y1,front],[x0,y1,front],'front');
    quad([x1,y0,back],[x0,y0,back],[x0,y1,back],[x1,y1,back]);
    quad([x0,y0,back],[x0,y0,front],[x0,y1,front],[x0,y1,back]);
    quad([x1,y0,front],[x1,y0,back],[x1,y1,back],[x1,y1,front]);
    quad([x0,y1,front],[x1,y1,front],[x1,y1,back],[x0,y1,back]);
    quad([x0,y0,back],[x1,y0,back],[x1,y0,front],[x0,y0,front]);
  };
  const doorX=doorSide*5.2;
  const openings=[{left:doorX-1.60,right:doorX+1.60,bottom:.75,top:6.25}];
  for(const x of [-7.1,0,7.1]){
    if(Math.abs(x-doorX)<3)continue;
    openings.push({left:x-2.25,right:x+2.25,bottom:3.35,top:7.90});
  }
  const upper=variant===0?[-6.4,-2.15,2.2,6.35]:
    variant===1?[-6.6,-2.35,2.3,6.6]:[-6.15,-2,2,6.15];
  for(let i=0;i<upper.length;i++){
    const x=upper[i],half=variant===2&&i===1?1.20:1.28;
    openings.push({left:x-half,right:x+half,bottom:12.10,top:14.72});
  }
  const cuts=(list,min,max)=>[min,max,...list].filter(v=>v>=min&&v<=max)
    .sort((a,b)=>a-b).filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>1e-6);
  for(const [low,high] of [[.65,10.30],[11.02,15.72]]){
    const active=openings.filter(o=>o.top>low&&o.bottom<high);
    const ys=cuts(active.flatMap(o=>[o.bottom,o.top]),low,high);
    const xs=cuts(active.flatMap(o=>[o.left,o.right]),-edge,edge);
    for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
      const [x0,x1,y0,y1]=[xs[i],xs[i+1],ys[j],ys[j+1]];
      const cx=(x0+x1)/2,cy=(y0+y1)/2;
      if(active.some(o=>cx>o.left&&cx<o.right&&cy>o.bottom&&cy<o.top))continue;
      if(x1-x0>1e-6&&y1-y0>1e-6)block(x0,x1,y0,y1);
    }
    // Keep exactly two contiguous material groups. One group per box
    // would issue hundreds of draw calls on each of the 3 nearby shops.
    if(low<1)lowerStoryIndexEnd=indices.length;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);geo.computeVertexNormals();
  // Story separation is material-only: physical openings, index count,
  // outward normals and the original 0.43-unit jamb depth are unchanged.
  geo.addGroup(0,lowerStoryIndexEnd,0);
  geo.addGroup(lowerStoryIndexEnd,indices.length-lowerStoryIndexEnd,1);
  geo.userData={marketOpenings:openings,frontQuads,wallThickness:-back,
    lowerStoryTriangles:lowerStoryIndexEnd/3,
    upperStoryTriangles:(indices.length-lowerStoryIndexEnd)/3};
  return geo;
}

export function buildChongqingMarketFronts({
  THREE,scene,ground,riverDist=()=>Infinity,obstacles=[],pbr=null
}){
  const marker=new THREE.Object3D(),unit=new THREE.BoxGeometry(1,1,1);
  const material=(color,roughness=.79,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  // Reuse PATROL's already licensed/loaded CC0 wood, cut-stone and
  // clay-tile PBR. The supplied roof material updates in-place when its
  // Poly Haven CC0 photo is available, and retains a local tiled fallback.
  const timberMat=pbr?.wood??material(0x493e34,.88),
    stoneMat=pbr?.cutStone??material(0x78736a,.93);
  // Clone the game's licensed/loaded physical glass so only these 3 market
  // shops gain partial transmission; NEVER mutate globally shared pbr.glass.
  // The inserted matte backing 1.19 units farther inside provides parallax
  // instead of a flat blue opaque billboard when the sky has no env cubemap.
  const sourceGlass=pbr?.glass??null;
  const glassMat=sourceGlass?.clone?.()??sourceGlass??new THREE.MeshStandardMaterial({
    color:0x94a6ac,roughness:.32,metalness:.07,side:THREE.DoubleSide
  });
  if(glassMat!==sourceGlass){
    glassMat.transparent=true;glassMat.opacity=.48;
    glassMat.depthWrite=false;glassMat.roughness=.32;glassMat.metalness=.07;
    glassMat.color?.setHex?.(0x94a6ac);
    glassMat.side=THREE.DoubleSide;glassMat.needsUpdate=true;
  }
  const interiorMat=new THREE.MeshStandardMaterial({
    color:0xf1e6d5,roughness:.93,metalness:0,
    emissive:0x241b16,emissiveIntensity:.13
  });
  const trimMat=pbr?.carvedWood??material(0x8e8980,.76),
    tileMat=pbr?.roof??material(0x4c5559,.87);
  const batch=(geometry,mat,capacity)=>{
    const mesh=new THREE.InstancedMesh(geometry,mat,capacity);
    mesh.count=0;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.receiveShadow=true;mesh.castShadow=false;
    scene.add(mesh);return mesh;
  };
  const beams=batch(unit,timberMat,160),
    braces=batch(unit,timberMat,30),
    stone=batch(unit,stoneMat,40),
    glass=batch(unit,glassMat,32),
    lattice=batch(unit,trimMat,144),
    roof=batch(makeChongqingMarketTileRoof(THREE),tileMat,3),
    interiors=batch(unit,interiorMat,24);
  const position=(mesh,x,y,z,w,h,d,rotX=0,rotZ=0)=>{
    if(mesh.count>=mesh.instanceMatrix.count)throw Error('Chongqing gallery batch exceeded '+mesh.instanceMatrix.count);
    marker.position.set(x,y,z);
    marker.scale.set(w,h,d);
    marker.rotation.set(rotX,0,rotZ);
    marker.updateMatrix();
    mesh.setMatrixAt(mesh.count++,marker.matrix);
  };
  const sites=[],facades=[];
  let stairTreads=0,backingOrdinal=0;
  const mutedInteriorColors=[0x63574b,0x56605e,0x795f4d,0x4e504b];
  const backing=(x,y,z,w,h,d=.12)=>{
    position(interiors,x,y,z,w,h,d);
    if(interiors.setColorAt&&THREE.Color)
      interiors.setColorAt(interiors.count-1,
        new THREE.Color(mutedInteriorColors[backingOrdinal%mutedInteriorColors.length]));
    backingOrdinal++;
  };
  for(const site of CHONGQING_MARKET_SITES){
    const {x,z,roofRise,doorSide}=site,
      earth=ground(x,z),frontGround=ground(x,z+5.35);
    if(!Number.isFinite(earth)||!Number.isFinite(frontGround)||
        earth<=0||frontGround<=0||
        riverDist(x,z)<8||riverDist(x,z+5.35)<8)continue;
    const accepted={
      ...site,base:earth,frontGround,
      galleryHeight:earth+10.80,
      frontZ:z+5.35,facadeZ:z+2.4
    };
    sites.push(accepted);
    // Front wall is extruded around genuine apertures, not an opaque box
    // under painted windows; each building has distinct opening coordinates.
    const geometry=makeChongqingMarketOpenFacade(THREE,{
      doorSide,variant:site.id==='tea-lane'?0:site.id==='stone-stair'?1:2
    });
    // The old all-dark-wood facade hid actual window and stair geometry
    // even in the camera-clear daylight screenshot. Chongqing district
    // chronicles describe timber upper levels and mixed lower storefront
    // finishes; keep lower facades distinct while reusing licensed CC0
    // masonry (stone-stair) or lighter carved timber (the other two).
    // Indexed geometry uses ONLY two contiguous material groups per wall.
    const groundFinish=site.id==='stone-stair'?stoneMat:trimMat;
    const frontWall=new THREE.Mesh(geometry,[groundFinish,timberMat]);
    frontWall.position.set(x,earth,z+2.78);
    frontWall.castShadow=true;frontWall.receiveShadow=true;
    scene.add(frontWall);facades.push(frontWall);
    // Existing 15.7-high shop shell is kept. New deck has true depth,
    // two driven timber posts, an overhanging railing and angled supports.
    position(stone,x,earth+10.55,z+3.63,18.7,.28,4.2);
    // Register the elevated gallery as a walkable/collidable volume BEFORE
    // the shared spatial obstacle index is created. Posts register too.
    obstacles.push({x,z:z+3.63,w:18.7,d:4.2,
      base:earth+10.39,top:earth+10.69,marketGallery:true});
    for(const side of [-1,1]){
      const px=x+side*8.15,pz=z+5.35,
        foot=ground(px,pz),
        postTop=earth+10.54,
        rise=postTop-foot;
      if(!Number.isFinite(foot)||rise<1.0)
        throw Error('Market porch post has no grounded foot at '+site.id);
      position(beams,px,foot+rise*.5,pz,.48,rise,.49);
      obstacles.push({x:px,z:pz,w:.5,d:.5,base:foot-.05,
        top:postTop,marketGalleryPost:true});
      // A solid diagonal brace connects a post to the cantilever underside.
      const aY=earth+7.45,bY=earth+10.39,
        aZ=pz,bZ=z+2.75,
        len=Math.hypot(bY-aY,bZ-aZ);
      position(braces,px,(aY+bY)*.5,(aZ+bZ)*.5,.28,len,.32,
        Math.atan2(bZ-aZ,bY-aY));
      position(beams,px,earth+11.61,z+5.60,.21,1.7,.22);
    }
    position(beams,x,earth+12.35,z+5.62,17.2,.20,.30);
    position(beams,x,earth+10.84,z+5.57,17.6,.22,.28);
    // Recessed, asymmetrical doorway and real mullioned shop windows.
    const doorX=x+doorSide*5.2;
    // Glass is behind both sides of the 0.43-unit-deep real jamb,
    // with a visible dark reveal gap; the old solid market front is absent.
    // Keep the site's original seven glazing cards (not additional draws).
    position(glass,doorX,earth+3.15,z+2.11,3.05,5.3,.10);
    backing(doorX,earth+3.15,z+.92,2.94,5.18);
    position(lattice,doorX,earth+3.15,z+2.42,.09,5.1,.18);
    for(const dx of [-7.1,0,7.1]){
      if(Math.abs((x+dx)-doorX)<3.0)continue;
      position(glass,x+dx,earth+5.6,z+2.11,4.2,4.3,.1);
      backing(x+dx,earth+5.6,z+.92,4.06,4.14);
      position(beams,x+dx,earth+5.6,z+2.65,.11,4.65,.18);
      // Individual sash and transom positions vary subtly by shop.
      position(lattice,x+dx+(site.id==='stone-stair'?.12:-.10),
        earth+5.6,z+2.42,.095,4.12,.16);
      position(lattice,x+dx,earth+6.35+(site.id==='tea-lane'?.23:-.18),
        z+2.42,4.04,.10,.16);
      // These are actual low-poly shop fittings INSIDE the pane, not paint
      // added to the glass or another copy of the exterior wood sash.
      // Three staggered z depths create visible parallax against the old
      // solid-blue window texture, at roughly a third of the outer facade cost.
      position(beams,x+dx,earth+4.30,z+1.48,3.44,.20,.68);
      position(beams,x+dx,earth+6.35+(site.id==='river-market'?.16:-.12),
        z+1.57,3.65,.13,.40);
      // Varied goods pedestal: inside at z+1.4, behind front glazing z+2.11.
      position(beams,x+dx+(dx<0?-.96:.93),earth+4.62,
        z+1.43,.64,.47,.48);
      position(lattice,x+dx+(site.id==='stone-stair'?.56:-.48),
        earth+5.21,z+1.71,.17,1.68,.18);
    }
    // Upper windows sit behind the 3D jambs, ahead of the old box wall.
    const upper=site.id==='tea-lane'?[-6.4,-2.15,2.2,6.35]:
      site.id==='stone-stair'?[-6.6,-2.35,2.3,6.6]:[-6.15,-2,2,6.15];
    for(let i=0;i<upper.length;i++){
      const bayWidth=site.id==='river-market'&&i===1?2.24:2.40;
      position(glass,x+upper[i],earth+13.41,z+2.11,
        bayWidth,2.38,.1);
      backing(x+upper[i],earth+13.41,z+.92,bayWidth-.14,2.25);
      position(lattice,x+upper[i]+(i%2?.12:-.10),earth+13.41,
        z+2.42,.09,2.36,.18);
      // Real projecting slate sill outside the jamb; not a painted line.
      position(stone,x+upper[i],earth+12.03,z+2.91,
        bayWidth+.18,.17,.46);
      // Shallow inset timber privacy screens are spaced differently per
      // storefront and sit IN FRONT of the backing but behind glazing.
      // The second-floor shutters are genuine box volumes, not UV stripes.
      position(lattice,x+upper[i]+(i%2?-.38:.38),
        earth+13.40+(site.id==='tea-lane'?.16:0),z+1.61,
        bayWidth*.29,1.38,.18);
      if(i%2===0)
        position(lattice,x+upper[i],earth+12.88,
          z+1.68,bayWidth*.79,.13,.17);
    }
    for(const dx of [-8.4,-4.2,0,4.2,8.4]){
      // Two-storey dark timber window rhythm varies by archetype and does
      // not cover the original shop sign immediately below the roof.
      const offset=doorSide<0?.30:0;
      position(lattice,x+dx+offset,earth+13.45,z+2.82,.13,2.45,.20);
    }
    position(beams,x,earth+14.80,z+2.83,17.5,.25,.28);
    position(beams,x,earth+12.15,z+2.83,17.5,.24,.27);
    // High-quality masonry pier/slate courses distinguish each bay from a
    // uniform cube while retaining the originally surveyed street clearance.
    position(stone,x-9.2,earth+5.9,z+2.55,.43,10.3,.50);
    position(stone,x+9.2,earth+5.9,z+2.55,.43,10.3,.50);
    for(const dx of [-6.4,-3.2,3.2,6.4]){
      position(lattice,x+dx,earth+11.80,z+5.64,.13,1.0,.18);
    }
    // Existing flat roof at y+16.4 stays as an under-roof, the curved tile
    // surface is physically ABOVE its y+17.15 top edge.
    position(roof,x,earth+17.20+roofRise*.10,z-6,1,roofRise/2.2,1);
    position(beams,x,earth+17.32,z+4.65,23.5,.30,.42);
    position(beams,x,earth+17.35,z-16.50,23.5,.24,.28);
    // Non-repeating small architecture: three individual shop characters.
    // Ground-following limestone steps remain at pedestrian height; unlike
    // fake giant stair cubes, each tread is no more than 1.4 m above soil.
    if(site.id==='stone-stair'){
      for(let t=0;t<6;t++){
        const sx=x+5.8,sz=z+9.2-t*.63,
          foot=ground(sx,sz),h=.24+t*.22,top=foot+h;
        position(stone,sx,foot+h*.5,sz,2.25,h,.60);
        obstacles.push({x:sx,z:sz,w:2.25,d:.60,
          base:foot-.02,top,marketStep:true});
        stairTreads++;
      }
      position(beams,x+7.25,earth+3.10,z+5.95,.16,3.9,.20);
    }else if(site.id==='tea-lane'){
      // Lower corner shade and real cantilever braces, not repeated neon.
      position(beams,x-5.25,earth+7.75,z+4.75,8.3,.28,2.8);
      for(const dx of [-8.2,-2.3]){
        position(braces,x+dx,earth+6.55,z+4.20,.24,3.25,.25,
          Math.atan2(-2.20,2.35));
      }
    }else if(site.id==='river-market'){
      // A closed timber-grid corner bay distinguishes the riverside shop.
      position(beams,x+8.3,earth+13.5,z+4.65,.33,3.65,.28);
      for(let t=0;t<4;t++){
        position(lattice,x+5.4+t*.93,earth+13.7,z+4.70,.11,2.65,.17);
      }
    }
  }
  for(const mesh of [beams,braces,stone,glass,lattice,roof,interiors]){
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    if(mesh.count)mesh.computeBoundingSphere();
    mesh.frustumCulled=true;
  }
  const stats={
    sites:sites.length,posts:sites.length*2,
    galleryDecks:sites.length,curvedRoofs:roof.count,stairTreads,
    roofTriangles:32*12*2*roof.count,
    meshes:10,batchDraws:7,facadeMaterialDraws:facades.length*2,
    interiorBackings:interiors.count,
    // 6 downstairs windows × (3 timber counters/shelves + 1 partition)
    // + 12 upstairs shutters + 6 staggered upper timber slats.
    interiorFittings:sites.length*14,
    openFacades:facades.length,
    // THREE.BufferGeometry.getIndex() is a BufferAttribute in real WebGL
    // (.count), unlike the array-based headless fixture (.length).
    openFacadeTriangles:facades.reduce((v,m)=>{
      const index=m.geometry.getIndex?.()??m.geometry.index;
      return v+(index?.count??index?.length??0)/3;
    },0),
    instances:[beams,braces,stone,glass,lattice,roof,interiors]
      .reduce((sum,m)=>sum+m.count,0)
  };
  return {
    stats,snapshot:()=>sites.map(s=>({...s})),
    setQuality(mode){
      // Never hide the load-bearing silhouette or walkable collisions on low.
      lattice.visible=mode!=='low';
      glass.visible=true;beams.visible=true;
      stone.visible=true;braces.visible=true;roof.visible=true;
      interiors.visible=true;
      for(const facade of facades)facade.visible=true;
    }
  };
}
