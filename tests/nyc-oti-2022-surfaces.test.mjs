import test from 'node:test';
import assert from 'node:assert/strict';
import {metersToWgs84} from '../assets/nyc/times-square-metered-massing.mjs';
import {
  OTI_2022_BBOX,OTI_2022_LAYERS,OTI_2022_MINIMUMS,
  officialLayerQuery,compileOfficialOti2022Surfaces,
  fetchAndCompileOfficialOti2022Surfaces
} from '../assets/nyc/nyc-oti-2022-surfaces.mjs';

const origin={lon:-73.9864883,lat:40.75775};
const geo=(east,north)=>metersToWgs84([east,north],origin);
const ring=points=>[...points.map(([e,n])=>geo(e,n)),geo(points[0][0],points[0][1])];
const feature=(id,geometry,subtype=350000)=>({
  type:'Feature',
  properties:{OBJECTID:id,SOURCE_ID:id*10,FEATURE_CODE:3500,
    SUB_FEATURE_CODE:subtype,STATUS:'Updated'},
  geometry
});
const fc=features=>({type:'FeatureCollection',features});
const collections={
  roadbed:fc([
    feature(1,{type:'Polygon',coordinates:[
      ring([[0,0],[20,0],[20,20],[0,20]]),
      ring([[5,5],[5,15],[15,15],[15,5]])
    ]}),
    feature(2,{type:'Polygon',coordinates:[ring([[30,0],[35,0],[35,5],[30,5]])]},350010)
  ]),
  plaza:fc([feature(3,{type:'Polygon',coordinates:[ring([[40,0],[45,0],[45,5],[40,5]])]},360000)]),
  sidewalk:fc([feature(4,{type:'Polygon',coordinates:[ring([[50,0],[55,0],[55,5],[50,5]])]},380000)]),
  curb:fc([feature(5,{type:'LineString',coordinates:[geo(60,0),geo(60,10)]},225000)]),
  curbCut:fc([feature(6,{type:'LineString',coordinates:[geo(65,0),geo(65,4)]},222700)])
};
const lowMinimums={
  roadbedFeatures:1,plazaFeatures:1,sidewalkFeatures:1,curbFeatures:1,curbCutFeatures:1,
  roadbedTriangles:1,sidewalkTriangles:1,curbSegments:1,curbCutSegments:1
};
const center={east:0,north:0};

test('official NYC OTI 2022 layer endpoints, BBOX and CRS are explicit',()=>{
  assert.deepEqual(OTI_2022_BBOX,[-73.9900,40.7552,-73.9822,40.7610]);
  assert.match(OTI_2022_LAYERS.roadbed,/Roadbed_2022\/FeatureServer\/20$/);
  assert.match(OTI_2022_LAYERS.plaza,/Plaza_2022\/FeatureServer\/16$/);
  assert.match(OTI_2022_LAYERS.sidewalk,/Sidewalk_2022\/FeatureServer\/22$/);
  assert.match(OTI_2022_LAYERS.curb,/Curb_2022\/FeatureServer\/4$/);
  assert.match(OTI_2022_LAYERS.curbCut,/Curb_Cut_2022\/FeatureServer\/5$/);
  for(const kind of Object.keys(OTI_2022_LAYERS)){
    const url=new URL(officialLayerQuery(kind,200));
    assert.equal(url.searchParams.get('geometry'),OTI_2022_BBOX.join(','));
    assert.equal(url.searchParams.get('inSR'),'4326');
    assert.equal(url.searchParams.get('outSR'),'4326');
    assert.equal(url.searchParams.get('returnGeometry'),'true');
    assert.equal(url.searchParams.get('f'),'geojson');
    assert.equal(url.searchParams.get('resultOffset'),'200');
  }
});

test('Earcut preserves a source courtyard hole and verifies polygon area',()=>{
  const mesh=compileOfficialOti2022Surfaces({
    massing:{origin},center,collections,minimums:lowMinimums
  });
  assert.equal(mesh.schema,'patrol-nyc-oti-2022-full-surfaces-v1');
  assert.equal(mesh.imageryYear,2022);
  assert.ok(mesh.counts.roadbedTriangles>2);
  assert.equal(mesh.counts.roadbedFeatures,2);
  const vertices=mesh.roadbedInterleaved;
  let area=0;
  for(let i=0;i<vertices.length;i+=30){
    const a=[vertices[i],vertices[i+2]],
      b=[vertices[i+10],vertices[i+12]],
      c=[vertices[i+20],vertices[i+22]];
    area+=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))*.5;
  }
  assert.ok(area>324.9&&area<325.1,'expected outer 400 - hole 100 + intersection 25 m²');
  assert.ok([...vertices].every(Number.isFinite));
  for(let i=1;i<vertices.length;i+=10)assert.ok(Math.abs(vertices[i]+.075)<1e-6);
});

test('sidewalk, plaza, curb and curb-cut remain separate display-only layers',()=>{
  const mesh=compileOfficialOti2022Surfaces({
    massing:{origin},center,collections,minimums:lowMinimums
  });
  assert.equal(mesh.counts.sidewalkFeatures,1);
  assert.equal(mesh.counts.plazaFeatures,1);
  assert.equal(mesh.counts.curbFeatures,1);
  assert.equal(mesh.counts.curbCutFeatures,1);
  assert.equal(mesh.counts.curbSegments,1);
  assert.equal(mesh.counts.curbCutSegments,1);
  assert.ok(mesh.pedestrianInterleaved.length>0);
  assert.ok(mesh.curbInterleaved.length>0);
  const ys=(arr)=>Array.from(arr).filter((_,i)=>i%10===1);
  const hasY=(values,y)=>values.some(v=>Math.abs(v-y)<1e-5);
  assert.ok(hasY(ys(mesh.pedestrianInterleaved),.10));
  assert.ok(hasY(ys(mesh.pedestrianInterleaved),.12));
  assert.ok(hasY(ys(mesh.curbInterleaved),.16));
  assert.ok(hasY(ys(mesh.curbInterleaved),.18));
  assert.equal(mesh.noSurveyedVerticalDatum,true);
  assert.equal(mesh.noGameplaySemantics,true);
  assert.equal(mesh.sourceDataStoredInRepository,false);
  assert.ok(mesh.caveats.some(x=>x.includes('29.492 m²')));
});

test('strict default source minimums reject incomplete tiles instead of inventing geometry',()=>{
  assert.ok(OTI_2022_MINIMUMS.roadbedFeatures>=70);
  assert.ok(OTI_2022_MINIMUMS.sidewalkFeatures>=40);
  assert.throws(()=>compileOfficialOti2022Surfaces({
    massing:{origin},center,collections
  }),/source coverage below the verified Times Square minimum/);
});

test('browser/runtime source fetch requests all five official layers and builds same-origin meshes',async()=>{
  const requested=[];
  const fakeFetch=async url=>{
    const parsed=new URL(url);
    const kind=Object.keys(OTI_2022_LAYERS).find(k=>
      parsed.pathname.startsWith(new URL(OTI_2022_LAYERS[k]).pathname));
    assert.ok(kind,'unknown official source URL');
    requested.push(kind);
    return {ok:true,status:200,json:async()=>collections[kind]};
  };
  const mesh=await fetchAndCompileOfficialOti2022Surfaces(
    {origin},center,fakeFetch,lowMinimums);
  assert.deepEqual(requested.sort(),Object.keys(OTI_2022_LAYERS).sort());
  assert.equal(mesh.projection.originLonLat[0],origin.lon);
  assert.equal(mesh.projection.originLonLat[1],origin.lat);
  assert.equal(mesh.counts.roadbedFeatures,2);
});
