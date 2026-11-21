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
  const glassMat=pbr?.glass??new THREE.MeshStandardMaterial({
    color:0x3e5964,roughness:.23,metalness:.2,side:THREE.DoubleSide
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
    glass=batch(unit,glassMat,24),
    lattice=batch(unit,trimMat,144),
    roof=batch(makeChongqingMarketTileRoof(THREE),tileMat,3);
  const position=(mesh,x,y,z,w,h,d,rotX=0,rotZ=0)=>{
    if(mesh.count>=mesh.instanceMatrix.count)throw Error('Chongqing gallery batch exceeded '+mesh.instanceMatrix.count);
    marker.position.set(x,y,z);
    marker.scale.set(w,h,d);
    marker.rotation.set(rotX,0,rotZ);
    marker.updateMatrix();
    mesh.setMatrixAt(mesh.count++,marker.matrix);
  };
  const sites=[];
  let stairTreads=0;
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
    position(glass,doorX,earth+3.15,z+2.53,3.05,5.3,.10);
    for(const dx of [-7.1,0,7.1]){
      if(Math.abs((x+dx)-doorX)<3.0)continue;
      position(glass,x+dx,earth+5.6,z+2.53,4.2,4.3,.1);
      position(beams,x+dx,earth+5.6,z+2.65,.11,4.65,.18);
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
  for(const mesh of [beams,braces,stone,glass,lattice,roof]){
    mesh.instanceMatrix.needsUpdate=true;
    if(mesh.count)mesh.computeBoundingSphere();
    mesh.frustumCulled=true;
  }
  const stats={
    sites:sites.length,posts:sites.length*2,
    galleryDecks:sites.length,curvedRoofs:roof.count,stairTreads,
    roofTriangles:32*12*2*roof.count,
    meshes:6,instances:[beams,braces,stone,glass,lattice,roof]
      .reduce((sum,m)=>sum+m.count,0)
  };
  return {
    stats,snapshot:()=>sites.map(s=>({...s})),
    setQuality(mode){
      // Never hide the load-bearing silhouette or walkable collisions on low.
      lattice.visible=mode!=='low';
      glass.visible=true;beams.visible=true;
      stone.visible=true;braces.visible=true;roof.visible=true;
    }
  };
}
