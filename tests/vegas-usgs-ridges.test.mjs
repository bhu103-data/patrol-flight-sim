import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeVegasRidgeDEM,loadVegasRidgeDEM} from '../assets/vegas/usgs-ridges.js';
const bbox=[-115.395,36.035,-114.965,36.245];
const fixture=()=>({
 schema:'patrol-vegas-usgs-3dep-ridges-v1',
 source:{agency:'USGS',crs:'EPSG:4326',verticalUnits:'meters',
    rawGeoTiffSHA256:'e'.repeat(64)},
 boundsWgs84:[...bbox],
 sampleLatitudesNorthing:Array.from({length:49},(_,i)=>36.035+(.21*i/48)),
 elevationMeters:{
   west:Array.from({length:49},(_,i)=>850+i*2),
   center:Array.from({length:49},(_,i)=>615+i*.1),
   east:Array.from({length:49},(_,i)=>710+i*1.5)
 }
});
test('only georeferenced measured USGS profiles can be decoded',()=>{
 const decoded=decodeVegasRidgeDEM(fixture());
 assert.equal(decoded.elevationMeters.west.length,49);
 assert.deepEqual(decoded.boundsWgs84,bbox);
 const bad=fixture();bad.source.crs='EPSG:3857';
 assert.throws(()=>decodeVegasRidgeDEM(bad),/provenance/);
 const wrong=fixture();wrong.boundsWgs84[0]=-114;
 assert.throws(()=>decodeVegasRidgeDEM(wrong),/provenance/);
 const missing=fixture();missing.elevationMeters.east[5]=null;
 assert.throws(()=>decodeVegasRidgeDEM(missing),/elevations/);
 const flat=fixture();flat.elevationMeters.west.fill(900);
 assert.throws(()=>decodeVegasRidgeDEM(flat),/relief/);
});
test('bad asset response triggers caller-safe rejection',async()=>{
 await assert.rejects(loadVegasRidgeDEM('/missing',async()=>({ok:false,status:404})),
   /HTTP 404/);
 const payload=fixture();
 const got=await loadVegasRidgeDEM('/verified',async()=>({ok:true,json:async()=>payload}));
 assert.equal(got.elevationMeters.east.length,49);
});
test('committed Vegas ridge elevations match the verified USGS source',async()=>{
 const payload=JSON.parse(await readFile(new URL('../assets/vegas/strip-ridges-3dep.json',import.meta.url),'utf8'));
 const decoded=decodeVegasRidgeDEM(payload);
 assert.equal(decoded.source.rawGeoTiffSHA256,'856259460e4e687285eb40949ab8764e7543ccf09e9f81177a8d2152bdb8046d');
 assert.equal(decoded.elevationMeters.west.length,49);
 assert.equal(decoded.elevationMeters.center.length,49);
 assert.equal(decoded.elevationMeters.east.length,49);
 assert.ok(Math.max(...decoded.elevationMeters.west)>1700);
 assert.ok(Math.min(...decoded.elevationMeters.center)>600);
 assert.ok(Math.max(...decoded.elevationMeters.east)>1100);
 assert.equal(payload.rasterExtentWgs84.length,4);
});
