import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OTI_SURFACE_BBOX,OTI_SURFACE_LAYERS,otiSurfaceQueryUrl,
  parseOtiSurfaceCollection,fetchOfficialOtiSurfaces
} from '../assets/nyc/nyc-oti-surface-runtime.mjs';
import {
  buildMeteredMassing,metersToWgs84
} from '../assets/nyc/times-square-metered-massing.mjs';
import {
  MESH_STRIDE,buildNeighborhoodMesh
} from '../assets/nyc/nyc-true-scale-neighborhood.mjs';

const origin={lon:-73.9864883,lat:40.75775};
const squareWgs=(x,y,size)=>{
  const pts=[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
  return pts.map(p=>metersToWgs84(p,origin));
};
const geoFeature=(id,subtype,geometry)=>({
  type:'Feature',
  properties:{OBJECTID:id,SOURCE_ID:10000000000+id,
    FEATURE_CODE:subtype,SUB_FEATURE_CODE:subtype,STATUS:'Unchanged'},
  geometry
});

test('all three query URLs are bounded to the same official Times Square WGS84 tile',()=>{
  for(const [kind,path] of [
    ['roadbeds','Roadbed_2022/FeatureServer/20'],
    ['plazas','Plaza_2022/FeatureServer/16'],
    ['sidewalks','Sidewalk_2022/FeatureServer/22']
  ]){
    const url=new URL(otiSurfaceQueryUrl(kind));
    assert.ok(url.pathname.includes(path));
    assert.equal(url.searchParams.get('geometry'),OTI_SURFACE_BBOX.join(','));
    assert.equal(url.searchParams.get('geometryType'),'esriGeometryEnvelope');
    assert.equal(url.searchParams.get('inSR'),'4326');
    assert.equal(url.searchParams.get('outSR'),'4326');
    assert.equal(url.searchParams.get('resultRecordCount'),'200');
    assert.equal(url.searchParams.get('returnGeometry'),'true');
    assert.equal(url.searchParams.get('f'),'geojson');
  }
  assert.throws(()=>otiSurfaceQueryUrl('buildings'),/Invalid NYC OTI/);
  assert.throws(()=>otiSurfaceQueryUrl('roadbeds',-1),/Invalid NYC OTI/);
});

test('GeoJSON Polygon and MultiPolygon preserve interior holes in local metres',()=>{
  const outer=squareWgs(0,0,30);
  const hole=squareWgs(8,8,8);
  const second=squareWgs(40,0,10);
  const collection={type:'FeatureCollection',features:[
    geoFeature(1,600000,{type:'Polygon',coordinates:[outer,hole]}),
    geoFeature(2,600000,{type:'MultiPolygon',coordinates:[[second],[squareWgs(60,0,10)]]})
  ]};
  const parsed=parseOtiSurfaceCollection('plazas',collection,origin);
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].objectId,1);
  assert.equal(parsed[0].polygons[0].length,2);
  assert.equal(parsed[1].polygons.length,2);
  assert.equal(parsed[0].sourceLayer,'plazas');
  assert.ok(parsed[0].polygons[0][0].every(p=>p.every(Number.isFinite)));
  assert.ok(Math.abs(parsed[0].polygons[0][0][1][0]-30)<.02);
});

test('source parser fails closed on malformed rings and unsupported geometry',()=>{
  assert.throws(()=>parseOtiSurfaceCollection('plazas',{
    type:'FeatureCollection',features:[geoFeature(1,600000,{
      type:'Polygon',coordinates:[[[0,0],[1,1],[0,0]]]
    })]
  },origin),/ring|collapsed/i);
  assert.throws(()=>parseOtiSurfaceCollection('plazas',{
    type:'FeatureCollection',features:[geoFeature(2,600000,{
      type:'LineString',coordinates:[[0,0],[1,1]]
    })]
  },origin),/Unsupported NYC OTI geometry/);
});

test('live source loader requires all 81/17/54-scale layer inventories and records provenance',async()=>{
  const featureCollection=(kind,count,subtype)=>({
    type:'FeatureCollection',
    features:Array.from({length:count},(_,i)=>geoFeature(i+1,subtype,{
      type:'Polygon',coordinates:[squareWgs(i*12,0,8)]
    }))
  });
  const fetcher=async url=>{
    const value=url.includes('/Roadbed_2022/')?
      featureCollection('roadbeds',81,350000):
      url.includes('/Plaza_2022/')?
        featureCollection('plazas',17,600000):
        featureCollection('sidewalks',54,380000);
    return {ok:true,status:200,json:async()=>value};
  };
  const result=await fetchOfficialOtiSurfaces({origin,fetcher});
  assert.equal(result.schema,'patrol-nyc-oti-surfaces-2022-runtime-v1');
  assert.equal(result.imageryYear,2022);
  assert.equal(result.role,'VISUAL_SOURCE_ONLY_NOT_COLLISION_OR_ROUTE_PERMISSION');
  assert.equal(result.counts.roadbeds.features,81);
  assert.equal(result.counts.plazas.features,17);
  assert.equal(result.counts.sidewalks.features,54);
  assert.match(result.terms,/Terms-of-Use/);
  assert.match(result.captureRules,/Capture_Rules/);
  assert.ok(result.loadMilliseconds>=0);
});

