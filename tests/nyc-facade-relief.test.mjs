// Run: node --test tests/nyc-facade-relief.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Check only the bounded, pure geometry generator. No WebGL installation needed.
const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('  function addDowntownFacadeRelief(');
const end=source.indexOf('  function buildCityBuildings(',start);
assert.ok(start>0&&end>start,'downtown geometry function exists');
const generator=new Function(source.slice(start,end)+';return addDowntownFacadeRelief')();

function generate(style,scale=1){
  const x=-92,z=-390,y=4.0,w=10*scale,d=9*scale,h=48*scale;
  const split=style%5;
  const low=split===0?.57:split===1?.68:split===2?.77:split===3?.63:.73;
  const mid=split===0?.87:split===1?.91:split===2?.94:split===3?.83:.89;
  const tier=alt=>{
    const k=alt<h*low-.16?1:alt<h*mid-.16?.76:.53;
    return {x:x+(split%2?.12:-.12)*w*(k===.76?1:0),w:w*k,d:d*k};
  };
  let quads=0,boxes=0,top=-Infinity,lowest=Infinity;
  const checkPoint=p=>{
    assert.equal(p.length,3);
    for(const n of p)assert.ok(Number.isFinite(n));
    top=Math.max(top,p[1]);
    lowest=Math.min(lowest,p[1]);
  };
  const result=generator((a,b,c,d,color)=>{
    for(const p of [a,b,c,d])checkPoint(p);
    assert.equal(color.length,3);
    const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(Math.hypot(...cross)>.000001,'nondegenerate facade strip');
    quads++;
  },(bx,by,bz,bw,bh,bd,color)=>{
    checkPoint([bx,by,bz]);
    for(const size of [bw,bh,bd])assert.ok(Number.isFinite(size)&&size>0);
    assert.equal(color.length,3);
    boxes++;
  },{x,y,z,w,d,h,archType:style,facadeTier:tier});
  return {quads,boxes,top,lowest,result,base:y,height:h};
}
for(const style of Array.from({length:13},(_,i)=>i)){
  test('financial-district facade style '+style+' is bounded',()=>{
    for(const scale of [.68,1,1.24]){
      const g=generate(style,scale);
      assert.equal(g.quads,g.result);
      assert.ok(g.quads>0&&g.quads<=150,'facade panel budget');
      assert.ok(g.boxes<=4,'parapet budget');
      assert.ok(g.top<=g.base+g.height+.09,'within original tower collision envelope');
      assert.ok(g.lowest>=g.base,'no geometry below street');
    }
  });
}
test('city builder uses a bounded, demolition-aware skyline corridor',()=>{
  assert.match(source,/detailedDowntown<48/);
  assert.match(source,/!local&&!destroyed&&heroDowntown/);
  assert.match(source,/north>-515&&north<-245&&east>-160&&east<80/);
});
