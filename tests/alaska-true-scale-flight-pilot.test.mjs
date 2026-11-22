import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../tracy-arm-true-scale.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const geoSrc=readFileSync(new URL('../assets/alaska/tracy-arm-geodesy.js',import.meta.url),'utf8');
const {rasterCellToLocalEnu,rasterCellWgs84,sourceTileOrigin,
  sampleSourceElevationMetres}=await import('data:text/javascript;base64,'+
  Buffer.from(geoSrc).toString('base64'));
const raw=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const decodeSrc=readFileSync(new URL('../assets/alaska/usgs-dem.js',import.meta.url),'utf8');
const {decodeAlaskaDEM}=await import('data:text/javascript;base64,'+
  Buffer.from(decodeSrc).toString('base64'));
const dem={...raw,...decodeAlaskaDEM(raw)};

test('flight pilot is reachable but does not replace shipping map or its controls',()=>{
  assert.match(game,/<a href="\.\/tracy-arm-true-scale\.html"/);
  assert.match(src,/href="\.\/index\.html"/);
  assert.match(src,/aria-label="Flightable real-coordinate Tracy Arm USGS terrain"/);
  assert.match(src,/W\/S forward\/back/);
  assert.match(src,/window\.PatrolTrueScaleQA/);
  assert.match(src,/original mountain relief/);
  assert.match(src,/source height datum unverified/);
  assert.match(src,/Experimental separate flight camera, not the integrated PATROL flight physics/);
});
test('GPU terrain mesh uses WGS84-derived real metre east/north with original heights',()=>{
  assert.match(src,/rasterCellToLocalEnu\(dem,col,row,0\)/);
  assert.match(src,/points\[i\*3\]=east/);
  assert.match(src,/points\[i\*3\+1\]=elev<=1\?-4:elev/);
  assert.match(src,/points\[i\*3\+2\]=north/);
  assert.match(src,/indices\.push\(a,c,b,b,c,d\)/);
  assert.match(src,/const count=dem\.width\*dem\.height/);
  assert.match(src,/new Uint32Array\(indexArray\)/);
  assert.doesNotMatch(src,/ALASKA_DEM_RELIEF_PREVIEW_SCALE|MAP_SPAN\s*=\s*1920|CEILING\s*=\s*100/);
  assert.doesNotMatch(src,/\.js\?v=.*cdn|unpkg\.com|threejs\.org/);
  assert.equal(dem.heights.length,65536);
  assert.equal(dem.heights.reduce((a,b)=>Math.max(a,b),0),1836);
  assert.equal((dem.width-1)*(dem.height-1)*2,130050);
});
test('north-up terrain spans more than 7.5km E and 8km N, no 90deg rotation',()=>{
  const [west,south]=rasterCellToLocalEnu(dem,0,0,0);
  const [east,north]=rasterCellToLocalEnu(dem,255,255,0);
  assert.ok(east-west>7500&&east-west<7800);
  assert.ok(north-south>7900&&north-south<8100);
  const [lon0,lat0]=sourceTileOrigin(dem);
  const [lonLow,latLow]=rasterCellWgs84(dem,0,0);
  const [lonHigh,latHigh]=rasterCellWgs84(dem,255,255);
  assert.ok(lonHigh>lonLow&&latHigh>latLow);
  assert.ok(Math.abs(lon0+133.2)<.00001&&Math.abs(lat0-57.887)<.00001);
});
test('flight starts from a verified water source location and keeps real dynamic envelope',()=>{
  const [lon,lat]=rasterCellWgs84(dem,170,105);
  const start=sampleSourceElevationMetres(dem,lon,lat);
  assert.ok(start<=1,'source DEM launch channel must be on water');
  const [e,n]=rasterCellToLocalEnu(dem,170,105,0);
  assert.ok(Number.isFinite(e)&&Number.isFinite(n));
  assert.match(src,/spawn=\[e,320,north\]/);
  assert.match(src,/if\(dem\.heights\[105\*dem\.width\+170\]>1\)/);
  assert.match(src,/Math\.max\(Math\.max\(0,surface\)\+18,Math\.min\(3800,pose\.xyz\[1\]\)\)/);
  assert.match(src,/gl\.drawElements\(gl\.TRIANGLES,m\.count,gl\.UNSIGNED_INT,0\)/);
});

test('materials are reused from already-bundled CC0 rather than unsourced scenery',()=>{
  const manifest=JSON.parse(readFileSync(
    new URL('../assets/alaska/alaska-photo-manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.license,'CC0');
  assert.deepEqual(manifest.columns.slice(0,3),[
    'rock_01','snow_02','forest_ground_04'
  ]);
  assert.match(src,/\.\/assets\/alaska\/alaska-photo-albedo\.webp/);
  assert.match(src,/vec3 rock=atlasColor\(0\.0,n\)/);
  assert.match(src,/vec3 forest=atlasColor\(2\.0,n\)/);
  assert.match(src,/vec3 ice=atlasColor\(1\.0,n\)/);
  assert.match(src,/photoReady=false/);
  assert.match(src,/if\(uPhoto\)/);
  assert.match(src,/textureGrad\(uAlbedo,atlasUV/);
  assert.match(src,/vec2 ddxX=dFdx\(px\),ddyX=dFdy\(px\)/);
  assert.doesNotMatch(src,/return texture\(uAlbedo,atlasUV\)/);
});
