// Focused DUMBO warehouse shell checks. Run locally with:
// node --test tests/nyc-dumbo-corner-warehouses.test.mjs
// Reference-inspired geometry, NOT an NYC survey or photo reconstruction.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function extract(name){
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing '+name);
  const opener=html.indexOf('{',start);
  let depth=0,end=-1;
  for(let i=opener;i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}'&&--depth===0){end=i+1;break;}
  }
  assert.ok(end>start,'unclosed '+name);
  return html.slice(start,end);
}
const shell=new Function(extract('buildDumboCornerWarehouseFacade')+
  ';return buildDumboCornerWarehouseFacade')();
const builder=extract('buildCityBuildings');
const parcel=(x,z,demolished=false)=>[x,z,9,17,17.5,.4,demolished];
const focus=[parcel(285,-330),parcel(372,-285)];
const filler=Array.from({length:30},(_,i)=>parcel(1000+i*4,1000+i*4));

test('two warehouse references use bounded, true inset glass and physical masonry arches',()=>{
  for(const style of [0,1]){
    const quads=[],boxes=[],beams=[];
    const x=285+style*87,z=-330+style*45,w=9,d=17,y=14.58,h=17.5;
    const stats=shell((...args)=>quads.push(args),(...args)=>boxes.push(args),
      (...args)=>beams.push(args),{x,y,z,w,d,h,variant:style});
    assert.equal(stats.variant,style);
    assert.equal(stats.stories,6);
    assert.ok(stats.openings>=90&&stats.openings<=140);
    assert.ok(stats.arcs>=200&&stats.arcs<=500);
    assert.equal(stats.headerStones,stats.arcs,
      'each upper-floor arch strip must have a real raised brick header');
    assert.ok(stats.headerStones>=200&&stats.headerStones<=500,
      'bounded projecting masonry pieces per building');
    assert.equal(stats.shutters,1,'exactly one service shutter on each warehouse');
    assert.ok(stats.sashMullions>=24&&stats.sashMullions<=80,
      'ground-floor workshop glazing needs two physical transom divisions');
    assert.equal(stats.roofPiers,4,'four raised stone-capped brick roof piers');
    assert.ok(quads.length>1200&&quads.length<2750,
      'ground-floor service openings and masonry remain bounded');
    assert.ok(quads.some(face=>face[5]===13),'inset windows actually generated');
    assert.ok(quads.some(face=>face[5]===12),'brick and window reveals actually generated');
    for(const face of quads){
      assert.ok([12,13].includes(face[5]),'use existing Brooklyn PBR material tags');
      for(const p of face.slice(0,4)){
        assert.ok(p.every(Number.isFinite));
        assert.ok(p[0]>=x-w/2-.11&&p[0]<=x+w/2+.11);
        assert.ok(p[2]>=z-d/2-.11&&p[2]<=z+d/2+.11);
        assert.ok(p[1]>=y-.01&&p[1]<=y+h+.01);
      }
    }
    for(const b of boxes){
      assert.ok(b.slice(0,6).every(Number.isFinite));
      assert.ok(b[3]>0&&b[4]>0&&b[5]>0);
      assert.ok(Math.abs(b[0]-x)+b[3]/2<=w/2+.01);
      assert.ok(Math.abs(b[2]-z)+b[5]/2<=d/2+.01);
      assert.ok(b[1]-b[4]/2>=y+h-.5);
      assert.ok(b[1]+b[4]/2<=y+h+.68);
    }
    assert.ok(beams.length>=2&&beams.length<=8);
  }
});

function draw(parcels,{compat=false,smooth=true}={}){
  let special=0,quads=0;
  const getMesh=()=>({addQuad(){quads++},addTri(){},
    upload(){return {quads}}});
  const painter=new Function(
    'createTriangleMesh','addModelBox','addRideBeam','nycDetailBand',
    'MANHATTAN_GRID','WATER_H','tintSeed','addDowntownFacadeRelief',
    'buildDumboCornerWarehouseFacade','graphicsCompat','smoothScenery',
    builder+';return buildCityBuildings'
  )(getMesh,()=>{},()=>{},
    (x,z)=>x>205&&x<435&&z>-415&&z<-195?3:0,
    {tilt:.24,offset:30,blockWidth:24,blockLength:33},
    12.2,()=>.41,()=>{},
    (...args)=>{special++;return shell(...args);},compat,()=>smooth);
  const result=painter(parcels);
  return {special,result};
}

test('exactly two accepted lots render, and demolishing one removes its facade',()=>{
  assert.equal(draw([...focus,...filler]).special,2);
  assert.equal(draw([parcel(285,-330,true),focus[1],...filler]).special,1);
  assert.equal(draw([focus[0]]).special,0,'small local builder input is untouched');
});
test('low-quality and compatible render paths preserve the existing box fallback',()=>{
  assert.equal(draw([...focus,...filler],{smooth:false}).special,0);
  assert.equal(draw([...focus,...filler],{compat:true}).special,0);
});
test('bridge road and physics source remain outside the warehouse patch',()=>{
  assert.match(html,/PATROL_DUMBO_CORNER_WAREHOUSE_V1/);
  assert.match(html,/PATROL_DUMBO_LOADING_SHUTTER_V3/);
  assert.match(html,/PATROL_DUMBO_ROOF_PARAPET_V3/);
  assert.match(builder,/warehouseStyles=new Map\(\)/);
  assert.match(builder,/!p\[7\]/,'do not replace official GIS polygons');
  assert.match(builder,/!graphicsCompat && smoothScenery\(\)/);
  assert.match(builder,/if\(destroyed\)\{/);
  assert.match(builder,/cornerWarehouse\?w-\.38:w/);
});
