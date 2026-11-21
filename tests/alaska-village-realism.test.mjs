// Execute the ACTUAL production harbor builder over its bundled USGS DEM.
// This is a geometry and terrain regression, not a screenshot impression.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const meta=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const bytes=Buffer.from(meta.heightsBase64,'base64');
const scale=Math.min(.04,(75*.90-12.2)/meta.maxElevationMeters);
function terrain(x,z){
  const cx=Math.max(0,Math.min(255,(z/1920+.5)*256-.5));
  const rz=Math.max(0,Math.min(255,(1-(x/1920+.5))*256-.5));
  const a=Math.floor(cx),b=Math.floor(rz),tx=cx-a,tz=rz-b;
  const h=(i,j)=>bytes.readUInt16LE((j*256+i)*2);
  const h0=(h(a,b)*(1-tx)+h(Math.min(a+1,255),b)*tx);
  const h1=(h(a,Math.min(b+1,255))*(1-tx)+
    h(Math.min(a+1,255),Math.min(b+1,255))*tx);
  return 12.2+(h0*(1-tz)+h1*tz)*scale;
}

function buildRealHarbor(){
  const start=html.indexOf('  function buildAlaskaHarbor() {');
  const end=html.indexOf('  function buildAlaskaFalls()',start);
  assert.ok(start>0&&end>start,'the original harbor authoring function is present');
  const boxes=[],surfaces=[],obstacles=[],logs=[],bridges=[];
  const finite=v=>assert.ok(Array.isArray(v)&&v.length===3&&v.every(Number.isFinite));
  const addQuad=(a,b,c,d,color,surfaceId=0)=>{for(const p of [a,b,c,d])finite(p);finite(color);surfaces.push({kind:'quad',surfaceId});};
  const addTri=(a,b,c,color,surfaceId=0)=>{for(const p of [a,b,c])finite(p);finite(color);surfaces.push({kind:'tri',surfaceId});};
  const createTriangleMesh=()=>({addQuad,addTri,upload:()=>({primitives:surfaces.length})});
  const addModelBox=(_,x,y,z,w,h,d,color,surfaceId=0)=>{
    for(const n of [x,y,z,w,h,d])assert.ok(Number.isFinite(n),'finite house geometry');
    assert.ok(w>0&&h>0&&d>0,'positive actual mesh dimensions');
    finite(color);boxes.push({x,y,z,w,h,d,color,surfaceId});
  };
  const addRideBeam=(_,start,end,width,color)=>{
    finite(start);finite(end);finite(color);assert.ok(width>0);
    bridges.push({start,end});
  };
  const pushRoadStrip=()=>{};
  const coords={harbor:{x:151,z:-525},beacon:{x:-155,z:-610}};
  const compile=new Function('createTriangleMesh','addModelBox','addRideBeam',
    'lerp','clamp','pushRoadStrip','ALASKA_PLACES','sampleTerrainHeight',
    'WATER_H','alaskaObstacles','console',
    html.slice(start,end)+'return buildAlaskaHarbor;');
  const run=compile(createTriangleMesh,addModelBox,addRideBeam,
    (a,b,t)=>a+(b-a)*t,(v,l,h)=>Math.max(l,Math.min(h,v)),
    pushRoadStrip,coords,terrain,12.2,obstacles,
    {info:(...args)=>logs.push(args)});
  run();
  return {boxes,surfaces,obstacles,logs,bridges};
}
const scene=buildRealHarbor();

test('all six Alaska cabins render on surveyed, non-overlapping dry ground',()=>{
  const cabins=scene.obstacles.filter(o=>o.name==='harbor building');
  assert.equal(cabins.length,6,'none of the six huts silently disappeared');
  for(const h of cabins){
    assert.ok(terrain(h.x,h.z)>13.2,'center above high-water line');
    for(const dx of [-h.halfX,0,h.halfX])
      for(const dz of [-h.halfZ,0,h.halfZ])
        assert.ok(terrain(h.x+dx,h.z+dz)>13.2,
          'house footprint must not reach wet terrain');
    assert.ok(h.top>h.y && h.top-h.y<7,'credible gable height');
  }
  for(let i=0;i<cabins.length;i++)for(let j=0;j<i;j++){
    const a=cabins[i],b=cabins[j];
    assert.ok(Math.abs(a.x-b.x)>=a.halfX+b.halfX ||
      Math.abs(a.z-b.z)>=a.halfZ+b.halfZ,
      'houses must not intersect each other');
  }
});

test('actual geometry includes distinct siding, metal gables, windows and anchored porches',()=>{
  const audit=scene.logs.find(x=>x[0]==='[PATROL] Alaska surveyed village');
  assert.ok(audit,'production scene prints inspectable village counts');
  const counts=JSON.parse(audit[1]);
  assert.equal(counts.cabins,6);
  assert.equal(counts.sidingRows,72);
  assert.ok(counts.roofSeams>=45);
  assert.ok(scene.boxes.length>400,'not six single giant rectangular blocks');
  assert.ok(scene.bridges.length>50,'physically traced roof seams and railings');
  assert.ok(scene.surfaces.length>25,'roof gable and lighthouse are true mesh faces');
  assert.match(html,/const porchTerrain=\[-1\.1,0,1\.1\]\.map/);
  assert.match(html,/if\(Math\.min\(\.\.\.porchTerrain\)>WATER_H\+\.95/);
});

test('lodge timber and metal shaders tag the real, independently validated faces',()=>{
  const timber=scene.boxes.filter(b=>b.surfaceId===15);
  const paintedMetal=scene.surfaces.filter(v=>v.kind==='quad'&&v.surfaceId===16);
  const woodGables=scene.surfaces.filter(v=>v.kind==='tri'&&v.surfaceId===15);
  assert.equal(timber.length,6,'one physically shaded timber shell per lodge');
  assert.equal(paintedMetal.length,12,'both actual metal roof slopes on six cabins');
  assert.equal(woodGables.length,12,'gable infills use the same grain material');
  assert.match(html,/PATROL_ALASKA_LODGE_WOOD_V1/);
  assert.match(html,/alaskaLodgeCladding\(material,n,surfaceRoughness\)/);
  assert.match(html,/vHarborSurface<14\.5/);
  assert.match(html,/uAlaskaMesh && vHarborSurface>14\.5 && vHarborSurface<16\.5/);
  assert.match(html,/!\(harborArtInspection&&selectedMap\.alaska\)/);
});

test('stilt and porch support bottoms are not suspended above local terrain',()=>{
  const cabins=scene.obstacles.filter(o=>o.name==='harbor building');
  for(const lodge of cabins){
    const groundSupports=scene.boxes.filter(b=>
      Math.abs(b.x-lodge.x)<lodge.halfX+1.25 &&
      Math.abs(b.z-lodge.z)<lodge.halfZ+1.25 &&
      b.w<.36&&b.d<.36&&b.h>.25 &&
      Math.abs(b.y-b.h/2-terrain(b.x,b.z))<.05);
    assert.ok(groundSupports.length>=4,'each hut has four real anchored stilts');
  }
});
