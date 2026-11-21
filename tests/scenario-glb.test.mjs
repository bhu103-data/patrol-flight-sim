// node --test tests/scenario-glb.test.mjs
// Validates the PRODUCTION Scenario GLB importer using an in-memory fixture.
// The GPU interface/image decoder are mocked; the HTML smoke page tests pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const realism=await readFile(new URL('../assets/nyc/nyc-realism.js',import.meta.url),'utf8');
const texture=await readFile(new URL('../assets/nyc/scenario-textures.js',import.meta.url),'utf8');
const atlasURL='data:text/javascript;base64,'+Buffer.from(texture).toString('base64');
const patched=realism.replace(
  "import('./scenario-textures.js')", "import('"+atlasURL+"')");
assert.notEqual(patched,realism,'real importer must reference its texture module');
const loaderURL='data:text/javascript;base64,'+Buffer.from(patched).toString('base64');
const {decodeGLB}=await import(loaderURL);
const png=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64'
);
const aligned=n=>(n+3)&~3;

function fixture(modify=()=>{}){
  const position=new Float32Array([0,0,0,1,0,0,0,2,0]);
  const coords=new Float32Array([0,0,1,0,0,1]);
  const indices=new Uint16Array([0,1,2]);
  const imageOffset=aligned(position.byteLength+coords.byteLength+indices.byteLength);
  const bin=new Uint8Array(aligned(imageOffset+png.length));
  bin.set(new Uint8Array(position.buffer));
  bin.set(new Uint8Array(coords.buffer),position.byteLength);
  bin.set(new Uint8Array(indices.buffer),position.byteLength+coords.byteLength);
  bin.set(png,imageOffset);
  const doc={
    asset:{version:'2.0'},scene:0,
    scenes:[{nodes:[0]}],nodes:[{mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},indices:2,material:0}]}],
    materials:[{pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],baseColorTexture:{index:0}}}],
    images:[{bufferView:3,mimeType:'image/png'}],textures:[{source:0}],
    buffers:[{byteLength:bin.length}],
    bufferViews:[
      {buffer:0,byteOffset:0,byteLength:position.byteLength},
      {buffer:0,byteOffset:position.byteLength,byteLength:coords.byteLength},
      {buffer:0,byteOffset:position.byteLength+coords.byteLength,byteLength:indices.byteLength},
      {buffer:0,byteOffset:imageOffset,byteLength:png.length}
    ],
    accessors:[
      {bufferView:0,componentType:5126,count:3,type:'VEC3'},
      {bufferView:1,componentType:5126,count:3,type:'VEC2'},
      {bufferView:2,componentType:5123,count:3,type:'SCALAR'}
    ]
  };
  modify(doc);
  const json=Buffer.from(JSON.stringify(doc),'utf8');
  const jp=aligned(json.length);
  const full=new ArrayBuffer(12+8+jp+8+bin.length);
  const dv=new DataView(full),bytes=new Uint8Array(full);
  dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);
  dv.setUint32(8,full.byteLength,true);dv.setUint32(12,jp,true);
  dv.setUint32(16,0x4e4f534a,true);bytes.set(json,20);
  bytes.fill(32,20+json.length,20+jp);
  const at=20+jp;
  dv.setUint32(at,bin.length,true);
  dv.setUint32(at+4,0x004e4942,true);
  bytes.set(bin,at+8);
  return full;
}
function mockGL(){
  const calls=[],textures=new Map();
  let active=0x84c0,id=0;
  const constants={
    ARRAY_BUFFER:34962,STATIC_DRAW:35044,FLOAT:5126,
    TEXTURE0:0x84c0,TEXTURE10:0x84ca,ACTIVE_TEXTURE:0x84e0,
    TEXTURE_BINDING_2D:0x8069,TEXTURE_2D:0x0de1,
    RGBA:0x1908,UNSIGNED_BYTE:0x1401,
    TEXTURE_MAG_FILTER:0x2800,TEXTURE_MIN_FILTER:0x2801,
    TEXTURE_WRAP_S:0x2802,TEXTURE_WRAP_T:0x2803,
    LINEAR:0x2601,LINEAR_MIPMAP_LINEAR:0x2703,REPEAT:0x2901
  };
  const gl={
    ...constants,calls,
    isContextLost:()=>false,
    createTexture:()=>({kind:'texture',id:++id}),
    deleteTexture:x=>calls.push(['deleteTexture',x]),
    activeTexture:n=>{active=n;calls.push(['active',n]);},
    getParameter:n=>n===gl.ACTIVE_TEXTURE?active:textures.get(active)||null,
    bindTexture:(n,x)=>{textures.set(active,x);calls.push(['bindTexture',n,!!x]);},
    texImage2D:(...args)=>calls.push(['image',args[8]?.width,args[8]?.height]),
    texParameteri:()=>{},
    generateMipmap:()=>calls.push(['mipmap']),
    createVertexArray:()=>({kind:'vao',id:++id}),
    bindVertexArray:()=>{},
    deleteVertexArray:x=>calls.push(['deleteVao',x]),
    createBuffer:()=>({kind:'buffer',id:++id}),
    deleteBuffer:x=>calls.push(['deleteBuffer',x]),
    bindBuffer:()=>{},
    bufferData:(target,arr)=>calls.push(['buffer',arr.length]),
    enableVertexAttribArray:n=>calls.push(['attribute',n]),
    vertexAttribPointer:()=>{}
  };
  return gl;
}
let bitmapClose=0;
globalThis.createImageBitmap=async()=>({
  width:32,height:32,close(){bitmapClose++;}
});
globalThis.window={document:{createElement:kind=>{
  assert.equal(kind,'canvas');
  return {width:0,height:0,getContext:kind=>{
    assert.equal(kind,'2d');
    return {drawImage(){}};
  }};
}}};

test('production decoder uploads embedded Base Color texture + four attribute streams',async()=>{
  const gl=mockGL();
  const mesh=await decodeGLB(gl,fixture(),77);
  assert.equal(mesh.count,3);
  assert.ok(mesh.texture);
  assert.equal(mesh.buffers.length,4,'positions/normals/colors/UVMask');
  assert.deepEqual(gl.calls.filter(x=>x[0]==='attribute').map(x=>x[1]),[0,1,2,4]);
  assert.equal(gl.calls.filter(x=>x[0]==='image').length,1);
  assert.ok(gl.calls.some(x=>x[0]==='mipmap'));
  assert.ok(bitmapClose>=1);
});
test('production decoder rejects external texture URI without fetching it',async()=>{
  const gl=mockGL();
  await assert.rejects(decodeGLB(gl,fixture(doc=>{
    doc.images[0]={uri:'https://example.com/unknown.png',mimeType:'image/png'};
  }),77),/embedded/i);
  assert.equal(gl.calls.filter(x=>x[0]==='image').length,0);
});
test('multiple material texture atlases rejected before GPU upload',async()=>{
  const gl=mockGL();
  await assert.rejects(decodeGLB(gl,fixture(doc=>{
    doc.textures.push({source:0});
    doc.materials.push({pbrMetallicRoughness:{baseColorTexture:{index:1}}});
    doc.meshes[0].primitives.push({...doc.meshes[0].primitives[0],material:1});
  }),77),/one atlas/);
  assert.equal(gl.calls.filter(x=>x[0]==='image').length,0);
});
test('textured primitive without UV0 is rejected',async()=>{
  const gl=mockGL();
  await assert.rejects(decodeGLB(gl,fixture(doc=>{
    delete doc.meshes[0].primitives[0].attributes.TEXCOORD_0;
  }),77),/TEXCOORD_0/);
});
