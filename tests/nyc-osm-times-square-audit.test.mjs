import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  polygonMetrics,analyzeOsmFeatures,OSM_LICENSE,OSM_ATTRIBUTION,NYCOSM_COMMIT
} from '../scripts/nyc-osm-times-square-audit.mjs';

const rect=(cx,cy,dx=.0001,dy=.0001)=>[
  [cx-dx/2,cy-dy/2],[cx+dx/2,cy-dy/2],
  [cx+dx/2,cy+dy/2],[cx-dx/2,cy+dy/2],[cx-dx/2,cy-dy/2]
];
const sourceRing=rect(-73.9865,40.7570);
const source={reference:'NYC Building Footprints',retrieved:'2026-11-20',
  bboxWGS84:[-73.9885,40.756,-73.9835,40.7595],
  features:[{fid:123,heightFt:80,rings:[sourceRing]}]};
const way={type:'way',id:456,tags:{
  building:'commercial','building:levels':'12',height:'45 m',
  'roof:shape':'flat','building:material':'glass','building:colour':'#7899aa',name:'Example Tower'
},geometry:sourceRing.map(([lon,lat])=>({lon,lat}))};

test('pinned NYC OSM source uses the exact ODbL extract and attribution',()=>{
  assert.equal(NYCOSM_COMMIT,'75ec01ced7fdd85619493d59f4e7e9236e0990fd');
  const report=analyzeOsmFeatures(source,{elements:[way]});
  assert.equal(report.source.package,'kjhealy/nycosm');
  assert.equal(report.source.extractDate,'2026-10-18');
  assert.equal(report.source.license,OSM_LICENSE);
  assert.equal(report.source.attribution,OSM_ATTRIBUTION);
  assert.equal(report.redistribution.rawOsmSnapshotCommitted,false);
  assert.equal(report.redistribution.rawOsmSnapshotUploaded,false);
  assert.equal(report.redistribution.runtimeImport,false);
});

test('polygon metrics reject invalid geometry and measure a closed ring',()=>{
  const m=polygonMetrics(sourceRing);
  assert.ok(m.areaSquareMeters>50&&m.areaSquareMeters<150);
  assert.ok(Math.abs(m.centroidWGS84[0]+73.9865)<1e-7);
  assert.ok(Math.abs(m.centroidWGS84[1]-40.757)<1e-7);
  assert.equal(polygonMetrics([[0,0],[1,1],[2,2]]),null);
});

test('only a unique matched building outline contributes to tag coverage',()=>{
  const report=analyzeOsmFeatures(source,{elements:[way]},{retrievedAt:'2026-11-22T00:00:00Z'});
  assert.equal(report.status,'source-audit-only-no-game-import');
  assert.equal(report.join.uniqueMatches,1);
  assert.equal(report.join.ambiguousCount,0);
  assert.equal(report.join.unmatchedCount,0);
  assert.equal('matches' in report.join,false,
    'do not export paired municipal FIDs and OSM IDs as a combined database');
  assert.equal(report.tagCoverage.matched['building:levels'],1);
  assert.equal(report.tagCoverage.matched['roof:shape'],1);
  assert.equal(report.tagCoverage.matched['building:material'],1);
  assert.equal(report.tagCoverage.matched.wikidata,0);
});

test('building parts are not falsely matched as whole-building outlines',()=>{
  const part={...way,id:789,tags:{building:'yes','building:part':'yes'}};
  const report=analyzeOsmFeatures(source,{elements:[part]});
  assert.equal(report.osmCounts.buildingParts,1);
  assert.equal(report.osmCounts.buildingWays,0);
  assert.equal(report.join.uniqueMatches,0);
  assert.equal(report.join.unmatchedCount,1);
});

test('multiple overlapping candidate outlines are flagged ambiguous, not guessed',()=>{
  const second={...way,id:457};
  const report=analyzeOsmFeatures(source,{elements:[way,second]});
  assert.equal(report.join.uniqueMatches,0);
  assert.equal(report.join.ambiguousCount,1);
  assert.equal(report.join.unmatchedCount,0);
});
