import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  validateFrontDockOfficialSource,buildDumboFrontDockRoad,
  FRONT_DOCK_GAME
} from '../assets/nyc/dumbo-front-dock-road.js';
const source=JSON.parse(readFileSync(new URL(
  '../assets/nyc/dumbo-front-dock-roadbed-2022.json',import.meta.url),'utf8'));
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const streets=readFileSync(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
function render({clear=true}={}){
  const faces=[];
  const q=(...vertices)=>faces.push({kind:'quad',v:vertices.slice(0,4)});
  const t=(...vertices)=>faces.push({kind:'tri',v:vertices.slice(0,3)});
  const opts={addTri:t,addQuad:q,box:()=>{},beam:()=>{},ribbon:()=>{},
    terrainAt:()=>1000,isClear:()=>clear,
    streetY:14.86,waterY:0,detailBand:()=>3,
    grid:{blockLength:33,blockWidth:24,tilt:.24,offset:30}};
  const out=buildDumboFrontDockRoad(source,opts);
  return {out,faces};
}
test('official source is 2022 NYC OTI roadbed, not inferred centerline widths',()=>{
  const info=validateFrontDockOfficialSource(source);
  assert.equal(source.schema,'patrol-nyc-dumbo-front-dock-oti-roadbed-2022-v1');
  assert.equal(info.triangleCount,577);
  assert.equal(info.droppedDegenerateTriangles,24);
  assert.equal(info.renderableTriangles,553);
  assert.equal(info.uniqueFids,8);
  assert.equal(source.areaSquareMetres,3714.73);
  assert.equal(source.origin.lon,-73.992042);
  assert.equal(source.origin.lat,40.702634);
  assert.match(source.source,/Roadbed_2022\/FeatureServer\/20/);
});
test('normal, footprint and production budget: no fictional rectangular roof',()=>{
  const {out,faces}=render();
  assert.equal(out.enabled,true);
  assert.equal(out.officialTriangles,553);
  assert.equal(out.droppedDegenerateTriangles,24);
  // Dated OTI boundaries partially cross the fictional grid. Do not delete
  // all old asphalt when only a fraction of each strip has source pavement.
  assert.deepEqual(out.skipFictionalStreetSegments,[]);
  assert.equal(out.sourceOverlayOnly,true);
  assert(out.legacyCoverage.some(x=>x.i===16&&x.covered<x.samples));
  assert(out.legacyCoverage.some(x=>x.i===17&&x.covered<x.samples));
  assert(out.legacyCoverage.every(x=>x.samples===105));
  assert(out.legacyCoverage.every(x=>x.fraction>=0&&x.fraction<1));
  assert(out.bikePaintQuads>=4,
    '2026 DOT planned bike markings should be physically inside source');
  assert(out.signalHeads===2,'The photographed Front/Dock intersection has signal heads');
  assert(out.triangles>553&&out.triangles<1100);
  assert.equal(out.newTextures,0);
  assert.equal(out.additionalDrawCalls,0);
  assert(out.estimatedVertexBufferBytes<200_000);
  // First 577 triangles use original licensed geo-poly vertices, no XY
  // rectangle generator, with upward normals after East/North -> X/-Z map.
  const sourceFaces=faces.slice(0,out.officialTriangles);
  // Keep a tiny 0.004 game-unit depth bias so partially covered polygons
  // don't z-fight with the underlying continuous legacy asphalt. Do not
  // repeat the former visibly floating 0.064-unit plate.
  const sourceY=14.86+.090;
  assert(sourceFaces.every(f=>f.v.every(p=>Math.abs(p[1]-sourceY)<1e-9)),
    'Official pavement must be nearly flush with old continuous asphalt');
  assert(Math.abs(sourceY-(14.86+.086))<=.004000001);
  assert(sourceFaces.every(f=>f.kind==='tri'));
  assert(sourceFaces.every(f=>{
    const [a,b,c]=f.v,u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);
    return u[2]*v[0]-u[0]*v[2]>0;
  }), 'All source pavement triangles must be upward facing');
  assert(Math.abs(FRONT_DOCK_GAME.gameUnitsPerMetre-.32)<1e-12);
});
test('source fail-closed on absent/invalid and occupied/wet scene',()=>{
  assert.equal(buildDumboFrontDockRoad(null,{}).enabled,false);
  assert.throws(()=>validateFrontDockOfficialSource({...source,year:2026}),/Untrusted/);
  const {out}=render({clear:false});
  assert.equal(out.enabled,false);
  assert.equal(out.officialTriangles,0);
  assert(out.reason.includes('collide'));
});
test('actual PATROL source only opt-in NYC and no change to flight or other maps',()=>{
  assert(index.includes("get('nycDumboRoadbed')==='on'"));
  assert(index.includes("if(selectedMap.city && !graphicsCompat && smoothScenery())"));
  assert(index.includes('frontDockRoadbed,'));
  assert(index.includes('window.PatrolDumboRoadQA=stats.officialFrontDock'));
  assert(index.includes("name:'DUMBO · Front Dock Real Road'"));
  assert(streets.includes("if(coveredLegacyStreets.has(i+':'+j))continue;"));
  assert(streets.includes("frontDockRoadbed=null"));
  assert(!streets.includes('fetch('),'No runtime network fetch in road generation');
  assert(!index.includes('onFrameNYCRoadbed'));
});
