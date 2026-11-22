// NYC municipal source-derived silhouettes in three conservative PATROL proxy lots.
// Run: node --test tests/nyc-dumbo-oti-source-silhouette.test.mjs
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const first=html.indexOf('  const DUMBO_OTI_PILOT=[');
const end=html.indexOf('  function buildCityBuildings(parcels,local=false)',first);
assert.ok(first>=0&&end>first);
const source=html.slice(first,end);
const setup=(compat=false,smooth=true,city=true)=>
  new Function('graphicsCompat','smoothScenery','selectedMap',source+
    'return {records:DUMBO_OTI_PILOT,select:matchingDumboOtiPilot,'+
      'build:buildDumboOtiPilotSourceMesh}')(
        compat,()=>smooth,{city});
const sites=[
  [366.89,-346.09,9,14.42,19.4,.44,false],
  [390.63,-346.49,9,19,13.84,.94,false],
  [358.67,-280.37,9,14.83,16.2,.05,false]
];
function audit(site,src,fn){
  const quads=[],tris=[],y=14.58;
  const result=fn((...a)=>tris.push(a),(...a)=>quads.push(a),
    site,src,y);
  return {result,quads,tris,ground:y};
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-
  (b[2]-a[2])*(c[0]-a[0]);

test('three exact municipal FIDs/BINs/heights retain source provenance',()=>{
  const {records}=setup();
  assert.deepEqual(records.map(p=>[p.fid,p.bin,p.roofHeightFt]),[
    [1080628,3389054,121],
    [1031082,3000135,83.41],
    [1051309,3344163,86.5]
  ]);
  for(const p of records){
    assert.ok(p.bin>=3000000&&p.bin<4000000);
    assert.ok(p.ring.length>=10&&p.ring.length<=13);
    assert.ok(p.ring.every(([lon,lat])=>
      lon>=-73.9935&&lon<=-73.9855&&
      lat>=40.6995&&lat<=40.7045));
    assert.ok(p.roofHeightFt>20&&p.roofHeightFt<200);
    assert.equal(new Set(p.ring.map(p=>p.join(','))).size,p.ring.length);
  }
  assert.match(html,/PATROL_DUMBO_OTI_SOURCE_OUTLINE_PILOT_V1/);
});

test('actual source topology produces non-box silhouettes and watertight roof area',()=>{
  const {select,build}=setup();
  const shapeCounts=[];
  for(const lot of sites){
    const src=select(lot,3);
    assert.ok(src,'real pilot lot must be covered');
    const {result,quads,tris,ground}=audit(lot,src,build);
    assert.ok(result.ring.length>=7);
    assert.ok(result.roofTriangles>=result.ring.length-3);
    shapeCounts.push(result.ring.length);
    const roof=tris.filter(t=>t.at(-1)===14);
    const projected=roof.reduce((sum,t)=>sum+Math.abs(cross(...t.slice(0,3)))*.5,0);
    assert.ok(Math.abs(projected-result.originalArea)<1e-6,
      'no triangular roof coverage gaps across concave source outline');
    for(const t of roof){
      assert.ok(cross(...t.slice(0,3))<-.000001,
        'all roof triangles face up with +Y normal in native game WebGL');
      const heights=src.fid===1080628
        ? [ground+lot[4],ground+lot[4]-.64]
        : [ground+lot[4]];
      assert.ok(t.slice(0,3).every(v=>
        heights.some(y=>Math.abs(v[1]-y)<1e-7)),
        'roof facets preserve exact external outline and bounded internal drop');
    }
    assert.ok(result.walls>=8&&result.windows>=20);
    assert.ok(result.floors>=3);
    assert.ok(quads.filter(q=>q.at(-1)===13).length===result.windows+result.doors,
      'one source-derived window pane per authored bay, no duplicate main box');
    assert.ok(quads.length<=(src.fid===1080628?1100:500) && tris.length<=13,
      'bounded same-mesh quad/triangle budget for WebGL2');
  }
  assert.ok(new Set(shapeCounts).size>=2,
    'GIS silhouettes should not be three clone rectangles');
});

test('192 source-pilot panes, including 108 Nexus condo bays, retain recessed window geometry',()=>{
  assert.match(source,/PATROL_DUMBO_OTI_RECESSED_BAYS_V2/);
  const {select,build}=setup();
  let totalWindows=0,totalDoors=0,totalQuads=0;
  for(const lot of sites){
    const {result,quads,tris}=audit(lot,select(lot,3),build);
    assert.equal(result.doors,1,'exactly one authored entry per pilot');
    assert.equal(result.windowReveals,4*result.windows,
      'left/right/sill/header are real 3D faces for every window');
    const panes=quads.filter(q=>q.at(-1)===13);
    assert.equal(panes.length,result.windows+result.doors);
    for(const pane of panes){
      const cx=pane.slice(0,4).reduce((s,p)=>s+p[0],0)/4;
      const cz=pane.slice(0,4).reduce((s,p)=>s+p[2],0)/4;
      let distance=Infinity;
      for(let k=0;k<result.ring.length;k++){
        const a=result.ring[k],b=result.ring[(k+1)%result.ring.length];
        const dx=b[0]-a[0],dz=b[1]-a[1];
        const t=Math.max(0,Math.min(1,
          ((cx-a[0])*dx+(cz-a[1])*dz)/(dx*dx+dz*dz)));
        distance=Math.min(distance,
          Math.hypot(cx-a[0]-t*dx,cz-a[1]-t*dz));
      }
      assert.ok(distance>=.17&&distance<=.19,
        'each glass/door plane must sit 0.18 units behind the shell');
    }
    assert.ok(quads.length<=(result.fid===1080628?1100:500)&&tris.length<=13,
      'recessed detail must remain within native one-batch mesh budget');
    totalWindows+=result.windows;totalDoors+=result.doors;
    totalQuads+=quads.length;
  }
  assert.equal(totalWindows,192);
  assert.equal(totalDoors,3);
  assert.ok(totalQuads<=1900);
});

test('fitted WGS84 polygon never crosses original road-cleared collision proxy',()=>{
  const {select,build}=setup();
  for(const lot of sites){
    const {result,quads,tris,ground}=audit(lot,select(lot,3),build);
    const [x,z,w,d,h]=lot;
    const v=[...quads.flatMap(q=>q.slice(0,4)),
      ...tris.flatMap(t=>t.slice(0,3))];
    assert.ok(v.length>100);
    for(const p of v){
      assert.ok(p.every(Number.isFinite));
      assert.ok(Math.abs(p[0]-x)<=w*.5+.001&&
        Math.abs(p[2]-z)<=d*.5+.001,
        'new municipal silhouette must not enter original road/rail margin');
      assert.ok(p[1]>=ground && p[1]<=ground+h+.121,
        'roof cannot exceed old worker collision/roof equipment envelope');
    }
    assert.ok(result.originalArea>12,
      'each source silhouette must have real roof area');
  }
});

test('low-detail and other-map paths keep procedural fallback and road geometry',()=>{
  const normal=setup(),compat=setup(true),simple=setup(false,false),
    otherMap=setup(false,true,false);
  for(const lot of sites){
    assert.ok(normal.select(lot,3));
    assert.equal(normal.select(lot,2),null,'LOD2 retains old cheap cuboid');
    assert.equal(normal.select(lot,1),null);
    assert.equal(compat.select(lot,3),null);
    assert.equal(simple.select(lot,3),null);
    assert.equal(otherMap.select(lot,3),null);
    assert.equal(normal.select([...lot.slice(0,6),true],3),null,
      'destroyed lots stay on existing debris/demolition path');
    assert.equal(normal.select([...lot.slice(0,6),false,[[0,0],[1,0],[1,1]]],3),null,
      'municipal footprints handled by their own verified renderer');
  }
  assert.equal(normal.select([342.76,-346.16,9,19,13.82,.41,false],3),null,
    'existing specialist DUMBO warehouse cannot be overwritten');
  assert.match(html,/function nycParcelCrossesRoad\(/);
  assert.match(html,/function isBridgeCollision\(x,y,z,radius=0\)/);
  assert.match(html,/renderExpressway\(CITY_EXPRESSWAY,/);
  assert.match(html,/renderExpressway\(VEGAS_EXPRESSWAY,/);
});

test('source-gated render skips generic wall box only for the three pilot lots',()=>{
  const block=html.slice(end,html.indexOf('\n  function tintSeed(',end));
  assert.match(block,/matchingDumboOtiPilot\(lot,detailBand\)/);
  assert.match(block,/buildDumboOtiPilotSourceMesh\(addTri,addQuad,lot,dumbOtiPilot,y\)/);
  assert.match(block,/if\(dumbOtiPilot\)\{[\s\S]{0,120}continue;/);
  assert.match(block,/addModelBox\(addQuad,x,y\+h\/2,z,w,h,d,material/);
  assert.match(source,/source\.roofHeightFt\/22/);
  assert.match(source,/const factor=Math\.min\(\(w-\.66\)\/\(xmax-xmin\)/);
});
