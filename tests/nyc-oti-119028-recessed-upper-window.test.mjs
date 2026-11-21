// One source-anchored, physically cut upper window on existing NYC OTI lot.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const [html,asset]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8')
]);
const source=JSON.parse(asset);
const start=html.indexOf('  function buildOfficialFootprintMesh(');
const stop=html.indexOf('  function buildCityBuildings(',start);
assert.ok(start>0&&stop>start,'existing native WebGL OTI building helper');
const render=new Function(html.slice(start,stop)+'return buildOfficialFootprintMesh;')();
function mesh(lot,detail=3){
  const [id,x,z,w,d,h,poly]=lot,quads=[],triangles=[];
  const stats=render((...args)=>triangles.push(args),
    (...args)=>quads.push(args),[x,z,w,d,h,(id%101)/101,false,poly,id],
    14.58,detail);
  return {quads,triangles,stats};
}
const lot=source.footprints.find(x=>x[0]===119028);
test('the bounded replacement only uses existing official OTI polygon and budget',()=>{
  assert.ok(lot,'verified NYC OTI DOITT_ID source');
  let quads=0,roofs=0;
  for(const rec of source.footprints){
    const x=mesh(rec),low=mesh(rec,1);
    quads+=x.quads.length;roofs+=x.triangles.length;
    assert.equal(x.stats.roof,low.stats.roof,'same official roof polygon');
    assert.equal(x.stats.walls,low.stats.walls,'same official outline edges');
    assert.ok(x.quads.length<400,'per-building geometry remains bounded');
    assert.ok(x.quads.every(face=>face.slice(0,4).every(
      p=>p.length===3&&p.every(Number.isFinite))));
  }
  assert.equal(source.footprints.length,100);
  assert.equal(quads,8894,'one real opening replaces old surplus 3-D trim');
  assert.ok(quads<9000,'existing mobile OTI quad budget retained');
  assert.equal(roofs,1164,'no change to official roof triangulation');
});
test('street camera edge 12 has a real upper aperture with inset glass',()=>{
  const {quads}=mesh(lot),ring=lot[6],a=ring[12],b=ring[0];
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  const area=ring.reduce((sum,p,i)=>{
    const q=ring[(i+1)%ring.length];
    return sum+p[0]*q[1]-q[0]*p[1];
  },0);
  const sign=Math.sign(area),normal=[sign*dz/len,-sign*dx/len];
  const projected=p=>((p[0]-a[0])*dx+(p[2]-a[1])*dz)/(len*len);
  const depth=p=>(p[0]-a[0])*normal[0]+(p[2]-a[1])*normal[1];
  const low=14.58+2.91,high=14.58+4.64,mid=(low+high)/2;
  const nearBand=face=>face.slice(0,4).every(p=>
    projected(p)>=-.0001&&projected(p)<=1.0001);
  const crossing=face=>{
    const p=face.slice(0,4),ys=p.map(x=>x[1]),ts=p.map(projected);
    return Math.min(...ys)<mid&&Math.max(...ys)>mid&&
      Math.min(...ts)<.5&&Math.max(...ts)>.5;
  };
  const opaque=quads.filter(face=>face[5]===9&&nearBand(face)&&
    face.slice(0,4).every(p=>Math.abs(depth(p))<1e-7)&&crossing(face));
  assert.equal(opaque.length,0,'opaque source wall no longer crosses upper window center');
  const glass=quads.filter(face=>face[5]===10&&nearBand(face)&&
    face.slice(0,4).every(p=>Math.abs(depth(p)+.12)<1e-6)&&
    crossing(face));
  assert.equal(glass.length,1,'exactly one pane is 0.12 units behind official wall');
  const [p0,p1,p2]=glass[0],u=p1.map((v,i)=>v-p0[i]),
    v=p2.map((w,i)=>w-p0[i]);
  const dot=(u[1]*v[2]-u[2]*v[1])*normal[0]+
    (u[0]*v[1]-u[1]*v[0])*normal[1];
  assert.ok(dot>0,'recessed glass must face outdoors');
  const returns=quads.filter(face=>face[5]===9&&nearBand(face)&&
    face.slice(0,4).every(p=>p[1]>=low-1e-6&&p[1]<=high+1e-6)&&
    face.slice(0,4).some(p=>Math.abs(depth(p)+.12)<1e-6)&&
    face.slice(0,4).some(p=>Math.abs(depth(p))<1e-6));
  assert.equal(returns.length,4,'four joined 3-D reveal surfaces');
});
test('other maps, traffic, collision and lower-LOD paths are untouched',()=>{
  assert.match(html.slice(start,stop),/lot\[8\]===119028 && i===12/);
  assert.match(html,/officialLotAt\(east,north\)\|\|cityParcels\.get/);
  const before=mesh(lot,1),now=mesh(lot,3);
  assert.equal(before.stats.streetEntrances,0);
  assert.equal(before.stats.corniceBands,0);
  assert.ok(now.stats.streetEntrances>0);
});
