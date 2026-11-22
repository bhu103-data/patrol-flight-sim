import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BBOX,ROAD_ORIGIN,LAYERS,SOURCE_TERMS,makeOfficialQuery,
  inspectOfficialFeature,fetchOfficialLayer} from '../tools/nyc/collect-front-dock-pedestrian-source.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const road=read('../assets/nyc/dumbo-front-dock-roadbed-2022.json');
const build=read('../assets/nyc/dumbo-oti-metric-48.json');

test('DUMBO official pedestrian sources are not the Times Square sample',()=>{
  assert.deepEqual(BBOX,road.queryBbox);
  assert.deepEqual(ROAD_ORIGIN,road.origin);
  assert.equal(build.features.length,48);
  assert.deepEqual(Object.keys(LAYERS),['sidewalk','curb','curbCut']);
  assert.equal(LAYERS.sidewalk.id,22);
  assert.equal(LAYERS.curb.id,4);
  assert.equal(LAYERS.curbCut.id,5);
  assert.match(SOURCE_TERMS,/Terms-of-Use/);
  assert(BBOX[0]<ROAD_ORIGIN.lon&&BBOX[2]>ROAD_ORIGIN.lon);
  assert(BBOX[1]<ROAD_ORIGIN.lat&&BBOX[3]>ROAD_ORIGIN.lat);
});

test('ArcGIS fetch is bounded, paginated, source-only EPSG:4326, source IDs retained',()=>{
  const uri=new URL(makeOfficialQuery('sidewalk',150));
  assert.equal(uri.searchParams.get('geometry'),BBOX.join(','));
  assert.equal(uri.searchParams.get('resultOffset'),'150');
  assert.equal(uri.searchParams.get('resultRecordCount'),'150');
  assert.equal(uri.searchParams.get('outSR'),'4326');
  assert.equal(uri.searchParams.get('returnGeometry'),'true');
  assert.equal(uri.searchParams.get('outFields'),'OBJECTID,SOURCE_ID,SUB_FEATURE_CODE,STATUS');
  assert.throws(()=>makeOfficialQuery('sidewalk',1),/Invalid/);
  assert.throws(()=>makeOfficialQuery('sidewalk',2100),/Invalid/);
  assert.throws(()=>makeOfficialQuery('wrong',0),/Invalid/);
});

test('closed sidewalk ring and arbitrary official holes retained, no estimated grade',()=>{
  const p=[[-73.992,40.7024],[-73.9919,40.7024],
    [-73.9919,40.7025],[-73.992,40.7024]];
  const hole=[[-73.99198,40.70243],[-73.99196,40.70243],
    [-73.99197,40.70244],[-73.99198,40.70243]];
  const raw={type:'Feature',properties:{OBJECTID:901,SOURCE_ID:'origin',STATUS:'Updated'},
    geometry:{type:'Polygon',coordinates:[p,hole]}};
  const x=inspectOfficialFeature(raw,'polygon');
  assert.equal(x.objectId,901);
  assert.equal(x.ringCount,2);
  assert.equal(x.vertices,8);
  assert.deepEqual(x.geometry.coordinates,[p,hole]);
  assert.equal(x.geometry.type,'Polygon');
  assert.equal('height' in x,false);
  assert.throws(()=>inspectOfficialFeature(
    {...raw,geometry:{type:'Polygon',coordinates:[p.slice(0,3)]}},'polygon'),
    /Invalid source coordinates/);
  assert.throws(()=>inspectOfficialFeature({...raw,geometry:{type:'Point',
    coordinates:p[0]}},'polygon'),/Unexpected/);
});

test('curb and curb cuts keep source lines and 2D coordinates, no fake sidewalk extrusion',()=>{
  const line=[[-73.9922,40.7022],[-73.9921,40.7023]];
  const f=inspectOfficialFeature({properties:{OBJECTID:31,SUB_FEATURE_CODE:123},
    geometry:{type:'MultiLineString',coordinates:[line]}},'line');
  assert.equal(f.vertices,2);
  assert.equal(f.objectId,31);
  assert.deepEqual(f.geometry.coordinates,[line]);
  assert.equal(f.subtype,123);
  assert.throws(()=>inspectOfficialFeature({properties:{OBJECTID:32},
    geometry:{type:'LineString',coordinates:[[0,0],[1,1]]}},'line'),/Invalid source coordinates/);
});
test('no geometry is invented if required official source is empty, failed or repeated',async()=>{
  const empty=async()=>({ok:true,json:async()=>({type:'FeatureCollection',features:[]})});
  await assert.rejects(fetchOfficialLayer('sidewalk',empty),/no features/);
  const bad=async()=>({ok:false,status:503});
  await assert.rejects(fetchOfficialLayer('curb',bad),/HTTP 503/);
  const curbCut=await fetchOfficialLayer('curbCut',empty);
  assert.equal(curbCut.records,0);
});
test('static-only source audit cannot activate PATROL aircraft or street meshes',()=>{
  const game=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const code=readFileSync(new URL('../tools/nyc/collect-front-dock-pedestrian-source.mjs',import.meta.url),'utf8');
  assert(!game.includes('collect-front-dock-pedestrian-source.mjs'));
  assert(!code.includes('window.PatrolSpaceBridge'));
  assert(!code.includes('addTri('));
  assert(!code.includes('new WebGL'));
});
