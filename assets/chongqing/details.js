// PATROL Chongqing detailed hero zone — authored locally from procedural geometry.
// No textures or meshes copied from other games. Deliberately localized for small download size.
export function buildChongqingDetails({THREE,scene,ground,riverCenter,rand,box,ball,sign,hotpot,obstacles,pbr=null}) {
  const unit=new THREE.BoxGeometry(1,1,1);
  const up=new THREE.Vector3(0,1,0);
  const dummy=new THREE.Object3D();
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
  const woodTexture=pbr?.wood?null:tiledTexture('wood');
  const materials={
    timber:pbr?.wood??new THREE.MeshStandardMaterial({color:0x9f6855,map:woodTexture,bumpMap:woodTexture,bumpScale:.025,roughness:.79}),
    carved:pbr?.carvedWood??new THREE.MeshStandardMaterial({color:0xbd8b62,map:woodTexture,roughness:.67}),
    terra:pbr?.roof??new THREE.MeshStandardMaterial({color:0x5d6061,roughness:.86}),
    rail:new THREE.MeshStandardMaterial({color:0x7e8791,metalness:.52,roughness:.5}),
    stone:pbr?.stone??new THREE.MeshStandardMaterial({color:0xb6adb0,roughness:.91}),
    paving:new THREE.MeshStandardMaterial({color:0x55545a,roughness:.96}),
    steps:pbr?.cutStone??new THREE.MeshStandardMaterial({color:0xbdb2a9,roughness:.89}),
    window:pbr?.window??new THREE.MeshBasicMaterial({color:0xffcf86}),
    lattice:pbr?.carvedWood??new THREE.MeshStandardMaterial({color:0x694c34,roughness:.8}),
    neon:new THREE.MeshBasicMaterial({color:0xffbd70}),
    red:new THREE.MeshBasicMaterial({color:0xff4142}),
    bridge:new THREE.MeshStandardMaterial({color:0xa7232c,metalness:.46,roughness:.38,emissive:0x7c0917,emissiveIntensity:.4}),
    amber:new THREE.MeshBasicMaterial({color:0xffa843}),
    blue:new THREE.MeshBasicMaterial({color:0x61b9e5})
  };
  const definitions=[
    ['timber',3600],['carved',1600],['terra',950],['rail',3300],['stone',2700],
    ['paving',1250],['steps',1250],['window',3500],['lattice',3400],['neon',1700],['red',700],
    ['bridge',850],['amber',950],['blue',800]
  ];
  const pools=new Map();
  for(const [name,capacity] of definitions){
    const mesh=new THREE.InstancedMesh(unit,materials[name],capacity);
    mesh.count=0;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.frustumCulled=true;
    scene.add(mesh);pools.set(name,{mesh,capacity,count:0});
  }
  // Curved pitched Chinese-style roof: true continuous 3D surface with lifted
  // eave corners. One low-cost instanced geometry replaces two intersecting box slabs.
  function traditionalRoofGeometry(){
    const positions=[],uvs=[],triangles=[];
    const cols=18,rows=22;
    for(let iz=0;iz<=rows;iz++){
      const z=iz/rows-.5;
      const edge=Math.abs(z)*2;
      const pitch=.96*(1-edge*edge)+.07*Math.pow(edge,7);
      for(let ix=0;ix<=cols;ix++){
        const x=ix/cols-.5;
        const cornerCurl=Math.pow(Math.abs(x)*2,6)*Math.pow(edge,6)*.12;
        const y=.017+pitch+cornerCurl;
        positions.push(x,y,z);
        // UVs span repeatable ceramic tiles across the actual surface, not solid paint.
        uvs.push(ix/cols*2.2,iz/rows*2.5);
      }
    }
    for(let iz=0;iz<rows;iz++)for(let ix=0;ix<cols;ix++){
      const a=iz*(cols+1)+ix,b=a+1,c=a+cols+1,d=c+1;
      triangles.push(a,c,b,b,c,d);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setIndex(triangles);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeVertexNormals();
    return geometry;
  }
  // Share the live PBR roof material so async CC0 photo loading updates curved roofs too.
  const roofMaterial=materials.terra;
  roofMaterial.side=THREE.DoubleSide;
  roofMaterial.needsUpdate=true;
  const curvedRoofs=new THREE.InstancedMesh(traditionalRoofGeometry(),roofMaterial,96);
  curvedRoofs.count=0;
  curvedRoofs.castShadow=true;
  curvedRoofs.receiveShadow=true;
  curvedRoofs.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  scene.add(curvedRoofs);
  function roof(x,y,z,width,height,depth){
    const index=curvedRoofs.count;
    if(index>=96)return;
    dummy.position.set(x,y,z);
    dummy.rotation.set(0,0,0);
    dummy.scale.set(width,height,depth);
    dummy.updateMatrix();
    curvedRoofs.setMatrixAt(index,dummy.matrix);
    curvedRoofs.count=index+1;
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
  // Preserve exact instance ranges so an approved GLB replaces ONLY Hongyadong.
  // Shared pools also contain the bridge, sidewalks and other city props.
  const hongStart=Object.fromEntries([...pools].map(([key,p])=>[key,p.count]));
  const hongRoofStart=curvedRoofs.count;
  const hongX=155;
  for(let level=0;level<11;level++){
    const z=112+level*8.3, y=13+level*10.25, w=128-level*4.1;
    const front=z+12.15;
    // One instanced core replaces hundreds of individually drawn facade blocks.
    put('timber',hongX,y+4.85,z,w,9.7,22.5);
    obstacles.push({x:hongX,z,w,d:22.5,base:y,top:y+10.2});
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
      // Six true-depth timber lattice strips give each pane articulated window frames.
      // All members render in one InstancedMesh; no per-window draw calls.
      for(let n=-1;n<=1;n++){
        put('lattice',x+n*1.06,y+5.6,front+.37,.115,5.35,.16);
        put('lattice',x,y+5.6+n*1.38,front+.37,3.88,.105,.15);
      }
      put('terra',x,y+5.5,front+.27,.28,5.8,.19);
      if(j%2===0){
        lantern(x,y+8.45,front+5.5,1.05);
        beam('timber',[x,y+8.8,front],[x,y+7.5,front+4],.33);
      }
      // Individual timber window ledges.
      put('carved',x,y+2.25,front+.4,4.5,.38,.65);
      if(j%3===0)put('window',x,y+3.3,front+.29,2.1,1.15,.15);
    }
    // River-facing frontage matters most: Hongyadong is primarily photographed
    // from the Jialing River (negative z), not the inland side of the hillside.
    const waterfront=z-12.2;
    put('carved',hongX,y+1.85,waterfront-4.7,w+7,.75,10.6);
    put('amber',hongX,y+9.55,waterfront-6.5,w+8,.22,.42);
    put('timber',hongX,y+6.5,waterfront-6.9,w+7,.48,.57);
    for(let j=0;j<sections;j++){
      const x=hongX-w/2+4+(j+.5)*(w-8)/sections;
      put('timber',x,y+5.2,waterfront-1.3,1.3,9.2,1.0);
      put('window',x,y+5.6,waterfront-2.1,4.0,5.6,.18);
      // River-facing screens are distinct from land-facing doors and balconies.
      for(let n=-1;n<=1;n++){
        put('lattice',x+n*1.06,y+5.6,waterfront-2.43,.115,5.4,.17);
        put('lattice',x,y+5.6+n*1.38,waterfront-2.43,3.9,.105,.17);
      }
      put('carved',x,y+2.8,waterfront-2.5,4.8,.39,.7);
      put('carved',x,y+8.9,waterfront-3.1,5.6,.5,.8);
      put('timber',x,y+3.65,waterfront-7.2,.38,3.7,.45);
      if(j%2===0){
        lantern(x,y+8.0,waterfront-5.6,1.05);
        beam('timber',[x,y+9,waterfront-1],[x,y+7.8,waterfront-4.9],.32);
      }
    }
    // Layers of timber balcony rails, with a believable opening at the midpoint.
    for(let j=0;j<sections;j++){
      if(j===Math.floor(sections/2))continue;
      const x=hongX-w/2+4+(j+.5)*(w-8)/sections;
      put('carved',x,y+4.25,waterfront-7.5,(w-8)/sections-.35,.35,.38);
      put('timber',x,y+2.1,waterfront-7.45,.3,2.2,.42);
    }
    put('amber',hongX,y+10.52,z-18,w+8,.19,.38);
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
      roof(cx,eave,roofZ,width+3,rise,37);
      put('carved',cx,eave+rise,roofZ,width+3,.52,.8);
      put('amber',cx,eave+.15,roofZ+18.1,width+3,.18,.42);
      put('carved',cx,eave+.13,roofZ-18.1,width+3,.22,.39);
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

  const hongEnd=Object.fromEntries([...pools].map(([key,p])=>[key,p.count]));
  const hongRoofEnd=curvedRoofs.count;

  // Geometric connection to the steep Yuzhong hillside: the upper city actually
  // meets the 11th-floor entrance, with visible masonry terraces below the road.
  // Individual stone blocks hide the artificial mathematical terrain beneath.
  for(let tier=0;tier<4;tier++){
    const z=216+tier*24;
    for(let col=0;col<13;col++){
      const x=83+col*12.3;
      const low=ground(x,z-14),high=ground(x,z+9);
      const wallHeight=Math.max(1.3,high-low+2.2);
      const base=low-.25;
      put('stone',x,base+wallHeight*.5,z-1.3,12.05,wallHeight,1.9);
      put('carved',x,base+wallHeight+.15,z-2.6,12.05,.38,3.4);
      if((tier+col)%3===0){
        put('carved',x,base+wallHeight*.5,z-2.53,.33,wallHeight*.89,.18);
        put('amber',x,base+wallHeight+1.55,z-3.5,.35,.22,.65);
      }
    }
  }
  // Broad paved upper street at the real hillside connection; no floating platform.
  for(let i=0;i<19;i++){
    const x=77+i*8.6,z=304+1.6*Math.sin(i*.45),y=ground(x,z)+.24;
    put('paving',x,y,z,8.4,.37,13);
    if(i%2===0){
      put('rail',x,y+1.6,z-6.9,.28,3.1,.28);
      put('carved',x,y+3.04,z-6.9,7,.27,.35);
    }
    if(i%5===0){
      put('rail',x,y+4.25,z+5.6,.38,8.3,.38);
      put('amber',x,y+8.6,z+5.5,2.0,.21,.83);
    }
  }
  // Two raised pedestrian routes bridge from the top roof deck to upper streets.
  for(const x of [121,187]){
    for(let step=0;step<20;step++){
      const t=step/19,z=206+t*94;
      const bridgeY=127+(ground(x,300)-127)*t;
      put('paving',x,bridgeY,z,7,.5,5.25);
      // Real landing surface for each elevated pedestrian deck, not just visible geometry.
      obstacles.push({x,z,w:7,d:5.25,base:bridgeY-.25,top:bridgeY+.25});
      for(const side of [-1,1]){
        put('rail',x+side*3.75,bridgeY+1.3,z,.18,2.6,.21);
        if(step>0&&step<19)put('carved',x+side*3.75,bridgeY+2.2,z,.2,.2,5);
      }
      if(step%4===0){
        const earth=ground(x,z);
        if(bridgeY-earth>3)put('stone',x,earth+(bridgeY-earth)*.5,z,1.8,bridgeY-earth,1.8);
      }
    }
  }
  // River-level entrance and lower promenade: heavy masonry arches rather than flat cubes.
  for(let bay=0;bay<7;bay++){
    const cx=90+bay*19.9,z=91;
    const baseY=ground(cx,z)+1.0;
    const radius=6.6,archCy=baseY+8.9;
    for(const dx of [-radius,radius]){
      put('stone',cx+dx,baseY+4.1,z,2.5,8.4,2.0);
    }
    for(let j=0;j<=12;j++){
      const a=Math.PI*j/12;
      const x=cx+radius*Math.cos(a),y=archCy+radius*Math.sin(a);
      put('stone',x,y,z,1.8,2.0,2.1,0,0,a-Math.PI/2);
    }
    put('timber',cx,baseY+4.2,z+1.5,10,7.9,.33);
    put('window',cx,baseY+5.0,z+1.8,9.2,5.4,.14);
    for(const side of [-1,1]){
      put('carved',cx+side*4.5,baseY+4.2,z+1.95,.24,7.7,.28);
    }
    put('amber',cx,baseY+15.6,z-.35,13.8,.22,.4);
  }

  // Qiansimen Jialing River Bridge — SINGLE PYLON, SINGLE CENTRAL CABLE PLANE.
  // Reference: Chongqing Municipal Urban Management Bureau (official description).
  // Red deck-side steel lattice sits below a pale inverted-V cable tower; NOT an arch bridge.
  // Game-space span is deliberately compressed and is not a surveyed 720 m model.
  const by=59,bx=40,bridgeMin=-168,bridgeMax=168;
  for(const side of [-1,1]){
    const xx=bx+side*8.8;
    beam('bridge',[xx,by+1.9,bridgeMin],[xx,by+1.9,bridgeMax],1.05,1.1);
    beam('bridge',[xx,by-12,bridgeMin],[xx,by-12,bridgeMax],1.45,1.4);
    for(let i=0;i<28;i++){
      const z0=bridgeMin+i*12,z1=z0+12;
      beam('bridge',[xx,by+1.9,z0],[xx,by-12,z0],.6,.62);
      beam('bridge',[xx,by-12,z0],[xx,by+1.9,z1],.56,.61);
      if(i%2===0)beam('bridge',[xx,by+1.9,z0],[xx,by-12,z1],.46,.48);
      if(i%2===0){
        put('red',xx,by+2.5,z0,.45,.4,1.6);
        put('amber',xx,by-10.5,z0,.46,.16,1.2);
      }
    }
  }
  for(let i=0;i<13;i++){
    const z=bridgeMin+12+i*25;
    beam('bridge',[bx-8.8,by-10,z],[bx+8.8,by-10,z],.72,.78);
  }
  // The tower is set toward one side of the span: two tapered pale legs converge near the crown.
  // Cable anchors remain in a single vertical plane on the bridge centerline.
  const mastZ=-94,mastTop=by+132;
  beam('stone',[bx-13,by-23,mastZ],[bx,mastTop,mastZ],4.3,4.1);
  beam('stone',[bx+13,by-23,mastZ],[bx,mastTop,mastZ],4.3,4.1);
  beam('stone',[bx,mastTop,mastZ],[bx,by+2,mastZ],2.8,2.8);
  beam('stone',[bx-12,by+17,mastZ],[bx+12,by+17,mastZ],2.5,2.5);
  put('blue',bx,mastTop+2,mastZ,2.1,2.4,2.1);
  for(let i=1;i<=11;i++){
    const z=mastZ+i*22;
    if(z>bridgeMax-8)break;
    const anchorY=mastTop-5-(i-1)*4.3;
    beam('rail',[bx,anchorY,mastZ],[bx,by+4,z],.24,.24);
    put('amber',bx,by+3.4,z,.42,.16,.7);
  }
  for(let i=1;i<=4;i++){
    const z=mastZ-i*18;
    beam('rail',[bx,mastTop-9-i*7,mastZ],[bx,by+4,z],.23,.23);
  }
  // Concrete footing to visually join the bridge support to the river.
  put('stone',bx,by-48,mastZ,25,58,23);

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
    // Three second-row gallery sites have a separate seven-aperture front
    // in market-fronts.js. Keep the back and two side walls, NOT the former
    // closed front box or 16-wide fake glazing card behind its cutouts.
    // The original unchanged occupied volume still protects pilot/vehicles.
    const openMarket=(z===345&&(x===236||x===284||x===332));
    obstacles.push({x,z:z-6,w:20,d:16,base:y,top:y+16.1});
    put('stone',x,y+.65,z,21,1.3,25);
    if(openMarket){
      // Extend sides 0.40 toward the facade; keep their rear at z-14.
      // Their fronts overlap the real jamb's back by 0.05 game units.
      put(facade,x-9.86,y+7.9,z-5.8,.28,15.7,16.4);
      put(facade,x+9.86,y+7.9,z-5.8,.28,15.7,16.4);
      put(facade,x,y+7.9,z-13.84,19.75,15.7,.32);
      // The local cliff drops sharply to the east of tea-lane and
      // stone-stair: the old 21x25 floor plate hung 6–11 units above the
      // sampled terrain at its downhill side. Ground three real cut-stone
      // footings along the INSIDE of that sidewall, not the street-facing
      // window openings. Every support overlaps the underside of the
      // existing slab but sinks 0.60 into the terrain to avoid floating
      // after the coarse world-grid interpolation. None changes occupancy.
      const supportX=x+9.45;
      for(const offsetZ of [-11.5,-5,1.2]){
        const supportZ=z+offsetZ;
        const localGround=ground(supportX,supportZ);
        const capY=y+.82;
        const bottomY=localGround-.60;
        const rise=capY-bottomY;
        // Flat third market lot needs no gratuitous tall fake buttresses.
        if(!Number.isFinite(localGround)||rise<=1.85)continue;
        put('stone',supportX,bottomY+rise*.5,supportZ,.86,rise,1.12);
        put('steps',supportX,localGround+.03,supportZ,1.55,.54,1.55);
      }
    }else{
      put(facade,x,y+7.9,z-6,20,15.7,16);
    }
    put('terra',x,y+16.4,z-6,23,1.5,22);
    if(!openMarket){
      put('window',x,y+7,z+2.15,16,6,.15);
      put('timber',x,y+7.1,z+2.35,.6,9,.4);
      put('carved',x,y+12,z+3,21,1.0,1.2);
      sign(names[i],x,y+15.1,z+3.6,17,4.5,'#ffd09a',i%3===0?'#712e35':'#493244');
    }else{
      // Small individual shop-name plaque above the true upper apertures;
      // the old giant board crossed the upstairs glass by ~2 units.
      sign(names[i],x+(i%2?-2.5:2.5),y+15.84,z+5.8,9,1.35,
        '#e1d2b6',i%3===0?'#563636':'#55443c');
    }
    for(let t=0;t<3;t++)put('paving',x-7+t*7,y+.22,z+13,6,.15,13);
    if(i%3===0){
      lantern(x-10,y+12,z+6,1.3);
      lantern(x+10,y+12,z+6,1.3);
    }
  }
  // Hotpot shop facade: metal roll-up frames, neon window strips, red lanterns, tiled entrance.
  const sx=hotpot.x,sz=hotpot.z,sy=ground(sx,sz+28);
// Stilted hillside foundation: the rear sits above lower terrain, while the
// storefront threshold meets the uphill pavement rather than being buried.
for(const x of [sx-29,sx-7,sx+17,sx+29]){
  for(const z of [sz-18,sz+7]){
    const earth=ground(x,z);
    const rise=Math.max(1,sy-earth);
    put('stone',x,earth+rise*.5,z,2.6,rise,2.7);
    put('carved',x,sy+.34,z,5,.68,5);
  }
}
put('paving',sx,sy+.36,sz+31.3,72,.7,14);
  obstacles.push({x:sx,z:sz,w:72,d:50,base:sy,top:sy+23.3});
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

  // Close-range modern facades have floor slabs, recessed glass and metal mullions;
  // distant city blocks retain simple geometry to respect the GPU budget.
  let facadeBlocks=0;
  for(const b of obstacles){
    if(facadeBlocks>=26)break;
    if(Math.hypot(b.x-175,b.z-210)>490||!Number.isFinite(b.base))continue;
    if((b.top-b.base)<38||b.w<17||b.d<16)continue;
    facadeBlocks++;
    const floors=Math.min(18,Math.floor((b.top-b.base)/7.4));
    for(let floor=1;floor<floors;floor++){
      const y=b.base+floor*(b.top-b.base)/floors;
      for(const face of [-1,1]){
        const front=b.z+face*(b.d/2+.24);
        put('stone',b.x,y,front,b.w+.22,.43,.38);
        // Dark glazing sits behind its mullions; alternate lit and dark floors.
        if(floor%4!==0){
          put('window',b.x,y+2.7,front+face*.18,b.w*.78,4.65,.14);
          for(let c=-2;c<=2;c++){
            put('rail',b.x+c*(b.w*.135),y+2.8,front+face*.28,.14,4.8,.18);
          }
        }
      }
    }
    for(const side of [-1,1]){
      put('rail',b.x+side*(b.w/2+.28),b.base+(b.top-b.base)/2,b.z+b.d/2+.4,.3,b.top-b.base,.35);
    }
  }

  // A small set of distinctive landmark-adjacent silhouettes uses true layered volumes.
  // Distant generic towers remain instanced and do not get unnecessary facade geometry.
  const skyline=[
    {x:-72,z:280,w:30,d:26,h:174,accent:'blue'},
    {x:390,z:170,w:34,d:30,h:185,accent:'neon'},
    {x:458,z:366,w:38,d:29,h:214,accent:'amber'},
    {x:-65,z:405,w:27,d:26,h:161,accent:'blue'},
    {x:525,z:235,w:39,d:33,h:232,accent:'neon'}
  ];
  for(const [index,t] of skyline.entries()){
    const y=ground(t.x,t.z), top=y+t.h;
    box(t.x,y+t.h/2,t.z,t.w,t.h,t.d,
      new THREE.MeshStandardMaterial({color:index%2?0x344a62:0x465362,metalness:.36,roughness:.31}));
    obstacles.push({x:t.x,z:t.z,w:t.w,d:t.d,base:y,top});
    for(let floor=1;floor<Math.floor(t.h/7);floor++){
      const fy=y+floor*7;
      put(t.accent,t.x,fy,t.z+t.d/2+.12,t.w+.2,.34,.14);
      if(floor%3===0)put(t.accent,t.x+t.w/2+.15,fy,t.z,.15,.3,t.d);
    }
    for(const dx of [-1,1]){
      put(t.accent,t.x+dx*t.w*.43,y+t.h*.5,t.z+t.d/2+.22,.28,t.h*.96,.28);
      put('rail',t.x+dx*t.w*.37,top+2,t.z,1.1,4,1.1);
    }
    const crown=top+7;
    put('terra',t.x,top+2.4,t.z,t.w*.78,4.8,t.d*.71);
    put(t.accent,t.x,crown,t.z,t.w*.6,1.2,t.d*.53);
    if(index%2===0){
      put('rail',t.x,top+16,t.z,.65,24,.65);
      put('red',t.x,top+28.2,t.z,1.8,1.6,1.8);
    }
  }

  // Layered leafy trees replace flat cone silhouettes at the walkable tourist scale.
  const leafMaterial=new THREE.MeshStandardMaterial({color:0x486955,roughness:1});
  const barkMaterial=new THREE.MeshStandardMaterial({color:0x695048,roughness:1});
  const leafMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),leafMaterial,198);
  const barkMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.4,.48,1,6),barkMaterial,70);
  leafMesh.count=0;barkMesh.count=0;
  for(let i=0;i<66;i++){
    const district=i%3;
    const x=district===0?210+rand()*255:district===1?-90+rand()*155:30+rand()*240;
    const z=district===0?365+rand()*180:district===1?240+rand()*235:230+rand()*80;
    if(obstacles.some(o=>Math.abs(o.x-x)<o.w/2+6&&Math.abs(o.z-z)<o.d/2+6))continue;
    const y=ground(x,z),h=5+rand()*2.6;
    dummy.position.set(x,y+h/2,z);dummy.rotation.set(0,0,0);dummy.scale.set(.9,h,1);
    dummy.updateMatrix();barkMesh.setMatrixAt(barkMesh.count++,dummy.matrix);
    for(let j=0;j<3;j++){
      dummy.position.set(x+(j-1)*2.2,y+h+1.2+(j===1?1.5:0),z+(j-1)*.8);
      const r=3.5+rand()*.75;
      dummy.scale.set(r,r*.9,r);dummy.updateMatrix();
      leafMesh.setMatrixAt(leafMesh.count++,dummy.matrix);
    }
  }
  leafMesh.instanceMatrix.needsUpdate=true;barkMesh.instanceMatrix.needsUpdate=true;
  scene.add(leafMesh,barkMesh);

  // PATROL realistic ferry pipeline uses riverlife.js exclusively.
  // Delete the three obsolete, stationary box-built "cruise ships" that had
  // overbright amber roof rectangles and overlapped moving navigable ferries.
  // The moving ferries retain detailed hulls, glass saloons, decks, railings,
  // water wakes and rideable landing surfaces. No decorative duplicates.

  // Water glints are instanced transparent strips. No real-time reflection render target.
  const glints=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial({color:0xffb96f,transparent:true,opacity:.23,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}),560);
  glints.count=0;glints.frustumCulled=true;
  for(let i=0;i<560;i++){
    const near=rand()<.72, x=near?-150+rand()*570:-900+rand()*1850;
    const z=riverCenter(x)+(rand()-.5)*138;
    const dist=Math.min(Math.abs(x-155),Math.abs(x-40),Math.abs(x-470));
    const strength=Math.max(.45,1-dist/500);
    dummy.position.set(x,-1.88+rand()*.06,z);
    dummy.rotation.set(-Math.PI/2,0,0);
    dummy.scale.set((1+rand()*7)*strength,.15+rand()*.52,1);
    dummy.updateMatrix();glints.setMatrixAt(glints.count++,dummy.matrix);
  }
  glints.instanceMatrix.needsUpdate=true;glints.computeBoundingSphere();scene.add(glints);

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
  const dust=new THREE.Points(g,new THREE.PointsMaterial({size:.9,vertexColors:true,transparent:true,opacity:.38,depthWrite:false}));
  scene.add(dust);

  // Three high-value lamps only; warm emissive geometry supplies most of the night scene.
  for(const [x,z,intensity] of [[155,180,95],[280,285,80],[40,20,85]]){
    const p=new THREE.PointLight(0xff9c53,intensity,145,2);
    p.position.set(x,ground(x,z)+34,z);scene.add(p);
  }

  for(const pool of pools.values()){
    pool.mesh.count=pool.count;
    pool.mesh.instanceMatrix.needsUpdate=true;
    if(pool.count>0)pool.mesh.computeBoundingSphere();
  }
  curvedRoofs.instanceMatrix.needsUpdate=true;
  if(curvedRoofs.count>0)curvedRoofs.computeBoundingSphere();
  // Set this only AFTER the replacement GLB has been validated and added.
  // Preserve matrix data for a reversible, instance-range-only facade swap.
  let hongReplaced=false;
  const hongOriginalMatrices=new Map();
  function setHongyadongReplacement(enabled){
    const next=enabled===true;
    if(next===hongReplaced)return;
    const targets=[...pools].map(([name,p])=>({
      name,mesh:p.mesh,start:hongStart[name],end:hongEnd[name]
    }));
    targets.push({name:'curvedRoof',mesh:curvedRoofs,start:hongRoofStart,end:hongRoofEnd});
    // Preflight all arrays before modifying any instance, to avoid a half-hidden city.
    for(const t of targets){
      if(t.end===t.start)continue;
      const data=t.mesh.instanceMatrix?.array;
      if(!data || data.length < t.end*16)throw Error('Instance matrix data missing: '+t.name);
      if(next&&!hongOriginalMatrices.has(t.name)){
        hongOriginalMatrices.set(t.name,data.slice(t.start*16,t.end*16));
      }
      if(!next&&!hongOriginalMatrices.has(t.name))throw Error('Cannot restore missing original instance matrices');
    }
    const hidden=next?new THREE.Matrix4().makeScale(0,0,0):null;
    for(const t of targets){
      if(t.end===t.start)continue;
      if(next){
        for(let i=t.start;i<t.end;i++)t.mesh.setMatrixAt(i,hidden);
      }else{
        t.mesh.instanceMatrix.array.set(hongOriginalMatrices.get(t.name),t.start*16);
      }
      t.mesh.instanceMatrix.needsUpdate=true;
    }
    hongReplaced=next;
  }
  // Toggle purely ornamental layers for battery life; core landmarks stay intact.
  return {
    setHongyadongReplacement,
    hongyadongReplacementCounts:{...Object.fromEntries([...pools].map(([name,p])=>[
      name,hongEnd[name]-hongStart[name]
    ])),curvedRoofs:hongRoofEnd-hongRoofStart},
    stats:{...Object.fromEntries([...pools].map(([key,p])=>[key,p.count])),curvedRoofs:curvedRoofs.count},
    detailMeshes:pools.size+3,
    setQuality(mode){const low=mode==='low';glints.visible=!low;dust.visible=!low;leafMesh.visible=!low;barkMesh.visible=!low;pools.get('lattice').mesh.visible=!low;}
  };
}