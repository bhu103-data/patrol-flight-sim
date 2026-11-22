// Test the actual named 1515 Broadway source polygon and native mesh,
// not an invented box or a disconnected render mock.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const geoMarker='const NYC_TIMES_VERIFIED_FOOTPRINTS = ';
const g=html.indexOf(geoMarker);
assert.ok(g>0);
const polygons=JSON.parse(html.slice(g+geoMarker.length,
  html.indexOf(';',g+geoMarker.length)));
const first=html.indexOf('    const blocks=[',html.indexOf('PATROL_NYC_GMAP_V8'));
const last=html.indexOf('    for(const [i,b] of blocks.entries()){',first);
const sites=new Function(html.slice(first,last)+'return blocks')();
const astor=sites.find(s=>s.name==='1515 Broadway');
const source=polygons['1515 Broadway'];
assert.ok(astor&&source&&source.fid===212747);
const outline=source.uv.map(([u,v])=>[astor.x+u*astor.w,astor.z+v*astor.d]);
const minHeight=Math.max(...astor.panels.map(([y,h])=>y+h*.5))+1.25;
const height=Math.max(minHeight,
  Math.min(astor.h*1.45,Math.max(astor.h*.66,source.ft*.3048*.32)));

const bodyStart=html.indexOf('  function buildOfficialFootprintMesh(');
const bodyEnd=html.indexOf('  function buildCityBuildings(',bodyStart);
const meshSource=html.slice(bodyStart,bodyEnd);
const gate='if(detailBand===4 && lot[9]===212747 && isGlass &&';
assert.ok(meshSource.includes(gate));
const compile=enabled=>new Function((enabled?meshSource:
  meshSource.replace(gate,'if(false && lot[9]===212747 && isGlass &&'))+
  ';return buildOfficialFootprintMesh')();

function render(build,fid=212747){
  const quads=[],triangles=[];
  const result=build((...args)=>triangles.push(args),
    (...args)=>quads.push(args),
    [astor.x,astor.z,astor.w,astor.d,height,.61,false,outline,fid],
    14.97,4);
  return {quads,triangles,result};
}
function segmentDistance(point,a,b){
  const dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;
  const t=Math.max(0,Math.min(1,len?
    ((point[0]-a[0])*dx+(point[2]-a[1])*dz)/len:0));
  return Math.hypot(point[0]-a[0]-dx*t,point[2]-a[1]-dz*t);
}

test('One Astor Plaza is tagged as a reflective glass shell, not a stone box',()=>{
  const scene=html.slice(first,html.indexOf(
    '    // One Times Square has its own landmark mesh',last));
  const tones=[];
  const fn=new Function('NYC_TIMES_VERIFIED_FOOTPRINTS','buildOfficialFootprintMesh',
    'addTri','addQuad','box','lamp','solidAt','marquee','ledQuad',
    'ground','warm','steel','avenue',scene+'return blocks');
  fn(polygons,(_tri,_quad,lot)=>{tones.push([lot[9],lot[5]]);return {roof:1,walls:4};},
    ()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},
    14.97,[1,.8,.5],[.24,.27,.28],12);
  assert.deepEqual(tones.find(([fid])=>fid===212747),[212747,.61]);
  assert.deepEqual(tones.find(([fid])=>fid===384606),[384606,.24]);
  assert.ok(height>30,'retain tall municipal 1515 Broadway silhouette');
});

test('curtainwall adds exactly 84 polygon-attached quads without changing roofs or old windows',()=>{
  const before=render(compile(false)),after=render(compile(true));
  const expectedEdges=outline.filter((p,i)=>{
    const b=outline[(i+1)%outline.length];
    return Math.hypot(p[0]-b[0],p[1]-b[1])>=3.3;
  }).length;
  assert.equal(expectedEdges,6);
  assert.equal(after.result.roof,before.result.roof);
  assert.deepEqual(after.triangles,before.triangles);
  assert.equal(after.result.windows,before.result.windows);
  const inserted=[];let original=0;
  for(const q of after.quads){
    if(original<before.quads.length &&
      JSON.stringify(q)===JSON.stringify(before.quads[original]))original++;
    else inserted.push(q);
  }
  assert.equal(original,before.quads.length,
    'all existing walls/windows must retain their order and geometry');
  assert.equal(inserted.length,expectedEdges*(4+10));
  assert.ok(inserted.every(q=>q[5]===9),'reuse native PBR trim surface');
  assert.equal(inserted.length*2,168,'exact added triangle budget');
  for(const q of inserted)for(const p of q.slice(0,4)){
    assert.ok(p.every(Number.isFinite));
    assert.ok(p[1]>=14.97+6.55-.03 &&
      p[1]<=14.97+height-.70+.03,'keep trim under surveyed roof');
    assert.ok(Math.min(...outline.map((a,i)=>
      segmentDistance(p,a,outline[(i+1)%outline.length])))<=.109,
      'trim must remain attached to the official footprint edges');
  }
});

test('new curtainwall is FID-scoped, never added to neighboring surveyed buildings',()=>{
  const before=render(compile(false),384606),
        after=render(compile(true),384606);
  assert.deepEqual(after,before,'no extra trim outside 1515 Broadway');
});
