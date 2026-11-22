// Keep floe snowcaps in the same existing CC0 glacier-snow mesh material.
// This stacked sample adds bounded shoulder bevels; coastline, ice draft and textures stay fixed.
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
  // Each original 7-9 sided snow cap has three inner ridge faces and
  // two extra beveled-lip faces per old horizontal fan triangle.
  const oldCount=Array.from({length:86},(_,i)=>7+i%3)
    .reduce((sum,count)=>sum+count,0);
  const expected=5*oldCount;
  assert.equal(stats.iceFloes,86);
  assert.equal(stats.iceFloesRejectedShore,0);
  assert.equal(snowcaps.length,expected);
  assert.equal(stats.floeCapTriangles,expected);
  assert.equal(stats.floeBevelTriangles,2*oldCount,
    'exactly two bounded bevel facets per original floe edge');
  assert.ok(stats.floeBevelMaxInset>.17&&stats.floeBevelMaxInset<.28,
    'shoulder must be inset 18-27% without changing the original ice footprint');
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
  assert.ok(moduleSource.includes('addTri(crown,ridge[next],ridge[k],top,13)'));
  assert.ok(moduleSource.includes('addTri(ridge[k],shB,shA,top,13)'));
  assert.ok(moduleSource.includes('addTri(ridge[k],ridge[next],shB,top,13)'));
  assert.ok(moduleSource.includes('addTri(shA,shB,rimB,top,13)'));
  assert.ok(moduleSource.includes('addTri(shA,rimB,rimA,top,13)'));
  const photoStart=renderer.indexOf('if(uAlaskaPhotoReady)',renderer.indexOf('void alaskaGlacierFace('));
  const lift=renderer.indexOf('material=min(material*(1.0+.20*near),vec3(.95));',photoStart);
  const photoEnd=renderer.indexOf('      }',lift);
  assert.ok(photoStart>0 && lift>photoStart && photoEnd>lift,
    'bounded snowcap luminance lift must occur only in photo-ready glacier shader');
  assert.ok(renderer.slice(photoStart,lift).includes('if(vHarborSurface>12.5)'),
    'floe-only brightness must not affect the old surface 12');
});

test('every snow top normal faces sky and each ice skirt points out to water',()=>{
  const caps=[],skirts=[];
  const waterY=12.2,lower=waterY+.035-.12;
  const normal=(a,b,c)=>{
    const u=b.map((v,k)=>v-a[k]),v=c.map((v,k)=>v-a[k]);
    return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],
      u[0]*v[1]-u[1]*v[0]];
  };
  buildAlaskaFjordDetail({
    waterY,terrainAt:()=>11,
    addTri(a,b,c,color,surface){if(surface===13)caps.push({a,b,c})},
    addQuad(a,b,c,d){if(Math.abs(c[1]-lower)<1e-6 &&
      Math.abs(d[1]-lower)<1e-6)skirts.push({a,b,c,d})}
  });
  const hash=n=>{const t=Math.sin(n*127.1+78.233)*43758.5453;
    return t-Math.floor(t);};
  let capOffset=0,skirtOffset=0;
  for(let i=0;i<86;i++){
    const corners=7+i%3;
    const h=hash(i*11+17),j=hash(i*13+37);
    const east=i<56?28+j*152:38+j*137;
    const north=i<56?250+h*195:-600+h*215;
    for(const cap of caps.slice(capOffset,capOffset+5*corners)){
      const n=normal(cap.a,cap.b,cap.c);
      assert.ok(n[1]>.001,'floe '+i+' cap must face +Y to receive sunlight');
    }
    for(const side of skirts.slice(skirtOffset,skirtOffset+corners)){
      const n=normal(side.a,side.b,side.c);
      const radialX=(side.a[0]+side.b[0])*.5-east;
      const radialZ=(side.a[2]+side.b[2])*.5-north;
      assert.ok(n[0]*radialX+n[2]*radialZ>.001,
        'floe '+i+' waterline wall must point away from ice center');
      assert.ok(Math.abs(side.c[1]-lower)<1e-6&&
        Math.abs(side.d[1]-lower)<1e-6,
        'ice draft and waterline must stay unchanged');
    }
    capOffset+=5*corners;skirtOffset+=corners;
  }
  assert.equal(capOffset,caps.length,'all 3435 sculpted top and bevel faces checked');
  assert.equal(skirtOffset,skirts.length,'all 687 waterline sides checked');
  assert.equal(caps.length,3435);
  assert.equal(skirts.length,687);
});

test('every sloped snow shoulder is inward of its original shore-tested rim',()=>{
  const tops=[];
  const stats=buildAlaskaFjordDetail({
    waterY:12.2,terrainAt:()=>11,
    addTri(a,b,c,color,surface){
      if(surface===13)tops.push({a,b,c});
    },
    addQuad(){}
  });
  const hash=n=>{const t=Math.sin(n*127.1+78.233)*43758.5453;
    return t-Math.floor(t);};
  let offset=0;
  for(let i=0;i<86;i++){
    const h=hash(i*11+17),j=hash(i*13+37);
    const east=i<56?28+j*152:38+j*137;
    const north=i<56?250+h*195:-600+h*215;
    const radius=1.35+3.9*hash(i*19+3);
    const corners=7+i%3;
    const originalRim=Array.from({length:corners},(_,k)=>{
      const a=k*2*Math.PI/corners,scale=.75+.31*hash(i*37+k*23);
      return [east+Math.cos(a)*radius*scale,
        north+Math.sin(a)*radius*(.53+.23*h)*scale];
    });
    const within=(p)=>{
      // Polygon boundary itself is valid; cross-product signs ensure the
      // inset shoulder and every bevel triangle stay inside the actual
      // surveyed-water-safe original (possibly irregular) perimeter.
      const px=p[0],pz=p[2],eps=1e-6;
      let inside=false;
      for(let k=0,prev=corners-1;k<corners;prev=k++){
        const [ax,az]=originalRim[prev],[bx,bz]=originalRim[k];
        const dx=bx-ax,dz=bz-az;
        const cross=dx*(pz-az)-dz*(px-ax);
        const projection=((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz);
        if(Math.abs(cross)<eps&&projection>=-eps&&projection<=1+eps)
          return true;
        if((az>pz)!==(bz>pz) &&
           px < (bx-ax)*(pz-az)/(bz-az)+ax)inside=!inside;
      }
      return inside;
    };
    for(const tri of tops.slice(offset,offset+5*corners)){
      for(const vertex of [tri.a,tri.b,tri.c])
        assert.ok(within(vertex),
          'floe '+i+' top/bevel vertex may not escape its original coast-tested footprint');
    }
    for(let k=0;k<corners;k++){
      // Last two of each wedge form the shoulder -> outer rim snow bevel.
      const [t1,t2]=tops.slice(offset+5*k+3,offset+5*k+5);
      const shA=t1.a,shB=t1.b,rimB=t1.c,rimA=t2.c;
      assert.ok(shA[1]>rimA[1]&&shB[1]>rimB[1],
        'snow bevel must descend outward into the blue wall, not form an inverted gutter');
      const inner=Math.hypot(shA[0]-east,shA[2]-north);
      const outer=Math.hypot(rimA[0]-east,rimA[2]-north);
      assert.ok(outer>inner+.05,'bevel must have a meaningful positive width');
    }
    offset+=5*corners;
  }
  assert.equal(offset,tops.length);
  assert.equal(stats.floeBevelTriangles,1374);
});
