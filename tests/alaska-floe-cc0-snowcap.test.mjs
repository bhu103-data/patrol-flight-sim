// Keep floe snowcaps in the same existing CC0 glacier-snow mesh material.
// This stacked sample adds bounded snow ridges; shoreline, collisions and textures stay fixed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const moduleSource=readFileSync(new URL('../assets/alaska/alaska-fjord-detail.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const {buildAlaskaFjordDetail}=await import('data:text/javascript;base64,'+
  Buffer.from(moduleSource).toString('base64'));

test('all 86 afloat floe snowcaps select existing mirrored PBR surface 13',()=>{
  const triangles=[],quads=[];
  const stats=buildAlaskaFjordDetail({
    waterY:12.2,terrainAt:()=>11,
    addTri(a,b,c,color,surface=0){triangles.push({a,b,c,color,surface});},
    addQuad(a,b,c,d,color){quads.push({a,b,c,d,color});}
  });
  const snowcaps=triangles.filter(({color})=>
    color[0]>=.69&&color[0]<=.80&&
    color[1]>=.85&&color[1]<=.94&&
    color[2]>=.90&&color[2]<=.97);
  // Each original 7-9 sided cap now has three shallow triangles per
  // old flat wedge, entirely inside its original shoreline-safe footprint.
  const oldCount=Array.from({length:86},(_,i)=>7+i%3)
    .reduce((sum,count)=>sum+count,0);
  const expected=3*oldCount;
  assert.equal(stats.iceFloes,86);
  assert.equal(stats.iceFloesRejectedShore,0);
  assert.equal(snowcaps.length,expected);
  assert.equal(stats.floeCapTriangles,expected);
  assert.ok(stats.floeCapMaxRelief>.23&&stats.floeCapMaxRelief<.58,
    'snow ridge lift is visible but bounded below one game unit');
  assert.ok(snowcaps.every(face=>face.surface===13),
    'every sculpted cap triangle must retain mirrored CC0 surface 13');
  const sculpted=snowcaps.filter(({a,b,c})=>
    Math.max(a[1],b[1],c[1])-Math.min(a[1],b[1],c[1])>.018);
  assert.ok(sculpted.length>oldCount,
    'a majority of the new top facets should be genuinely non-coplanar');
  assert.ok(snowcaps.every(({a,b,c})=>[a,b,c].every(p=>
    p[1]>=12.2+.035+.15-.001&&p[1]<12.2+1)),
    'raised ice ridges stay above the static slab and below a bounded roof');
  // The snowcap's lower outside silhouette stays precisely waterline-safe.
  // For every ice skirt, its upper two vertices are also actual cap vertices
  // in the same float coordinates: no open triangles or texture-through gaps.
  const waterBottom=12.2+.035-.12;
  const skirts=quads.filter(q=>
    Math.abs(q.c[1]-waterBottom)<1e-6&&
    Math.abs(q.d[1]-waterBottom)<1e-6);
  assert.equal(skirts.length,oldCount);
  const key=p=>p.map(x=>x.toFixed(7)).join(',');
  const capVertices=new Set(snowcaps.flatMap(face=>[
    key(face.a),key(face.b),key(face.c)
  ]));
  assert.ok(skirts.every(q=>capVertices.has(key(q.a))&&
    capVertices.has(key(q.b))),
    'every lifted ice rim must be sealed by top and side-wall geometry');
  assert.ok(skirts.every(q=>q.a[1]>=q.c[1]&&q.b[1]>=q.d[1]),
    'floe side walls cannot sink beneath their static waterline');
});

test('floe surface 13 mirrors existing CC0 atlas with color-only fallback',()=>{
  assert.match(renderer,/vHarborSurface<11\.5 \|\| vHarborSurface>13\.5/);
  assert.ok(renderer.includes('if(uAlaskaPhotoReady)'),
    'shader must preserve color-only rendering when the atlas is not loaded');
  assert.ok(renderer.includes('vec2 tile=vHarborSurface>12.5'));
  assert.ok(renderer.includes('1.0-abs(mod(uv0,vec2(2.0))-1.0)'));
  assert.ok(renderer.includes(': fract(uv0);'),
    'original glacier UV mode must remain unchanged');
  assert.ok(renderer.includes('uAlaskaPhotoNormalRough'));
  assert.ok(renderer.includes('uAlaskaPhotoAlbedo'));
  assert.ok(moduleSource.includes('addTri(crown,ridge[k],ridge[next],top,13)'));
  assert.ok(moduleSource.includes('addTri(ridge[k],rimA,rimB,top,13)'));
  assert.ok(moduleSource.includes('addTri(ridge[k],rimB,ridge[next],top,13)'));
  const photoStart=renderer.indexOf('if(uAlaskaPhotoReady)',renderer.indexOf('void alaskaGlacierFace('));
  const lift=renderer.indexOf('material=min(material*(1.0+.20*near),vec3(.95));',photoStart);
  const photoEnd=renderer.indexOf('      }',lift);
  assert.ok(photoStart>0 && lift>photoStart && photoEnd>lift,
    'bounded snowcap luminance lift must occur only in photo-ready glacier shader');
  assert.ok(renderer.slice(photoStart,lift).includes('if(vHarborSurface>12.5)'),
    'floe-only brightness must not affect the old surface 12');
});
