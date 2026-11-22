import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../tracy-arm-true-scale.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const geoSrc=readFileSync(new URL('../assets/alaska/tracy-arm-geodesy.js',import.meta.url),'utf8');
const lodSrc=readFileSync(new URL('../assets/alaska/ifsar-lod.js',import.meta.url),'utf8');
const {rasterCellToLocalEnu,rasterCellWgs84,sourceTileOrigin,
  sampleSourceElevationMetres}=await import('data:text/javascript;base64,'+
  Buffer.from(geoSrc).toString('base64'));
const {decimateIfsarRaster}=await import('data:text/javascript;base64,'+
  Buffer.from(lodSrc).toString('base64'));
const raw=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const decodeSrc=readFileSync(new URL('../assets/alaska/usgs-dem.js',import.meta.url),'utf8');
const {decodeAlaskaDEM}=await import('data:text/javascript;base64,'+
  Buffer.from(decodeSrc).toString('base64'));
const dem={...raw,...decodeAlaskaDEM(raw)};
const actualExtent=JSON.parse(readFileSync(
  new URL('../assets/alaska/tracy-arm-3dep-actual-extent.json',import.meta.url),'utf8'));
const correctedDem={...dem,bbox:actualExtent.actualPixelBboxWgs84};

test('flight pilot is reachable but does not replace shipping map or its controls',()=>{
  assert.match(game,/<a href="\.\/tracy-arm-true-scale\.html"/);
  assert.match(game,/<a href="\.\/tracy-arm-true-scale\.html\?alaskaSource=ifsar5m"/);
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
test('actual ArcGIS WGS84 pixel extent corrected, revealing true 7.7x14.4km DEM footprint',()=>{
  assert.deepEqual(actualExtent.requestedBboxWgs84,raw.bbox);
  assert.deepEqual(actualExtent.actualPixelBboxWgs84,[-133.265,57.822,-133.135,57.952]);
  assert.equal(actualExtent.source,'USGS 3DEP ArcGIS ImageServer exportImage f=json');
  assert.match(src,/tracy-arm-3dep-actual-extent\.json/);
  assert.match(src,/const coarse=\{\.\.\.coarseRaw,bbox:correctedBbox,/);
  const [west,south]=rasterCellToLocalEnu(correctedDem,0,0,0);
  const [east,north]=rasterCellToLocalEnu(correctedDem,255,255,0);
  assert.ok(east-west>7500&&east-west<7800);
  assert.ok(north-south>14000&&north-south<14700);
  const [lon0,lat0]=sourceTileOrigin(correctedDem);
  const [lonLow,latLow]=rasterCellWgs84(correctedDem,0,0);
  const [lonHigh,latHigh]=rasterCellWgs84(correctedDem,255,255);
  assert.ok(lonHigh>lonLow&&latHigh>latLow);
  assert.ok(Math.abs(lon0+133.2)<.00001&&Math.abs(lat0-57.887)<.00001);
});
test('flight starts from a verified water source location and keeps real dynamic envelope',()=>{
  const [lon,lat]=rasterCellWgs84(correctedDem,170,105);
  const start=sampleSourceElevationMetres(correctedDem,lon,lat);
  assert.ok(start<=3,'corrected source DEM launch GPS belongs on water');
  const [e,n]=rasterCellToLocalEnu(correctedDem,170,105,0);
  assert.ok(Number.isFinite(e)&&Number.isFinite(n));
  assert.match(src,/spawn=\[e,320,north\]/);
  assert.match(src,/rasterCellWgs84\(coarse,170,105\)/);
  assert.match(src,/sampleSourceElevationMetres\(nativeSource,spawnLon,spawnLat\)/);
  assert.match(src,/launchElevation>3/);
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
  assert.match(src,/textureGrad\(uAlbedo,vec3\(uv,tile\),du,dv\)/);
  assert.match(src,/vec2 ddxX=dFdx\(px\),ddyX=dFdy\(px\)/);
  assert.match(src,/uniform highp sampler2DArray uAlbedo;/);
  assert.match(src,/gl\.texImage3D\(gl\.TEXTURE_2D_ARRAY,0,gl\.RGBA8,256,256,4,0,/);
  assert.match(src,/gl\.texSubImage3D\(gl\.TEXTURE_2D_ARRAY,0,0,0,layer,256,256,1,/);
  assert.match(src,/gl\.generateMipmap\(gl\.TEXTURE_2D_ARRAY\)/);
  assert.doesNotMatch(src,/gl\.texImage2D\(gl\.TEXTURE_2D,0,gl\.RGBA8/);
});

test('optional 5m tile is source-aligned, leaves default 30m untouched and validates actual source',()=>{
  const decoder=readFileSync(
    new URL('../assets/alaska/usgs-5m-tile.js',import.meta.url),'utf8');
  assert.match(src,/get\('alaskaDetail'\)==='5m'/);
  assert.match(src,/decodeAlaskaFiveMetreTile\(await response\.json\(\),coarse\)/);
  assert.match(src,/detailMode='source-5m-local'/);
  assert.match(src,/detailWarning='5m source tile is unavailable\/invalid/);
  assert.match(src,/wgs84ToLocalEnu\(\.\.\.rasterCellWgs84\(dem,col,row\),0,\.\.\.origin\)/);
  assert.match(src,/origin=sourceTileOrigin\(coarse\)/);
  // The historical parent-cell index anchor was invalid because the original
  // USGS raster's actual output bbox differs from its stored request bbox.
  assert.match(decoder,/payload\.actualBboxVerifiedFromServer\.every/);
  assert.match(decoder,/High-resolution tile escapes actual USGS parent pixel extent/);
  assert.match(decoder,/payload\.bbox\[0\]<parent\.bbox\[0\]/);
  assert.match(decoder,/payload\.bbox\[2\]>parent\.bbox\[2\]/);
  assert.match(decoder,/request\.searchParams\.get\('adjustAspectRatio'\)!=='false'/);
  assert.match(decoder,/sampleSpacingApproxMeters/);
  assert.match(decoder,/NoData found in experimental 5m source tile/);
  assert.match(decoder,/Number\(payload\.projectIndexEvidence\?\.dem_gsd_meters\)!==5/);
  assert.match(decoder,/String\(payload\.projectIndexEvidence\?\.vert_crs\)!=='5703'/);
  assert.match(decoder,/request\.searchParams\.get\('adjustAspectRatio'\)!=='false'/);
  assert.match(decoder,/payload\.actualBboxVerifiedFromServer\.every/);
});

test('new USGS 5m extraction explicitly disables ArcGIS auto-bbox expansion',()=>{
  const builder=readFileSync(
    new URL('../tools/alaska/build_usgs5m_tracyarm_pilot.py',import.meta.url),'utf8');
  assert.match(builder,/"adjustAspectRatio": "false"/);
  assert.match(builder,/metadata_args = \{\*\*args,"f":"json"\}/);
  assert.match(builder,/actual=\[envelope\.get\(k\) for k in/);
  assert.match(builder,/max\(abs\(a-b\) for a,b in zip\(actual,bbox\)\)>1e-8/);
  assert.match(builder,/"originalActualPixelBboxWgs84"/);
});


test('native 5m IfSAR full-area LOD preserves WGS84 extent and uses 3x3 median cells',()=>{
  const native={
    format:'patrol-usgs-ifsar-5m-source-native-v1',
    crs:'EPSG:4326',axis:'x=east, z=north, south-first raster rows',
    bbox:[-133.265,57.822,-133.135,57.952],
    width:6,height:6,heights:Float32Array.from({length:36},(_,i)=>i),
    sampleSpacingApproxMeters:[5,5],sourceElevationRangeMeters:[0,35],
    verticalDatum:'NAVD88 / GEOID09',sourceVerticalCrs:'EPSG:5703',
    sourceProject:'Alaska_Mid_Accuracy_DEM_Summer_2015',
    workunit:'AK_IFSAR_Sum_L4_C353_2010',
    sourceTileSha256:['a'.repeat(64),'b'.repeat(64)]
  };
  const lod=decimateIfsarRaster(native,3);
  assert.equal(lod.width,2);assert.equal(lod.height,2);
  assert.deepEqual(Array.from(lod.heights),[7,10,25,28]);
  assert.deepEqual(lod.bbox,native.bbox);
  assert.deepEqual(lod.sourceResolutionMeters,[5,5]);
  assert.deepEqual(lod.sampleSpacingApproxMeters,[15,15]);
  assert.equal(lod.sourceCellCount,36);assert.equal(lod.meshCellCount,4);
  assert.equal(lod.meshLodStride,3);
});
test('full native IfSAR mode is opt-in, source-verified and memory-bounded to 15m mesh LOD',()=>{
  const loader=readFileSync(new URL('../assets/alaska/usgs-ifsar5m.js',import.meta.url),'utf8');
  const smoke=readFileSync(new URL('../tools/alaska/smoke_true_scale_flight.mjs',import.meta.url),'utf8');
  assert.ok(src.includes("params.get('alaskaSource')==='ifsar5m'"));
  assert.ok(src.includes('loadAlaskaIfsar5m('));
  assert.ok(src.includes('decimateIfsarRaster(nativeSource,3)'));
  assert.ok(src.includes('source-native-ifsar5m-lod15m'));
  assert.ok(src.includes("nativeSource.sourceVerticalCrs!=='EPSG:5703'"));
  assert.ok(src.includes('sourceCollectionStart:nativeSource.collectionStart'));
  assert.ok(src.includes('sourceVerticalDatumEvidence:nativeSource.verticalDatumEvidence'));
  assert.ok(src.includes('rasterCellWgs84(coarse,170,105)'));
  assert.ok(src.includes('indices=new Uint32Array((n-1)*(m-1)*6)'));
  assert.ok(loader.includes("manifest.sourceVerticalCrs!=='EPSG:5703'"));
  assert.ok(loader.includes("manifest.geoid!=='GEOID09'"));
  assert.ok(loader.includes('manifest.project'));
  assert.ok(loader.includes('manifest.workunit'));
  assert.ok(loader.includes('manifest.coverageValidFraction!==1'));
  assert.ok(loader.includes('manifest.tileSeamP95Metres'));
  assert.ok(loader.includes('assetUrl.origin!==manifestAbsolute.origin'));
  assert.ok(smoke.includes('PATROL_ALASKA_IFSAR5M'));
  assert.ok(smoke.includes('sourceCellCount===1536*2880'));
  assert.ok(smoke.includes('sourceCollectionStart===1278720000000'));
  assert.ok(smoke.includes("sourceVerticalDatumEvidence?.includes('EPSG:5703 / GEOID09')"));
  assert.ok(smoke.includes('meshSpacingMeters'));
});
