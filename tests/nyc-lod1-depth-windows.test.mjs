// Bounded NYC LOD1 window-relief geometry, with explicit triangle budget.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('  function addDistantManhattanWindowRows(');
const end=html.indexOf('  function buildCityBuildings(',begin);
assert.ok(begin>0&&end>begin,'new helper is isolated from NYC city generator');
const build=(quads,boxes)=>new Function('addModelBox',
  html.slice(begin,end)+';return addDistantManhattanWindowRows;')(
  (quad,...params)=>boxes.push(params));

test('LOD1 facade adds layered, correctly facing window bays inside the footprint',()=>{
  const quads=[],boxes=[];
  const fn=build(quads,boxes);
  const result=fn((...args)=>quads.push(args),-72,-330,12,9,2,20,.53,[.51,.48,.46]);
  assert.deepEqual(result,{panes:24,triangles:432});
  assert.equal(quads.length,72); // shadow, glazed face, mullion
  assert.equal(boxes.length,24); // physically protruding narrow sills
  for(const quad of quads){
    const [a,b,c,d]=quad;
    for(const p of [a,b,c,d]){
      assert.ok(p[0]>=-78 && p[0]<=-66,'window stays within building X');
      assert.ok(p[1]>2 && p[1]<22,'window stays below shaft roof');
      assert.ok(Math.abs(p[2]+330)<=4.7,'surface stays near existing facade');
    }
  }
  const facing=quads.filter((_,i)=>i%3===1);
  assert.equal(facing.filter(x=>x[5]===5).length,24,'glass shader on 24 panes');
  for(const q of facing){
    const [a,b,c]=q;
    const winding=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    assert.ok(winding*(a[2]>-330?1:-1)>0,'facade outward triangle winding');
  }
});
test('small distant towers use zero extra geometry and mapped official lots keep their own path',()=>{
  const q=[],b=[],fn=build(q,b);
  assert.deepEqual(fn((...a)=>q.push(a),0,0,5,4,0,10,.5,[.5,.5,.5]),
    {panes:0,triangles:0});
  assert.equal(q.length,0);
  const call=html.indexOf('addDistantManhattanWindowRows(addQuad,x,z,w,d,y,h*k,tone,trim);');
  const first=html.indexOf('      if(!local&&lot[7]){');
  const returns=html.indexOf('        continue;',first);
  assert.ok(first>0 && returns>first && call>returns,
    'survey-protected official footprints bypass LOD facade kit');
  assert.match(html,/east>-185&&east<175&&north>-526&&north<-155&&/);
  assert.match(html,/\(\(parcelSeed>>>4\)&3\)===0/);
});
