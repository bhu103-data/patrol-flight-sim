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
    const texture=loader.load(root+file,()=>{texture.needsUpdate=true;},undefined,()=>{
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
  const tileTexture=makeAtlas('tile');
  const cutStoneTexture=makeAtlas('stone');
  const windowTexture=makeAtlas('window');
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
    cutStone:carvedStoneMat,glass:glassMat,window:nightWindowMat
  };
}
