import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGIN,BBOX,toLocalMeters} from '../scripts/nyc-times-true-scale-pilot.mjs';
import {OFFICIAL_LAYERS,officialLayerQuery,fetchOfficialLayer,
  parseOfficialSidewalk,parseOfficialCurbLines,streetSurfaceSvg}
  from '../scripts/nyc-times-sidewalk-curb-source.mjs';
const p=(e=0,n=0)=>[ORIGIN[0]+e,ORIGIN[1]+n];
const closed=(e=0,n=0)=>[p(e,n),p(e+.0001,n),p(e+.0001,n+.0001),p(e,n+.0001),p(e,n)];
const ft=(id,geometry,sub=380000)=>({type:'Feature',
  properties:{OBJECTID:id,SOURCE_ID:id*10,SUB_FEATURE_CODE:sub,STATUS:'Updated'},
  geometry});
const fc=features=>({type:'FeatureCollection',features});
test('official citywide OTI layer IDs and source semantics are exact',()=>{
  assert.match(OFFICIAL_LAYERS.sidewalk.url,/Sidewalk_2022\/FeatureServer\/22$/);
  assert.match(OFFICIAL_LAYERS.curb.url,/Curb_2022\/FeatureServer\/4$/);
  assert.match(OFFICIAL_LAYERS.curbCut.url,/Curb_Cut_2022\/FeatureServer\/5$/);
  for(const name of Object.keys(OFFICIAL_LAYERS)){
    const query=new URL(officialLayerQuery(name,150));
    assert.equal(query.searchParams.get('geometry'),BBOX.join(','));
    assert.equal(query.searchParams.get('inSR'),'4326');
    assert.equal(query.searchParams.get('outSR'),'4326');
    assert.equal(query.searchParams.get('f'),'geojson');
    assert.equal(query.searchParams.get('resultOffset'),'150');
    assert.equal(query.searchParams.get('outFields'),
      'OBJECTID,SOURCE_ID,FEATURE_CODE,SUB_FEATURE_CODE,STATUS');
  }
  assert.throws(()=>officialLayerQuery('bad'),/Unknown/);
  assert.throws(()=>officialLayerQuery('curb',999999),/unsafe/);
});
test('real sidewalk polygons retain holes, metric coordinates and source class',()=>{
  const f=ft(73,{type:'Polygon',coordinates:[closed(),
    closed(.000025,.000025).map(q=>q)]},380010);
  const parsed=parseOfficialSidewalk(fc([f,f]));
  assert.equal(parsed.length,1);
  assert.equal(parsed[0].subtype,380010);
  assert.equal(parsed[0].polygons.length,1);
  assert.equal(parsed[0].polygons[0].length,2,'do not fill polygon courtyards');
  assert.deepEqual(parsed[0].polygons[0][0][0],[0,0]);
  const right=toLocalMeters(p(.0001,0));
  assert.ok(Math.abs(parsed[0].polygons[0][0][1][0]-right[0])<.002);
});
test('curb polylines are metric and Z is never silently treated as height',()=>{
  const f=ft(91,{type:'MultiLineString',coordinates:[[
    [...p(0,0),12.0],[...p(.0001,0),13.0],
    [...p(.0001,.0001),14.0]
  ]]},225000);
  const a=parseOfficialCurbLines(fc([f,f]),'curb');
  assert.equal(a.length,1);
  assert.equal(a[0].sourceHasZ,true);
  assert.equal(a[0].parts[0][0].length,2);
  assert.equal(a[0].parts[0].length,3);
  assert.deepEqual(a[0].parts[0][0],[0,0]);
  assert.throws(()=>parseOfficialCurbLines(fc([]),'curb'),
    /No valid official curb/);
  const cuts=parseOfficialCurbLines(fc([ft(92,{type:'LineString',coordinates:[
    p(0,0),p(.0001,0)
  ]},222700)]),'curbCut');
  assert.equal(cuts[0].subtype,222700);
  assert.deepEqual(parseOfficialCurbLines(fc([]),'curbCut'),[],
    'no cut in a sampled block must not invent one');
});
test('source query fails on HTTP/invalid data, no drawn substitute edges',async()=>{
  let called=0;
  const f=ft(1,{type:'LineString',coordinates:[p(0,0),p(.0001,0)]},225000);
  const data=await fetchOfficialLayer('curb',async (url)=>{
    called++;assert.ok(url.startsWith(OFFICIAL_LAYERS.curb.url));
    return {ok:true,json:async()=>fc([f])};
  });
  assert.equal(called,1);assert.equal(data.features.length,1);
  await assert.rejects(fetchOfficialLayer('curb',async()=>({
    ok:false,status:403,json:async()=>({})
  })),/HTTP 403/);
  await assert.rejects(fetchOfficialLayer('sidewalk',async()=>({
    ok:true,json:async()=>({})
  })),/non-GeoJSON/);
});
test('plan view uses source sidewalk and road-edge rather than rectangles',()=>{
  const side=parseOfficialSidewalk(fc([ft(1,{type:'Polygon',coordinates:[closed()]})]));
  const curb=parseOfficialCurbLines(fc([ft(2,
    {type:'LineString',coordinates:[p(0,0),p(.0001,0)]},225000)]));
  const cuts=parseOfficialCurbLines(fc([ft(3,
    {type:'LineString',coordinates:[p(0,0),p(0,.0001)]},222700)]),'curbCut');
  const svg=streetSurfaceSvg(side,curb,cuts);
  assert.match(svg,/fill-rule="evenodd"/);
  assert.match(svg,/stroke="#5fd0e3"/);
  assert.match(svg,/stroke="#ef8b5f"/);
  assert.match(svg,/clip-path="url\(#tile\)"/);
});
