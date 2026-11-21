// Execute the real, exported NYC loader with mocked GPU and network I/O.
// Run: node --test tests/nyc-procedural-landmark-rollback.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/nyc-realism.js',import.meta.url),'utf8');
function loaderFor(search,missing=false){
  const calls=[],decoded=[],textures=[];
  const response=async path=>{
    calls.push(path);
    if(path.endsWith('scenario-manifest.json'))
      return {ok:true,json:async()=>({schema_version:1,landmarks:{}})};
    if(path.endsWith('statue-of-liberty.glb')){
      if(missing)return {ok:false,status:404};
      return {ok:true,arrayBuffer:async()=>new ArrayBuffer(16)};
    }
    throw Error('Unexpected external request: '+path);
  };
  const photos=async gl=>{
    textures.push(gl);
    return {asphalt:'unchanged-PBR-surface'};
  };
  const decodeGLB=async (_gl,bytes,height)=>{
    decoded.push({bytes:bytes.byteLength,height});
    return {count:200,source:'bundled'};
  };
  // The loader is extracted rather than replaced by a duplicated test
  // implementation; no real network, WebGL driver or image decode needed.
  const start=source.indexOf('export async function loadNycRealism(gl){');
  assert.ok(start>=0,'production export is present');
  const body=source.slice(start).replace(
    /^export async function loadNycRealism\(gl\)/,
    'async function loadNycRealism(gl)');
  const create=new Function('photos','decodeGLB','fetch','location',
    body+';return loadNycRealism;');
  const run=create(photos,decodeGLB,response,{search});
  return {run,calls,decoded,textures};
}

test('legacy flag disables both bundled and manifest-approved landmark imports',async()=>{
  const context=loaderFor('?nycModels=legacy');
  const gpu={isContextLost:()=>false};
  const result=await context.run(gpu);
  assert.deepEqual(Object.keys(result.models),[]);
  assert.deepEqual(context.calls,[],
    'no GLB or manifest should be requested for legacy geometry');
  assert.deepEqual(context.decoded,[]);
  assert.equal(context.textures.length,1,
    'switching landmark meshes must not disable street PBR photos');
  assert.equal(result.photos.asphalt,'unchanged-PBR-surface');
  assert.deepEqual(result.failures,[]);
});

test('default NYC view continues loading original bundled model and approved manifest',async()=>{
  const context=loaderFor('');
  const result=await context.run({isContextLost:()=>false});
  assert.ok(context.calls.includes('./assets/nyc/statue-of-liberty.glb'));
  assert.ok(context.calls.includes('./assets/nyc/scenario-manifest.json'));
  assert.equal(context.decoded.length,1);
  assert.equal(context.decoded[0].height,31);
  assert.ok(result.models.liberty);
  assert.equal(result.photos.asphalt,'unchanged-PBR-surface');
});

test('a missing bundled mesh still falls back without blocking photo materials',async()=>{
  const context=loaderFor('',true);
  const result=await context.run({isContextLost:()=>false});
  assert.deepEqual(Object.keys(result.models),[]);
  assert.ok(result.failures.some(x=>x.includes('liberty: HTTP 404')));
  assert.equal(result.photos.asphalt,'unchanged-PBR-surface');
});
