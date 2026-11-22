import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOverpassQuery,polygonMetrics,analyzeOsmFeatures,fetchOverpass,OSM_LICENSE,OSM_ATTRIBUTION
} from '../scripts/nyc-osm-times-square-audit.mjs';

const rect=(cx,cy,dx=.0001,dy=.0001)=>[
  [cx-dx/2,cy-dy/2],[cx+dx/2,cy-dy/2],
  [cx+dx/2,cy+dy/2],[cx-dx/2,cy+dy/2],[cx-dx/2,cy-dy/2]
];
const sourceRing=rect(-73.9865,40.7570);
const source={reference:'NYC Building Footprints',retrieved:'2026-11-20',
  bboxWGS84:[-73.9885,40.756,-73.9835,40.7595],
  features:[{fid:123,heightFt:80,rings:[sourceRing]}]};
const way={
  type:'way',id:456,tags:{
    building:'commercial','building:levels':'12',height:'45 m',
    'roof:shape':'flat','building:material':'glass',
    'building:colour':'#7899aa',name:'Example Tower'
  },
  geometry:sourceRing.map(([lon,lat])=>({lon,lat}))
};

test('Overpass query is bounded to the source WGS84 Times Square bbox',()=>{
  const q=buildOverpassQuery(source.bboxWGS84);
  assert.match(q,/way\["building"\]/);
  assert.match(q,/relation\["building"\]/);
  assert.match(q,/way\["building:part"\]/);
  assert.match(q,/relation\["building:part"\]/);
  assert.match(q,/40\.756,-73\.9885,40\.7595,-73\.9835/);
  assert.throws(()=>buildOverpassQuery([1,2,0,3]),/Invalid WGS84 bbox/);
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
  assert.equal(report.join.matches[0].fid,123);
  assert.equal(report.join.matches[0].osmId,456);
  assert.equal(report.tagCoverage.matched['building:levels'],1);
  assert.equal(report.tagCoverage.matched['roof:shape'],1);
  assert.equal(report.tagCoverage.matched['building:material'],1);
  assert.equal(report.tagCoverage.matched.wikidata,0);
  assert.equal(report.source.license,OSM_LICENSE);
  assert.equal(report.source.attribution,OSM_ATTRIBUTION);
  assert.equal(report.redistribution.rawOsmSnapshotCommitted,false);
});

test('building parts are not falsely matched as whole-building outlines',()=>{
  const part={...way,id:789,tags:{building:'yes','building:part':'yes'}};
  const report=analyzeOsmFeatures(source,{elements:[part]});
  assert.equal(report.osmCounts.buildingParts,1);
  assert.equal(report.osmCounts.buildingWays,0);
  assert.equal(report.join.uniqueMatches,0);
  assert.deepEqual(report.join.unmatchedFids,[123]);
});

test('multiple overlapping candidate outlines are flagged ambiguous, not guessed',()=>{
  const second={...way,id:457};
  const report=analyzeOsmFeatures(source,{elements:[way,second]});
  assert.equal(report.join.uniqueMatches,0);
  assert.equal(report.join.ambiguousFids.length,1);
  assert.deepEqual(report.join.ambiguousFids[0].candidateOsmIds,[456,457]);
});

test('Overpass fallback records the endpoint that actually returned data',async()=>{
  let calls=0;
  const result=await fetchOverpass('bounded-query',{
    endpoints:['https://first.invalid','https://second.invalid'],
    timeoutMs:100,
    fetchImpl:async(url,options)=>{
      calls++;
      assert.equal(options.method,'POST');
      assert.match(String(options.body),/data=bounded-query/);
      if(calls===1)return {ok:false,status:503};
      return {ok:true,json:async()=>({elements:[{type:'way',id:1}]})};
    }
  });
  assert.equal(calls,2);
  assert.equal(result.endpoint,'https://second.invalid');
  assert.equal(result.data.elements.length,1);
});
