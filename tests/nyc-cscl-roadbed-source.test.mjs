import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SERVICE,BBOX,FIELDS,makeUrl,checkFeatureCollection,summarize}
  from '../scripts/nyc-times-cscl-roadbed-probe.mjs';
const f=(id,props={})=>({
  type:'Feature',properties:{
    OBJECTID:id,STREET_NAME:'Broadway',STATUS:'2',TRAFDIR:'FT',RW_TYPE:1,
    STREETWIDTH:40,STREETWIDTH_IRR:'N',NUMBER_TRAVEL_LANES:2,
    NUMBER_PARK_LANES:0,NUMBER_TOTAL_LANES:2,FROM_LEVEL_CODE:13,
    TO_LEVEL_CODE:13,...props
  },geometry:{type:'LineString',coordinates:[
    [-73.9855,40.7565],[-73.9854,40.7566]
  ]}
});
test('public OTI CSCL layer has source roadway-status, direction, paved-width and count fields',()=>{
  const url=new URL(makeUrl());
  assert.ok(url.pathname.endsWith('/Centerline_view/FeatureServer/0/query'));
  assert.equal(url.searchParams.get('geometry'),BBOX.join(','));
  assert.equal(url.searchParams.get('inSR'),'4326');
  assert.equal(url.searchParams.get('outSR'),'4326');
  assert.equal(url.searchParams.get('returnGeometry'),'true');
  assert.equal(url.searchParams.get('f'),'geojson');
  assert.equal(url.searchParams.get('where'),'1=1');
  assert.equal(url.searchParams.get('resultRecordCount'),'1000');
  assert.equal(new URL(makeUrl(1000)).searchParams.get('resultOffset'),'1000');
  for(const k of ['STATUS','TRAFDIR','RW_TYPE','STREETWIDTH','STREETWIDTH_IRR',
    'NUMBER_TRAVEL_LANES','NUMBER_PARK_LANES','NUMBER_TOTAL_LANES',
    'FROM_LEVEL_CODE','TO_LEVEL_CODE','STREET_NAME'])
    assert.ok(FIELDS.includes(k),k);
  assert.ok(SERVICE.startsWith('https://services6.arcgis.com/'));
});
test('construct only source-code candidate roadways without making up unknown lanes',()=>{
  const features=[
    f(1),f(2,{STREET_NAME:'7 Avenue',TRAFDIR:'TW',STREETWIDTH:100,
      NUMBER_TRAVEL_LANES:null,NUMBER_TOTAL_LANES:null}),
    f(3,{STATUS:'3'}),f(4,{TRAFDIR:'NV'}),
    f(5,{RW_TYPE:6}),f(6,{RW_TYPE:3}),f(7,{STREETWIDTH:null}),
    f(8,{STATUS:'4'})
  ];
  const x=checkFeatureCollection({type:'FeatureCollection',features});
  assert.equal(x.rejected.length,0);
  const s=summarize(x,features.length);
  assert.equal(s.constructedVehicleCandidates,3);
  assert.equal(s.widthKnown,2);
  assert.equal(s.travelLaneCountKnown,2);
  assert.equal(s.statuses['2'],6);
  assert.equal(s.trafficDirections.FT,6);
  assert.ok(x.accepted.every(r=>r.lines[0][0][0]>0&&r.lengthMeters>0));
  assert.equal(x.accepted[0].widthMeters,12.192);
  assert.equal(x.accepted[1].widthMeters,30.48);
  assert.equal(x.accepted[1].travelLanes,null);
  assert.equal(x.accepted[6].widthMeters,null);
});
test('invalid, duplicate or implausible coordinates are flagged, not silently drawn',()=>{
  const duplicate=f(1),bad=f(2);
  bad.geometry.coordinates[0][0]=NaN;
  const x=checkFeatureCollection({type:'FeatureCollection',features:[
    f(1),duplicate,bad,f(3,{STREETWIDTH:-1,NUMBER_TRAVEL_LANES:99})
  ]});
  assert.equal(x.accepted.length,2);
  assert.equal(x.rejected.length,2);
  assert.equal(x.accepted[1].widthMeters,null);
  assert.equal(x.accepted[1].travelLanes,null);
  assert.throws(()=>checkFeatureCollection({features:[]}),/FeatureCollection/);
});
test('probe is QA-only: it does not import street geometry into playable PATROL',async()=>{
  const source=await readFile(new URL(
    '../scripts/nyc-times-cscl-roadbed-probe.mjs',import.meta.url),'utf8');
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(source.includes('licenseApprovedForGame:false'));
  assert.ok(source.includes('cityModelModified:false'));
  assert.ok(!html.includes('nyc-times-cscl-roadbed-probe.mjs'));
  assert.ok(!source.includes('pushRoadStrip('));
});
