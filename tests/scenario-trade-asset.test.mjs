// node --test tests/scenario-trade-asset.test.mjs
// Runs the ACTUAL production GLB decoder on the committed original One WTC asset.
// GPU calls and ImageBitmap rasterization are mocked; real browser draw is separate.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=url=>readFile(new URL(url,import.meta.url));
const binary=await read('../assets/nyc/scenario/trade.glb');
const provenance=JSON.parse(await read('../assets/nyc/scenario/trade-provenance.json'));
const manifest=JSON.parse(await read('../assets/nyc/scenario-manifest.json'));
const tex=await read('../assets/nyc/scenario-textures.js');
const loader=await read('../assets/nyc/nyc-realism.js');
const dataUrl=src=>'data:text/javascript;base64,'+Buffer.from(src).toString('base64');
const patched=String(loader).replace("import('./scenario-textures.js')",
  "import('"+dataUrl(tex)+"')");
assert.notEqual(patched,String(loader),'production decoder still imports texture module');
const {decodeGLB}=await import(dataUrl(patched));
let closeCount=0;
globalThis.createImageBitmap=async()=>({width:512,height:512,
  close(){closeCount++;}});
globalThis.window={document:{createElement:kind=>{
  assert.equal(kind,'canvas');
  return {width:0,height:0,getContext:ctx=>{
    assert.equal(ctx,'2d');return {drawImage(){}};
  }};
}}};
function createGL(){
  const calls=[],textures=new Map();
  let active=33984,count=0;
  const gl={
    ARRAY_BUFFER:34962,STATIC_DRAW:35044,FLOAT:5126,
    TEXTURE0:33984,TEXTURE10:33994,
    ACTIVE_TEXTURE:34016,TEXTURE_BINDING_2D:32873,
    TEXTURE_2D:3553,RGBA:6408,UNSIGNED_BYTE:5121,
    TEXTURE_MAG_FILTER:10240,TEXTURE_MIN_FILTER:10241,
    TEXTURE_WRAP_S:10242,TEXTURE_WRAP_T:10243,
    LINEAR:9729,LINEAR_MIPMAP_LINEAR:9987,REPEAT:10497,
    calls,isContextLost:()=>false,
    createTexture:()=>({id:++count}),
    deleteTexture:t=>calls.push(['del-texture',t.id]),
    activeTexture:n=>{active=n},
    getParameter:p=>p===34016?active:textures.get(active)||null,
    bindTexture:(target,t)=>{textures.set(active,t)},
    texImage2D:(...args)=>calls.push(['tex',args.length]),
    texParameteri:()=>{},generateMipmap:()=>calls.push(['mipmap']),
    createVertexArray:()=>({id:++count}),
    bindVertexArray:()=>{},deleteVertexArray:()=>{},
    createBuffer:()=>({id:++count}),deleteBuffer:()=>{},
    bindBuffer:()=>{},
    bufferData:(target,a)=>calls.push(['data',a.length]),
    enableVertexAttribArray:slot=>calls.push(['attr',slot]),
    vertexAttribPointer:()=>{}
  };
  return gl;
}
test('the activated original GLB is present, licensed and within budget',()=>{
  assert.equal(binary.toString('ascii',0,4),'glTF');
  assert.equal(binary.readUInt32LE(8),binary.length);
  const jsonLength=binary.readUInt32LE(12);
  const metadata=binary.subarray(20,20+jsonLength).toString('utf8');
  assert.doesNotMatch(metadata,/\\b(?:NaN|Infinity|-Infinity)\\b/,'JSON must be browser-safe');
  assert.equal(provenance.generation,
    'Original procedural mesh and Base Color atlas (not Scenario AI)');
  assert.equal(provenance.triangles,22064);
  assert.ok(binary.length<8388608);
  assert.equal(manifest.landmarks.trade.enabled,true);
  assert.match(manifest.landmarks.trade.license,/Original/);
  assert.equal(manifest.landmarks.trade.file,'scenario/trade.glb');
  for(const [name,entry] of Object.entries(manifest.landmarks)){
    if(!['liberty','trade','empire','chrysler'].includes(name))assert.equal(entry.enabled,false);
  }
  assert.equal(manifest.landmarks.empire.enabled,true);
  assert.match(manifest.landmarks.empire.license,/Original/);
});
test('production loader decodes the ACTUAL complete One WTC with atlas and normals',async()=>{
  const gl=createGL();
  const bytes=binary.buffer.slice(binary.byteOffset,binary.byteOffset+binary.length);
  const result=await decodeGLB(gl,bytes,77);
  assert.equal(result.triangleCount,22064);
  assert.equal(result.count,22064*3);
  assert.equal(result.dimensions.height,77);
  assert.ok(result.dimensions.width>8&&result.dimensions.width<11);
  assert.ok(result.dimensions.depth>8&&result.dimensions.depth<11);
  assert.ok(result.texture,'embedded PNG atlas created a GPU texture');
  const attrs=gl.calls.filter(x=>x[0]==='attr').map(x=>x[1]);
  assert.ok(attrs.includes(0)&&attrs.includes(1)&&attrs.includes(2)&&attrs.includes(4));
  assert.equal(gl.calls.filter(x=>x[0]==='tex').length,1);
  assert.equal(gl.calls.filter(x=>x[0]==='mipmap').length,1);
  assert.ok(closeCount>=1);
  console.log('Verified real One WTC triangles=',result.triangleCount,
    'game height=',result.dimensions.height,
    'footprint=',result.dimensions.width.toFixed(2)+'x'+result.dimensions.depth.toFixed(2));
});
