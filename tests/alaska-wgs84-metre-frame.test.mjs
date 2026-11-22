import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const moduleText=readFileSync(new URL('../assets/alaska/tracy-arm-geodesy.js',import.meta.url),'utf8');
const geo=await import('data:text/javascript;base64,'+
  Buffer.from(moduleText).toString('base64'));
const raw=JSON.parse(readFileSync(
  new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const decodeSource=readFileSync(new URL('../assets/alaska/usgs-dem.js',import.meta.url),'utf8');
const {decodeAlaskaDEM}=await import('data:text/javascript;base64,'+
  Buffer.from(decodeSource).toString('base64'));
const dem={...raw,...decodeAlaskaDEM(raw)};

test('source bbox is WGS84 north-up, covers ~8km, not game units',()=>{
  geo.validateTracyArmRaster(raw);
  assert.deepEqual(geo.sourceTileOrigin(raw),[-133.2,57.887]);
  const [lon0,lat0]=geo.sourceTileOrigin(raw);
  const west=geo.wgs84ToLocalEnu(raw.bbox[0],lat0,0,lon0,lat0);
  const east=geo.wgs84ToLocalEnu(raw.bbox[2],lat0,0,lon0,lat0);
  const south=geo.wgs84ToLocalEnu(lon0,raw.bbox[1],0,lon0,lat0);
  const north=geo.wgs84ToLocalEnu(lon0,raw.bbox[3],0,lon0,lat0);
  const width=east[0]-west[0],height=north[1]-south[1];
  assert.ok(width>7600&&width<7800,'actual east-west metres '+width);
  assert.ok(height>8000&&height<8100,'actual south-north metres '+height);
  assert.ok(Math.abs(east[1])<10&&Math.abs(north[0])<10);
  assert.ok(Math.abs(east[0]+west[0])<10);
  assert.ok(Math.abs(north[1]+south[1])<10);
});
test('decoded raster centres are in original south-first WGS84 order',()=>{
  const p00=geo.rasterCellWgs84(raw,0,0);
  const pNE=geo.rasterCellWgs84(raw,255,255);
  assert.ok(p00[0]<pNE[0]&&p00[1]<pNE[1]);
  assert.ok(p00[0]>raw.bbox[0]&&p00[1]>raw.bbox[1]);
  assert.ok(pNE[0]<raw.bbox[2]&&pNE[1]<raw.bbox[3]);
  for(const [col,row] of [[0,0],[255,255],[127,82],[71,213],[128,128]]){
    const [lon,lat]=geo.rasterCellWgs84(raw,col,row);
    assert.ok(Math.abs(geo.sampleSourceElevationMetres(dem,lon,lat)-
      dem.heights[row*dem.width+col])<1e-6,'exact cell centre '+col+'/'+row);
  }
});
test('ENU metre coordinates are invertible without rotating source geography',()=>{
  const [lon0,lat0]=geo.sourceTileOrigin(raw);
  for(const [lon,lat,ellipsoidHeight] of [
    [lon0,lat0,0],[-133.259,57.854,0],[-133.142,57.919,1200],
    [-133.201,57.888,1800]
  ]){
    const enu=geo.wgs84ToLocalEnu(lon,lat,ellipsoidHeight,lon0,lat0);
    const restored=geo.localEnuToWgs84(...enu,lon0,lat0);
    assert.ok(Math.abs(restored[0]-lon)<2e-8);
    assert.ok(Math.abs(restored[1]-lat)<2e-8);
    assert.ok(Math.abs(restored[2]-ellipsoidHeight)<.02);
  }
  const south=geo.rasterCellToLocalEnu(raw,128,0);
  const north=geo.rasterCellToLocalEnu(raw,128,255);
  assert.ok(north[1]>south[1],'true north corresponds to increasing north metres');
});
test('existing PATROL location transform is intentionally 90 degrees off north-up',()=>{
  const centre=geo.oldPatrolGamePointToWgs84(raw,0,0);
  const gameNorth=geo.oldPatrolGamePointToWgs84(raw,0,400);
  const gameEast=geo.oldPatrolGamePointToWgs84(raw,400,0);
  assert.deepEqual(centre,geo.sourceTileOrigin(raw));
  assert.ok(gameNorth[0]>centre[0]&&Math.abs(gameNorth[1]-centre[1])<1e-10,
    'existing game north is real east');
  assert.ok(gameEast[1]<centre[1]&&Math.abs(gameEast[0]-centre[0])<1e-10,
    'existing game east is real south');
  assert.ok(Math.abs(gameEast[1]-centre[1])>.01,'not a rounding issue');
});
test('out-of-bounds GIS input must fail rather than invent mountain coordinates',()=>{
  assert.throws(()=>geo.sampleSourceElevationMetres(dem,-133.30,57.90),RangeError);
  assert.throws(()=>geo.rasterCellWgs84(raw,256,0),RangeError);
  assert.throws(()=>geo.rasterCellWgs84(raw,1,-1),RangeError);
  assert.throws(()=>geo.wgs84ToLocalEnu(200,57,0,-133.2,57.887),RangeError);
  assert.throws(()=>geo.validateTracyArmRaster({...raw,crs:'EPSG:3857'}));
  assert.throws(()=>geo.validateTracyArmRaster({...raw,axis:'north-first rows'}));
});
test('measured vertical datum cannot be silently assumed WGS84 ellipsoidal',()=>{
  assert.equal(raw.verticalUnit,'meters');
  assert.equal(raw.crs,'EPSG:4326');
  assert.ok(!raw.verticalDatum,'source tile does not identify vertical datum');
  // Geo heights from raster and ECEF ellipsoidal heights must be reconciled
  // before describing a terrain/flight visual as geodetically 1:1.
  assert.match(moduleText,/vertical reference has NOT been verified/);
  assert.doesNotMatch(moduleText,/export function render/);
});
