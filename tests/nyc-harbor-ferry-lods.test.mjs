// PATROL NYC harbor CC0 ferry model and failsafe regression.
// Uses the real, binary staged GLBs and exact feature-branch game paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto,createHash} from 'node:crypto';
const src=readFileSync(new URL('../assets/nyc/nyc-harbor-ferry-lods.js',import.meta.url),'utf8');
const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const {createNycHarborFerryLods}=await import('data:text/javascript;base64,'+
  Buffer.from(src).toString('base64'));
const facts=[
  ['far','lod2',505076,5478,'7b14324877e0da022a3e3cbf27bc00206bfbc7a693b7ee3d35d85a528cfaea1b'],
  ['mid','lod1',2176996,19775,'c30c18eb05f3ba2f8479bc782794b8fd7115ae6aefd2e1ac9cd244cdeb1baa91'],
  ['near','lod0',5936236,52069,'143815ec7d9830970f6d568ba5ec4495d8c422b2be8e2465fc4274819fc58288']
];
const blobs=new Map();
for(const [tier,lod,bytes,tris,sha] of facts){
  const data=readFileSync(new URL('../assets/nyc/harbor/tevy-ro-ro-'+lod+'.glb',import.meta.url));
  assert.equal(data.length,bytes);
  assert.equal(createHash('sha256').update(data).digest('hex'),sha);
  const jsonLen=data.readUInt32LE(12);
  const doc=JSON.parse(data.subarray(20,20+jsonLen).toString('utf8'));
  assert.equal(doc.extensionsRequired?.length??0,0);
  const triangleCount=(doc.meshes||[]).flatMap(m=>m.primitives||[])
    .filter(p=>(p.mode??4)===4).reduce((n,p)=>n+
      doc.accessors[p.indices??p.attributes.POSITION].count/3,0);
  assert.equal(triangleCount,tris);
  blobs.set(tier,{data,tris});
}

const tick=()=>new Promise(resolve=>setTimeout(resolve,12));
async function spinUntil(testFn){
  for(let j=0;j<500;j++){if(testFn())return;await tick();}
  throw Error('ferry opt-in loader did not settle');
}
const mockGl=()=>({
  isContextLost:()=>false,deleted:[],
  deleteBuffer(v){this.deleted.push(v);},
  deleteVertexArray(v){this.deleted.push(v);},
  deleteTexture(v){this.deleted.push(v);}
});
test('source-authorized near ferry fits the special GLB float budget while other landmarks retain default',()=>{
  const decoder=readFileSync(new URL('../assets/nyc/nyc-realism.js',import.meta.url),'utf8');
  assert.match(decoder,/decodeGLB\(gl,buffer,targetHeight,maxPositionFloats=240000\)/);
  assert.match(decoder,/maxPositionFloats>480000/);
  assert.match(src,/spec\.tier==='near'\?480000:240000/);
  assert.equal(52069*9,468621);
  assert.ok(468621<480000 && 468621>240000);
  assert.ok(19775*9<=240000 && 5478*9<=240000);
});

test('real converted CC0 ferry assets have pinned hashes and expected native LOD budgets',()=>{
  assert.equal(facts.length,3);
  assert.equal(blobs.get('near').tris,52069);
  assert.ok(blobs.get('near').data.length<8*1024*1024);
});
test('real same-origin ferry LODs load far/mid/near and dispose resources',async()=>{
  if(!globalThis.crypto)globalThis.crypto=webcrypto;
  const gl=mockGl(),meshes=[],fetches=[];
  const load=createNycHarborFerryLods(gl,async(_gl,data)=>{
    const found=[...blobs.entries()].find(([,v])=>v.data.length===data.byteLength);
    if(!found)throw Error('Unknown model');
    const mesh={vao:{},buffers:[{},{}],count:found[1].tris*3,
      texture:{},triangleCount:found[1].tris,
      dimensions:{width:5.3,height:7.5,depth:24.3},tier:found[0]};
    meshes.push(mesh);return mesh;
  },{fetchFn:async url=>{
    fetches.push(url);
    const tier=url.includes('lod0')?'near':url.includes('lod1')?'mid':'far';
    return {ok:true,arrayBuffer:async()=>blobs.get(tier).data.buffer.slice(
      blobs.get(tier).data.byteOffset,
      blobs.get(tier).data.byteOffset+blobs.get(tier).data.byteLength)};
  }});
  assert.equal(load.select(25),null,'no model before explicit start');
  load.start();
  await spinUntil(()=>load.stats.ready.length===3||load.stats.failed.length>0);
  assert.deepEqual(load.stats.ready,['far','mid','near']);
  assert.deepEqual(load.stats.failed,[]);
  assert.equal(load.select(40)?.tier,'near');
  assert.equal(load.select(220)?.tier,'mid');
  assert.equal(load.select(500)?.tier,'far');
  assert.equal(load.stats.selections.near,1);
  assert.equal(load.stats.selections.mid,1);
  assert.equal(load.stats.selections.far,1);
  assert.equal(fetches.length,3);
  load.dispose();
  assert.equal(load.ready,false);
  assert.equal(load.select(500),null);
  assert.equal(gl.deleted.length,12,'three VAOs, six VBOs and three textures freed');
});
test('missing staged file, bad SHA or no near model falls back to original boat',async()=>{
  if(!globalThis.crypto)globalThis.crypto=webcrypto;
  const gl=mockGl();
  const x=createNycHarborFerryLods(gl,async()=>{throw Error('decoder unavailable');},
    {fetchFn:async()=>({ok:false,status:404})});
  x.start();await spinUntil(()=>x.stats.failed.length===3);
  assert.equal(x.select(100),null);
  assert.equal(x.select(600),null);
  assert.equal(x.stats.failed.length,3);
  x.dispose();
});
test('only explicitly opted-in NYC noncompat route may render external ferry mesh',()=>{
  assert.match(game,/get\('nycHarborVessels'\)==='cc0-ferry-preview'/);
  assert.match(game,/if\(!ferryVisualPreview\|\|!selectedMap\.city\|\|graphicsCompat\)/);
  assert.match(game,/selectedMap\.city&&!graphicsCompat&&boat\.kind==='ferry'/);
  assert.match(game,/const model=imported\|\|shipMeshes\[boat\.kind\]/);
  assert.match(game,/drawSplitShip\(boat,drawMesh\)/);
  assert.match(game,/const \[index, kind\] of \['cruise','ferry','cargo','ferry'\]/);
  assert.match(game,/for\(const ship of boats\)/);
  assert.match(game,/clearOfNycHeroDocks\(px,pz\)/);
});
