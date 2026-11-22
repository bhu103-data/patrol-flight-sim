// Run: node --test tests/nyc-gis-pbr.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const js=await readFile(new URL('../assets/nyc/nyc-gis-infill.js',import.meta.url),'utf8');
const data=JSON.parse(await readFile(new URL(
  '../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
const {buildTimesSquareGisInfill}=await import('data:text/javascript;base64,'+
  Buffer.from(js).toString('base64'));
const start=html.indexOf('    const blocks=[',html.indexOf('PATROL_NYC_GMAP_V8'));
const end=html.indexOf('    for(const [i,b] of blocks.entries()){',start);
assert.ok(start>0&&end>start);
const blocks=new Function(html.slice(start,end)+';return blocks')();

function simulate(asset=data){
  const surfaces=new Map(),glazingCenters=[];
  let triangles=0,invalid=0,minArea=Infinity;
  const check=(a,b,c)=>{
    for(const p of [a,b,c]){
      if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))invalid++;
      else if(p[0]<-34.15||p[0]>56.15||p[2]<-52.15||p[2]>68.15)invalid++;
    }
    const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
    const area=.5*Math.hypot(u[1]*v[2]-u[2]*v[1],
      u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
    if(!Number.isFinite(area)||area<1e-8)invalid++;
    minArea=Math.min(minArea,area);triangles++;
  };
  const tag=id=>{
    assert.ok([6,7,8].includes(id),'all GIS faces have explicit material IDs');
    surfaces.set(id,(surfaces.get(id)||0)+1);
  };
  const stats=buildTimesSquareGisInfill(asset,{
    addQuad:(a,b,c,d,color,id)=>{
      tag(id);assert.equal(color.length,3);check(a,b,c);check(a,c,d);
      if(id===7)glazingCenters.push([Math.round((a[0]+c[0])*50)/100,
        Math.round((a[1]+c[1])*50)/100,Math.round((a[2]+c[2])*50)/100]);
    },
    addTri:(a,b,c,color,id)=>{
      tag(id);assert.equal(color.length,3);check(a,b,c);
    },
    box:(x,y,z,w,h,d,color)=>{
      assert.ok([x,y,z,w,h,d].every(Number.isFinite));
      assert.ok(w>0&&h>0&&d>0);
      assert.equal(color.length,3);
    },
    ground:14.93,bounds:[-34,56,-52,68],protectedSites:blocks
  });
  return {stats,surfaces,triangles,invalid,minArea,glazingCenters};
}

test('official NYC GIS source preserves validated FIDs and coordinates',()=>{
  assert.equal(data.features.length,120);
  const ids=new Set();
  for(const row of data.features){
    assert.ok(Number.isSafeInteger(row.fid));
    assert.ok(!ids.has(row.fid));ids.add(row.fid);
    assert.ok(row.heightFt>0&&row.heightFt<2500);
    for(const ring of row.rings)for(const p of ring){
      assert.ok(p[0]>-74&&p[0]<-73.8&&p[1]>40.65&&p[1]<40.85);
    }
  }
});
test('GLSL categories 6 masonry, 7 glazing, 8 roof generate nondegenerate faces',()=>{
  const {stats,surfaces,triangles,invalid,minArea}=simulate();
  assert.equal(invalid,0,'finite coordinates and nondegenerate triangles');
  assert.ok(minArea>1e-5);
  assert.deepEqual(stats.materialSurfaceIds,[6,7,8]);
  assert.ok(surfaces.get(6)>200,'texturable building walls');
  assert.ok(surfaces.get(7)>500,'fresnel window glazing');
  assert.ok(surfaces.get(8)>100,'triangulated rooftops');
  assert.ok(triangles>1000&&triangles<9000,'bounded geometry');
});
test('visual GIS infill is bounded and keeps the curated LED towers',()=>{
  const {stats}=simulate();
  assert.ok(stats.sourceBuildings>=20&&stats.sourceBuildings<=45);
  assert.ok(stats.infillPieces<=stats.maximumPieces);
  assert.ok(stats.windowQuads<=2200);
  assert.equal(stats.visualOnly,true);
  assert.equal(blocks.length,13);
});
test('main WebGL2 shader binds material IDs and keeps a rollback path',()=>{
  assert.match(html,/PATROL_NYC_GIS_PBR_V12/);
  assert.match(html,/dataMesh\.addQuad\(a,b,c,d,color,surface\)/);
  assert.match(html,/dataMesh\.addTri\(a,b,c,color,surface\)/);
  assert.match(html,/nyOfficialGisPbr\(material,n,surfaceRoughness\)/);
  assert.match(html,/nycGisMesh\?\.count/);
  assert.match(html,/nycGIS'\)!=='off'/);
  assert.match(html,/PATROL_NYC_UNIQUE_ADS_V6/);
  assert.match(html,/float waterReflectance/);
  assert.match(html,/function advanceFlight\(dt\)/);
});

test('GIS glazing coverage is independent of source FID sort order',()=>{
  const normal=simulate(),reversed=simulate({...data,features:[...data.features].reverse()});
  assert.ok(normal.stats.windowQuads<2200,
    'bounded fair window distribution must not exhaust global count');
  assert.equal(normal.stats.windowQuads,reversed.stats.windowQuads);
  const key=point=>point.join(':');
  assert.deepEqual(normal.glazingCenters.map(key).sort(),
    reversed.glazingCenters.map(key).sort(),
    'late FIDs must retain their windows even when record order changes');
  const buckets=new Set(normal.glazingCenters.map(([x,y,z])=>
    Math.floor(x/8)+':'+Math.floor(z/8)));
  assert.ok(buckets.size>=12,'surveyed infill panes must cover the district');
});

test('44th Street inspected FID receives bounded deep upper windows',()=>{
  const source=data.features.find(f=>f.fid===1000156);
  assert.ok(source&&source.heightFt>450,'refer to real municipal footprint');
  const one=simulate({...data,features:[source]});
  assert.ok(one.stats.infillPieces>=1,'inspected parcel must survive road cuts');
  assert.ok(one.stats.windowQuads>=40&&one.stats.windowQuads<=180,
    'dense but bounded facade, not a shader-only effect');
  assert.ok(one.glazingCenters.filter(p=>p[1]>14.93+27).length>=8,
    'upper floors must contain genuine glass quads');
  assert.ok(one.surfaces.get(6)>one.surfaces.get(7)/2,
    'masonry returns and source geometry must remain intact');
  assert.match(js,/showcaseRemaining--/);
  assert.match(js,/const stone=\[\.37,\.39,\.40\],front=\.075/);
});
