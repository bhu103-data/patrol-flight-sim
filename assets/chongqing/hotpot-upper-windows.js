// Local, original WebGL window-depth relief for the PATROL Chongqing hotpot
// storefront. This overlays the legacy flat glass without cutting the solid
// load-bearing game collision box; it is NOT a surveyed/open-air window hole.
// Three instanced draws, no external images/assets, aligned with original
// seven frontage bays and the 72-unit restaurant perimeter.
export function buildChongqingHotpotUpperWindows({THREE,scene,pbr,shopX,shopZ,shopFloor}){
  if(![shopX,shopZ,shopFloor].every(Number.isFinite))
    throw new RangeError('Hotpot upper-window site must be finite');
  if(!THREE||!scene||!pbr)throw new TypeError('Missing upper-window render resources');
  const back=[],glass=[],joinery=[],bayWidths=[],styles=[];
  const limitL=shopX-35.1,limitR=shopX+35.45;
  const paletteGlass=[0x6b828b,0x9a9589,0x587b80,0x849ba0,
    0x8b7866,0x647983,0x80928d];
  const paletteWood=[0xdac8b1,0xb8a58d,0xd1bc9e,0xc7aa87,
    0xab9b87,0xd8c5a6,0xbfad95];
  for(let bay=0;bay<7;bay++){
    // Source: details.js shopfront x = shopX-30+bay*10 + 4.5;
    // 7th source pane overruns the outer wall; keep this framed reveal IN
    // the existing shop silhouette instead of repeating the bad overhang.
    const sourceX=shopX-25.5+bay*10;
    const left=Math.max(limitL,sourceX-4.03);
    const right=Math.min(limitR,sourceX+4.03);
    const width=right-left,center=(right+left)/2;
    if(width<2.5)throw new RangeError('Hotpot window too narrow');
    const height=[5.35,5.7,5.05,5.5,5.9,5.18,5.55][bay];
    const mid=shopFloor+12.02+([0,.08,-.06,.10,-.04,.12,-.03][bay]);
    // Dark backing starts in front of the old window's z=+26.60 face.
    // Panes are inset behind independently projecting timber returns:
    // backing front +26.82, glass front +26.99, frame front +27.52.
    back.push({x:center,y:shopFloor+12,z:shopZ+26.76,
      w:width,h:6.23,d:.12,tint:0x293640});
    glass.push({x:center,y:mid,z:shopZ+26.95,
      w:width-.56,h:height,d:.08,tint:paletteGlass[bay]});
    const edge=width/2-.16;
    for(const side of [-1,1]){
      joinery.push({x:center+side*edge,y:shopFloor+12,
        z:shopZ+27.19,w:.26,h:6.42,d:.64,
        tint:paletteWood[(bay+side+7)%paletteWood.length]});
    }
    for(const heightY of [8.85,15.12]){
      joinery.push({x:center,y:shopFloor+heightY,
        z:shopZ+27.19,w:width,h:.25,d:.64,
        tint:paletteWood[(bay+Math.round(heightY))%paletteWood.length]});
    }
    // Distinct widths, mullion offsets, transoms and partial blinds, not
    // seven repeated texture-only 2x2 window grids.
    const dividers=1+(bay%3);
    const inner=(width-.66), step=inner/(dividers+1);
    for(let m=1;m<=dividers;m++){
      joinery.push({x:center-inner/2+step*m,y:mid,z:shopZ+27.10,
        w:.11+(bay%2)*.03,h:height-.10,d:.33,
        tint:paletteWood[(bay+m*2)%paletteWood.length]});
    }
    if(bay%3!==1){
      joinery.push({x:center,y:mid+(bay%2?-.35:.62),z:shopZ+27.12,
        w:width-.45,h:.13,d:.35,
        tint:paletteWood[(bay+3)%paletteWood.length]});
    }
    if(bay===1||bay===5){
      // Three restrained interior timber blind rails, visibly recessed.
      for(let k=0;k<3;k++)joinery.push({
        x:center,y:mid+height*.30-k*.32,z:shopZ+27.02,
        w:width-.67,h:.085,d:.18,tint:paletteWood[(bay+k)%paletteWood.length]
      });
    }
    // Continuous sill, genuinely projecting beyond the inset glass.
    joinery.push({x:center,y:shopFloor+8.66,z:shopZ+27.27,
      w:width+.02,h:.15,d:.55,tint:paletteWood[(bay+4)%paletteWood.length]});
    bayWidths.push(width);
    styles.push({bay,mullions:dividers,blinds:bay===1||bay===5,height});
  }
  const cube=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
  function batch(items,name,material){
    const mesh=new THREE.InstancedMesh(cube,material,items.length);
    mesh.name=name;mesh.count=items.length;mesh.receiveShadow=true;
    mesh.castShadow=false;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    for(let i=0;i<items.length;i++){
      const p=items[i];
      dummy.position.set(p.x,p.y,p.z);
      dummy.rotation.set(0,0,0);dummy.scale.set(p.w,p.h,p.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i,dummy.matrix);
      mesh.setColorAt(i,new THREE.Color(p.tint));
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.instanceColor.needsUpdate=true;
    scene.add(mesh);return mesh;
  }
  const backingMat=new THREE.MeshStandardMaterial({
    color:0x495a64,metalness:0,roughness:.92,
    side:THREE.DoubleSide
  });
  const glassMat=pbr.glassPane?.clone?.()??new THREE.MeshStandardMaterial({
    color:0x9bb0b6,metalness:.23,roughness:.25
  });
  // Real WebGL daylight A/B caught an oversized orange point-light glare
  // from the inherited highly metallic smooth-glass material. The pane now
  // reads as slightly weathered glass rather than a polished metal mirror;
  // never modify the shared PBR glass material used by other buildings.
  glassMat.transparent=false;
  if(glassMat.color?.setHex)glassMat.color.setHex(0xb9c8cd);
  glassMat.roughness=.64;glassMat.metalness=.08;
  if('emissiveIntensity' in glassMat)glassMat.emissiveIntensity=.12;
  const timberMat=pbr.carvedWood?.clone?.()??new THREE.MeshStandardMaterial({
    color:0x9c8c77,roughness:.85
  });
  timberMat.roughness=.82;timberMat.metalness=0;
  const backMesh=batch(back,'hotpot-upper-reveal-backing',backingMat);
  const glassMesh=batch(glass,'hotpot-upper-inset-glazing',glassMat);
  const frameMesh=batch(joinery,'hotpot-upper-projecting-timber-frames',timberMat);
  return {
    backMesh,glassMesh,frameMesh,
    bays:back.length,frameCount:joinery.length,
    glassCount:glass.length,drawCalls:3,
    triangles:(back.length+glass.length+joinery.length)*12,
    depth:27.52-26.82,bayWidths,styles,
    maxX:Math.max(...joinery.map(p=>p.x+p.w/2)),
    minX:Math.min(...joinery.map(p=>p.x-p.w/2)),
    maxY:Math.max(...joinery.map(p=>p.y+p.h/2))-shopFloor
  };
}
