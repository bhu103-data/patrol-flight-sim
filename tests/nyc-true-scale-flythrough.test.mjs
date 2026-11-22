import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMeteredMassing,wgs84ToMeters} from '../assets/nyc/times-square-metered-massing.mjs';
import {MESH_STRIDE,buildingContains,buildNeighborhoodMesh}
  from '../assets/nyc/nyc-true-scale-neighborhood.mjs';

const load=async name=>JSON.parse(await readFile(
  new URL('../assets/nyc/'+name,import.meta.url),'utf8'));
const [footprints,roads,roadbed]=await Promise.all([
  load('times-square-footprints.json'),load('nyc-dcm-centerlines-sample.json'),
  load('nyc-oti-roadbed-core-2022.json')]);
const massing=buildMeteredMassing(footprints);

test('NYC real-source buildings + roads share one metre-scale frame',()=>{
  assert.equal(massing.units,'metres');
  assert.equal(massing.heightScale,1);
  assert.equal(roads.schema,'patrol-nyc-dcm-centerline-segments-v1');
  assert.equal(roads.originWGS84[0],-73.9864883);
  assert.equal(roads.originWGS84[1],40.756421);
  assert.match(roads.source,/DCM_Street_Center_Line/);
  assert.match(roads.important,/not proof of paved width/);
  assert.equal(roads.roads.length,38);
  assert.equal(roads.roads.reduce((n,r)=>n+r[2].length,0),89);
  assert.ok(massing.buildings.length>=118);
  const [dx,dy]=wgs84ToMeters(roads.originWGS84,massing.origin);
  assert.ok(Math.abs(dx)<.01,'same One Times Square east origin');
  assert.ok(dy < -140&&dy > -155,
    'official DCM old-origin north offset should be transformed, not guessed');
});

test('new runtime scene renders 118 source buildings plus 89 official street segments',()=>{
  const g=buildNeighborhoodMesh(massing,roads,{detail:true});
  assert.equal(g.strideFloats,MESH_STRIDE);
  assert.ok(g.interleaved instanceof Float32Array);
  assert.equal(g.counts.buildings,massing.buildings.length);
  assert.equal(g.counts.streetFeatures,38);
  assert.equal(g.counts.streetSegments,89);
  assert.ok(g.counts.facadeWindows>100,'bounded authored facade detail should be visible');
  assert.ok(g.counts.facadeWindows<=6200,'never blow runtime facade budget');
  assert.ok(g.counts.triangles>g.counts.roofTriangles+g.counts.wallTriangles);
  assert.ok(g.counts.triangles<180000,'bounded WebGL2 polygon budget');
  assert.equal(g.interleaved.length,g.counts.triangles*3*MESH_STRIDE);
  assert.ok(g.interleaved.every(Number.isFinite),'GPU buffer is finite');
  assert.equal(g.provenance.streets,roads.source);
  assert.match(g.caveat,/illustrative or unverified/);
  const y=[];
  for(let i=1;i<g.interleaved.length;i+=MESH_STRIDE)y.push(g.interleaved[i]);
  assert.ok(Math.max(...y)>260,'actual official roof height not compressed');
  assert.ok(y.some(height=>Math.abs(height+.135)<1e-6),
    'Float32 roundoff must not hide centerline-derived road deck');
});

