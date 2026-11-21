// Bounded Blender/Scenario GLB diffuse texture import for the native PATROL WebGL2 renderer.
// The only supported bitmap is an embedded baseColorTexture PNG/JPEG. Other PBR
// channels remain intentionally unsupported until the per-material shader path exists.
export async function loadEmbeddedBaseColor(gl,glb,gltf,binOffset,binSize,textureIndex){
  const texSpec=gltf.textures?.[textureIndex];
  const img=gltf.images?.[texSpec?.source];
  if(!img || img.bufferView===undefined ||
     !['image/png','image/jpeg'].includes(img.mimeType))
    throw Error('Base color texture must be embedded as PNG/JPEG in the GLB');
  const view=gltf.bufferViews?.[img.bufferView];
  const offset=binOffset+(view?.byteOffset||0),length=view?.byteLength;
  if(!view || view.buffer!==0 || !Number.isSafeInteger(length) ||
     length<64 || length>4194304 || offset<binOffset ||
     offset+length>binOffset+binSize)
    throw Error('Invalid embedded texture byte range');
  if(typeof createImageBitmap!=='function')throw Error('ImageBitmap unsupported');
  const blob=new Blob([new Uint8Array(glb,offset,length)],{type:img.mimeType});
  const image=await createImageBitmap(blob,{imageOrientation:'flipY'});
  let tex=null;
  try{
    if(!image.width||!image.height||image.width>4096||image.height>4096)
      throw Error('Unsupported GLB image dimensions');
    if(gl.isContextLost())throw Error('WebGL context unavailable');
    const scale=Math.min(1,1024/Math.max(image.width,image.height));
    const surface=window.document.createElement('canvas');
    surface.width=Math.max(2,Math.floor(image.width*scale));
    surface.height=Math.max(2,Math.floor(image.height*scale));
    const ctx=surface.getContext('2d');
    if(!ctx)throw Error('Canvas texture conversion unavailable');
    ctx.drawImage(image,0,0,surface.width,surface.height);
    tex=gl.createTexture();
    if(!tex)throw Error('GL texture allocation failed');
    const oldUnit=gl.getParameter(gl.ACTIVE_TEXTURE);
    gl.activeTexture(gl.TEXTURE10);
    const oldBinding=gl.getParameter(gl.TEXTURE_BINDING_2D);
    try{
      gl.bindTexture(gl.TEXTURE_2D,tex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,surface);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
      gl.generateMipmap(gl.TEXTURE_2D);
    }finally{
      gl.bindTexture(gl.TEXTURE_2D,oldBinding);
      gl.activeTexture(oldUnit);
    }
    return tex;
  }catch(error){
    if(tex)gl.deleteTexture(tex);
    throw error;
  }finally{image.close();}
}
