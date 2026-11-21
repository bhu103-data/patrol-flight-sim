// PATROL global Cessna 185 floatplane: Blender GLB decode into original WebGL mesh.
// Strictly local same-origin asset; all size/count/bounds checks happen before upload.
// No Three.js dependency: caller provides PATROL's batched addTri callback.
export function decodeFloatplaneGLB(bytes, addTri) {
  if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<36||bytes.byteLength>2000000)
    throw new Error('Floatplane GLB exceeds data budget or is empty');
  const view=new DataView(bytes);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2 ||
     view.getUint32(8,true)!==bytes.byteLength)throw new Error('Invalid floatplane GLB header');
  const jsonLength=view.getUint32(12,true),jsonType=view.getUint32(16,true);
  const binOffset=20+jsonLength;
  if(jsonType!==0x4e4f534a||jsonLength<2||binOffset+8>bytes.byteLength)
    throw new Error('Invalid floatplane GLB manifest');
  const text=new TextDecoder().decode(new Uint8Array(bytes,20,jsonLength));
  const doc=JSON.parse(text),binLength=view.getUint32(binOffset,true);
  if(view.getUint32(binOffset+4,true)!==0x004e4942 ||
     binOffset+8+binLength>bytes.byteLength)throw new Error('Invalid floatplane GLB buffer');
  const binBase=binOffset+8,accessors=doc.accessors||[],buffers=doc.bufferViews||[];
  const components={5121:1,5123:2,5125:4,5126:4};
  function accessor(index,type){
    const a=accessors[index],b=a&&buffers[a.bufferView];
    if(!a||!b||a.type!==type||!components[a.componentType]||a.sparse)
      throw new Error('Unsupported floatplane accessor');
    // Only floats are valid for positions; GLB indices must be unsigned.
    if((type==='VEC3'&&a.componentType!==5126) ||
       (type==='SCALAR'&&![5121,5123,5125].includes(a.componentType)))
      throw new Error('Unsupported floatplane component type');
    const n=type==='VEC3'?3:1;
    const componentBytes=components[a.componentType],elementBytes=n*componentBytes;
    const viewOffset=b.byteOffset??0,viewLength=b.byteLength;
    const accessorOffset=a.byteOffset??0,step=b.byteStride??elementBytes;
    // Constrain each accessor to its own bufferView, not neighboring GLB data.
    if(b.buffer!==0||
       !Number.isSafeInteger(viewOffset)||viewOffset<0||
       !Number.isSafeInteger(viewLength)||viewLength<elementBytes||
       viewOffset+viewLength>binLength||
       !Number.isSafeInteger(accessorOffset)||accessorOffset<0||
       !Number.isSafeInteger(step)||step<elementBytes||
       step%componentBytes!==0||accessorOffset%componentBytes!==0||
       !Number.isSafeInteger(a.count)||a.count<1||a.count>150000||
       accessorOffset+(a.count-1)*step+elementBytes>viewLength)
      throw new Error('Floatplane accessor bounds');
    const offset=binBase+viewOffset+accessorOffset;
    function get(i,k=0){
      const off=offset+i*step+k*components[a.componentType];
      if(a.componentType===5126)return view.getFloat32(off,true);
      if(a.componentType===5125)return view.getUint32(off,true);
      if(a.componentType===5123)return view.getUint16(off,true);
      return view.getUint8(off);
    }
    return {count:a.count,get};
  }
  let triangles=0,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  const meshNodes=(doc.nodes||[]).filter(node=>Number.isInteger(node.mesh));
  if(!meshNodes.length)throw new Error('No floatplane geometry found');
  for(const node of meshNodes){
    // Blender bakes object transforms at export. Reject unexpected runtime transforms.
    if(node.matrix||node.rotation||node.scale||node.translation)
      throw new Error('Floatplane meshes must be transformed at Blender export');
    const mesh=doc.meshes?.[node.mesh];
    for(const primitive of mesh?.primitives||[]){
      if(primitive.mode!==undefined&&primitive.mode!==4)continue;
      const positions=accessor(primitive.attributes?.POSITION,'VEC3');
      const indices=primitive.indices===undefined?null:accessor(primitive.indices,'SCALAR');
      if(indices&&indices.count%3!==0)throw new Error('Invalid floatplane triangles');
      const count=indices?indices.count:positions.count;
      if(count%3!==0||triangles+count/3>50000)throw new Error('Floatplane triangle budget');
      const mat=doc.materials?.[primitive.material||0];
      const factor=mat?.pbrMetallicRoughness?.baseColorFactor||[.72,.75,.75,1];
      const color=factor.slice(0,3).map(c=>Math.min(1,Math.max(0,Number(c)||0)));
      for(let i=0;i<count;i+=3){
        const tri=[];
        for(let k=0;k<3;k++){
          const n=indices?indices.get(i+k):i+k;
          if(n>=positions.count)throw new Error('Floatplane triangle index outside bounds');
          const p=[positions.get(n,0),positions.get(n,1),positions.get(n,2)];
          if(!p.every(Number.isFinite)||p.some(v=>Math.abs(v)>15))
            throw new Error('Floatplane vertex outside real aircraft dimensions');
          for(let axis=0;axis<3;axis++){
            min[axis]=Math.min(min[axis],p[axis]);
            max[axis]=Math.max(max[axis],p[axis]);
          }
          tri.push(p);
        }
        addTri(tri[0],tri[1],tri[2],color,4);
        triangles++;
      }
    }
  }
  const span=max[0]-min[0],length=max[2]-min[2];
  if(triangles<100||span<10.5||span>11.2||length<7.7||length>8.4)
    throw new Error('Floatplane asset failed 1:1 dimension gate');
  return {triangles,span,length,bounds:{min,max}};
}
export async function loadFloatplaneGLB(path,createMesh){
  const response=await fetch(path,{cache:'no-store'});
  if(!response.ok)throw new Error('Blender floatplane not published: '+response.status);
  const n=Number(response.headers.get('content-length')||0);
  if(n>2000000)throw new Error('Floatplane model too large');
  const bytes=await response.arrayBuffer();
  const mesh=createMesh();
  const metadata=decodeFloatplaneGLB(bytes,mesh.addTri);
  return {mesh:mesh.upload(),metadata};
}
