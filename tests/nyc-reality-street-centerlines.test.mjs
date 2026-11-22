import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  NYC_DCM_SOURCE,NYC_STREET_BBOX,officialStreetQuery,clipWGS84Line,
  projectDCMRoads,fetchOfficialDCM,chooseOfficialStreetCamera
} from '../assets/nyc/nyc-reality-street-centerlines.mjs';
import {NYC_REALITY_ORIGIN,lonLatToENU}
  from '../assets/nyc/nyc-reality-projection.mjs';

const example=(id,name,a,b,kind='City_St')=>({
  type:'Feature',
  properties:{OBJECTID:id,Street_NM:name,Feat_status:kind,
    Build_Status:'Improved',Paper_ST:'N'},
  geometry:{type:'LineString',coordinates:[a,b]}
});
const lines={
  type:'FeatureCollection',
  features:[
    example(42,'West 42 Street',[-73.99,40.7573],[-73.984,40.7553]),
    example(7,'7 Avenue',[-73.9869,40.7553],[-73.9835,40.7606]),
    example(90,'Shubert Alley',[-73.9871,40.7579],[-73.9867,40.7584],'Way_on_record'),
    example(91,'West 44 Street',[-73.989,40.7585],[-73.984,40.7564]),
    example(92,'Broadway',[-73.985,40.757],[-73.984,40.759]),
    example(7,'duplicate ID',[-73.9869,40.7553],[-73.9835,40.7606])
  ]
};

test('bounded official NYC DCM query preserves source and WGS84 metres',()=>{
  const u=new URL(officialStreetQuery());
  assert.ok(u.toString().startsWith(NYC_DCM_SOURCE));
  assert.equal(u.searchParams.get('geometry'),NYC_STREET_BBOX.join(','));
  assert.equal(u.searchParams.get('inSR'),'4326');
  assert.equal(u.searchParams.get('outSR'),'4326');
  assert.equal(u.searchParams.get('f'),'geojson');
  assert.match(u.searchParams.get('outFields'),/OBJECTID,Street_NM/);
  assert.throws(()=>officialStreetQuery(-200),/Unbounded/);
  assert.throws(()=>officialStreetQuery(2000),/Unbounded/);
});
test('street edges are clipped to source query envelope without stretching',()=>{
  const lines=clipWGS84Line([[-73.996,40.758],[-73.985,40.758],[-73.98,40.758]]);
  assert.equal(lines.length,1);
  assert.ok(Math.abs(lines[0][0][0]-NYC_STREET_BBOX[0])<1e-9);
  assert.ok(Math.abs(lines[0].at(-1)[0]-NYC_STREET_BBOX[2])<1e-9);
  assert.throws(()=>clipWGS84Line([[NaN,40],[-73.98,40]]),/Invalid official/);
});
test('same ENU projection as buildings, source IDs and provisional status',()=>{
  const result=projectDCMRoads(lines);
  assert.equal(result.records.length,5);
  assert.equal(result.builtCount,4);
  assert.equal(result.records[0].objectId,7);
  assert.equal(result.records[2].name,'Shubert Alley');
  assert.equal(result.records[2].built,false);
  assert.equal(result.source,NYC_DCM_SOURCE);
  assert.deepEqual(result.origin,NYC_REALITY_ORIGIN);
  const reference=lonLatToENU(-73.9869,40.7553);
  const first=result.records[0].metreLines[0][0];
  assert.ok(Math.hypot(first[0]-reference[0],first[1]-reference[1])<1e-6);
  assert.equal(result.kind,'WGS84 DCM street centerlines, not roadbeds');
});
test('official data fetch is replaceable, invalid responses fail not fabricate roads',async()=>{
  // A minimal batch of five distinct official-shaped lines is required; no
  // test injection into the production map or use of invented road fallback.
  const source={type:'FeatureCollection',features:
    Array.from({length:5},(_,i)=>example(300+i,'W 4'+i+' St',
      [-73.989,40.756+i*.0005],[-73.984,40.756+i*.0005]))};
  let called='';
  const result=await fetchOfficialDCM(async url=>{
    called=url;return {ok:true,json:async()=>source};
  });
  assert.equal(result.records.length,5);
  assert.match(called,/DCM_Street_Center_Line/);
  await assert.rejects(fetchOfficialDCM(async()=>({ok:false,status:503})),/HTTP 503/);
  await assert.rejects(fetchOfficialDCM(async()=>({
    ok:true,json:async()=>({error:{message:'no public data'}})
  })),/ArcGIS/);
});
test('standalone viewer marks roads as source centerlines, not a game road network',()=>{
  const html=readFileSync(new URL('../nyc-reality.html',import.meta.url),'utf8');
  assert.match(html,/nyc-reality-street-centerlines\.mjs/);
  assert.match(html,/fetchOfficialDCM\(\)/);
  assert.match(html,/new THREE\.Vector3\(east,0\.075,-north\)/);
  assert.match(html,/DCM lines are <strong>street centerlines only/);
  assert.match(html,/PatrolRealityStreetStatus/);
  assert.doesNotMatch(html,/buildTimesSquareDistrict\(/);
});

test('street-height camera derives solely from a built 7 Avenue DCM segment',()=>{
  const records=projectDCMRoads(lines).records;
  const shot=chooseOfficialStreetCamera(records);
  assert.equal(shot.streetName,'7 Avenue');
  assert.equal(shot.objectId,7);
  assert.equal(shot.eye[1],2.3);
  assert.equal(shot.look[1],2.3);
  assert.ok(Math.hypot(shot.look[0]-shot.eye[0],
    shot.look[2]-shot.eye[2])>30);
  assert.match(shot.source,/not curb\/roadbed/);
  assert.throws(()=>chooseOfficialStreetCamera(records,'Fake road'),/No source-verified/);
});
