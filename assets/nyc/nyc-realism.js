// PATROL NYC realism asset adapter v4 (native WebGL2, not Three.js)
// Sources and licensing: assets/nyc/THIRD_PARTY_NOTICES.md
// Deliberately limited to inline GLB 2.0 meshes and two 512x512 textures.
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
function decodeGLB(gl,buffer,targetHeight){
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
      result[row*components+k]=a.componentType===5126?dv.getFloat32(offset,true):
        a.componentType===5125?dv.getUint32(offset,true):
        a.componentType===5123?dv.getUint16(offset,true):dv.getUint8(offset);
    }
    const ret={result,components,count:a.count};
    cache.set(id,ret);return ret;
  }
  const pos=[],nor=[],col=[];
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  function walk(id,parent,depth=0){
    if(depth>32)throw Error('GLB hierarchy too deep');
    const node=document.nodes[id],matrix=product(parent,nodeMatrix(node));
    if(node.mesh!==undefined){
      for(const primitive of document.meshes[node.mesh].primitives||[]){
        if(primitive.mode!==undefined&&primitive.mode!==4)continue;
        const p=readAccessor(primitive.attributes.POSITION);
        if(p.components!==3)throw Error('Expected VEC3 positions');
        const n=primitive.attributes.NORMAL!==undefined?
          readAccessor(primitive.attributes.NORMAL):null;
        const idx=primitive.indices!==undefined?readAccessor(primitive.indices):null;
        const faceColor=document.materials?.[primitive.material??0]?.pbrMetallicRoughness
          ?.baseColorFactor||[0.6,0.62,0.63,1];
        const length=idx?idx.count:p.count;
        for(let k=0;k+2<length;k+=3){
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
              const ax=matrix[0]*nx+matrix[4]*ny+matrix[8]*nz;
              const ay=matrix[1]*nx+matrix[5]*ny+matrix[9]*nz;
              const az=matrix[2]*nx+matrix[6]*ny+matrix[10]*nz;
              const len=Math.hypot(ax,ay,az)||1;
              nor.push(ax/len,ay/len,az/len);
            }else nor.push(0,1,0);
            col.push(faceColor[0],faceColor[1],faceColor[2]);
          }
        }
      }
    }
    for(const child of node.children||[])walk(child,matrix,depth+1);
  }
  for(const id of document.scenes?.[document.scene||0]?.nodes||[])
    walk(id,identity);
  if(pos.length===0||pos.length>240000||!(maxY>minY))
    throw Error('GLB is empty, too large or flat');
  const scale=targetHeight/(maxY-minY),mx=(minX+maxX)*0.5,mz=(minZ+maxZ)*0.5;
  for(let i=0;i<pos.length;i+=3){
    pos[i]=(pos[i]-mx)*scale;
    pos[i+1]=(pos[i+1]-minY)*scale;
    pos[i+2]=(pos[i+2]-mz)*scale;
  }
  const vao=gl.createVertexArray(),buffers=[];
  gl.bindVertexArray(vao);
  try{
    for(const [slot,array] of [pos,nor,col].entries()){
      const b=gl.createBuffer();buffers.push(b);
      gl.bindBuffer(gl.ARRAY_BUFFER,b);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(array),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(slot);
      gl.vertexAttribPointer(slot,3,gl.FLOAT,false,0,0);
    }
  }finally{
    gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);
  }
  return {vao,buffers,count:pos.length/3};
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
  const [asphaltImage,concreteImage]=await Promise.all([
    imageFile('asphalt_04_diff_1k.jpg'),
    imageFile('concrete_floor_damaged_01_diff_1k.jpg')
  ]);
  if(gl.isContextLost())return null;
  const textures=[];
  const flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  try{
    for(const image of [asphaltImage,concreteImage]){
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
    return {asphalt:textures[0],concrete:textures[1]};
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
  const modelsReady=Promise.all([
    ['empire','empire-state.glb',79],
    ['liberty','statue-of-liberty.glb',31]
  ].map(async ([kind,filename,height])=>{
    try{
      const response=await fetch('./assets/nyc/'+filename);
      if(!response.ok)throw Error('HTTP '+response.status);
      const bytes=await response.arrayBuffer();
      if(gl.isContextLost())return;
      models[kind]=decodeGLB(gl,bytes,height);
    }catch(error){failures.push(kind+': '+error.message);}
  }));
  const photoPromise=photos(gl).catch(error=>{
    failures.push('street textures: '+error.message);return null;
  });
  const [,photoResult]=await Promise.all([modelsReady,photoPromise]);
  if(failures.length)console.warn('[PATROL] NYC asset fallbacks:',failures);
  return {models,photos:photoResult,failures};
}
