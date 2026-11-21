// Chongqing: damp asphalt, puddle micro-roughness, and soft streetlight streaks.
// Authored procedurally, no remote photos or third-party scene assets.
// Two small batched meshes across the entire city; no RTT / expensive SSR.
export function buildChongqingWetStreets({THREE,scene,ground,riverCenter}) {
  const puddlePositions=[],puddleUvs=[],puddleIndices=[];
  const glowPositions=[],glowUvs=[],glowIndices=[];
  const roadZ=(x,side,tier)=>
    riverCenter(x)+side*(145+tier*105+14*Math.sin(x/115+tier));
  // Stable wetness pattern: fixed, nonrepeating per-location irregular edges.
  let seed=113831;
  const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  function point(x,z,side,tier,offset=0){
    const dzdx=(roadZ(x+1,side,tier)-roadZ(x-1,side,tier))*.5;
    const tangent=Math.atan2(dzdx,1);
    const normalX=-Math.sin(tangent),normalZ=Math.cos(tangent);
    const py=ground(x,roadZ(x,side,tier))+1.68+offset;
    return {x:x+normalX*z,y:py,z:roadZ(x,side,tier)+normalZ*z,angle:tangent};
  }
  function puddle(x,side,tier,lane,length,width){
    // Custom polygon with irregular perimeter and softly darkened PBR material.
    const base=puddlePositions.length/3;
    const c=point(x,lane,side,tier,.04);
    puddlePositions.push(c.x,c.y,c.z);puddleUvs.push(.5,.5);
    const N=18;
    for(let k=0;k<N;k++){
      const angle=k*Math.PI*2/N;
      const distortion=.78+rand()*.22+Math.sin(angle*3.0+rand())*.08;
      const along=Math.cos(angle)*length*distortion;
      const across=Math.sin(angle)*width*distortion;
      const px=x+along*Math.cos(c.angle)-across*Math.sin(c.angle);
      const pz=lane+along*Math.sin(c.angle)+across*Math.cos(c.angle);
      const pt=point(px,pz,side,tier,.038);
      puddlePositions.push(pt.x,pt.y,pt.z);
      puddleUvs.push(.5+.5*Math.cos(angle),.5+.5*Math.sin(angle));
    }
    for(let k=0;k<N;k++)puddleIndices.push(base,base+k+1,base+(k+1)%N+1);
  }
  function lampStreak(x,side,tier,offset){
    const center=point(x,offset,side,tier,.075);
    const length=4+rand()*3.7,width=.45+rand()*.36;
    const a=center.angle,cs=Math.cos(a),sn=Math.sin(a);
    const base=glowPositions.length/3;
    for(const [dx,dz,u,v] of [
      [-length,-width,0,0],[length,-width,1,0],
      [length,width,1,1],[-length,width,0,1]
    ]){
      glowPositions.push(center.x+dx*cs-dz*sn,center.y,
        center.z+dx*sn+dz*cs);
      glowUvs.push(u,v);
    }
    glowIndices.push(base,base+2,base+1,base,base+3,base+2);
  }
  for(const side of [-1,1]){
    for(let tier=0;tier<3;tier++){
      for(let k=0;k<32;k++){
        const x=-903+k*56.4+(rand()-.5)*14;
        const z=roadZ(x,side,tier);
        if(x<-950||x>950||z<-615||z>615)continue;
        // Avoid perfect repetition or overlaying the entire asphalt surface.
        const lane=(rand()>.5?1:-1)*(1.5+rand()*2.15);
        const length=2.8+rand()*5.5,width=.5+rand()*1.2;
        puddle(x,side,tier,lane,length,width);
      }
      // Light ribbons appear only where streetlight geometry already exists.
      for(let i=0;i<17;i++){
        const x=-875+i*107;
        const z=roadZ(x,side,tier);
        if(z<-615||z>615)continue;
        lampStreak(x,side,tier,(i%2===0?1:-1)*4.5);
      }
    }
  }
  function geometry(positions,uvs,indices){
    const meshGeo=new THREE.BufferGeometry();
    meshGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    meshGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    meshGeo.setIndex(indices);meshGeo.computeVertexNormals();
    return meshGeo;
  }
  const wetMaterial=new THREE.MeshPhysicalMaterial({
    color:0x26333c,metalness:.12,roughness:.16,clearcoat:.93,
    clearcoatRoughness:.08,transparent:true,opacity:.42,depthWrite:false,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    side:THREE.DoubleSide
  });
  const puddles=new THREE.Mesh(geometry(puddlePositions,puddleUvs,puddleIndices),wetMaterial);
  puddles.renderOrder=1;
  scene.add(puddles);

  const c=document.createElement('canvas');c.width=64;c.height=128;
  const ctx=c.getContext('2d');
  const gradient=ctx.createRadialGradient(32,64,1,32,64,59);
  gradient.addColorStop(0,'rgba(255,190,97,.52)');
  gradient.addColorStop(.34,'rgba(255,175,92,.25)');
  gradient.addColorStop(.75,'rgba(229,154,76,.05)');
  gradient.addColorStop(1,'rgba(229,154,76,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,c.width,c.height);
  const glowTex=new THREE.CanvasTexture(c);
  glowTex.colorSpace=THREE.SRGBColorSpace;
  const reflectionMaterial=new THREE.MeshBasicMaterial({
    map:glowTex,color:0xffcf9b,transparent:true,opacity:.52,
    depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending
  });
  const reflections=new THREE.Mesh(geometry(glowPositions,glowUvs,glowIndices),reflectionMaterial);
  reflections.renderOrder=2;
  scene.add(reflections);

  function setQuality(mode){
    const low=mode==='low';
    puddles.visible=!low;
    reflections.visible=!low;
  }
  let time=0;
  function update(dt){
    if(!reflections.visible)return;
    time+=Math.min(Math.max(dt,0),.05);
    reflectionMaterial.opacity=.49+.05*Math.sin(time*.7);
  }
  return {
    update,setQuality,
    stats:{puddles:puddleIndices.length/54,reflectionStrips:glowIndices.length/6,drawGroups:2}
  };
}