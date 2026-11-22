import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {TIMES_SQUARE_ORIGIN,wgs84ToLocalMetres,signedAreaXZ,
  cleanMetricRing,triangulateMetricRing,buildMetricFootprints}
  from '../assets/nyc/nyc-metric-footprints.mjs';

const dir=dirname(fileURLToPath(import.meta.url));
const file=resolve(dir,'../assets/nyc/times-square-footprints.json');
const asset=JSON.parse(readFileSync(file,'utf8'));

test('real WGS84 ENU metres keep One Times Square origin and cardinal directions',()=>{
 const centre=wgs84ToLocalMetres([-73.9864883,40.756421]);
 assert.ok(Math.hypot(...centre)<.001,'ECEF origin at zero');
 const east=wgs84ToLocalMetres([-73.9854883,40.756421]);
 const north=wgs84ToLocalMetres([-73.9864883,40.757421]);
 assert.ok(east[0]>80&&east[0]<90,east.join(','));
 assert.ok(Math.abs(east[1])<1,east.join(','));
 assert.ok(north[1]<-105&&north[1]>-120,north.join(','));
 assert.ok(Math.abs(north[0])<1,north.join(','));
 assert.equal(TIMES_SQUARE_ORIGIN.longitude,-73.9864883);
});

test('closed WGS84 concave rings produce source-area matching roof triangles',()=>{
 const o=[-73.9864883,40.756421];
 const p=[[0,0],[.00025,0],[.00025,.0001],[.00012,.0001],
   [.00012,.0003],[0,.0003],[0,0]].map(([x,y])=>[o[0]+x,o[1]+y]);
 const ring=cleanMetricRing(p),a=Math.abs(signedAreaXZ(ring));
 const result=triangulateMetricRing(ring);
 assert.equal(result.triangles.length,ring.length-2);
 assert.ok(a>100);
 assert.ok(Math.abs(result.roofAreaMetres2-a)<.001);
});

test('existing 120-feature official file creates finite metre-scale 3D roofs',()=>{
 assert.equal(asset.features.length,120);
 assert.match(asset.source,/NYC Building Footprints/);
 assert.match(asset.coordinateSystem,/WGS84/);
 const result=buildMetricFootprints(asset);
 assert.equal(result.stats.inputFeatures,120);
 assert.ok(result.stats.builtFeatures>=110,JSON.stringify(result.rejections));
 assert.equal(result.stats.builtFeatures+result.stats.rejectedFeatures,120);
 assert.equal(result.stats.units,'metres');
 assert.ok(result.vertexBuffer.length>10000);
 assert.equal(result.vertexBuffer.length%9,0);
 assert.equal(result.vertexBuffer.length/27,result.stats.triangles);
 for(const v of result.vertexBuffer)assert.ok(Number.isFinite(v));
 const fids=new Set();
 for(const b of result.buildings){
   assert.ok(!fids.has(b.fid));fids.add(b.fid);
   assert.equal(b.roofHeightMetres,b.sourceHeightFt*.3048);
   assert.ok(b.roofAreaMetres2>.5&&b.roofTriangleCount>=1);
   assert.ok(b.polygon.length>=3);
 }
 assert.ok(result.stats.maxHeightMetres>200,
   'roof heights must not be clamped to the compressed 66 game unit ceiling');
 assert.ok(result.rejections.some(r=>/multipart|holed/.test(r.reason)));
});

test('hole polygons cannot be silently roof-filled or mistaken for a massing',()=>{
 const toy={features:[{fid:1,heightFt:35,rings:[[
   [-73.9865,40.7565],[-73.9864,40.7565],[-73.9864,40.7566],
   [-73.9865,40.7566],[-73.9865,40.7565]
  ],[[-73.98649,40.75651],[-73.98648,40.75651],
   [-73.98648,40.75652],[-73.98649,40.75652],
   [-73.98649,40.75651]]]}]};
 const model=buildMetricFootprints(toy);
 assert.equal(model.stats.builtFeatures,0);
 assert.equal(model.rejections[0].fid,1);
 assert.match(model.rejections[0].reason,/hole/);
});

test('metric viewer is WebGL2, no paid tiles or passive import into the flight map',()=>{
 const html=readFileSync(resolve(dir,'../nyc-metric-pilot.html'),'utf8');
 assert.match(html,/webgl2/);
 assert.match(html,/nyc-metric-footprints\.mjs/);
 assert.match(html,/times-square-footprints\.json/);
 assert.match(html,/官方 CSCL 道路中心线/);
 assert.match(html,/CSCL 不是路缘测绘/);
 assert.match(html,/nyc-metric-curbs\.mjs/);
 assert.match(html,/official-curbs\.json/);
 assert.match(html,/不保证反映 2026 年改造/);
 assert.match(html,/经核准的路面及路缘几何/);
 assert.doesNotMatch(html,/maps\.googleapis\.com|google\.com\/maps\/v1|Cesium|apiKey/i);
 // Syntax of test and of shared node/browser module.
 assert.doesNotThrow(()=>execFileSync(process.execPath,
   ['--check','assets/nyc/nyc-metric-footprints.mjs'],
   {cwd:resolve(dir,'..')}));
});
