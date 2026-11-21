// PATROL Chongqing detailed hero zone — authored locally from procedural geometry.
// No textures or meshes copied from other games. Deliberately localized for small download size.
export function buildChongqingDetails({THREE,scene,ground,riverCenter,rand,box,ball,sign,hotpot,obstacles}) {
  const unit=new THREE.BoxGeometry(1,1,1);
  const sphere=new THREE.IcosahedronGeometry(1,1);
  const up=new THREE.Vector3(0,1,0);
  const dummy=new THREE.Object3D();
  const color={};
  // Tiny procedural material atlases instead of large downloaded photographs.
  function tiledTexture(type) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const c=canvas.getContext('2d');
    c.fillStyle=type==='roof'?'#bcb1ac':type==='stone'?'#d0c6bb':'#bda996';
    c.fillRect(0,0,256,256);
    if(type==='roof'){
      for(let row=0;row<14;row++)for(let col=-1;col<15;col++){
        const x=col*20+(row%2)*10,y=row*20;
        c.fillStyle=['#a99e94','#c0b3a8','#d2bda9','#998b82'][(col*13+row*7+1000)%4];
        c.fillRect(x+1,y+1,18,17);
        c.strokeStyle='#756a66';c.lineWidth=1.1;
        c.beginPath();c.moveTo(x+1,y+18);c.quadraticCurveTo(x+10,y+11,x+19,y+18);c.stroke();
        c.fillStyle='#e0d0bf';c.fillRect(x+2,y+2,15,1.2);
      }
    }else if(type==='stone'){
      for(let row=0;row<14;row++)for(let col=-1;col<15;col++){
        const x=col*22+(row%2)*11,y=row*19;
        c.fillStyle=['#bbb5b0','#d2ccc2','#ada9a4','#c8bfb2'][(row*9+col*11+1000)%4];
        c.fillRect(x+1,y+1,21,18);
        c.strokeStyle='#817c79';c.lineWidth=.9;c.strokeRect(x+1,y+1,21,18);
      }
    }else{
      for(let i=0;i<70;i++){
        const y=(i*73)%256;
        c.strokeStyle=i%3===0?'#7f695b':'#dac3ad';
        c.globalAlpha=.18+(i%5)*.08;c.lineWidth=i%7===0?2:.7;
        c.beginPath();c.moveTo(0,y);c.bezierCurveTo(65,y+Math.sin(i)*4,185,y-Math.cos(i)*3,256,y);c.stroke();
      }
      c.globalAlpha=1;
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(type==='roof'?3:2,type==='roof'?2:3);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=4;texture.generateMipmaps=true;
    return texture;
  }
  const roofTexture=tiledTexture('roof'),stoneTexture=tiledTexture('stone'),woodTexture=tiledTexture('wood');
  const materials={
    timber:new THREE.MeshStandardMaterial({color:0x9f6855,map:woodTexture,bumpMap:woodTexture,bumpScale:.025,roughness:.79}),
    carved:new THREE.MeshStandardMaterial({color:0xbd8b62,map:woodTexture,roughness:.67}),
    terra:new THREE.MeshStandardMaterial({color:0x8c5555,map:roofTexture,bumpMap:roofTexture,bumpScale:.05,roughness:.72}),
    rail:new THREE.MeshStandardMaterial({color:0x7e8791,metalness:.52,roughness:.5}),
    stone:new THREE.MeshStandardMaterial({color:0xb6adb0,map:stoneTexture,bumpMap:stoneTexture,bumpScale:.04,roughness:.91}),
    paving:new THREE.MeshStandardMaterial({color:0x55545a,roughness:.96}),
    steps:new THREE.MeshStandardMaterial({color:0xbdb2a9,map:stoneTexture,roughness:.89}),
    window:new THREE.MeshBasicMaterial({color:0xffcf86}),
    neon:new THREE.MeshBasicMaterial({color:0xffbd70}),
    red:new THREE.MeshBasicMaterial({color:0xff4142}),
    bridge:new THREE.MeshStandardMaterial({color:0xa7232c,metalness:.46,roughness:.38,emissive:0x7c0917,emissiveIntensity:.4}),
    amber:new THREE.MeshBasicMaterial({color:0xffa843}),
    blue:new THREE.MeshBasicMaterial({color:0x61b9e5})
  };
  const definitions=[
    ['timber',3600],['carved',1100],['terra',950],['rail',1300],['stone',2700],
    ['paving',1250],['steps',1250],['window',3500],['neon',1700],['red',700],
    ['bridge',850],['amber',950],['blue',800]
  ];
  const pools=new Map();
  for(const [name,capacity] of definitions){
    const mesh=new THREE.InstancedMesh(unit,materials[name],capacity);
    mesh.count=0;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.frustumCulled=false;
    scene.add(mesh);pools.set(name,{mesh,capacity,count:0});
  }
  function put(name,x,y,z,w,h,d,rx=0,ry=0,rz=0){
    const p=pools.get(name);if(!p||p.count>=p.capacity)return;
    dummy.position.set(x,y,z);dummy.scale.set(w,h,d);
    dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();
    p.mesh.setMatrixAt(p.count++,dummy.matrix);
  }
  function beam(name,a,b,r=.6,depth=r){
    const p=pools.get(name);if(!p||p.count>=p.capacity)return;
    const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),v=vb.clone().sub(va);
    if(v.lengthSq()<.001)return;
    dummy.position.copy(va).add(vb).multiplyScalar(.5);
    dummy.quaternion.setFromUnitVectors(up,v.clone().normalize());
    dummy.scale.set(r,v.length(),depth);dummy.updateMatrix();
    p.mesh.setMatrixAt(p.count++,dummy.matrix);
  }
  function lantern(x,y,z,r=1.65){
    const p=pools.get('red');
    if(p.count<p.capacity){
      dummy.position.set(x,y,z);dummy.rotation.set(0,0,0);dummy.scale.set(r,r*1.35,r);
      dummy.updateMatrix();p.mesh.setMatrixAt(p.count++,dummy.matrix);
    }
    put('amber',x,y+r*1.42,z,r*.65,.18,r*.65);
    put('amber',x,y-r*1.42,z,r*.65,.18,r*.65);
  }

  // Hongyadong: distinct eleven-level terraced profile with railings, bracket sets, glazed stalls,
  // suspended lanterns, timber posts and pitched tiled roofs.
  const hongX=155;
  for(let level=0;level<11;level++){
    const z=112+level*8.3, y=13+level*10.25, w=128-level*4.1;
    const front=z+12.15;
    const sections=Math.floor((w-8)/7);
    put('terra',hongX,y+10.45,z,w+15,1.1,33);
    put('carved',hongX,y+9.15,front+1,w+5,.72,1.25);
    put('amber',hongX,y+10.1,front+3,w+7,.19,.3);
    put('timber',hongX,y+2.1,front+3.6,w+8,.85,2);
    put('carved',hongX,y+6.45,front+4.6,w+9,.45,1.1);
    // A balconied gallery, with warm restaurant interiors instead of a single flat face.
    for(let j=0;j<sections;j++){
      const x=hongX-w/2+4+(j+.5)*(w-8)/sections;
      put('timber',x,y+4.3,front,1.15,9.2,1.5);
      put('window',x,y+5.6,front+.16,4.0,5.5,.12);
      put('terra',x,y+5.5,front+.27,.28,5.8,.19);
      if(j%2===0){
        lantern(x,y+8.45,front+5.5,1.05);
        beam('timber',[x,y+8.8,front],[x,y+7.5,front+4],.33);
      }
      // Individual timber window ledges.
      put('carved',x,y+2.25,front+.4,4.5,.38,.65);
      if(j%3===0)put('window',x,y+3.3,front+.29,2.1,1.15,.15);
    }
    // Cantilever posts and infill balcony balustrades.
    for(let j=0;j<=sections;j++){
      const x=hongX-w/2+4+j*(w-8)/sections;
      put('timber',x,y+3.6,front+5,.48,3.7,.48);
      if(j>0)put('carved',x-(w-8)/(2*sections),y+3.9,front+5,(w-8)/sections,.33,.35);
    }
    // Each level has subtly staggered rooflets rather than a flat slab.
    for(let wing=0;wing<3;wing++){
      const width=(w+5)/3, cx=hongX+(wing-1)*width;
      const roofZ=z-(wing%2===0?0:2);
      const eave=y+11.2, rise=3.2+((level+wing)%3)*.5;
      const angle=Math.atan2(rise,18);
      const slope=Math.hypot(18,rise);
      put('terra',cx,eave+rise/2,roofZ+9,width+2,1.15,slope,angle);
      put('terra',cx,eave+rise/2,roofZ-9,width+2,1.15,slope,-angle);
      put('carved',cx,eave+rise,roofZ,width+3,.9,.8);
      put('amber',cx,eave-.2,roofZ+18,width+3,.21,.45);
      // Upturned eave ends + tile seams.
      for(const edge of [-1,1]){
        put('carved',cx+edge*(width/2+1),eave+.65,roofZ+17.7,2.0,1.3,.8);
      }
    }
    // Timber columns deliberately extend down into the lower terrace: stilt-house rhythm.
    if(level<8)for(let j=0;j<6;j++){
      const x=hongX-w/2+5+j*(w-10)/5;
      put('timber',x,y-1.6,z+6,1.6,13,1.6);
    }
    if(level%3===0){
      // Side terraces have their own lantern-lit entrances.
      lantern(hongX-w/2-8,y+7,z+4,1.5);
      lantern(hongX+w/2+8,y+7,z+4,1.5);
      put('steps',hongX+w/2+6,y+2,z+4,9,.6,11);
    }
  }
  // Riverfront stilt gallery: support piles are visible from beneath the building.
  for(let x=91;x<=219;x+=10){
    put('timber',x,11,118,1.5,23,1.5);
    put('timber',x,6,131,1.0,13,1.0);
    put('window',x,19,133,5.6,6,.1);
  }
  for(let z=98;z<175;z+=8){
    put('stone',80,ground(80,z)+1,z,8,2.0,6);
    put('amber',83.9,ground(80,z)+2.25,z,0.22,.25,4);
  }

  // The Qiansimen crossing uses an arched crimson truss silhouette with diagonal web members.
  // Unlike the second stylized cable-stayed crossing it is no longer dominated by pylons.
  const by=59, bx=-230;
  for(const side of [-1,1]){
    const xx=bx+side*9.7;
    for(let i=0;i<28;i++){
      const z0=-168+i*12,z1=z0+12;
      const archZ=z=>by+13+48*Math.sqrt(Math.max(0,1-(z/184)**2));
      const a=[xx,archZ(z0),z0],b=[xx,archZ(z1),z1];
      beam('bridge',a,b,1.8,1.8);
      beam('bridge',[xx,by+2,z0],[xx,by+2,z1],1.35,1.2);
      if(i<27){
        beam('bridge',[xx,by+2,z0],a,.64,.64);
        if(i%2===0)beam('bridge',[xx,by+2,z0],b,.67,.67);
        else beam('bridge',a,[xx,by+2,z1],.67,.67);
      }
      if(i%2===0){
        put('red',xx,by+4,z0,.62,.34,1.7);
        put('amber',xx,by+1.35,z0,.35,.15,1.8);
      }
    }
  }
  for(let i=0;i<15;i++){
    const z=-158+i*23;
    put('bridge',bx,by+17,z,21.5,.6,.6);
    beam('bridge',[bx-9.7,by+13,z],[bx+9.7,by+13,z],.5,.55);
  }

  // Layered roads: limestone parapets, guide stripes, lamp heads and zebra crossings.
  for(const side of [-1,1])for(let band=0;band<2;band++){
    let previous=null;
    for(let j=0;j<=70;j++){
      const x=-850+j*24;
      const z=riverCenter(x)+side*(143+band*106+14*Math.sin(x/115+band));
      const y=ground(x,z)+2.2;
      if(previous){
        beam('stone',[previous.x,previous.y,previous.z+side*7],[x,y,z+side*7],.42,.5);
        const mx=(previous.x+x)*.5,mz=(previous.z+z)*.5,my=(previous.y+y)*.5;
        put('amber',mx,my+.11,mz,2.8,.10,.3);
      }
      if(j%5===0){
        const edge=z+side*9;
        put('rail',x,y+3.8,edge,.46,6,.46);
        put('neon',x,y+6.8,edge-side*1.7,2.2,.18,.95);
        if(j%10===0)put('stone',x,y-1,z+side*11,3,2,3);
      }
      if(j%12===0){
        for(let stripe=-2;stripe<=2;stripe++)put('steps',x+stripe*1.8,y+.15,z,1.1,.12,9);
      }
      previous={x,y,z};
    }
  }

  // Hero area pedestrian staircase: each tread tracks the hillside's uneven heightfield.
  function stairs(sx,sz,dx,dz,count=72,width=7){
    for(let i=0;i<count;i++){
      const f=i/(count-1),x=sx+dx*f,z=sz+dz*f,y=ground(x,z)+.45;
      put('steps',x,y,z,width,.75,Math.max(2,Math.hypot(dx,dz)/count));
      if(i%3===0)for(const side of [-1,1]){
        put('rail',x+side*(width/2+.4),y+1.45,z,.29,2.8,.29);
      }
      if(i%14===0){
        const y2=y+5.2;
        put('timber',x-width/2-3,y2-2,z,.5,4,.5);
        lantern(x-width/2-3,y2,z,1.1);
      }
    }
  }
  stairs(62,92,18,170,58);
  stairs(235,162,-48,118,48);
  stairs(370,257,45,165,55,9);

  // Around the restaurant, build a walkable-feeling hotpot street with distinct storefronts.
  const names=['山城小面','雾都茶馆','麻辣江湖','老街豆花','吊脚楼茶','嘉陵夜食','石梯巷','红油抄手','两江码头','龙门阵','山城冰粉','江风咖啡','川味烧烤','重庆串串'];
  for(let i=0;i<names.length;i++){
    const x=212+(i%7)*24,z=303+Math.floor(i/7)*42;
    const y=ground(x,z);
    const facade=(i%4===0?'terra':'timber');
    put('stone',x,y+.65,z,21,1.3,25);
    put(facade,x,y+7.9,z-6,20,15.7,16);
    put('terra',x,y+16.4,z-6,23,1.5,22);
    put('window',x,y+7,z+2.15,16,6,.15);
    put('timber',x,y+7.1,z+2.35,.6,9,.4);
    put('carved',x,y+12,z+3,21,1.0,1.2);
    sign(names[i],x,y+15.1,z+3.6,17,4.5,'#ffd09a',i%3===0?'#712e35':'#493244');
    for(let t=0;t<3;t++)put('paving',x-7+t*7,y+.22,z+13,6,.15,13);
    if(i%3===0){
      lantern(x-10,y+12,z+6,1.3);
      lantern(x+10,y+12,z+6,1.3);
    }
  }
  // Hotpot shop facade: metal roll-up frames, neon window strips, red lanterns, tiled entrance.
  const sx=hotpot.x,sz=hotpot.z,sy=ground(sx,sz);
  for(let x=sx-30;x<=sx+30;x+=10){
    put('timber',x,sy+9,sz+26.4,.8,18,.9);
    put('window',x+4.5,sy+12,sz+26.5,7.2,6,.2);
    lantern(x,sy+17,sz+30,1.35);
  }
  put('neon',sx,sy+18.3,sz+28.2,65,.32,.5);
  put('neon',sx-32,sy+11.5,sz+28,.4,14,.5);
  put('neon',sx+32,sy+11.5,sz+28,.4,14,.5);
  for(let x=sx-30;x<=sx+30;x+=4)put('paving',x,ground(x,sz+35)+.18,sz+35,3.6,.22,4);

  // Add rooftop mechanical floors, edge outlines and rooftop antennae only near landmarks.
  let roofRank=0;
  for(const b of obstacles){
    const d=Math.hypot(b.x-150,b.z-200);
    if(d>610)continue;
    const x=b.x,z=b.z,y=b.top;
    const short=Math.min(b.w,b.d);
    if(++roofRank%2===0){
      put('stone',x,y+.8,z,b.w*.82,1.6,b.d*.74);
      put('window',x,y+1.8,z,short*.3,2.8,short*.35);
      put('neon',x,y+1.55,z+b.d*.39,b.w*.68,.18,.25);
    }
    if(roofRank%4===0){
      put('rail',x,y+5,z,.4,9,.4);
      put('red',x,y+9.6,z,1.2,.35,1.2);
    }
    if(roofRank%3===0){
      for(let row=1;row<5;row++)put('blue',x+b.w/2+.18,y-row*8,z,.13,1.5,b.d*.66);
    }
  }

  // Water glints are instanced transparent strips. No real-time reflection render target.
  const glints=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({color:0xffb96f,transparent:true,opacity:.23,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),560);
  glints.count=0;glints.frustumCulled=false;
  for(let i=0;i<560;i++){
    const near=rand()<.72, x=near?-150+rand()*570:-900+rand()*1850;
    const z=riverCenter(x)+(rand()-.5)*138;
    const dist=Math.min(Math.abs(x-155),Math.abs(x+230),Math.abs(x-470));
    const strength=Math.max(.45,1-dist/500);
    dummy.position.set(x,-1.88+rand()*.06,z);
    dummy.rotation.set(-Math.PI/2,0,0);
    dummy.scale.set((1+rand()*7)*strength,.15+rand()*.52,1);
    dummy.updateMatrix();glints.setMatrixAt(glints.count++,dummy.matrix);
  }
  glints.instanceMatrix.needsUpdate=true;scene.add(glints);

  // Gentle airborne dust motes around the foreground riverside, cheap point cloud.
  const points=[],pal=[];
  const soft=new THREE.Color();
  for(let i=0;i<340;i++){
    const x=-10+rand()*460,z=60+rand()*300;
    const y=30+rand()*118;
    points.push(x,y,z);
    soft.set(rand()<.65?'#ffc98e':'#9fb7d6');pal.push(soft.r,soft.g,soft.b);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(pal,3));
  scene.add(new THREE.Points(g,new THREE.PointsMaterial({size:.9,vertexColors:true,transparent:true,opacity:.38,depthWrite:false})));

  // Three high-value lamps only; warm emissive geometry supplies most of the night scene.
  for(const [x,z,intensity] of [[155,180,95],[280,285,80],[-230,20,85]]){
    const p=new THREE.PointLight(0xff9c53,intensity,145,2);
    p.position.set(x,ground(x,z)+34,z);scene.add(p);
  }

  for(const pool of pools.values()){
    pool.mesh.count=pool.count;
    pool.mesh.instanceMatrix.needsUpdate=true;
  }
  return { stats:Object.fromEntries([...pools].map(([key,p])=>[key,p.count])), detailMeshes:pools.size+2 };
}