test('real OTI 2022 11-FID polygon core matches source integrity budgets',()=>{
  assert.equal(roadbed.v,1);
  assert.equal(roadbed.imagery,2022);
  assert.match(roadbed.source,/Roadbed_2022\/FeatureServer\/20/);
  assert.deepEqual(roadbed.origin,roads.originWGS84);
  assert.equal(roadbed.polygons.length,11);
  assert.equal(new Set(roadbed.polygons.map(x=>x[0])).size,11);
  assert.equal(roadbed.polygons.filter(x=>x[1]===350010).length,3);
  assert.ok(roadbed.maxHausdorffM<=.061);
  assert.ok(roadbed.maxAreaDifferencePct<=.096);
  assert.equal(roadbed.polygons.reduce((n,p)=>n+p[2].length,0),229);
  const pristine=buildNeighborhoodMesh(massing,roads,{detail:false});
  const official=buildNeighborhoodMesh(massing,roads,{
    detail:false,officialRoadbed:roadbed
  });
  assert.equal(official.counts.officialRoadbedPolygons,11);
  assert.equal(official.counts.officialRoadbedIntersections,3);
  assert.equal(official.counts.officialRoadbedTriangles,207);
  assert.equal(official.counts.triangles,pristine.counts.triangles+207);
  assert.equal(official.counts.facadeWindows,0,'quality-low still avoids facade panels');
  assert.equal(official.counts.buildings,pristine.counts.buildings);
  assert.equal(official.counts.streetSegments,pristine.counts.streetSegments);
  assert.equal(official.provenance.roadbed,roadbed.source);
  assert.equal(official.provenance.roadbedImageryYear,2022);
  assert.ok(official.interleaved.every(Number.isFinite));
  let sourceDeck=0,sourceUp=0;
  for(let i=0;i<official.interleaved.length;i+=MESH_STRIDE){
    if(Math.abs(official.interleaved[i+1]+.075)<1e-6){
      sourceDeck++;
      if(official.interleaved[i+4]>.99)sourceUp++;
    }
  }
  assert.equal(sourceDeck,207*3,'source polygons must use one same metre deck Y');
  assert.equal(sourceUp,sourceDeck,'source polygon winding must face upward');
});

test('source core rejects fake/incomplete/repeated IDs, never relabels author roads as official',()=>{
  const good={detail:false,officialRoadbed:roadbed};
  assert.equal(buildNeighborhoodMesh(massing,roads,good).counts.officialRoadbedPolygons,11);
  assert.throws(()=>buildNeighborhoodMesh(massing,roads,{
    detail:false,officialRoadbed:{...roadbed,source:'https://example.org/fake'}
  }),/Invalid official source roadbed slice/);
  const duplicated={...roadbed,polygons:[
    roadbed.polygons[0],roadbed.polygons[0]]};
  assert.throws(()=>buildNeighborhoodMesh(massing,roads,{
    detail:false,officialRoadbed:duplicated
  }),/repeated source FID/);
  assert.equal(buildNeighborhoodMesh(massing,roads,{detail:false})
    .counts.officialRoadbedPolygons,0);
});

test('road source is not silently invented if absent',()=>{
  assert.throws(()=>buildNeighborhoodMesh(massing,{schema:'wrong',roads:[]}),
    /DCM official road data missing/);
  assert.throws(()=>buildNeighborhoodMesh({...massing,units:'game-units'},roads),
    /genuine metre-scale NYC/);
  const low=buildNeighborhoodMesh(massing,roads,{detail:false});
  assert.equal(low.counts.facadeWindows,0);
  assert.equal(low.counts.streetSegments,89);
  assert.ok(low.counts.triangles<20000,'bounded fallback keeps real source geometry');
});

test('low-altitude collision uses original source FID polygons and roof height',()=>{
  const building=massing.buildings.find(b=>b.fid===22922);
  assert.ok(building,'known municipal building retained');
  const east=building.footprintMeters.reduce((s,p)=>s+p[0],0)/building.footprintMeters.length;
  const north=building.footprintMeters.reduce((s,p)=>s+p[1],0)/building.footprintMeters.length;
  assert.equal(buildingContains(massing,east,north,2),22922);
  assert.equal(buildingContains(massing,east,north,400),null);
  assert.equal(buildingContains(massing,10000,10000,2),null);
});

