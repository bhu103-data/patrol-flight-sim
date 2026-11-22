import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGIN,BBOX,metresPerDegree,toLocalMeters} from '../scripts/nyc-times-true-scale-pilot.mjs';
import {ROADBED_SOURCE,parseRoadbedPolygons,fetchOfficialRoadbeds,
  roadbedOverlaySvg} from '../scripts/nyc-times-roadbed-polygon-source.mjs';

const square=(cx,cy,size=.0001)=>[
  [cx,cy],[cx+size,cy],[cx+size,cy+size],[cx,cy+size],[cx,cy]
];
const feature=(id,geometry,sub=350000)=>({
  type:'Feature',properties:{OBJECTID:id,SOURCE_ID:id*100,
    FEATURE_CODE:3500,SUB_FEATURE_CODE:sub,STATUS:'Updated'},geometry
});
const fixture={type:'FeatureCollection',features:[
  feature(77,{type:'Polygon',coordinates:[square(...ORIGIN)]}),
  feature(78,{type:'MultiPolygon',coordinates:[
    [square(ORIGIN[0]+.0003,ORIGIN[1]+.0004),
      square(ORIGIN[0]+.00032,ORIGIN[1]+.00042,.00001)]
  ]},350010)
]};
test('official roadbed polygons retain shape, holes, and subtype with true metres',()=>{
  const out=parseRoadbedPolygons(fixture);
  assert.deepEqual(out.map(x=>x.objectId),[77,78]);
  assert.equal(out[0].subtype,350000);
  assert.equal(out[1].subtype,350010);
  assert.equal(out[1].polygons[0].length,2,
    'source hole must remain cut out rather than be filled');
  assert.deepEqual(out[0].polygons[0][0][0],[0,0]);
  const [east,north]=metresPerDegree(ORIGIN[1]);
  const expected=toLocalMeters([ORIGIN[0]+.0001,ORIGIN[1]]);
  assert.ok(Math.abs(out[0].polygons[0][0][1][0]-expected[0])<.001);
  assert.ok(Math.abs(expected[0]-east*.0001)<.00001);
  assert.ok(north>110000);
});
test('source geometry is not replaced with invented rectangles or synthetic lanes',()=>{
  assert.throws(()=>parseRoadbedPolygons({}),/No official/);
  assert.throws(()=>parseRoadbedPolygons({type:'FeatureCollection',features:[]}),
    /no valid polygons/);
  const duplicate={type:'FeatureCollection',
    features:[fixture.features[0],fixture.features[0]]};
  assert.equal(parseRoadbedPolygons(duplicate).length,1);
  const bogus=feature(20,{type:'Polygon',coordinates:[
    [[0,0],[100,0],[100,100],[0,0]]
  ]});
  assert.throws(()=>parseRoadbedPolygons({
    type:'FeatureCollection',features:[bogus]
  }),/no valid polygons/);
});
test('metre overlay preserves polygon source contours and clips only view',()=>{
  const source={projection:{originLonLat:ORIGIN},buildings:[
    {outline:[[0,0],[10,0],[10,10],[0,10]]}
  ],roads:[{lines:[[[0,0],[10,5]]]}]};
  const svg=roadbedOverlaySvg(source,parseRoadbedPolygons(fixture));
  assert.match(svg,/fill-rule="evenodd"/);
  assert.match(svg,/#d8ac61/);
  assert.match(svg,/#6bb99d/);
  assert.match(svg,/clipPath id="tile"/);
  const wrong={...source,projection:{originLonLat:[0,0]}};
  assert.throws(()=>roadbedOverlaySvg(wrong,parseRoadbedPolygons(fixture)),
    /different origins/);
});
test('fetch uses only bounded NYC OTI authoritative polygon service, no fallback',async()=>{
  let times=0;
  const data=await fetchOfficialRoadbeds(async url=>{
    times++;
    const u=new URL(url);
    assert.ok(url.startsWith(ROADBED_SOURCE+'/query?'));
    assert.equal(u.searchParams.get('geometry'),BBOX.join(','));
    assert.equal(u.searchParams.get('inSR'),'4326');
    assert.equal(u.searchParams.get('outSR'),'4326');
    assert.equal(u.searchParams.get('f'),'geojson');
    assert.equal(u.searchParams.get('returnGeometry'),'true');
    return {ok:true,json:async()=>({type:'FeatureCollection',
      features:Array.from({length:5},(_,i)=>
        feature(100+i,{type:'Polygon',coordinates:[square(...ORIGIN)]}))})};
  });
  assert.equal(data.features.length,5);
  assert.equal(times,1);
  await assert.rejects(fetchOfficialRoadbeds(async()=>({
    ok:false,status:403,json:async()=>({})
  })),/Official OTI roadbed HTTP 403/);
});
