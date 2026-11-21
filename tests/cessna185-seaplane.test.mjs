// Physical source-of-truth smoke tests for the shared US Cessna 185 floatplane.
// This test intentionally uses the published Blender GLB, not only source regexes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=async file=>readFile(new URL(file,import.meta.url));
const html=(await read('../index.html')).toString();
const chongqing=(await read('../assets/chongqing/chongqing.js')).toString();
const loader=(await read('../assets/aircraft/floatplane-glb.js')).toString();
const data=await read('../assets/aircraft/cessna185-floats.glb');
const {decodeFloatplaneGLB}=await import('data:text/javascript;base64,'+
  Buffer.from(loader).toString('base64'));

test('Blender-baked aircraft conforms to wing dimension and triangle budgets',()=>{
  assert.ok(data.byteLength>20000&&data.byteLength<2000000);
  const buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  let tris=0;
  const model=decodeFloatplaneGLB(buffer,()=>tris++);
  assert.equal(model.triangles,tris);
  assert.ok(tris>=1000&&tris<50000);
  assert.ok(Math.abs(model.span-10.922)<.002);
  // Span and length include the propeller spinner, not just fuselage.
  assert.ok(model.length>7.80&&model.length<8.40);
  assert.ok(model.bounds.min[1]<-1.50);
});

test('C185 GLB retains real Blender vertex normals without changing other scenery',()=>{
  const bytes=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  let normals=0,triangles=0,nonFlat=0;
  decodeFloatplaneGLB(bytes,(a,b,c,color,surface,vertexNormals)=>{
    triangles++;
    assert.equal(surface,4);
    assert.equal(color.length,3);
    if(!vertexNormals)return;
    normals++;
    assert.equal(vertexNormals.length,3);
    for(const n of vertexNormals){
      assert.equal(n.length,3);
      assert.ok(n.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...n)-1)<.001);
    }
    if(Math.hypot(...vertexNormals[0].map((n,i)=>n-vertexNormals[1][i]))>.015)
      nonFlat++;
  });
  assert.ok(triangles>=3000&&triangles<50000,'bounded model detail');
  assert.ok(normals>triangles*.8,'Blender GLB must store smooth vertex normals');
  assert.ok(nonFlat>100,'curved surfaces must actually vary across a triangle');
  assert.match(html,/function addTri\(a, b, c, rgb, surface=0, vertexNormals=null\)/);
  assert.match(html,/for\(const n of vertexNormals\) norm\.push\(\.\.\.n\)/);
});

test('left launcher selection exists for all main maps; Chongqing carries it forward',()=>{
  assert.match(html,/name="aircraft" value="seaplane"/);
  assert.match(html,/seaplane: \{ name: 'Cessna 185 Floatplane'/);
  assert.match(html,/seaplane: buildCessna185FloatMesh\(\)/);
  assert.match(html,/selectedAircraft==='seaplane'\)prepareFloatplaneAsset\(\)/);
  assert.match(html,/new URLSearchParams\(\{time,aircraft:/);
  assert.match(chongqing,/new URLSearchParams\(location.search\).get\('aircraft'\)==='seaplane'/);
  assert.match(chongqing,/moveSharedFloatplane\(dt\)/);
  assert.match(chongqing,/cessna185-floats\.glb/);
});

test('water taxi, rotation, land/water checks and touchdown are separate from jet gameplay',()=>{
  assert.match(html,/FLOAT_ROTATE_SPEED=17\.5/);
  assert.match(html,/let waterborne=false/);
  assert.match(html,/function usableFloatWater\(/);
  assert.match(html,/const floatRotate=waterborne/);
  assert.match(html,/if\(floatplane && !crash\)/);
  assert.match(html,/Hard water landing/);
  assert.match(html,/Float hit shoreline/);
  assert.match(html,/selectedAircraft!=='seaplane' && trailAccum/);
  assert.match(chongqing,/floatWaterSite\(x,z,heading\)/);
  assert.match(chongqing,/水面软着陆/);
});

test('Alaska lodgings are land-only, while piers and boats are allowed on water',()=>{
  assert.match(html,/LAND_PAD_GUARD_V1/);
  assert.match(html,/function dryPad\(/);
  assert.match(html,/if\(!pad\)return/);
  assert.match(html,/low<=WATER_H\+1\.0/);
  assert.match(html,/const beaconPad=dryPad/);
  assert.match(html,/const annex=findScenerySite/);
  assert.match(html,/const mast=findScenerySite/);
  assert.match(html,/let shoreX=null;/);
  assert.match(html,/const walkwayY=x=>/);
  assert.match(html,/Math\.min\(a\[1\],b\[1\],c\[1\],d\[1\]\)<=WATER_H\+\.58/);
});

test('both game scripts compile after the new aircraft integration',()=>{
  const first=html.indexOf('<script>')+8;
  const last=html.indexOf('</script>',first);
  assert.ok(first>8&&last>first);
  assert.doesNotThrow(()=>new Function(html.slice(first,last)));
  assert.doesNotThrow(()=>new Function(chongqing.replace(/^import .*;\s*$/gm,'')));
});
