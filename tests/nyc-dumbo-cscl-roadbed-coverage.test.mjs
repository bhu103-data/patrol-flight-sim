// No fake DUMBO road widths: strictly source metric CSCL vs OTI 2022 roadbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  clipStreetToSourceTriangle,mergeCoveredIntervals,
  coveredStreetMetres,auditDumboStreetPavement
} from '../assets/nyc/dumbo-cscl-roadbed-coverage.mjs';
import {prepareOfficialDumboRoadbed} from '../assets/nyc/dumbo-roadbed-metric.mjs';
import {reconcileMetricStreets} from '../assets/nyc/dumbo-cscl-metric-reconcile.mjs';

const row=(p,id=1)=>({id,points:p});
const t1=[[0,-2],[6,-2],[0,2]];
const t2=[[0,2],[6,-2],[6,2]];

test('true triangle clip intersects only pavement, in either source winding',()=>{
  const x=clipStreetToSourceTriangle([-5,0],[12,0],t1);
  const y=clipStreetToSourceTriangle([-5,0],[12,0],t1.toReversed());
  assert.ok(x&&y);
  assert.ok(Math.abs(x[0]-y[0])<1e-12);
  assert.ok(Math.abs(x[1]-y[1])<1e-12);
  assert.equal(clipStreetToSourceTriangle([50,10],[51,10],t1),null);
  assert.throws(()=>clipStreetToSourceTriangle([NaN,0],[3,0],t1),/Invalid/);
});

test('merged source polygon coverage NEVER double-counts overlapping road triangles',()=>{
  const line=[[-5,0],[12,0]];
  const one=coveredStreetMetres(line,[row(t1),row(t2)]);
  const duplicate=coveredStreetMetres(line,[
    row(t1),row(t1,2),row(t2),row(t2,3)]);
  assert.ok(Math.abs(one.pavedMetres-6)<1e-9);
  assert.ok(Math.abs(duplicate.pavedMetres-6)<1e-9);
  assert.equal(one.lineMetres,17);
  assert.ok(duplicate.triangleIntersections>one.triangleIntersections);
  assert.deepEqual(mergeCoveredIntervals([[0,.5],[.3,.7],[.8,.9],[.9,1]]),
    [[0,.7],[.8,1]]);
});

test('real official 404 CSCL, 48 buildings and 553 2022 pavement triangles produce finite source-only audit',()=>{
  const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
  const cscl=read('../assets/nyc/dumbo-cscl-official-snapshot.json');
  const buildings=read('../assets/nyc/dumbo-oti-metric-48.json');
  const pavement=read('../assets/nyc/dumbo-front-dock-roadbed-2022.json');
  const roadbed=prepareOfficialDumboRoadbed(pavement);
  const network=reconcileMetricStreets(cscl,buildings);
  const audit=auditDumboStreetPavement(network,roadbed);
  assert.equal(audit.roads,295);
  assert.equal(audit.pavementTriangles,553);
  assert.equal(audit.byPhysicalId.length,213);
  assert.equal(audit.crossingSamples.length,4);
  assert.deepEqual(audit.crossingSamples.map(x=>x.physicalid),
    [57818,57819,57893,57894]);
  assert.ok(audit.fullSourceLineMetres>8000);
  assert.ok(audit.withinHistoricalRoadbedMetres>0);
  assert.ok(audit.outside2022SourcePavementMetres>0,
    'limited 2022 Front/Dock roadbed must NOT be advertised as a complete city street network');
  assert.ok(audit.withinHistoricalRoadbedMetres<=audit.fullSourceLineMetres);
  assert.ok(audit.byStreet.length>=30);
  for(const record of [...audit.byStreet,...audit.crossingSamples]){
    assert.ok(record.roadbedCoveragePercent>=0&&
      record.roadbedCoveragePercent<=100);
  }
  assert.match(audit.role,/NOT_NAVIGABLE/);
  assert.match(audit.caution,/2026 lane/);
});

test('reject changed or misaligned source before reporting street coverage',()=>{
  assert.throws(()=>auditDumboStreetPavement(
    {sourceCount:403,segmentCount:295}, {year:2022,stats:{renderedTriangles:553}}),
    /source sample/);
  const one=[[-1,0],[1,0]];
  assert.throws(()=>coveredStreetMetres(one,[{points:[[0,0]]}]),/triangle/);
});