test('PATROL launcher routes experimental map to real-source free-flight entry',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const match=html.match(/name="flightMap" value="manhattanReality"/g)||[];
  assert.equal(match.length,1);
  assert.match(html,/choice[\s\S]{0,190}manhattanReality|settings[\s\S]{0,190}manhattanReality|flightMap'\) === 'manhattanReality'/);
  assert.match(html,/assets\/nyc\/nyc-true-scale-flight\.html/);
  const page=await readFile(
    new URL('../assets/nyc/nyc-true-scale-flight.html',import.meta.url),'utf8');
  assert.match(page,/buildNeighborhoodMesh\(massing,roadSource/);
  assert.match(page,/buildingContains\(massing/);
  assert.match(page,/requestPointerLock/);
  assert.match(page,/id="roadbedFocus"/);
  assert.match(page,/const coreSourceFID24700=\[4\.09,32\.58\]/);
  assert.match(page,/roadbedFocusOriginWGS84:roadSource\.originWGS84/);
  assert.match(page,/roadbedOff\?null:/,'same experimental map keeps source-on/off evidence');
  assert.match(page,/source buildings/);
  assert.doesNotMatch(page,/https?:\/\/(?:google\.com|maps\.google|cesium\.com)/);
  assert.match(page,/not the original aircraft physics/);
});


test('source street view has upstream 3.2m eye and 1.2m footprint clearance, not 65m aerial',async()=>{
  const html=await readFile(
    new URL('../assets/nyc/nyc-true-scale-flight.html',import.meta.url),'utf8');
  assert.match(html,/Street height \(3\.2m\)/);
  assert.match(html,/const streetEyeMetres=3\.2,streetClearanceMetres=1\.2;/);
  assert.match(html,/safeOffsets\.some\(\(\[de,dn\]\)=>/);
  assert.match(html,/buildingContains\(massing,east\+de,north\+dn,streetEyeMetres\)/);
  assert.match(html,/position:\[site\[0\],streetEyeMetres,site\[1\]\]/);
  assert.match(html,/streetClearanceRadiusMetres:streetClearanceMetres/);
  assert.doesNotMatch(html,/buildingContains\(massing,east,north,65\)/);
  assert.match(html,/position:\[0,340,Math\.min\(450,span\*\.55\)\]/);
});


test('source-only provenance mode hides ALL guessed DCM-width road bands',()=>{
  // All official polygon positions and source DCM audit lines remain. This
  // mode deliberately does NOT invent any asphalt outside the 11-FID core.
  const normal=buildNeighborhoodMesh(massing,roads,{
    detail:false,officialRoadbed:roadbed});
  const only=buildNeighborhoodMesh(massing,roads,{
    detail:false,officialRoadbed:roadbed,sourceRoadbedOnly:true});
  assert.equal(normal.counts.illustrativeRoadBandTriangles,89*2);
  assert.equal(only.counts.illustrativeRoadBandTriangles,0);
  assert.equal(only.counts.officialRoadbedPolygons,11);
  assert.equal(only.counts.officialRoadbedIntersections,3);
  assert.equal(only.counts.officialRoadbedTriangles,207);
  assert.equal(only.counts.buildings,normal.counts.buildings);
  assert.equal(only.counts.streetSegments,normal.counts.streetSegments);
  assert.equal(only.counts.triangles,
    normal.counts.triangles-normal.counts.illustrativeRoadBandTriangles);
  assert.equal(only.provenance.sourceRoadbedOnly,true);
  assert.equal(only.provenance.roadbedImageryYear,2022);
  assert.ok(only.interleaved.every(Number.isFinite));
  assert.throws(()=>buildNeighborhoodMesh(massing,roads,{
    detail:false,sourceRoadbedOnly:true
  }),/Source-only roadbed requires official NYC OTI polygons/);
});

test('source-only mode is explicit opt-in and cannot modify the old PATROL map',async()=>{
  const page=await readFile(new URL('../assets/nyc/nyc-true-scale-flight.html',import.meta.url),'utf8');
  const game=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(page,/params\.get\('roadbed'\)==='only'/);
  assert.match(page,/sourceRoadbedOnly,illustrativeRoadBandTriangles:/);
  assert.match(page,/guessed road widths hidden outside 2022 FIDs/);
  assert.ok(!game.includes('sourceRoadbedOnly'),'default PATROL maps remain unchanged');
});
