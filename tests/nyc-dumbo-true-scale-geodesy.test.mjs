// A spatial-fidelity gate, not another test of decorative game-space cuboids.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=new URL('../assets/nyc/dumbo-true-scale-geodesy.js',import.meta.url);
const src=readFileSync(file,'utf8');
const {wgs84Ecef,makeDumboMetreFrame,roofTriangulation,prepareDumboBuildings}=
  await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const data=JSON.parse(readFileSync(
  new URL('../assets/nyc/dumbo-oti-true-scale-source.json',import.meta.url),'utf8'));
const prepared=prepareDumboBuildings(data);
const crossY=(a,b,c)=>{
  const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
  return u[2]*v[0]-u[0]*v[2];
};
test('DUMBO pilot retains exact official WGS84 FIDs, BINs and measured source height units',()=>{
  assert.equal(data.crs,'EPSG:4326');
  assert.equal(data.source.originalRepoCommit,
    '0eff65fdd133c8c3bd2a762e407e967bc024e299');
  assert.deepEqual(data.buildings.map(b=>b.fid),[1080628,1031082,1051309]);
  assert.deepEqual(data.buildings.map(b=>b.bin),[3389054,3000135,3344163]);
  assert.deepEqual(data.buildings.map(b=>b.heightAboveGroundFeet),
    [121,83.41,86.5]);
  assert.deepEqual(data.buildings.map(b=>b.ring.length),[12,13,10]);
  assert.ok(data.buildings.every(b=>b.ring.every(p=>
    p[0]<-73.98&&p[0]>-74.00&&p[1]>40.69&&p[1]<40.71)));
  assert.ok(data.units.modelHeight.includes('NOT surveyed roof elevation'));
});
test('WGS84 origin, east and north behave as actual metres with no fit-to-lot scale',()=>{
  const f=prepared.frame;
  const [x,y,z]=f.project(data.origin.longitude,data.origin.latitude,0);
  assert.ok(Math.hypot(x,y,z)<1e-5);
  const ex=f.project(data.origin.longitude+.0001,data.origin.latitude,0),
        nz=f.project(data.origin.longitude,data.origin.latitude+.0001,0);
  assert.ok(ex[0]>8.3&&ex[0]<8.6&&Math.abs(ex[2])<.01);
  assert.ok(nz[2]>11.0&&nz[2]<11.2&&Math.abs(nz[0])<.01);
  assert.equal(wgs84Ecef(0,0,0)[0],6378137);
  assert.throws(()=>f.project(181,40.7),/Invalid/);
  for(const b of data.buildings){
    for(const [lon,lat] of b.ring){
      const q=f.project(lon,lat,0),inverse=f.unproject(...q);
      assert.ok(Math.abs(inverse[0]-lon)<1e-8&&
        Math.abs(inverse[1]-lat)<1e-8,
        'WGS84 source point cannot drift to an unrelated street lot');
    }
  }
});
test('source roof heights are ft-to-metres above ground, with no worker proxy clamp',()=>{
  assert.deepEqual(prepared.buildings.map(b=>b.heightMetres),
    [36.8808,25.423368,26.3652]);
  assert.doesNotMatch(src,/target:\[366\.89|-346\.09|factor=Math\.min/);
});
test('three source polygons keep true relative location and area with upward roofs',()=>{
  const buildings=prepared.buildings;
  assert.equal(buildings.length,3);
  for(const b of buildings){
    assert.ok(b.roof.triangles.length>=3,'some concave municipal footprints need earclip');
    assert.ok(b.roof.areaSquareMetres>100,'building area should be real square metres');
    for(const t of b.roof.triangles){
      assert.ok(crossY(...t)>0,'every roof normal must point toward sky');
      for(const p of t)assert.ok(Number.isFinite(p[0])&&Number.isFinite(p[2]));
    }
  }
  const real12=Math.hypot(...[0,1].map(i=>
    buildings[0].centerEastNorthMetres[i]-buildings[1].centerEastNorthMetres[i]));
  const real13=Math.hypot(...[0,1].map(i=>
    buildings[0].centerEastNorthMetres[i]-buildings[2].centerEastNorthMetres[i]));
  assert.ok(real12>100&&real12<220,'real east-west separation ~150 metres');
  assert.ok(real13>100&&real13<250,'real north-south separation ~150 metres');
  // These are the existing PATROL procedural game proxies from #192, NOT
  // real coordinates. Their inconsistent distances prove distortion.
  const old12=Math.hypot(390.63-366.89,-346.49+346.09);
  const old13=Math.hypot(358.67-366.89,-280.37+346.09);
  const compression12=old12/real12,compression13=old13/real13;
  assert.ok(compression12<.25&&compression13>.25,
    'existing city cannot be rescued by a single uniform scale factor');
});
test('invalid source records and roofs are rejected, not silently replaced by boxes',()=>{
  assert.throws(()=>prepareDumboBuildings({...data,crs:'EPSG:3857'}),/WGS84/);
  assert.throws(()=>roofTriangulation([]),/Invalid/);
  assert.throws(()=>wgs84Ecef(-73.9,100),/Invalid/);
});
