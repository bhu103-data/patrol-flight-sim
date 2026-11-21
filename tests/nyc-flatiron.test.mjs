// Run with: node --test tests/nyc-flatiron.test.mjs
// Tests the original Flatiron geometry in index.html without WebGL or packages.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('  function buildFlatironArchitecture(');
const end=source.indexOf('  function buildNewYorkLandmark(kind) {',start);
assert.ok(start>0&&end>start,'independent Flatiron geometry helper is present');
const make=new Function(source.slice(start,end)+'return buildFlatironArchitecture;')();

function inspect(){
  const bounds=[[Infinity,Infinity,Infinity],[-Infinity,-Infinity,-Infinity]];
  let faces=0,triangles=0,lights=0;
  const check=p=>{
    assert.equal(p.length,3);
    for(let i=0;i<3;i++){
      assert.ok(Number.isFinite(p[i]),'position must be finite');
      bounds[0][i]=Math.min(bounds[0][i],p[i]);
      bounds[1][i]=Math.max(bounds[1][i],p[i]);
    }
  };
  const area=(a,b,c)=>{
    const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    return Math.hypot(...cross)*.5;
  };
  const quad=(a,b,c,d,color)=>{
    for(const p of [a,b,c,d])check(p);
    assert.equal(color.length,3);
    assert.ok(area(a,b,c)>1e-6,'quad must not be degenerate');
    faces++;
  };
  const result=make({
    addQuad:quad,
    addLightQuad:(...args)=>{lights++;quad(...args);},
    addTri:(a,b,c,color)=>{
      for(const p of [a,b,c])check(p);
      assert.equal(color.length,3);
      assert.ok(area(a,b,c)>1e-6,'roof triangle must not be degenerate');
      triangles++;
    }
  });
  return {result,bounds,faces,triangles,lights};
}

test('rounded wedge includes 21-storey window bays and restrained lit interiors',()=>{
  const {result,lights}=inspect();
  assert.equal(result.outlinePoints,11);
  assert.equal(result.windows,630);
  assert.equal(result.litWindows,lights);
  assert.ok(lights>0&&lights<30);
});

test('original geometry stays within the existing landmark scale and mesh budget',()=>{
  const {result,bounds,faces,triangles}=inspect();
  assert.ok(result.quads<1450);
  assert.equal(faces,result.quads);
  assert.ok(triangles>0&&triangles<=11);
  assert.ok(bounds[0][0]>=-7.15&&bounds[1][0]<=7.15);
  assert.ok(bounds[0][2]>=-8.5&&bounds[1][2]<=8.8);
  assert.ok(bounds[0][1]>=0&&bounds[1][1]<=16.80);
});

test('new Flatiron remains a single-batch replacement of the old wedge',()=>{
  assert.match(source,/buildFlatironArchitecture\(\{addQuad,addTri,addLightQuad:lights\.addQuad\}\)/);
  assert.doesNotMatch(source,/const points=\[\[-6\.65,-7\.95\],\[6\.65,-7\.95\]/);
});
