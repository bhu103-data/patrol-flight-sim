// Checks the production NYC road builder, not a mocked replacement.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/nyc-street-network.js',
  import.meta.url),'utf8');
const moduleUrl='data:text/javascript;charset=utf-8,'+
  encodeURIComponent(source);
const {buildNycStreetNetwork}=await import(moduleUrl);
const isRepairColor=c=>Array.isArray(c)&&[
  [.223,.247,.269],[.278,.299,.314],[.238,.260,.279]
].some(rgb=>rgb.every((v,i)=>Math.abs(v-c[i])<1e-8));

function sampleRoadBuilder(){
  const roadStrips=[],repairQuads=[],roadY=14.86+.086;
  const stats=buildNycStreetNetwork({
    addQuad:(a,b,c,d,color)=>{
      if(isRepairColor(color))repairQuads.push([a,b,c,d]);
    },
    addTri:()=>{},box:()=>{},beam:()=>{},
    ribbon:(a,b,width,color)=>{
      if(width>5 && Math.abs(a[1]-roadY)<1e-7 &&
         Math.abs(b[1]-roadY)<1e-7)
        roadStrips.push({a,b,width,color});
    },
    terrainAt:()=>50, detailBand:()=>3,
    grid:{blockWidth:24,blockLength:33,tilt:.24,offset:30,
      parkHalfWidth:1,parkHalfLength:1,parkCenter:10000},
    streetY:14.86,waterY:10,timesBounds:[10000,10001,10000,10001],
    existingStreets:[],lettering:()=>{},pavementText:()=>{},
    addParkedCar:()=>{},isClear:()=>true
  });
  return {stats,roadStrips,repairQuads};
}

test('all rectangular street trunks share one consistent asphalt PBR tint',()=>{
  const {roadStrips,stats}=sampleRoadBuilder();
  assert.ok(roadStrips.length>300,'expected the actual NYC grid to render');
  assert.ok(stats.avenues>0&&stats.streets>0);
  for(const r of roadStrips)
    assert.deepEqual(r.color,[.25,.28,.30],
      'a block-wide random tint exposes rectangular road seams');
  assert.doesNotMatch(source,/slab\(p\[0\],p\[1\],\.46,patch/,
    'avoid the old floating rectangular wear slab');
});

test('DUMBO resurfacing is tapered nonrectangular and stays inside road base',()=>{
  const {stats,repairQuads,roadStrips}=sampleRoadBuilder();
  assert.ok(stats.dumboSurfaceRepairs>10,
    'the test must actually exercise the DUMBO repair production branch');
  assert.equal(repairQuads.length,stats.dumboSurfaceRepairs*6);
  const width=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
  for(let i=0;i<repairQuads.length;i+=6){
    const first=repairQuads[i],middle=repairQuads[i+2],
      last=repairQuads[i+5];
    const peak=width(middle[1],middle[2]);
    assert.ok(peak>width(first[0],first[3])*2,
      'resurfacing must not start as a square edge');
    assert.ok(peak>width(last[1],last[2])*2,
      'resurfacing must taper rather than end as a square edge');
    for(let j=i;j<i+6;j++)for(const v of repairQuads[j]){
      assert.ok(v.every(Number.isFinite));
      assert.ok(Math.abs(v[1]-(14.86+.086+.005))<1e-7,
        'the repair decal must remain flush below raised road markings');
      // The base grid includes both Manhattan and Brooklyn. Every
      // repair vertex must lie in a safe asphalt corridor already emitted.
      const covered=roadStrips.some(road=>{
        const dx=road.b[0]-road.a[0],dz=road.b[2]-road.a[2],
          denom=dx*dx+dz*dz||1;
        const t=Math.max(0,Math.min(1,
          ((v[0]-road.a[0])*dx+(v[2]-road.a[2])*dz)/denom));
        return Math.hypot(v[0]-road.a[0]-t*dx,
          v[2]-road.a[2]-t*dz)<road.width*.5-.06;
      });
      assert.ok(covered,'decal must remain inside an existing road');
    }
  }
});
