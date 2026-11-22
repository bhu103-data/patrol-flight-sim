// A deliberately small, reversible Hongyadong riverside street prototype.
// It changes only surface dressing; landmark geometry, collision and flight paths stay intact.
export const HONGYADONG_STREET_SEGMENT={
  xMin:96,xMax:226,side:1,centerOffset:66,width:16
};

function makeSurfaceTexture(THREE){
  const canvas=document.createElement('canvas'); canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#8a837b';ctx.fillRect(0,0,256,256);
  for(let y=0;y<256;y+=34){
    const shift=(y/34%2)*24;
    for(let x=-24;x<280;x+=48){
      const v=118+((x*17+y*7)%29);
      ctx.fillStyle=`rgb(${v},${v-3},${v-8})`;
      ctx.fillRect(x+shift+2,y+2,44,30);
      ctx.strokeStyle='rgba(35,35,34,.45)';ctx.lineWidth=2;ctx.strokeRect(x+shift+1,y+1,46,32);
    }
  }
  for(let i=0;i<92;i++){
    const x=(i*83)%256,y=(i*47)%256;
    ctx.fillStyle=i%3?'rgba(31,35,37,.12)':'rgba(226,203,174,.13)';
    ctx.fillRect(x,y,4+(i%7),2+(i%4));
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(1.3,5.4);
  texture.anisotropy=4;
  return texture;
}

function makeRibbon(THREE,points,width,yOffset=0){
  const positions=[],uvs=[],indices=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
    const nx=-dz/len,nz=dx/len;
    positions.push(p.x+nx*width/2,p.y+yOffset,p.z+nz*width/2,
      p.x-nx*width/2,p.y+yOffset,p.z-nz*width/2);
    uvs.push(i/(points.length-1),0,i/(points.length-1),1);
    if(i){const k=(i-1)*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(indices);g.computeVertexNormals();
  return g;
}

function addBoxStrip(THREE,group,material,points,width,height=0,yOffset=0){
  const geo=makeRibbon(THREE,points,width,yOffset+height);
  const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  // The thin vertical face is intentionally omitted: this is a surface prototype,
  // not a replacement for the existing collision/retaining-wall geometry.
  return mesh;
}

export function buildHongyadongStreetPrototype({THREE,scene,ground,riverCenter,pbr}){
  const group=new THREE.Group();group.name='HongyadongStreetPrototype';scene.add(group);
  const path=[];
  for(let x=HONGYADONG_STREET_SEGMENT.xMin;x<=HONGYADONG_STREET_SEGMENT.xMax;x+=5){
    const z=riverCenter(x)+HONGYADONG_STREET_SEGMENT.centerOffset+5*Math.sin(x*.045);
    // The lowest riverside terrace is an elevated boardwalk above the water;
    // keep it at the lower Hongyadong floor rather than burying it in the river.
    path.push({x,z,y:Math.max(ground(x,z)+.12,11.6)});
  }
  const walkwayMat=new THREE.MeshStandardMaterial({map:makeSurfaceTexture(THREE),color:0xd2cbc1,roughness:.88,metalness:0});
  const dryAsphalt=pbr.asphalt.clone();dryAsphalt.color.set(0x5d6260);dryAsphalt.roughness=.78;
  const wetAsphalt=pbr.asphalt.clone();wetAsphalt.color.set(0x36464d);wetAsphalt.roughness=.22;wetAsphalt.metalness=.06;wetAsphalt.clearcoat=.55;wetAsphalt.clearcoatRoughness=.16;
  const curb=pbr.stone.clone();curb.color.set(0xbab5ab);curb.roughness=.94;
  const wall=pbr.concrete.clone();wall.color.set(0x817c78);wall.roughness=.96;
  const seamMat=new THREE.MeshStandardMaterial({color:0x2b3030,roughness:.54,metalness:.1});
  const dry=path.slice(0,11),wet=path.slice(11,19),dry2=path.slice(19);
  const meshes=[addBoxStrip(THREE,group,walkwayMat,path,12),
    addBoxStrip(THREE,group,curb,path,1.1,.18,.15),
    addBoxStrip(THREE,group,wall,path,1.35,.16,-.4),
    addBoxStrip(THREE,group,dryAsphalt,dry,4,.025,.03),
    addBoxStrip(THREE,group,wetAsphalt,wet,4,.025,.035),
    addBoxStrip(THREE,group,dryAsphalt,dry2,4,.025,.03)];
  // Expansion joints and drainage slots: sparse, localized, and cheap.
  const drains=[];
  for(let i=3;i<path.length-2;i+=5){
    const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
    const nx=-dz/len,nz=dx/len;
    const g=makeRibbon(THREE,[{x:a.x+nx*4,z:a.z+nz*4,y:a.y+.06},{x:a.x-nx*4,z:a.z-nz*4,y:a.y+.06}],.32);
    const m=new THREE.Mesh(g,seamMat);m.rotation.y=0;group.add(m);drains.push(m);
  }
  const signs=[];
  function sign(text,x,z){
    const c=document.createElement('canvas');c.width=256;c.height=64;const ctx=c.getContext('2d');
    ctx.fillStyle='#17333b';ctx.fillRect(0,0,256,64);ctx.fillStyle='#f3d6a0';ctx.font='bold 26px sans-serif';ctx.textAlign='center';ctx.fillText(text,128,41);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
    const m=new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide});
    const s=new THREE.Mesh(new THREE.PlaneGeometry(5.5,1.35),m);s.position.set(x,ground(x,z)+3.1,z);s.rotation.y=Math.PI/2;s.name='GenericChongqingWayfinding';group.add(s);signs.push(s);
  }
  sign('临江步道',151,riverCenter(151)+66);
  sign('出口  →',216,riverCenter(216)+66);
  let quality='normal';
  return {
    stats:{segment:'hongyadong-riverside-walkway',bounds:{...HONGYADONG_STREET_SEGMENT},meshes:meshes.length,drains:drains.length,signs:signs.length,materials:['stone-pavers','dry-asphalt','wet-asphalt','curb','retaining-wall']},
    setQuality(mode){quality=mode;const low=mode==='low';drains.forEach(m=>m.visible=!low);signs.forEach(s=>s.visible=!low);meshes.forEach(m=>m.visible=true);},
    setTimeOfDay(){},
    getDebug(){return {quality,segment:HONGYADONG_STREET_SEGMENT,textureBindings:{walkway:!!walkwayMat.map,dryAsphalt:!!dryAsphalt.map,wetAsphalt:!!wetAsphalt.map,curb:!!curb.map,wall:!!wall.map},drawCalls:meshes.length+drains.length+signs.length};}
  };
}
