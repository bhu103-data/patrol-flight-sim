// node --test tests/chongqing-scenario.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/chongqing/scenario-assets.js',import.meta.url),'utf8');
const {checkScenarioManifest,validateScenarioGLB,loadOptionalHongyadong}=await
  import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function manifest(enabled=false,license='') {
  return {schema_version:1,hongyadong:{
    enabled,file:'generated/hongyadong-study.glb',position:[155,13,112],
    scale:[1,1,1],rotation_y:0,license
  }};
}
function fakeGLB({triangles=600,external=false,extensions=false}={}) {
  const doc={asset:{version:'2.0'},
    buffers:[{byteLength:4}],bufferViews:[{buffer:0,byteOffset:0,byteLength:4}],
    accessors:[{bufferView:0,componentType:5126,count:triangles*3,type:'VEC3'}],
    meshes:[{primitives:[{attributes:{POSITION:0}}]}]};
  if(external)doc.images=[{uri:'https://example.com/remote.png'}];
  if(extensions)doc.extensionsRequired=['KHR_draco_mesh_compression'];
  const json=Buffer.from(JSON.stringify(doc));
  const padded=Math.ceil(json.length/4)*4;
  const total=12+8+padded+8+4;
  const output=new Uint8Array(total);
  const dv=new DataView(output.buffer);
  [0x46546c67,2,total,padded,0x4e4f534a].forEach((n,i)=>dv.setUint32(i*4,n,true));
  output.set(json,20);output.fill(32,20+json.length,20+padded);
  dv.setUint32(20+padded,4,true);
  dv.setUint32(24+padded,0x004e4942,true);
  return output.buffer;
}
function makeHarness({enabled=false,preview=false,original=false,missing=false,badBounds=false,license='' }={}){
  const requests=[],visited=[],removed=[],swaps=[];
  const data=manifest(enabled,license);
  const asset={isObject3D:true,
    position:{set(...a){this.value=a}},
    rotation:{y:0},scale:{set(...a){this.value=a}},
    updateMatrixWorld(){}};
  const fetcher=async path=>{
    requests.push(path);
    if(path.endsWith('scenario-manifest.json')){
      return {ok:true,json:async()=>data};
    }
    if(missing)return {ok:false,status:404};
    return {ok:true,headers:{get(){return '4096'}},arrayBuffer:async()=>fakeGLB()};
  };
  const THREE={
    Vector3:class{set(x,y,z){this.x=x;this.y=y;this.z=z;return this}},
    Box3:class{setFromObject(){return this}getSize(v){
      return v.set(badBounds?900:130,113,100);
    }}
  };
  const scene={add:o=>visited.push(o),remove:o=>removed.push(o)};
  const detailBuild={setHongyadongReplacement:b=>swaps.push(b)};
  return {requests,visited,removed,swaps,asset,
    load:()=>loadOptionalHongyadong({
      THREE,scene,detailBuild,fetcher,decodeModel:async()=>({scene:asset}),
      search:original?'?scenario=original':(preview?'?scenario=hongyadong':'')
    })};
}

test('disabled manifest does not fetch a model or change procedural scene',async()=>{
  const h=makeHarness(),result=await h.load();
  assert.equal(result.active,false);
  assert.equal(h.requests.length,1);
  assert.equal(h.swaps.length,0);
  assert.equal(h.visited.length,0);
});

test('production activation requires redistributable rights and same-origin relative path',()=>{
  assert.throws(()=>checkScenarioManifest(manifest(true)),/license/);
  const good=manifest(true,'Original geometry; reviewed for distribution');
  assert.equal(checkScenarioManifest(good).shouldLoad,true);
  good.hongyadong.file='https://malicious.invalid/model.glb';
  assert.throws(()=>checkScenarioManifest(good),/local/);
  good.hongyadong.file='../index.html';
  assert.throws(()=>checkScenarioManifest(good),/local/);
  good.hongyadong.file='generated/good.glb';
  good.hongyadong.scale=[1,0,1];
  assert.throws(()=>checkScenarioManifest(good),/transform/);
});

test('force-original query bypasses licensed default Blender GLB and keeps collision-safe original',async()=>{
  const h=makeHarness({enabled:true,original:true,license:'Original Blender mesh and Poly Haven CC0'});
  const result=await h.load();
  assert.equal(result.active,false);
  assert.deepEqual(h.swaps,[]);
  assert.equal(h.requests.length,1,'original mode must not download the 3D GLB');
  assert.equal(checkScenarioManifest(manifest(true,'CC0'),false,true).shouldLoad,false);
});

test('GLB validator accepts budgeted triangles and rejects untrusted data',()=>{
  assert.equal(validateScenarioGLB(fakeGLB()).triangles,600);
  assert.throws(()=>validateScenarioGLB(fakeGLB({triangles:25001})),/triangle budget/);
  assert.throws(()=>validateScenarioGLB(fakeGLB({triangles:200})),/at least/);
  assert.throws(()=>validateScenarioGLB(fakeGLB({external:true})),/embedded/);
  assert.throws(()=>validateScenarioGLB(fakeGLB({extensions:true})),/extensions/);
  const corrupt=fakeGLB();new DataView(corrupt).setUint32(8,100,true);
  assert.throws(()=>validateScenarioGLB(corrupt),/Invalid GLB/);
});

test('failed preview load preserves originals',async()=>{
  const h=makeHarness({preview:true,missing:true});
  await assert.rejects(h.load(),/unavailable/);
  assert.equal(h.swaps.length,0);
  assert.equal(h.visited.length,0);
});

test('valid GLB preview swaps only the requested facade and can be restored',async()=>{
  const h=makeHarness({preview:true});
  const result=await h.load();
  assert.equal(result.active,true);
  assert.deepEqual(h.swaps,[true]);
  assert.deepEqual(h.visited,[h.asset]);
  assert.deepEqual(h.asset.position.value,[155,13,112]);
  assert.equal(result.audit.triangles,600);
  result.restore();result.restore();
  assert.deepEqual(h.swaps,[true,false]);
  assert.deepEqual(h.removed,[h.asset]);
});

test('invalid decoded bounding box cannot displace the original facade',async()=>{
  const h=makeHarness({preview:true,badBounds:true});
  await assert.rejects(h.load(),/bounds/);
  assert.deepEqual(h.swaps,[]);
  assert.deepEqual(h.visited,[]);
});

test('main map uses an import map and preserves existing collision index',async()=>{
  const html=await readFile(new URL('../chongqing.html',import.meta.url),'utf8');
  const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
  const details=await readFile(new URL('../assets/chongqing/details.js',import.meta.url),'utf8');
  assert.ok(html.includes('type="importmap"'));
  assert.ok(game.includes('loadOptionalHongyadong({THREE,scene,detailBuild'));
  assert.ok(game.includes('const obstacleIndex=new SpatialObstacleIndex(obstacles)'));
  assert.ok(details.includes('setHongyadongReplacement'));
  assert.ok(details.includes('hongRoofStart'));
  assert.ok(details.includes('hongRoofEnd'));
});
