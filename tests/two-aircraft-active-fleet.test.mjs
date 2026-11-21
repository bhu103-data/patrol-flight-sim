import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const file=p=>readFileSync(new URL('../'+p,import.meta.url));
const page=file('index.html').toString('utf8');
const chongqing=file('assets/chongqing/chongqing.js').toString('utf8');
const inventory=JSON.parse(file('assets/aircraft/active-fleet.json').toString('utf8'));

test('launcher has exactly fighter and seaplane, in that order',()=>{
  const choices=[...page.matchAll(/<input type="radio" name="aircraft" value="([^"]+)"/g)]
    .map(x=>x[1]);
  assert.deepEqual(choices,['fighter','seaplane']);
  assert.deepEqual(inventory.active.map(x=>x.id),choices);
  assert.deepEqual(inventory.archived.map(x=>x.id),['saucer','jetpack']);
  assert.doesNotMatch(page,/name="aircraft" value="(?:saucer|jetpack)"/);
});

test('live flight stats registry and eagerly-built mesh registry contain only two crafts',()=>{
  const first=page.indexOf('  const AIRCRAFT = {');
  const last=page.indexOf('  let selectedAircraft = ',first);
  assert.ok(first>0&&last>first);
  const code=page.slice(first,last);
  const keys=new Function(code+'\nreturn Object.keys(AIRCRAFT);')();
  assert.deepEqual(keys,['fighter','seaplane']);

  const start=page.indexOf('  const aircraftMeshes = {');
  const end=page.indexOf('  // The optional real Blender GLB',start);
  assert.ok(start>0&&end>start);
  const constructors=page.slice(start,end);
  assert.match(constructors,/fighter:\s*buildFighterMesh\(\)/);
  assert.match(constructors,/seaplane:\s*buildCessna185FloatMesh\(\)/);
  assert.doesNotMatch(constructors,/saucer|jetpack|buildSaucerMesh|buildJetpackMesh/);
  assert.doesNotMatch(page,/const ironManMeshes=buildJetpackMesh\(\)/,
    'inactive armor must not allocate GPU buffers during ordinary gameplay');
});

test('archived prototypes remain as source backups but cannot be selected',()=>{
  assert.match(page,/function buildSaucerMesh\(\)/);
  assert.match(page,/function buildJetpackMesh\(\)/);
  assert.match(page,/selectedAircraft = settings\.get\('aircraft'\)==='seaplane'\?'seaplane':'fighter'/);
  assert.match(page,/aircraft==='seaplane'\?'seaplane':'fighter'/,
    'Chongqing must not receive a jetpack aircraft selector ID');
  assert.match(chongqing,/aircraft:seaplaneMode\?'seaplane':'fighter'/);
  assert.match(chongqing,/avatarMode:seaplaneMode\?'cessna185':'legacy-hotpot-pilot'/);
  // Both script bodies must remain syntactically valid after minimal changes.
  const at=page.indexOf('<script>')+8;
  const close=page.indexOf('</script>',at);
  assert.ok(at>8&&close>at);
  assert.doesNotThrow(()=>new Script(page.slice(at,close)));
});

test('original playable C185 remains an exact original asset with its GLB decoder',async()=>{
  const glb=file('assets/aircraft/cessna185-floats.glb');
  const code=file('assets/aircraft/floatplane-glb.js').toString('utf8');
  const {decodeFloatplaneGLB}=await import('data:text/javascript;base64,'+
    Buffer.from(code).toString('base64'));
  let emitted=0,normalCount=0;
  const input=glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength);
  const result=decodeFloatplaneGLB(input,(_a,_b,_c,_rgb,_surface,norm)=>{
    emitted++;if(norm)normalCount++;
  });
  assert.equal(glb.byteLength,179472);
  assert.equal(result.triangles,3736);
  assert.equal(emitted,3736);
  assert.ok(normalCount>=3400);
  assert.ok(Math.abs(result.span-10.922)<.002);
  assert.ok(Math.abs(result.length-7.8105)<.03);
  assert.ok(result.bounds.min[1]<-1.5);
});

test('actual Viper procedural triangle mesh stays finite and small without PBR dependency',()=>{
  const fighterBegin=page.indexOf('function buildFighterMesh() {');
  const fighterEnd=page.indexOf('// Build simple diamond/box mesh for Missiles',fighterBegin);
  const boxBegin=page.indexOf('function addModelBox(');
  const boxEnd=page.indexOf('  const SHIP_TYPES',boxBegin);
  assert.ok(fighterBegin>0&&fighterEnd>fighterBegin&&boxBegin>0&&boxEnd>boxBegin);
  const source=page.slice(boxBegin,boxEnd)+'\\n'+
    page.slice(fighterBegin,fighterEnd)+'\\nreturn buildFighterMesh();';
  let triangles=0,invalid=0;
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  function capture(vertices,color){
    triangles++;
    assert.ok(Array.isArray(color)&&color.length===3,'RGB shader material');
    for(const v of vertices){
      for(let k=0;k<3;k++){
        if(!Number.isFinite(v[k]))invalid++;
        min[k]=Math.min(min[k],v[k]);max[k]=Math.max(max[k],v[k]);
      }
    }
  }
  const mock=()=>({
    addTri:(a,b,c,col)=>capture([a,b,c],col),
    addQuad:(a,b,c,d,col)=>{capture([a,b,c],col);capture([a,c,d],col);},
    upload:()=>({triangles,min,max})
  });
  const result=new Function('createTriangleMesh',source)(mock);
  assert.equal(result.triangles,700,'Viper source geometry must remain unchanged');
  assert.equal(invalid,0);
  const width=result.max.map((v,i)=>+(v-result.min[i]).toFixed(2));
  assert.deepEqual(width,[4.34,1.16,4.60]);
  assert.ok(width[2]>width[0],'jet should be longer than it is wide');
});
