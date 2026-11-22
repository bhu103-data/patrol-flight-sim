// Keep floe snowcaps in the same existing CC0 glacier-snow mesh material.
// No geometry, collision, shoreline or texture download is introduced.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const moduleSource=readFileSync(new URL('../assets/alaska/alaska-fjord-detail.js',import.meta.url),'utf8');
const renderer=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const {buildAlaskaFjordDetail}=await import('data:text/javascript;base64,'+
  Buffer.from(moduleSource).toString('base64'));

test('all 86 afloat floe snowcaps select existing mirrored PBR surface 13',()=>{
  const triangles=[];
  const stats=buildAlaskaFjordDetail({
    waterY:12.2,terrainAt:()=>11,
    addTri(a,b,c,color,surface=0){triangles.push({a,b,c,color,surface});},
    addQuad(){}
  });
  const snowcaps=triangles.filter(({color})=>
    color[0]>=.69&&color[0]<=.80&&
    color[1]>=.85&&color[1]<=.94&&
    color[2]>=.90&&color[2]<=.97);
  // 86 original polygons each with 7, 8 or 9 triangles, no extra geometry.
  const expected=Array.from({length:86},(_,i)=>7+i%3)
    .reduce((sum,count)=>sum+count,0);
  assert.equal(stats.iceFloes,86);
  assert.equal(stats.iceFloesRejectedShore,0);
  assert.equal(snowcaps.length,expected);
  assert.ok(snowcaps.every(face=>face.surface===13),
    'floe top must use mirrored CC0 surface 13 rather than flat vertex color');
  assert.ok(snowcaps.every(({a,b,c})=>
    Math.abs(a[1]-b[1])<1e-6&&Math.abs(a[1]-c[1])<1e-6),
    'floe cap vertices remain unchanged in a horizontal fan');
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
  assert.ok(moduleSource.includes('addTri(center,a,b,top,13)'));
  const photoStart=renderer.indexOf('if(uAlaskaPhotoReady)',renderer.indexOf('void alaskaGlacierFace('));
  const lift=renderer.indexOf('material=min(material*(1.0+.20*near),vec3(.95));',photoStart);
  const photoEnd=renderer.indexOf('      }',lift);
  assert.ok(photoStart>0 && lift>photoStart && photoEnd>lift,
    'bounded snowcap luminance lift must occur only in photo-ready glacier shader');
  assert.ok(renderer.slice(photoStart,lift).includes('if(vHarborSurface>12.5)'),
    'floe-only brightness must not affect the old surface 12');
});
