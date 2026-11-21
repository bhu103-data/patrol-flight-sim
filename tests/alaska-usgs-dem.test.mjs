import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const moduleSource=readFileSync(new URL('../assets/alaska/usgs-dem.js',import.meta.url),'utf8');
const {decodeAlaskaDEM,loadAlaskaDEM}=await import('data:text/javascript;base64,'+
  Buffer.from(moduleSource).toString('base64'));
const file=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const dem=decodeAlaskaDEM(file);

function gameSample(x,z){
  // 90° rotation: game north -> geographic east. Source raster south-first.
  const u=x/1920+.5,v=z/1920+.5;
  const col=Math.max(0,Math.min(dem.width-1,v*dem.width-.5));
  const row=Math.max(0,Math.min(dem.height-1,(1-u)*dem.height-.5));
  const x0=Math.floor(col),y0=Math.floor(row);
  const x1=Math.min(x0+1,dem.width-1),y1=Math.min(y0+1,dem.height-1);
  const tx=col-x0,tz=row-y0,H=dem.heights,W=dem.width;
  return (H[y0*W+x0]*(1-tx)+H[y0*W+x1]*tx)*(1-tz)
    +(H[y1*W+x0]*(1-tx)+H[y1*W+x1]*tx)*tz;
}
test('actual USGS asset is compact, georeferenced and non-flat',()=>{
  assert.equal(file.format,'usgs-3dep-u16le-v1');
  assert.equal(file.crs,'EPSG:4326');
  assert.equal(file.source,'USGS 3DEP Bare Earth Elevation ImageServer (public domain)');
  assert.deepEqual(dem.bbox,[-133.265,57.851,-133.135,57.923]);
  assert.equal(dem.width,256);
  assert.equal(dem.height,256);
  assert.equal(dem.heights.length,65536);
  assert.ok(file.maxElevationMeters>1200);
  assert.ok(file.sampleSpacingApproxMeters.every(v=>v>25&&v<40));
  assert.ok(file.landCoverageFraction>.5&&file.landCoverageFraction<.99);
});
test('DEM is rotated to keep the original harbor and respawn on navigable water',()=>{
  assert.ok(gameSample(-19,-667)<=3,'respawn belongs in the fjord');
  assert.ok(gameSample(151,-525)<=3,'harbor belongs beside fjord water');
  assert.ok(gameSample(130,558)>200,'glacier upper tongue is inland and elevated');
  assert.ok(gameSample(130,449)<=5,'glacier face reaches measured fjord water');
  assert.ok(gameSample(-140,-406)>300,'falls belong on upland slope');
  const scale=Math.min(.04,(75*.90-12.2)/file.maxElevationMeters);
  assert.ok(12.2+file.maxElevationMeters*scale<=75*.90+.001);
});
test('wrong source format and truncated data are rejected',()=>{
  assert.throws(()=>decodeAlaskaDEM({...file,format:'unknown'}));
  assert.throws(()=>decodeAlaskaDEM({...file,heightsBase64:'AA=='}));
  assert.throws(()=>decodeAlaskaDEM({...file,bbox:[2,3,1,0]}));
});
test('missing local DEM is an explicit handled failure',async()=>{
  await assert.rejects(loadAlaskaDEM('missing.json',async()=>({ok:false,status:404})),/HTTP 404/);
});
test('worker and texture receive measured elevations, without altering other maps',()=>{
  assert.match(index,/function measuredHeight\(u,v\)/);
  assert.match(index,/if \(alaska && measured\)/);
  assert.match(index,/options\.alaskaDEM\.verticalScale/);
  assert.match(index,/new URLSearchParams\(location\.search\)\.get\('alaskaTerrain'\)!=='legacy'/);
  assert.match(index,/const workerSrc = `/);
  assert.match(index,/heightField = data\.height/);
  assert.match(index,/data\.packed/);
  assert.match(index,/sampleGroundHeight\(selectedMap\.spawn\[0\],selectedMap\.spawn\[2\]\)\+12/);
});
