// Original game-scale detail for the lower street-facing Chongqing hotpot shop.
// Geometry uses the existing CC0/locally authored PBR materials; no downloads.
// Two instanced draws replace a flat-looking wall below the existing windows.
// The top of all pieces remains below the glazing, and no obstacles are added.
export function buildChongqingHotpotLowerFacade({
  THREE,scene,pbr,shopX,shopZ,shopFloor
}){
  if(![shopX,shopZ,shopFloor].every(Number.isFinite))
    throw new RangeError('Hotpot facade coordinates must be finite');
  if(!THREE||!scene||!pbr)throw new TypeError('Missing Three.js/scene/materials');
  const minX=shopX-35.4,maxX=shopX+35.4;
  const frontZ=shopZ+26.30;
  const stoneParts=[],timberParts=[];
  const paletteStone=[0xdbddd9,0xcacbc5,0xe2dfd8,0xd4d5cf,0xbfc6c4];
  const paletteTimber=[0xeee6dd,0xe2dbd4,0xd5c7b9,0xf1e7db,0xcfc4bc,0xe6d3bf];
  // Three low, shallow coursed masonry bands. The existing stone forecourt
  // top is floor+0.78: begin ABOVE it, not inside its drain or collision plane.
  // Alternate brick joints without opening gaps at the old box edges.
  for(let row=0;row<3;row++){
    const pitch=7.05,offset=row%2?pitch/2:0;
    for(let col=-1;col<=11;col++){
      const center=minX+col*pitch+offset+pitch/2;
      const a=Math.max(minX,center-pitch*.5+.055);
      const b=Math.min(maxX,center+pitch*.5-.055);
      if(b-a<.65)continue;
      stoneParts.push({
        x:(a+b)/2,y:shopFloor+1.06+row*.70,z:frontZ,
        w:b-a,h:.645,d:.20,
        tint:paletteStone[(row*7+col*3+25)%paletteStone.length]
      });
    }
  }
  // A shallow crowning cap visually joins the masonry and the timber below
  // the windows; it is wall relief, not a curb or walkable step.
  stoneParts.push({
    x:shopX,y:shopFloor+3.045,z:frontZ+.09,
    w:70.8,h:.36,d:.34,tint:0xd3d6d2
  });
  // Six clearly articulated wood-batten bays, behind pre-existing massive
  // load-bearing posts at x = shopX-30..shopX+30. No intrusion into windows
  // beginning around floor+9, and no imaginary cut-outs in the solid core.
  for(let bay=0;bay<6;bay++){
    const center=shopX-25+bay*10;
    const panelY=shopFloor+5.75;
    // Tongue-and-groove boards, spaced so the dark join shadow is visible
    // from a pedestrian camera at night and in daylight.
    for(let strip=0;strip<9;strip++){
      const x=center-3.77+strip*.94;
      const shade=paletteTimber[(bay*5+strip*3+Math.floor(strip/3))%paletteTimber.length];
      timberParts.push({
        x,y:panelY,z:frontZ+.06,
        w:.81,h:4.55,d:.19,tint:shade
      });
    }
    // Actual projecting top/bottom girts and slightly raised center brace:
    // their layered silhouettes should survive dark low-quality rendering.
    for(const [height,thickness] of [[3.36,.24],[8.18,.25],[6.15,.13]]){
      timberParts.push({
        x:center,y:shopFloor+height,z:frontZ+.22,
        w:8.62,h:thickness,d:.25,
        tint:paletteTimber[(bay*2+3)%paletteTimber.length]
      });
    }
  }
  const cube=new THREE.BoxGeometry(1,1,1);
  const tmp=new THREE.Object3D();
  function batch(parts,name,base,color){
    const material=base?.clone?.()??new THREE.MeshStandardMaterial({
      color,roughness:.94,metalness:0
    });
    // Keep existing atlas normals, roughness and color texture; the tint
    // deliberately avoids saturated orange/red billboard appearance.
    if(material.color?.setHex)material.color.setHex(color);
    material.roughness=.93;material.metalness=0;
    const mesh=new THREE.InstancedMesh(cube,material,parts.length);
    mesh.name=name;mesh.count=parts.length;
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.receiveShadow=true;
    mesh.castShadow=false;
    for(let i=0;i<parts.length;i++){
      const p=parts[i];
      tmp.position.set(p.x,p.y,p.z);
      tmp.rotation.set(0,0,0);
      tmp.scale.set(p.w,p.h,p.d);
      tmp.updateMatrix();
      mesh.setMatrixAt(i,tmp.matrix);
      mesh.setColorAt(i,new THREE.Color(p.tint));
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.instanceColor.needsUpdate=true;
    scene.add(mesh);
    return mesh;
  }
  const masonry=batch(stoneParts,'hotpot-lower-coursed-masonry',
    pbr.cutStone,0xb5b5ae);
  const timber=batch(timberParts,'hotpot-lower-timber-cladding',
    pbr.carvedWood,0x94715e);
  return {
    masonry,timber,masonryCount:stoneParts.length,
    timberCount:timberParts.length,
    totalTriangles:(stoneParts.length+timberParts.length)*12,
    drawCalls:2,
    topY:Math.max(...timberParts.map(p=>p.y+p.h*.5)),
    frontZ, minX,maxX
  };
}
