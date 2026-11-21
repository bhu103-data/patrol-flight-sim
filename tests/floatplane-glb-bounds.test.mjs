// Regression test against the actual Blender GLB, including invalid data slices.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url));
const glb=read('../assets/aircraft/cessna185-floats.glb');
const src=read('../assets/aircraft/floatplane-glb.js').toString('utf8');
const {decodeFloatplaneGLB}=await import('data:text/javascript;base64,'+
  Buffer.from(src).toString('base64'));
const ab=data=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
function rewrite(mutator){
  const jlen=glb.readUInt32LE(12),binOffset=20+jlen,binLen=glb.readUInt32LE(binOffset);
  const doc=JSON.parse(glb.subarray(20,binOffset).toString('utf8'));
  mutator(doc);
  const json=Buffer.from(JSON.stringify(doc),'utf8'),pad=Math.ceil(json.length/4)*4;
  const out=Buffer.alloc(20+pad+8+binLen);
  out.write('glTF',0,'ascii');
  out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(pad,12);out.writeUInt32LE(0x4e4f534a,16);
  out.fill(0x20,20,20+pad);json.copy(out,20);
  out.writeUInt32LE(binLen,20+pad);out.writeUInt32LE(0x004e4942,24+pad);
  glb.copy(out,28+pad,binOffset+8,binOffset+8+binLen);
  return ab(out);
}
const first=doc=>doc.meshes.find(m=>m.primitives?.length).primitives[0];
const position=doc=>doc.accessors[first(doc).attributes.POSITION];
test('real full-scale Cessna 185 GLB loads with strict accessor checks',()=>{
  let triangles=0;
  const model=decodeFloatplaneGLB(ab(glb),()=>triangles++);
  assert.equal(triangles,model.triangles);
  assert.ok(triangles>=1000);
  assert.ok(Math.abs(model.span-10.922)<.05);
  assert.ok(Math.abs(model.length-7.8105)<.03);
});
test('position data cannot spill into an adjacent bufferView',()=>{
  const broken=rewrite(doc=>{
    const a=position(doc);
    a.byteOffset=doc.bufferViews[a.bufferView].byteLength-4;
  });
  assert.throws(()=>decodeFloatplaneGLB(broken,()=>{}),/Floatplane accessor bounds/);
});
test('byteLength of a bufferView must cover the entire accessor',()=>{
  const broken=rewrite(doc=>{
    doc.bufferViews[position(doc).bufferView].byteLength=8;
  });
  assert.throws(()=>decodeFloatplaneGLB(broken,()=>{}),/Floatplane accessor bounds/);
});
test('floating-point indices are not accepted as mesh vertex numbers',()=>{
  const broken=rewrite(doc=>{
    const id=first(doc).indices;
    assert.ok(Number.isInteger(id));
    doc.accessors[id].componentType=5126;
  });
  assert.throws(()=>decodeFloatplaneGLB(broken,()=>{}),/Unsupported floatplane component type/);
});
test('a secondary unprovided GLB buffer is rejected',()=>{
  const broken=rewrite(doc=>{
    doc.bufferViews[position(doc).bufferView].buffer=1;
  });
  assert.throws(()=>decodeFloatplaneGLB(broken,()=>{}),/Floatplane accessor bounds/);
});