const ring=(x,y,size)=>[
  [x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]
];
const feature=(objectId,subtype,polygons)=>({
  objectId,sourceId:10000000000+objectId,subtype,status:'Unchanged',polygons
});
const makeSurfaces=massing=>{
  const roadbeds=Array.from({length:70},(_,i)=>feature(
    i+1,i===0?350010:350000,
    [[ring(-120+(i%10)*12,-100+Math.floor(i/10)*12,5)]]
  ));
  const plazas=Array.from({length:10},(_,i)=>feature(
    i+1,600000,[i===0
      ?[ring(20,20,5),ring(21,21,1.5)]
      :[ring(20+(i%5)*8,35+Math.floor(i/5)*8,5)]]
  ));
  const sidewalks=Array.from({length:40},(_,i)=>feature(
    i+1,i===0?380010:380000,
    [i===0
      ?[ring(-80,45,5),ring(-79,46,1)]
      :[ring(-80+(i%8)*8,55+Math.floor(i/8)*8,5)]]
  ));
  return {
    schema:'patrol-nyc-oti-surfaces-2022-runtime-v1',
    role:'VISUAL_SOURCE_ONLY_NOT_COLLISION_OR_ROUTE_PERMISSION',
    imageryYear:2022,origin:{...massing.origin},
    sources:{
      roadbeds:OTI_SURFACE_LAYERS.roadbeds.url,
      plazas:OTI_SURFACE_LAYERS.plazas.url,
      sidewalks:OTI_SURFACE_LAYERS.sidewalks.url
    },
    counts:{roadbeds:{features:70},plazas:{features:10},sidewalks:{features:40}},
    roadbeds,plazas,sidewalks
  };
};

test('full official surfaces triangulate holes, suppress guessed road bands and face upward',async()=>{
  const footprints=JSON.parse(await (await import('node:fs/promises')).readFile(
    new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
  const roads=JSON.parse(await (await import('node:fs/promises')).readFile(
    new URL('../assets/nyc/nyc-dcm-centerlines-sample.json',import.meta.url),'utf8'));
  const massing=buildMeteredMassing(footprints);
  const surfaces=makeSurfaces(massing);
  const mesh=buildNeighborhoodMesh(massing,roads,{
    detail:false,officialSurfaces:surfaces
  });
  const c=mesh.counts;
  assert.equal(c.officialRoadbedPolygons,70);
  assert.equal(c.officialRoadbedIntersections,1);
  assert.equal(c.officialPlazaPolygons,10);
  assert.equal(c.officialSidewalkPolygons,40);
  assert.equal(c.officialSurfaceFeatures,120);
  assert.equal(c.officialSurfaceHoles,2);
  assert.equal(c.illustrativeRoadBandSegments,0);
  assert.equal(c.officialSurfaceTriangles,252);
  assert.ok(Math.abs(c.officialSurfaceAreaSquareMetres-2996.75)<.02);
  assert.ok(c.officialSurfaceMaxAreaError<1e-8);
  assert.equal(mesh.interleaved.length,c.triangles*3*MESH_STRIDE);
  assert.ok(mesh.interleaved.every(Number.isFinite));
  const firstSurfaceVertex=mesh.interleaved.length-
    c.officialSurfaceTriangles*3*MESH_STRIDE;
  for(let i=firstSurfaceVertex;i<mesh.interleaved.length;i+=MESH_STRIDE)
    assert.ok(mesh.interleaved[i+4]>.99,'all OTI pavement/plaza/sidewalk faces must point up');
  assert.match(mesh.caveat,/bounded 2022 OTI roadbed\/plaza\/sidewalk/);
});

test('full source geometry rejects a mismatched local WGS84 origin',async()=>{
  const fs=await import('node:fs/promises');
  const footprints=JSON.parse(await fs.readFile(
    new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
  const roads=JSON.parse(await fs.readFile(
    new URL('../assets/nyc/nyc-dcm-centerlines-sample.json',import.meta.url),'utf8'));
  const massing=buildMeteredMassing(footprints);
  const surfaces=makeSurfaces(massing);
  surfaces.origin.lat+=.0001;
  assert.throws(()=>buildNeighborhoodMesh(massing,roads,{
    detail:false,officialSurfaces:surfaces
  }),/incompatible local metre origin/);
});
