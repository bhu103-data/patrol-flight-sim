import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const asset=JSON.parse(await readFile(new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
const key='const NYC_TIMES_VERIFIED_FOOTPRINTS = ',i=html.indexOf(key);
const geos=JSON.parse(html.slice(i+key.length,html.indexOf(';',i+key.length)));
const a=html.indexOf('    const blocks=[',html.indexOf('PATROL_NYC_GMAP_V8'));
const b=html.indexOf('    for(const [i,b] of blocks.entries()){',a);
const sites=new Function(html.slice(a,b)+'return blocks')();
const p=html.indexOf('  function buildOfficialFootprintMesh('),q=html.indexOf('  function buildCityBuildings(',p);
const build=new Function(html.slice(p,q)+'return buildOfficialFootprintMesh')();
const area=poly=>Math.abs(poly.reduce((n,a,i)=>{const b=poly[(i+1)%poly.length];return n+a[0]*b[1]-b[0]*a[1]},0)*.5);
test('13 address-verified official Times Square building shells',()=>{
 assert.equal(sites.length,13);assert.equal(Object.keys(geos).length,13);
 const ids=new Set(),saved=new Set(asset.features.map(x=>x.fid));
 for(const s of sites){
  const r=geos[s.name];assert.ok(r,s.name);
  assert.ok(saved.has(r.fid)||r.fid===672984,s.name);
  assert.ok(!ids.has(r.fid));ids.add(r.fid);
  assert.ok(r.uv.length>=4&&r.uv.length<=30);
 }
 assert.equal(sites.find(x=>x.name==='7 Times Square').z,-58);
});
test('surveyed roofs and windows preserve genuine bounded geometry',()=>{
 let roofs=0,glazing=0;
 for(const s of sites){
  const g=geos[s.name],outline=g.uv.map(([u,v])=>[s.x+u*s.w,s.z+v*s.d]);
  const minH=Math.max(...s.panels.map(([y,h])=>y+h*.5))+1.25;
  const h=Math.max(minH,Math.min(s.h*1.45,Math.max(s.h*.66,g.ft*.3048*.32)));
  let triangles=0,cover=0;
  const out=build((a,b,c,color,tag)=>{
   assert.equal(tag,11);roofs++;triangles++;
   cover+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))*.5;
  },(a,b,c,d,color,tag)=>{assert.ok(tag===9||tag===10);if(tag===10)glazing++},
  [s.x,s.z,s.w,s.d,h,.61,false,outline,g.fid],14.97,4);
  assert.ok(out.walls>=4&&out.windows>0);
  assert.equal(triangles,outline.length-2,s.name);
  assert.ok(Math.abs(cover-area(outline))<.03,s.name);
 }
 assert.ok(roofs>70&&glazing>300);
});
test('real building bodies replace boxes without removing LED ads or colliders',()=>{
 const p=html.indexOf('    const blocks=[',html.indexOf('PATROL_NYC_GMAP_V8'));
 const q=html.indexOf('    // One Times Square has its own landmark mesh',p);
 let boxes=0,ads=0,collisions=0;
 const fn=new Function('NYC_TIMES_VERIFIED_FOOTPRINTS','buildOfficialFootprintMesh',
 'addTri','addQuad','box','lamp','solidAt','marquee','ledQuad','ground','warm','steel','avenue',
 html.slice(p,q)+'return blocks');
 fn(geos,build,()=>{},()=>{},()=>{boxes++},()=>{},()=>{collisions++},
 ()=>{ads++},()=>{},14.97,[1,.8,.5],[.24,.27,.28],12);
 assert.equal(collisions,13);assert.equal(ads,sites.reduce((n,s)=>n+s.panels.length,0));
 assert.ok(boxes<=50,'cartoon cuboid bodies should not remain');
 assert.match(html,/PATROL_NYC_TIMES_SURVEY_SWAP_V14/);
 assert.match(html,/nyOfficialGisPbr\(material,n,surfaceRoughness\)/);
 assert.match(html,/float waterReflectance/);
 assert.match(html,/function advanceFlight\(dt\)/);
});

test('One Times Square official wedge preserves municipal roof and NYE lighting',()=>{
 const marker='const NYC_ONE_TIMES_OFFICIAL_POLYGON = ';
 const at=html.indexOf(marker);
 assert.ok(at>=0,'One Times official outline must be in scene source');
 const after=html.slice(at+marker.length);
 const end=after.indexOf(';');
 const polygon=JSON.parse(after.slice(0,end));
 assert.equal(polygon.length,4,'same four corners as municipal FID 57216');
 const world=polygon.map(([x,z])=>[x*10.7,z*13.75]);
 let roofs=0,roofArea=0,windows=0;
 build((a,b,c,col,type)=>{
   assert.equal(type,11);roofs++;
   roofArea+=Math.abs((b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]))*.5;
 },(a,b,c,d,col,type)=>{
   assert.ok(type===9||type===10);
   if(type===10)windows++;
 },[0,0,10.7,13.75,30.9,.24,false,world,57216],0,4);
 assert.equal(roofs,2,'no extra cuboid roof');
 assert.ok(Math.abs(roofArea-area(world))<.02);
 assert.ok(windows>40,'replaced tower has real glass panes');
 assert.match(html,/PATROL_NYC_ONE_TIMES_SURVEY_V15/);
 assert.match(html,/const face=side\*7\.12/,'side screens remain outside tapered body');
 assert.match(html,/const ball=\[\[34\.18/,'New Year ball remains');
});
