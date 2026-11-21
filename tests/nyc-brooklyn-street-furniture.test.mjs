// Brooklyn Bridgehead LOD2 gets restrained, footprint-checked street detail.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
const {buildNycStreetNetwork}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));
const grid={blockWidth:24,blockLength:33,tilt:.24,offset:30,
  parkHalfWidth:43,parkHalfLength:151,parkCenter:10000};
function scene(band,isClear=()=>true){
  return buildNycStreetNetwork({
    addQuad(){},addTri(){},box(){},beam(){},ribbon(){},
    terrainAt:()=>100,detailBand:()=>band,
    grid,streetY:20,waterY:0,
    timesBounds:[900,1000,900,1000],existingStreets:[],isClear
  });
}
test('Brooklyn focus-zone LOD2 actually contains streetside scene details',()=>{
  const stats=scene(2);
  assert.ok(stats.avenues>0&&stats.streets>0);
  assert.ok(stats.brooklynStreetFurniture>=4,
    'bridgehead must not look like an empty pavement at LOD2');
  assert.ok(stats.brooklynStreetFurniture<=22,
    'fixture budget must remain strictly bounded');
  assert.equal(stats.streetFurniture,stats.brooklynStreetFurniture,
    'Manhattan tourist furniture stays restricted to its LOD3 view');
});
test('bridgehead furniture never leaks into LOD1',()=>{
  const stats=scene(1);
  assert.equal(stats.brooklynStreetFurniture,0);
  assert.equal(stats.streetFurniture,0);
});
test('Manhattan detail remains capped independently of Brooklyn detail',()=>{
  const stats=scene(3);
  assert.ok(stats.brooklynStreetFurniture>0);
  assert.ok(stats.streetFurniture-stats.brooklynStreetFurniture<=82);
  assert.ok(stats.streetFurniture<=104);
});
test('land parcels and roads retain priority over bridgehead props',()=>{
  const clear=(x,z,r=0)=>x<175||x>450||z<-450||z>-180;
  const clearScene=scene(2);
  const stats=scene(2,clear);
  // Outer edge blocks remain usable; only the occupied bridgehead zone
  // should lose fixtures. A zero count would incorrectly erase safe streets.
  assert.ok(stats.brooklynStreetFurniture<clearScene.brooklynStreetFurniture,
    'occupied bridgehead must have fewer pedestrian fixtures');
  assert.ok(stats.skippedRoadFootprints>0);
});
