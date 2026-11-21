/**
 * Bounded steel dead-end guards for Chongqing's unbridged tributary approaches.
 * Procedural original art; no new texture downloads or unlicensed street scans.
 * Scene input is the actual river-clipped road ends, not invented map points.
 */
export function buildChongqingShorelineBarriers({THREE,scene,ends=[]}){
  if(!THREE||!scene||typeof scene.add!=='function'||!Array.isArray(ends))
    throw new TypeError('Invalid Chongqing shoreline barrier scene');
  const valid=ends.filter(e=>e&&[e.point?.x,e.point?.y,e.point?.z,
    e.tangent?.[0],e.tangent?.[1],e.width,e.intoRoad].every(Number.isFinite)&&
    e.width>=3&&Math.hypot(...e.tangent)>.01&&Math.abs(e.intoRoad)===1);
  // There are six end guards for three tributary crossings. Cap accidental
  // future additions at 24 without allocating a draw per individual post.
  const sites=valid.slice(0,24);
  const stats={barriers:sites.length,posts:0,rails:0,reflectors:0,
    skippedInvalid:ends.length-sites.length};
  if(!sites.length)return stats;
  const grey=new THREE.MeshStandardMaterial({
    color:0x747d81,metalness:.68,roughness:.48
  });
  const red=new THREE.MeshStandardMaterial({
    color:0xa6372d,metalness:.12,roughness:.42,
    emissive:0x2c0704,emissiveIntensity:.07
  });
  const white=new THREE.MeshStandardMaterial({
    color:0xd6d8d2,metalness:.08,roughness:.39,
    emissive:0x171915,emissiveIntensity:.045
  });
  const unit=new THREE.BoxGeometry(1,1,1),tmp=new THREE.Object3D();
  function pool(geometry,material,max){
    const mesh=new THREE.InstancedMesh(geometry,material,max);
    mesh.count=0;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.castShadow=false;mesh.receiveShadow=true;
    return mesh;
  }
  const posts=pool(new THREE.CylinderGeometry(.075,.085,1,9),grey,sites.length*5);
  const rails=pool(unit,grey,sites.length*2);
  const reflRed=pool(unit,red,sites.length*3);
  const reflWhite=pool(unit,white,sites.length*2);
  function place(mesh,x,y,z,yaw,w,h,d){
    const index=mesh.count++;
    tmp.position.set(x,y,z);
    tmp.rotation.set(0,yaw,0);
    tmp.scale.set(w,h,d);
    tmp.updateMatrix();mesh.setMatrixAt(index,tmp.matrix);
  }
  for(const end of sites){
    const [dx,dz]=end.tangent,len=Math.hypot(dx,dz);
    const fx=dx/len,fz=dz/len,nx=-fz,nz=fx;
    // Keep the guard on the verified dry section, not over the cut/water.
    const x=end.point.x+fx*end.intoRoad*.72;
    const z=end.point.z+fz*end.intoRoad*.72;
    const y=end.point.y,yaw=Math.atan2(-nz,nx);
    // Two galvanized steel rails and five cylindrical posts form a solid
    // road-width visual terminus, rather than an oversized block.
    for(const h of [.69,1.05])
      place(rails,x,y+h,z,yaw,end.width+.50,.105,.145);
    for(let i=0;i<5;i++){
      const across=(i-2)*(end.width/4);
      const px=x+nx*across,pz=z+nz*across;
      place(posts,px,y+.08,pz,0,1,2.25,1);
      const mesh=i%2===0?reflRed:reflWhite;
      place(mesh,px,y+.96,pz,yaw,Math.min(1.25,end.width/5),.19,.175);
    }
    stats.posts+=5;stats.rails+=2;stats.reflectors+=5;
  }
  for(const mesh of [posts,rails,reflRed,reflWhite]){
    mesh.instanceMatrix.needsUpdate=true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  return stats;
}
