// node --test tests/nyc-brooklyn-facades.test.mjs
// Test the actual browser building generator without a GPU driver.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function extract(name){
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const open=html.indexOf('{',start);
  let depth=0,end=-1;
  for(let i=open;i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}'&&--depth===0){end=i+1;break;}
  }
  assert.ok(end>open,'unclosed '+name);
  return html.slice(start,end);
}
const builderSource=extract('buildCityBuildings');
function build(lot,detail=2){
  const boxes=[];
  let beams=0,quads=0;
  const quadTags=[];
  const generator=new Function(
    'createTriangleMesh','addModelBox','addRideBeam','nycDetailBand',
    'MANHATTAN_GRID','WATER_H','tintSeed','addDowntownFacadeRelief',
    'return ('+builderSource+')'
  )(
    ()=>({addQuad(...args){quads++;quadTags.push(args.at(-1))},addTri(){},upload(){return {quads}}}),
    (_quad,...args)=>boxes.push(args),
    ()=>{beams++},
    ()=>detail,
    {tilt:.24,offset:30,blockWidth:24,blockLength:33},
    12.2,()=>.5,()=>0
  );
  return {mesh:generator([lot]),boxes,beams,quads,quadTags};
}
test('DUMBO midrise uses brick facade with bounded fire escape geometry',()=>{
  const b=build([342.76,-346.16,9,19,13.82,.41,false]);
  assert.deepEqual(b.boxes[0].at(-2),[.55,.35,.31]);
  assert.equal(b.boxes[0].at(-1),12,'brick walls use procedural PBR tag');
  assert.ok(b.boxes.some(box=>box.at(-1)===13),'window meshes use glass tag');
  assert.ok(b.quadTags.includes(14),'roof face uses gravel PBR tag');
  assert.ok(b.quadTags.filter(tag=>tag===13).length>=5,'window quads share glass shader');
  assert.ok(b.beams>=4,'external railings must be present');
  assert.ok(b.boxes.length<175,'detail stays within per-building budget');
  assert.ok(b.mesh.quads>0,'existing shopfront windows remain');
});
test('Manhattan retains existing financial district tower materials',()=>{
  const ny=build([-78,-335,9,19,23.5,.41,false]);
  assert.deepEqual(ny.boxes[0].at(-1),[.29,.42,.48]);
  assert.equal(ny.beams,0,'no Brooklyn fire escape applied in Manhattan');
  assert.ok(ny.boxes.length>100);
});
test('Brooklyn fire escapes are skipped at distant LOD',()=>{
  const far=build([342.76,-346.16,9,19,13.82,.41,false],1);
  assert.equal(far.beams,0);
  assert.ok(far.boxes.length<10,'distant buildings remain lightweight');
});
test('Brooklyn style does not leak beyond bridgehead',()=>{
  const away=build([480,-346.16,9,19,13.82,.41,false]);
  assert.equal(away.beams,0);
  assert.notDeepEqual(away.boxes[0].at(-1),[.55,.35,.31]);
});

test('Brooklyn PBR tags do not impersonate surveyed NYC footprint source IDs',()=>{
  assert.match(html,/vHarborSurface<5\.5 \|\| vHarborSurface>14\.5/);
  assert.match(html,/taggedFacadeSurface=vHarborSurface>5\.5 && vHarborSurface<14\.5/);
  assert.match(html,/vHarborSurface==13\.0/);
  assert.match(html,/12\/13\/14 mark \*procedural Brooklyn\*/);
});

test('historic warehouse arches appear only inside Brooklyn LOD3 without extra box towers',()=>{
  // A grid cell whose stable facade seed selects the original brick arch family.
  const lot=[310.68,-280.5,9,19,13.82,.41,false];
  const medium=build(lot,2),close=build(lot,3);
  assert.ok(close.beams>=medium.beams+48,
    'first upper warehouse windows gain curved masonry arches');
  assert.equal(close.boxes.length,medium.boxes.length,
    'curved masonry uses batched beams, not more opaque cuboids');
  // The isolated beam stub counts arches, but does not triangulate beams.
  // Compare beam invocations above; the actual renderer triangulates them.
  const far=build(lot,1);
  assert.equal(far.beams,0,'no distant industrial arch allocations');
});
