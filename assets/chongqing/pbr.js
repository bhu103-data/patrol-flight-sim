// Textured Chongqing materials. Uses real CC0 PBR files already present in PATROL.
// Poly Haven CC0 references: assets/nyc/PBR_TEXTURE_SOURCES.md
// No proprietary map imagery, photos, 3D buildings or additional binary assets.
export function createChongqingPBR(THREE){
  const root='./assets/nyc/';
  const loader=new THREE.TextureLoader();
  const anisotropy=4;
  const assets={
    concreteDiffuse:'concrete_wall_008_diff_1k.jpg',
    concreteNormal:'concrete_wall_008_nor_gl_1k.jpg',
    concreteARM:'concrete_wall_008_arm_1k.jpg',
    asphaltDiffuse:'asphalt_04_diff_1k.jpg',
    asphaltNormal:'asphalt_04_nor_gl_1k.jpg',
    asphaltARM:'asphalt_04_arm_1k.jpg'
  };
  function loadTexture(file,sRGB=false){
    const texture=loader.load(root+file,(loaded)=>{loaded.needsUpdate=true;},undefined,()=>{
      // Keep the material's default color/roughness when a photo map is unavailable.
      // The game never fails to launch solely because one texture is missing.
      console.warn('Chongqing PBR texture unavailable:',file);
    });
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=anisotropy;
    if(sRGB)texture.colorSpace=THREE.SRGBColorSpace;
    return texture;
  }
  const concrete={
    diffuse:loadTexture(assets.concreteDiffuse,true),
    normal:loadTexture(assets.concreteNormal),
    arm:loadTexture(assets.concreteARM)
  };
  const asphalt={
    diffuse:loadTexture(assets.asphaltDiffuse,true),
    normal:loadTexture(assets.asphaltNormal),
    arm:loadTexture(assets.asphaltARM)
  };
  const concreteMat=new THREE.MeshStandardMaterial({
    color:0xc4cad0,map:concrete.diffuse,normalMap:concrete.normal,
    normalScale:new THREE.Vector2(.23,.23),
    roughnessMap:concrete.arm,roughness:.88,metalness:.025
  });
  const stoneMat=new THREE.MeshStandardMaterial({
    color:0xcac3bd,map:concrete.diffuse,normalMap:concrete.normal,
    normalScale:new THREE.Vector2(.36,.36),
    roughnessMap:concrete.arm,roughness:.96,metalness:0
  });
  const asphaltMat=new THREE.MeshStandardMaterial({
    color:0x8b8e8f,map:asphalt.diffuse,normalMap:asphalt.normal,
    normalScale:new THREE.Vector2(.38,.38),
    roughnessMap:asphalt.arm,roughness:.98,metalness:0,side:THREE.DoubleSide
  });

  // Photographic masonry + generated tiles/weathering where the repository has no photo.
  // Small atlases are local canvases, not low-poly flat colors or external binary downloads.
  function makeAtlas(type,size=512){
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=size;
    const ctx=canvas.getContext('2d');
    let seed=type==='tile'?23:type==='window'?883:1601;
    function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const stone=type==='stone',tile=type==='tile',glass=type==='window';
    ctx.fillStyle=glass?'#1c2c38':tile?'#5f6060':'#9d9390';
    ctx.fillRect(0,0,size,size);
    if(tile){
      // Closely overlapping ridged ceramic tiles; weathered charcoal slate, not neon red roofs.
      const tw=26,th=27;
      for(let row=0;row<Math.ceil(size/th);row++)for(let col=-1;col<Math.ceil(size/tw)+1;col++){
        const x=col*tw+(row%2)*tw/2,y=row*th;
        const shade=Math.round(62+rand()*35);
        ctx.fillStyle='rgb('+Math.round(shade*1.04)+','+shade+','+Math.round(shade*.98)+')';
        ctx.beginPath();
        ctx.moveTo(x+1,y+2);ctx.lineTo(x+tw-1,y+2);
        ctx.lineTo(x+tw-2,y+th-4);ctx.quadraticCurveTo(x+tw/2,y+th+5,x+1,y+th-4);
        ctx.closePath();ctx.fill();
        ctx.lineWidth=2.2;ctx.strokeStyle='#343537';ctx.stroke();
        ctx.strokeStyle='rgba(216,208,190,.27)';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(x+tw/2,y+3);ctx.lineTo(x+tw/2,y+th-3);ctx.stroke();
      }
    }else if(stone){
      const bw=92,bh=37;
      for(let row=0;row<Math.ceil(size/bh);row++)for(let col=-1;col<Math.ceil(size/bw)+1;col++){
        const x=col*bw+(row%2)*bw/2,y=row*bh;
        const shade=Math.round(128+rand()*42);
        ctx.fillStyle='rgb('+shade+','+Math.round(shade*.99)+','+Math.round(shade*.97)+')';
        ctx.fillRect(x+2,y+2,bw-3,bh-3);
        ctx.strokeStyle='rgba(47,49,55,.42)';ctx.lineWidth=2;ctx.strokeRect(x+1,y+1,bw-2,bh-2);
        for(let n=0;n<12;n++){
          ctx.fillStyle='rgba(49,43,38,'+(rand()*.1)+')';
          ctx.fillRect(x+rand()*bw,y+rand()*bh,2+rand()*8,1+rand()*2);
        }
      }
    }else{
      const cw=44,ch=62;
      for(let y=0;y<size;y+=ch)for(let x=0;x<size;x+=cw){
        const on=rand()>.34;
        const base=on?Math.round(65+rand()*75):Math.round(16+rand()*25);
        const g=ctx.createLinearGradient(x+3,y,x+cw-3,y+ch);
        g.addColorStop(0,'rgb('+Math.round(base*.66)+','+Math.round(base*.86)+','+base+')');
        g.addColorStop(.45,'rgb('+Math.round(base*.8)+','+Math.round(base*.95)+','+base+')');
        g.addColorStop(.62,'rgb('+Math.round(base*.52)+','+Math.round(base*.70)+','+Math.round(base*.83)+')');
        g.addColorStop(1,'rgb('+Math.round(base*.68)+','+Math.round(base*.84)+','+base+')');
        ctx.fillStyle=g;ctx.fillRect(x+3,y+3,cw-6,ch-6);
        ctx.fillStyle='rgba(9,20,28,.82)';ctx.fillRect(x,y,cw,3);ctx.fillRect(x,y,3,ch);
        ctx.fillStyle='rgba(189,207,210,.26)';ctx.fillRect(x+5,y+5,2,ch-12);
        ctx.fillStyle='rgba(242,227,179,'+(on?.12:.03)+')';ctx.fillRect(x+6,y+ch-12,cw-12,3);
      }
    }
    // Fine grain breaks up hard procedural edges.
    for(let i=0;i<size*size/18;i++){
      const x=Math.floor(rand()*size),y=Math.floor(rand()*size);
      ctx.fillStyle=rand()>.5?'rgba(228,228,216,.065)':'rgba(8,12,17,.1)';
      ctx.fillRect(x,y,1,1);
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=anisotropy;
    return texture;
  }
  // Rocky subtropical embankment: slate, weathered grit, tiny moss pockets.
  // A procedural tiled slope is more plausible than covering every hill in
  // the photographic concrete-wall image meant for man-made building facades.
  function makeSlopeAtlas(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const ctx=canvas.getContext('2d');
    let seed=128385;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    ctx.fillStyle='#696e68';ctx.fillRect(0,0,512,512);
    // Broad uneven strata and broken shale outlines.
    for(let n=0;n<2500;n++){
      const x=rand()*512,y=rand()*512;
      const w=7+rand()*83,h=.5+rand()*6;
      const shade=rand();
      ctx.fillStyle=shade<.38?'rgba(25,30,29,.14)':
        shade<.75?'rgba(202,197,171,.13)':'rgba(90,99,88,.24)';
      ctx.fillRect(x,y,w,h);
      if(x+w>512)ctx.fillRect(x-512,y,w,h);
    }
    // Diffuse moss/soil stains occur in clustered patches, not uniform green noise.
    for(let c=0;c<190;c++){
      const cx=rand()*512,cy=rand()*512,r=9+rand()*27;
      for(let j=0;j<14;j++){
        const x=(cx+(rand()-.5)*r*2+512)%512,y=(cy+(rand()-.5)*r*2+512)%512;
        const w=1+rand()*16,h=1+rand()*4;
        ctx.fillStyle=rand()>.6?'rgba(48,72,55,.19)':'rgba(68,79,61,.12)';
        ctx.fillRect(x,y,w,h);
      }
    }
    // Layered fine abrasion for a matte natural rock response.
    for(let n=0;n<5000;n++){
      const x=rand()*512,y=rand()*512;
      ctx.fillStyle=rand()>.5?'rgba(218,217,197,.10)':'rgba(16,26,27,.12)';
      ctx.fillRect(x,y,.5+rand()*2.5,.5+rand()*2);
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=anisotropy;
    return texture;
  }
  const slopeTexture=makeSlopeAtlas();
  const hillsideMat=new THREE.MeshStandardMaterial({
    map:slopeTexture,bumpMap:slopeTexture,bumpScale:.08,
    color:0xc0c5c0,roughness:.98,metalness:0,vertexColors:true,side:THREE.DoubleSide
  });
  const tileTexture=makeAtlas('tile');
  const cutStoneTexture=makeAtlas('stone');
  const windowTexture=makeAtlas('window');
  // Glazed curtain-wall atlas with true floor-height rhythm and nonuniform interiors.
  // 12 floors per atlas; sail-geometry UVs use ~7.5 game units per floor.
  function makeCurtainWallAtlas() {
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=768;
    const ctx=canvas.getContext('2d');
    let seed=718291;
    const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    const columns=10,rows=12,w=canvas.width/columns,h=canvas.height/rows;
    ctx.fillStyle='#202d36';ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const x=col*w,y=row*h,occupied=rand()>.67;
      const hue=occupied?(rand()>.2?'#a39b85':'#8dacae'):(rand()>.4?'#314652':'#263a48');
      const gradient=ctx.createLinearGradient(x+4,y+3,x+w-4,y+h-4);
      gradient.addColorStop(0,'#17232d');
      gradient.addColorStop(.27,hue);
      gradient.addColorStop(.62,occupied?'#747b80':'#45606e');
      gradient.addColorStop(1,'#172632');
      ctx.fillStyle=gradient;ctx.fillRect(x+6,y+5,w-12,h-11);
      // Individual floor-to-ceiling structural modules, small spandrels and reveals.
      ctx.fillStyle='#26333c';ctx.fillRect(x,y,w,5);
      ctx.fillStyle='#677a84';ctx.fillRect(x,y,3,h);
      ctx.fillStyle='#192630';ctx.fillRect(x+w-5,y,5,h);
      ctx.fillStyle='rgba(193,214,221,.15)';ctx.fillRect(x+10,y+9,2,h-19);
      ctx.fillStyle='rgba(11,19,29,.33)';ctx.fillRect(x+w*.58,y+5,3,h-12);
      ctx.fillStyle='rgba(220,234,232,.11)';ctx.fillRect(x+15,y+11,w*.23,3);
      if(occupied){
        ctx.fillStyle='rgba(251,211,148,.14)';ctx.fillRect(x+8,y+h*.73,w-16,h*.13);
        if(rand()>.48){ctx.fillStyle='rgba(24,26,34,.42)';ctx.fillRect(x+w*.38,y+h*.55,w*.25,h*.32);}
      }
    }
    // Broken horizontal reflected sky streaks keep the glazing from reading as a checkerboard.
    for(let n=0;n<380;n++){
      const x=rand()*768,y=rand()*768;
      ctx.fillStyle='rgba(185,213,225,'+(0.035+rand()*.04)+')';
      ctx.fillRect(x,y,4+rand()*56,.7+rand()*1.2);
    }
    const texture=new THREE.CanvasTexture(canvas);
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=anisotropy;
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.generateMipmaps=true;
    return texture;
  }
  const curtainWallTexture=makeCurtainWallAtlas();
  const curtainWallMat=new THREE.MeshPhysicalMaterial({
    map:curtainWallTexture,color:0xcad6dc,metalness:.28,roughness:.23,
    clearcoat:.42,clearcoatRoughness:.28,emissive:0x11191f,emissiveIntensity:.2,
    side:THREE.DoubleSide
  });
  // Instanced window panes keep individually colored occupancy, not a whole atlas
  // of microscopic repeated windows on every single 2m-wide pane.
  const glassPaneMat=new THREE.MeshStandardMaterial({
    color:0x89a9b2,metalness:.39,roughness:.26,emissive:0x314a4f,
    emissiveIntensity:.36,side:THREE.DoubleSide
  });
  const roofMat=new THREE.MeshStandardMaterial({
    color:0xddd6cc,map:tileTexture,bumpMap:tileTexture,bumpScale:.09,roughness:.83,metalness:0
  });
  const carvedStoneMat=new THREE.MeshStandardMaterial({
    color:0xb9afa3,map:cutStoneTexture,bumpMap:cutStoneTexture,bumpScale:.08,roughness:.94,metalness:0
  });
  const glassMat=new THREE.MeshPhysicalMaterial({
    color:0x466d7e,metalness:.5,roughness:.17,clearcoat:.35,
    clearcoatRoughness:.24,emissive:0x08202e,emissiveIntensity:.25
  });
  const nightWindowMat=new THREE.MeshBasicMaterial({
    color:0xe9dcca,map:windowTexture,side:THREE.DoubleSide
  });
  return {
    concrete:concreteMat,stone:stoneMat,asphalt:asphaltMat,roof:roofMat,
    cutStone:carvedStoneMat,glass:glassMat,window:nightWindowMat,
    curtainWall:curtainWallMat,glassPane:glassPaneMat,hillside:hillsideMat
  };
}
