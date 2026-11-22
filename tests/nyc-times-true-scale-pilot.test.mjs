import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ORIGIN,BBOX,BUILDING_SOURCE,ROAD_SOURCE,metresPerDegree,toLocalMeters,
  buildingsInMeters,roadsInMeters,fetchOfficialRoads,makeSvg,
  SOURCE_TILE_METRES,clipSourceStreetLine
} from '../scripts/nyc-times-true-scale-pilot.mjs';

const asset=JSON.parse(readFileSync(new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));

test('source georeferencing is WGS84 east/north metres, not PATROL fictional units',()=>{
  assert.equal(ORIGIN.length,2);
  assert.equal(BBOX.length,4);
  assert.match(BUILDING_SOURCE,/ArcGIS/i);
  assert.match(ROAD_SOURCE,/DCM_Street_Center_Line/);
  assert.deepEqual(toLocalMeters(ORIGIN),[0,0]);
  const [ex,ny]=metresPerDegree(ORIGIN[1]);
  assert.ok(ex>84000&&ex<84500);
  assert.ok(ny>110000&&ny<112000);
  const east=toLocalMeters([ORIGIN[0]+1/ex,ORIGIN[1]]);
  const north=toLocalMeters([ORIGIN[0],ORIGIN[1]+1/ny]);
  assert.ok(Math.abs(east[0]-1)<1e-7&&Math.abs(east[1])<1e-7);
  assert.ok(Math.abs(north[1]-1)<1e-7&&Math.abs(north[0])<1e-7);
  assert.ok(Math.hypot(...toLocalMeters([-73.9845,40.7580]))<400);
});

test('all source buildings retain municipal FID, polygon coordinates, and real roof metres',()=>{
  assert.equal(asset.features.length,120,'do not silently reduce the official sample');
  const buildings=buildingsInMeters(asset);
  assert.ok(buildings.length>=100);
  assert.equal(new Set(buildings.map(x=>x.fid)).size,buildings.length);
  for(const b of buildings){
    const src=asset.features.find(x=>x.fid===b.fid);
    assert.ok(src);
    assert.equal(b.heightMeters,+(src.heightFt*.3048).toFixed(2),
      'source height feet converted to metres, never capped to 66 game units');
    assert.ok(b.outline.length>=3);
    for(let i=0;i<b.outline.length;i++){
      const original=src.rings[0][i];
      const [e,n]=toLocalMeters(original);
      assert.ok(Math.abs(b.outline[i][0]-e)<=.000501);
      assert.ok(Math.abs(b.outline[i][1]-n)<=.000501);
    }
  }
});

test('official street geometry uses precisely the same metre frame',()=>{
  const features=[{
    type:'Feature',
    properties:{OBJECTID:412,Street_NM:'BROADWAY',Streetwidth:'60',Paper_ST:'N',
      Build_Status:'Improved',Feat_status:'Mapped'},
    geometry:{type:'LineString',coordinates:[
      [ORIGIN[0],ORIGIN[1]], [ORIGIN[0]+.001,ORIGIN[1]+.001]]}
  },{
    type:'Feature',
    properties:{OBJECTID:413,Street_NM:'W 43 ST',Paper_ST:'Y'},
    geometry:{type:'MultiLineString',coordinates:[
      [[ORIGIN[0],ORIGIN[1]],[ORIGIN[0]+.0002,ORIGIN[1]]]]}
  }];
  const roads=roadsInMeters({type:'FeatureCollection',features});
  assert.equal(roads.length,2);
  assert.deepEqual(roads[0].lines[0][0],[0,0]);
  assert.equal(roads[0].streetWidthFeet,60);
  assert.equal(roads[0].buildStatus,'Improved');
  assert.equal(roads[1].paperStreet,'Y');
  assert.equal(roads[1].streetWidthFeet,null);
  const b=buildingsInMeters(asset);
  const svg=makeSvg(b,roads);
  assert.match(svg,/viewBox=/);
  assert.match(svg,/polyline/);
  assert.match(svg,/#d98a57/,'paper street visually distinct, not a driveable road');
  assert.match(svg,/#55c8f5/,'mapped street visually distinct');
});

test('ArcGIS envelope-intersecting road geometry is clipped instead of shrinking the view',()=>{
  const [west,south,east,north]=SOURCE_TILE_METRES;
  assert.ok(east-west>600&&east-west<700);
  assert.ok(north-south>600&&north-south<700);
  const lines=clipSourceStreetLine([[0,0],[1000,0],[1000,300],[0,300]]);
  assert.equal(lines.length,2,'outside gap must not become a connecting road');
  assert.ok(Math.abs(lines[0][0][0])<.001);
  assert.ok(Math.abs(lines[0].at(-1)[0]-east)<.002);
  assert.ok(Math.abs(lines[1][0][0]-east)<.002);
  assert.ok(Math.abs(lines[1].at(-1)[0])<.002);
  assert.deepEqual(clipSourceStreetLine([
    [1000,1000],[1200,1200]]),[],'outside road must be dropped');
  for(const line of lines)for(const p of line){
    assert.ok(p[0]>=west-.002&&p[0]<=east+.002,
      'invalid east/west source position '+p);
    assert.ok(p[1]>=south-.002&&p[1]<=north+.002,
      'invalid north/south source position '+p);
  }
});

test('source street identity and paper-street status survive actual clipping',()=>{
  const outside=ORIGIN[0]+.020;
  const data={type:'FeatureCollection',features:[
    {type:'Feature',properties:{OBJECTID:88,Street_NM:'7 AV',
      Streetwidth:'80',Paper_ST:'N'},geometry:{type:'LineString',
      coordinates:[ORIGIN,[outside,ORIGIN[1]]]}},
    {type:'Feature',properties:{OBJECTID:89,Street_NM:'PAPER ST',
      Paper_ST:'Y'},geometry:{type:'LineString',
      coordinates:[[outside,ORIGIN[1]],[outside,ORIGIN[1]+.001]]}}
  ]};
  const roads=roadsInMeters(data);
  assert.equal(roads.length,1,'outside source line must not become scenery');
  assert.equal(roads[0].objectId,88);
  assert.equal(roads[0].streetName,'7 AV');
  assert.equal(roads[0].streetWidthFeet,80);
  assert.equal(roads[0].paperStreet,'N');
  assert.equal(roads[0].lines.length,1);
  assert.ok(Math.abs(roads[0].lines[0].at(-1)[0]-SOURCE_TILE_METRES[2])<.002);
});

test('network fetching is official-source-only, bounded, and not a fictional fallback',async()=>{
  let count=0;
  const fake=async(url)=>{
    count++;
    const parsed=new URL(url);
    assert.ok(url.startsWith(ROAD_SOURCE+'/query?'));
    assert.equal(parsed.searchParams.get('inSR'),'4326');
    assert.equal(parsed.searchParams.get('outSR'),'4326');
    assert.equal(parsed.searchParams.get('f'),'geojson');
    assert.equal(parsed.searchParams.get('geometry'),BBOX.join(','));
    return {ok:true,json:async()=>({type:'FeatureCollection',
      features:Array.from({length:5},(_,i)=>({
        properties:{OBJECTID:i+1},geometry:{type:'LineString',
          coordinates:[ORIGIN,[ORIGIN[0]+.0001,ORIGIN[1]+.0001]]}
      }))})};
  };
  const result=await fetchOfficialRoads(fake);
  assert.equal(result.features.length,5);
  assert.equal(count,1);
  await assert.rejects(fetchOfficialRoads(async()=>({
    ok:false,status:403,json:async()=>({})
  })),/Official DCM HTTP 403/);
});
