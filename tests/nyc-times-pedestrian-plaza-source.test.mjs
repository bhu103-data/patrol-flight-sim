import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PEDESTRIAN_LAYERS,pedestrianQueryUrl,fetchPedestrianLayer,
  pedestrianOverlaySvg,countSource
} from '../scripts/nyc-times-pedestrian-plaza-source.mjs';
import {ORIGIN} from '../scripts/nyc-times-true-scale-pilot.mjs';

const outer=[
  [-73.98670,40.75700],[-73.98640,40.75700],
  [-73.98640,40.75730],[-73.98670,40.75730],
  [-73.98670,40.75700]
];
const inner=[
  [-73.98665,40.75704],[-73.98660,40.75704],
  [-73.98660,40.75709],[-73.98665,40.75709],
  [-73.98665,40.75704]
];
function row(id,coords=[outer],status='Unchanged'){
  return {type:'Feature',properties:{
    OBJECTID:id,SOURCE_ID:100000+id,FEATURE_CODE:3800,
    SUB_FEATURE_CODE:380000,STATUS:status},
    geometry:{type:'Polygon',coordinates:coords}};
}
function fetcherFor(features,urls=[]){
  return async url=>{
    urls.push(String(url));
    return {ok:true,status:200,json:async()=>({
      type:'FeatureCollection',features
    })};
  };
}
test('uses only official OTI plaza and sidewalk polygon services',()=>{
  assert.match(PEDESTRIAN_LAYERS.plaza.url,/Plaza_2022\/FeatureServer\/16$/);
  assert.match(PEDESTRIAN_LAYERS.sidewalk.url,/Sidewalk_2022\/FeatureServer\/22$/);
  for(const kind of ['plaza','sidewalk']){
    const q=decodeURIComponent(pedestrianQueryUrl(kind,0));
    assert.match(q,/f=geojson/);
    assert.match(q,/outSR=4326/);
    assert.match(q,/geometryType=esriGeometryEnvelope/);
    assert.match(q,/returnGeometry=true/);
    assert.match(q,/OBJECTID/);
    assert.ok(!q.includes('google'));
  }
  assert.throws(()=>pedestrianQueryUrl('made-up'),/Unknown/);
});
test('preserves real source OBJECTID and original courtyard holes',async()=>{
  const seen=[];
  const shapes=await fetchPedestrianLayer('sidewalk',
    fetcherFor([row(1,[outer,inner])],seen));
  assert.equal(seen.length,1);
  assert.equal(shapes.length,1);
  assert.equal(shapes[0].objectId,1);
  assert.equal(shapes[0].sourceLayer,'sidewalk');
  assert.equal(shapes[0].polygons.length,1);
  assert.equal(shapes[0].polygons[0].length,2);
  assert.equal(shapes[0].status,'Unchanged');
  assert.equal(countSource(shapes).rings,2);
  const p=shapes[0].polygons[0][0][0];
  assert.ok(Math.hypot(...p)>10,'Source was not projected into actual meters');
});
test('plaza ring provenance is distinct from a fabricated road width',async()=>{
  const shapes=await fetchPedestrianLayer('plaza',fetcherFor([row(9)]));
  assert.equal(shapes[0].sourceLayer,'plaza');
  assert.ok(!Object.hasOwn(shapes[0],'roadWidthMeters'));
  assert.deepEqual(Object.keys(countSource(shapes)).sort(),
    ['features','polygons','rings','subtypes','vertices']);
});
test('rejects empty, misleading and non-GeoJSON official responses',async()=>{
  const bad=await fetchPedestrianLayer('plaza',async()=>({
    ok:true,json:async()=>({type:'FeatureCollection',features:[]})
  })).catch(x=>x);
  assert.match(String(bad),/No official plaza/);
  await assert.rejects(()=>fetchPedestrianLayer('sidewalk',
    async()=>({ok:true,json:async()=>({type:'FeatureCollection',
      features:[{type:'Feature',properties:{OBJECTID:4},
        geometry:{type:'Point',coordinates:[-73.98,40.76]}}]})})),
    /No official|No valid/);
});
test('all three real source layers must share identical geographic origin',()=>{
  const props={projection:{originLonLat:ORIGIN},buildings:[
    {fid:3,outline:[[-3,2],[-1,2],[-1,4],[-3,4]]}
  ],roads:[{lines:[[[-4,1],[-2,3]]]}]};
  const base={
    projection:{originLonLat:ORIGIN},
    roadbeds:[{polygons:[[[[-6,0],[6,0],[6,1],[-6,1],[-6,0]]]]}]
  };
  const ps={plaza:[{polygons:[[[[-2,1],[-1,1],[-1,2],[-2,2],[-2,1]]]]}],
    sidewalk:[{polygons:[[[[-5,1],[-3,1],[-3,2],[-5,2],[-5,1]]]]}]};
  const svg=pedestrianOverlaySvg(props,base,ps);
  assert.match(svg,/fill-rule="evenodd"/);
  assert.match(svg,/gold=plaza/);
  assert.match(svg,/beige=sidewalk/);
  assert.match(svg,/teal=roadbed/);
  assert.match(svg,/NYC OTI official 2022 planimetrics/);
  assert.doesNotMatch(svg,/Google|Street View/);
  assert.throws(()=>pedestrianOverlaySvg(
    {...props,projection:{originLonLat:[0,0]}},base,ps),/origins differ/);
  assert.throws(()=>pedestrianOverlaySvg(props,base,{plaza:[],sidewalk:null}),
    /datasets required/);
});
