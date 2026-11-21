// node --test tests/nyc-glb-normals.test.mjs
// Synthetic GLB fixtures validate normals without browser/WebGL drivers.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/nyc-realism.js',import.meta.url),'utf8');
const {decodeGLB}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function buildGLB({normals=false,scale=[1,1,1]}={}){
  // Vertical YZ triangle; its geometric face normal points toward +X.
  const position=new Float32Array([0,0,0,0,1,0,0,0,1]);
  const normal=new Float32Array([1,1,0,1,1,0,1,1,0]);
  const raw=Buffer.alloc(normals?72:36);
  Buffer.from(position.buffer).copy(raw,0);
  if(normals)Buffer.from(normal.buffer).copy(raw,36);
  const doc={
    asset:{version:'2.0'},
    scenes:[{nodes:[0]}],scene:0,
    nodes:[{mesh:0,scale}],
    meshes:[{primitives:[{attributes:normals?{POSITION:0,NORMAL:1}:{POSITION:0}}]}],
    accessors:[
      {bufferView:0,componentType:5126,count:3,type:'VEC3'},
      ...(normals?[{bufferView:1,componentType:5126,count:3,type:'VEC3'}]:[])
    ],
    bufferViews:[
      {buffer:0,byteOffset:0,byteLength:36},
      ...(normals?[{buffer:0,byteOffset:36,byteLength:36}]:[])
    ],
    buffers:[{byteLength:raw.length}]
  };
  const js=Buffer.from(JSON.stringify(doc));
  const jsonLength=Math.ceil(js.length/4)*4;
  const padded=Buffer.alloc(jsonLength,0x20);js.copy(padded);
  const out=Buffer.alloc(12+8+jsonLength+8+raw.length);
  out.writeUInt32LE(0x46546c67,0);
  out.writeUInt32LE(2,4);
  out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(jsonLength,12);
  out.writeUInt32LE(0x4e4f534a,16);
  padded.copy(out,20);
  out.writeUInt32LE(raw.length,20+jsonLength);
  out.writeUInt32LE(0x004e4942,24+jsonLength);
  raw.copy(out,28+jsonLength);
  return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);
}
function fakeGL(){
  const streams=[];
  let bufferNumber=0;
  const gl={
    ARRAY_BUFFER:34962,STATIC_DRAW:35044,FLOAT:5126,
    createVertexArray:()=>({}),
    bindVertexArray(){},
    createBuffer:()=>({index:++bufferNumber}),
    bindBuffer(){},
    bufferData(target,data){streams.push(Array.from(data))},
    enableVertexAttribArray(){},
    vertexAttribPointer(){},
    isContextLost:()=>false,
    deleteBuffer(){},deleteVertexArray(){}
  };
  return {gl,streams};
}
test('missing GLB normals use a geometric vertical face normal',async()=>{
  const {gl,streams}=fakeGL();
  const mesh=await decodeGLB(gl,buildGLB(),5);
  assert.equal(mesh.triangleCount,1);
  assert.equal(streams.length,3);
  const n=streams[1];
  for(let i=0;i<9;i+=3){
    assert.ok(Math.abs(n[i]-1)<1e-6);
    assert.ok(Math.abs(n[i+1])<1e-6);
    assert.ok(Math.abs(n[i+2])<1e-6);
  }
});
test('nonuniform GLB scale uses inverse transpose normals',async()=>{
  const {gl,streams}=fakeGL();
  await decodeGLB(gl,buildGLB({normals:true,scale:[2,1,1]}),5);
  const n=streams[1];
  // Normalize (0.5,1,0): x=1/sqrt(5), y=2/sqrt(5).
  assert.ok(Math.abs(n[0]-1/Math.sqrt(5))<1e-5);
  assert.ok(Math.abs(n[1]-2/Math.sqrt(5))<1e-5);
  assert.ok(Math.abs(n[2])<1e-6);
});
