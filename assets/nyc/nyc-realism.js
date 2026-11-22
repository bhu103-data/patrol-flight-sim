// PATROL NYC realism asset adapter v5 — source-backed architectural materials (native WebGL2, not Three.js)
// Sources and licensing: assets/nyc/THIRD_PARTY_NOTICES.md
// Restricted GLB 2.0 loader; seven CC0 512x512 diffuse/normal/ARM textures.
function product(a,b){
  const v=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)
    for(let k=0;k<4;k++)v[c*4+r]+=a[k*4+r]*b[c*4+k];
  return v;
}
function nodeMatrix(node){
  if(node.matrix)return node.matrix;
  const t=node.translation||[0,0,0],s=node.scale||[1,1,1];
  const [x,y,z,w]=node.rotation||[0,0,0,1];
  return [
    (1-2*(y*y+z*z))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0,
    2*(x*y-z*w)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+x*w)*s[1],0,
    2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(x*x+y*y))*s[2],0,
    ...t,1
  ];
}
// Named export permits real-browser GLB smoke tests without loading paid assets.
export async function decodeGLB(gl,buffer,targetHeight,minTriangles=1){
  const dv=new DataView(buffer);
  if(buffer.byteLength<28||dv.getUint32(0,true)!==0x46546c67||
    dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==buffer.byteLength)
      throw Error('Not GLB 2.0');
  const jsonLength=dv.getUint32(12,true);
  if(dv.getUint32(16,true)!==0x4e4f534a)throw Error('Missing GLB JSON');
  const document=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jsonLength)));
  const binHeader=20+jsonLength;
  if(binHeader+8>buffer.byteLength||dv.getUint32(binHeader+4,true)!==0x004e4942)
    throw Error('Missing GLB binary');
  const binOffset=binHeader+8,binSize=dv.getUint32(binHeader,true);
  if(binOffset+binSize>buffer.byteLength)throw Error('GLB binary truncated');
  const cache=new Map();
  function readAccessor(id){
    if(cache.has(id))return cache.get(id);
    const a=document.accessors[id],view=document.bufferViews[a.bufferView];
    if(a.sparse||view.buffer!==0)throw Error('Unsupported accessor');
    const components=({SCALAR:1,VEC2:2,VEC3:3,VEC4:4})[a.type];
    const width=({5126:4,5125:4,5123:2,5121:1})[a.componentType];
    if(!components||!width)throw Error('Unsupported accessor type');
    const stride=view.byteStride||components*width;
    const start=binOffset+(view.byteOffset||0)+(a.byteOffset||0);
    const end=start+(a.count-1)*stride+components*width;
    if(end>binOffset+binSize || start<binOffset)throw Error('Accessor outside binary');
    const result=new Float32Array(a.count*components);
    for(let row=0;row<a.count;row++)for(let k=0;k<components;k++){
      const offset=start+row*stride+k*width;
      const raw=a.componentType===5126?dv.getFloat32(offset,true):
        a.componentType===5125?dv.getUint32(offset,true):
        a.componentType===5123?dv.getUint16(offset,true):dv.getUint8(offset);
      result[row*components+k]=a.normalized && a.componentType!==5126
        ?raw/(a.componentType===5121?255:a.componentType===5123?65535:4294967295)
        :raw;
    }
    const ret={result,components,count:a.count};
    cache.set(id,ret);return ret;
  }
  const pos=[],nor=[],col=[],uvMask=[];
  let baseTextureIndex=null;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function walk(id,parent,depth=0){
    if(depth>32)throw Error('GLB hierarchy too deep');
    const node=document.nodes[id],matrix=product(parent,nodeMatrix(node));
    // Cofactor columns give the inverse-transpose normal transform.
    const c0=[matrix[0],matrix[1],matrix[2]];
    const c1=[matrix[4],matrix[5],matrix[6]];
    const c2=[matrix[8],matrix[9],matrix[10]];
    const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    const n0=cross(c1,c2),n1=cross(c2,c0),n2=cross(c0,c1);
    const det=c0[0]*n0[0]+c0[1]*n0[1]+c0[2]*n0[2];
    const normalSign=Math.sign(det||1);
    if(node.mesh!==undefined){
      for(const primitive of document.meshes[node.mesh].primitives||[]){
        if(primitive.mode!==undefined&&primitive.mode!==4)continue;
        const positionId=primitive.attributes.POSITION;
        const vertexCount=document.accessors[primitive.indices??positionId]?.count;
        if(!Number.isSafeInteger(vertexCount)||vertexCount<0)
          throw Error('Invalid GLB vertex count');
        if(pos.length+Math.floor(vertexCount/3)*9>240000)
          throw Error('GLB is empty, too large or flat');
        const p=readAccessor(positionId);
        if(p.components!==3)throw Error('Expected VEC3 positions');
        const n=primitive.attributes.NORMAL!==undefined?
          readAccessor(primitive.attributes.NORMAL):null;
        const color0=primitive.attributes.COLOR_0!==undefined?
          readAccessor(primitive.attributes.COLOR_0):null;
        if(color0 && color0.components!==3 && color0.components!==4)
          throw Error('Unsupported GLB COLOR_0');
        const idx=primitive.indices!==undefined?readAccessor(primitive.indices):null;
        // glTF 2.0: a primitive with no material index uses the GLTF
        // default untextured material; it does NOT inherit material[0].
        // Blender often exports colored metal parts without a material slot.
        const pbr=primitive.material===undefined?null:
          document.materials?.[primitive.material]?.pbrMetallicRoughness;
        const faceColor=pbr?.baseColorFactor||[1,1,1,1];
        const diffuse=pbr?.baseColorTexture;
        let uv=null;
        if(diffuse){
          if((diffuse.texCoord||0)!==0 || diffuse.extensions?.KHR_texture_transform)
            throw Error('Only the primary UV layer is supported');
          if(baseTextureIndex!==null && baseTextureIndex!==diffuse.index)
            throw Error('Bake Blender diffuse materials into one atlas');
          baseTextureIndex=diffuse.index;
          if(primitive.attributes.TEXCOORD_0===undefined)
            throw Error('GLB material is missing TEXCOORD_0');
          uv=readAccessor(primitive.attributes.TEXCOORD_0);
          if(uv.components!==2 || uv.count!==p.count)
            throw Error('Bad GLB texture coordinates');
        }
        for(let k=0;k+2<vertexCount;k+=3){
          for(let j=0;j<3;j++){
            const index=idx?idx.result[k+j]:k+j;
            if(index<0||index>=p.count)throw Error('Index out of range');
            const x=p.result[index*3],y=p.result[index*3+1],z=p.result[index*3+2];
            const wx=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];
            const wy=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
            const wz=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
            pos.push(wx,wy,wz);
            minX=Math.min(minX,wx);maxX=Math.max(maxX,wx);
            minY=Math.min(minY,wy);maxY=Math.max(maxY,wy);
            minZ=Math.min(minZ,wz);maxZ=Math.max(maxZ,wz);
            if(n){
              const nx=n.result[index*3],ny=n.result[index*3+1],nz=n.result[index*3+2];
              const ax=(n0[0]*nx+n1[0]*ny+n2[0]*nz)*normalSign;
              const ay=(n0[1]*nx+n1[1]*ny+n2[1]*nz)*normalSign;
              const az=(n0[2]*nx+n1[2]*ny+n2[2]*nz)*normalSign;
              const len=Math.hypot(ax,ay,az)||1;
              nor.push(ax/len,ay/len,az/len);
            }else nor.push(0,0,0);
            if(color0){
              const at=index*color0.components,tint=color0.result;
              col.push(faceColor[0]*tint[at],faceColor[1]*tint[at+1],faceColor[2]*tint[at+2]);
            }else col.push(faceColor[0],faceColor[1],faceColor[2]);
            uvMask.push(uv?uv.result[index*2]:0,
              uv?uv.result[index*2+1]:0,uv?1:0);
          }
          // Reconstruct face normals for GLBs that omit the NORMAL accessor.
          if(!n){
            const p0=pos.length-9;
            const ax=pos[p0+3]-pos[p0],ay=pos[p0+4]-pos[p0+1],az=pos[p0+5]-pos[p0+2];
            const bx=pos[p0+6]-pos[p0],by=pos[p0+7]-pos[p0+1],bz=pos[p0+8]-pos[p0+2];
            const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
            const len=Math.hypot(nx,ny,nz)||1;
            for(let j=0;j<3;j++){
              const at=nor.length-9+j*3;
              nor[at]=nx/len;nor[at+1]=ny/len;nor[at+2]=nz/len;
            }
          }
        }
      }
    }
    for(const child of node.children||[])walk(child,matrix,depth+1);
  }
  for(const id of document.scenes?.[document.scene||0]?.nodes||[])
    walk(id,identity);
  if(pos.length===0||!(maxY>minY))
    throw Error('GLB is empty, too large or flat');
  if(pos.length/9<minTriangles)throw Error('Not enough triangles for premium mesh');
  const scale=targetHeight/(maxY-minY),mx=(minX+maxX)*0.5,mz=(minZ+maxZ)*0.5;
  for(let i=0;i<pos.length;i+=3){
    pos[i]=(pos[i]-mx)*scale;
    pos[i+1]=(pos[i+1]-minY)*scale;
    pos[i+2]=(pos[i+2]-mz)*scale;
  }
  const texture=baseTextureIndex===null?null:
    await import('./scenario-textures.js').then(mod=>mod.loadEmbeddedBaseColor(
      gl,buffer,document,binOffset,binSize,baseTextureIndex));
  if(gl.isContextLost()){
    if(texture)gl.deleteTexture(texture);
    throw Error('WebGL context unavailable');
  }
  const vao=gl.createVertexArray(),buffers=[];
  gl.bindVertexArray(vao);
  try{
    const streams=[[0,pos],[1,nor],[2,col]];
    if(texture)streams.push([4,uvMask]);
    for(const [slot,array] of streams){
      const b=gl.createBuffer();buffers.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(array),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(slot);
      gl.vertexAttribPointer(slot,3,gl.FLOAT,false,0,0);
    }
  }catch(error){
    for(const b of buffers)gl.deleteBuffer(b);
    if(vao)gl.deleteVertexArray(vao);
    if(texture)gl.deleteTexture(texture);
    throw error;
  }finally{
    gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);
  }
  return {vao,buffers,count:pos.length/3,texture,
    dimensions:{width:(maxX-minX)*scale,height:targetHeight,depth:(maxZ-minZ)*scale},
    triangleCount:pos.length/9};
}
function imageFile(filename){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(Error('Texture unavailable: '+filename));
    image.src='./assets/nyc/'+filename;
  });
}
async function photos(gl){
  const names=[
    'asphalt_04_diff_1k.jpg',
    'concrete_floor_damaged_01_diff_1k.jpg',
    'concrete_wall_008_diff_1k.jpg',
    'concrete_wall_008_nor_gl_1k.jpg',
    'concrete_wall_008_arm_1k.jpg',
    'asphalt_04_nor_gl_1k.jpg',
    'asphalt_04_arm_1k.jpg'
  ];
  const images=await Promise.all(names.map(imageFile));
  if(gl.isContextLost())return null;
  const textures=[];
  const flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  try{
    for(const image of images){
      const c=document.createElement('canvas');
      c.width=c.height=512;
      c.getContext('2d').drawImage(image,0,0,512,512);
      const texture=gl.createTexture();textures.push(texture);
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    return {
      asphalt:textures[0],concrete:textures[1],
      wallDiffuse:textures[2],wallNormal:textures[3],wallARM:textures[4],
      asphaltNormal:textures[5],asphaltARM:textures[6]
    };
  }catch(error){
    for(const texture of textures)gl.deleteTexture(texture);
    throw error;
  }finally{
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);
    gl.bindTexture(gl.TEXTURE_2D,null);
  }
}
export async function loadNycRealism(gl){
  const models=Object.create(null),failures=[];
  // QA rollback must skip ALL imported landmark meshes, including the older
  // bundled Liberty GLB, not merely skip the manifest-approved Scenario GLBs.
  // Keep PBR terrain/street photos independent of the landmark choice.
  const options=typeof location!=='undefined'?new URLSearchParams(location.search):new URLSearchParams();
  const useProceduralLandmarks=options.get('nycModels')==='legacy';
  // Explicit, isolated opt-in; the production manifest stays disabled for Liberty.
  // This uses the SAME reviewed 15.9k CC0 GLB already staged in PR #103.
  const libertyCC0Pilot=options.get('nycLibertyCC0')==='1' && !useProceduralLandmarks;
  // Source-verified #103 GLB; never authorize geometry-specific collision by
  // filename or triangle count alone. No manifest/default enablement.
  const libertyCC0Sha256='34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225';
  const modelsReady=useProceduralLandmarks?Promise.resolve():Promise.all([
    // Keep the bundled Liberty mesh as a fallback for optional replacements.
    ['liberty','statue-of-liberty.glb',31]
  ].map(async ([kind,filename,height])=>{
    try{
      const response=await fetch('./assets/nyc/'+filename);
      if(!response.ok)throw Error('HTTP '+response.status);
      const bytes=await response.arrayBuffer();
      if(gl.isContextLost())return;
      models[kind]=await decodeGLB(gl,bytes,height);
    }catch(error){failures.push(kind+': '+error.message);}
  }));
  // Scenario for Blender assets are optional; the public game never calls
  // Scenario or includes API tokens. Only exact, manifest-approved same-origin
  // GLBs are requested, preserving original procedural asset fallback.
  const scenarioReady=(async()=>{
    try{
      // Explicit visual rollback for QA without changing other maps, PBR
      // street textures or the deployed manifest.
      // ?nycModels=legacy keeps the built-in procedural landmarks and skips
      // every optional imported landmark file, not the PBR street textures.
      if(useProceduralLandmarks){
        console.info('[PATROL] Using original NYC landmark geometry (QA rollback)');
        return;
      }
      const response=await fetch('./assets/nyc/scenario-manifest.json');
      if(!response.ok)return;
      const manifest=await response.json();
      if(manifest.schema_version!==1||!manifest.landmarks)return;
      const allowed=new Set(['liberty','trade','empire','chrysler','flatiron','times']);
      await Promise.all(Object.entries(manifest.landmarks).map(async ([kind,spec])=>{
        const stagedLiberty=kind==='liberty'&&libertyCC0Pilot&&
          spec?.enabled===false&&spec.file==='scenario/liberty.glb';
        if(!allowed.has(kind)||!spec||(spec.enabled!==true&&!stagedLiberty))return;
        if(typeof spec.file!=='string' ||
           !/^scenario\/[a-z0-9_-]+\.glb$/.test(spec.file) ||
           !Number.isFinite(spec.target_height)||spec.target_height<10||
           spec.target_height>100||!Number.isInteger(spec.min_triangles)||
           spec.min_triangles<200||typeof spec.license!=='string'||
           !spec.license.trim()){
          failures.push('scenario '+kind+': invalid manifest');return;
        }
        try{
          const file=await fetch('./assets/nyc/'+spec.file);
          if(!file.ok)throw Error('HTTP '+file.status);
          const maxBytes=Math.min(8388608,Number(manifest.max_glb_bytes)||8388608);
          if(Number(file.headers?.get('Content-Length'))>maxBytes)
            throw Error('GLB exceeds import limit');
          const bytes=await file.arrayBuffer();
          if(bytes.byteLength>maxBytes)throw Error('GLB exceeds import limit');
          if(stagedLiberty){
            // Fail closed before decoding or creating GPU objects: source
            // collision radius bands are valid only for these exact bytes.
            if(!globalThis.crypto?.subtle)throw Error('Secure SHA-256 unavailable');
            const raw=await globalThis.crypto.subtle.digest('SHA-256',bytes);
            const digest=Array.from(new Uint8Array(raw),value=>
              value.toString(16).padStart(2,'0')).join('');
            if(digest!==libertyCC0Sha256)
              throw Error('Liberty CC0 SHA-256 mismatch; retain bundled fallback');
          }
          // Only Liberty can replace an already loaded mesh. Other downloads
          // and decodes need not wait for the independent fallback request.
          if(kind==='liberty')await modelsReady;
          if(gl.isContextLost())return;
          const mesh=await decodeGLB(gl,bytes,spec.target_height,spec.min_triangles);
          if(stagedLiberty && (mesh.triangleCount!==15900 ||
             !mesh.dimensions ||
             !Number.isFinite(mesh.dimensions.height) ||
             !Number.isFinite(mesh.dimensions.width) ||
             !Number.isFinite(mesh.dimensions.depth) ||
             Math.abs(mesh.dimensions.height-31.3)>0.01 ||
             Math.abs(mesh.dimensions.width-9.323)>0.04 ||
             Math.abs(mesh.dimensions.depth-9.323)>0.04)){
            // Reject mismatched decoded mesh WITHOUT arming scenario collider.
            for(const buffer of mesh.buffers)gl.deleteBuffer(buffer);
            gl.deleteVertexArray(mesh.vao);
            if(mesh.texture)gl.deleteTexture(mesh.texture);
            throw Error('Liberty CC0 dimensions mismatch; retain bundled fallback');
          }
          mesh.source='scenario';
          if(models[kind]){
            if(stagedLiberty){
              // Reuse the existing original low-poly GLB as LOD1 and as the
              // working fallback; never download/copy a second 3D asset.
              models.libertyLow=models[kind];
            }else{
              for(const buffer of models[kind].buffers)gl.deleteBuffer(buffer);
              gl.deleteVertexArray(models[kind].vao);
              if(models[kind].texture)gl.deleteTexture(models[kind].texture);
            }
          }
          models[kind]=mesh;
        }catch(error){failures.push('scenario '+kind+': '+error.message);}
      }));
    }catch(error){failures.push('scenario manifest: '+error.message);}
  })();
  const photoPromise=photos(gl).catch(error=>{
    failures.push('street textures: '+error.message);return null;
  });
  const [,,photoResult]=await Promise.all([modelsReady,scenarioReady,photoPromise]);
  if(failures.length)console.warn('[PATROL] NYC asset fallbacks:',failures);
  return {models,photos:photoResult,failures};
}
