// Actual official 2022 pavement triangle overlay, not a guessed DUMBO street grid.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {toLocalMeters,prepareDistrict} from '../assets/nyc/dumbo-oti-metric.mjs';
import {prepareOfficialDumboRoadbed,sourceRoadToWgs84,
  sourceRoadToDistrictMeters,ROADBED_SOURCE} from '../assets/nyc/dumbo-roadbed-metric.mjs';

const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const road=read('../assets/nyc/dumbo-front-dock-roadbed-2022.json');
const buildings=read('../assets/nyc/dumbo-oti-metric-48.json');
const pilot=prepareOfficialDumboRoadbed(road);
const near=(a,b,eps=1e-8)=>Math.abs(a-b)<eps;

test('reuse EXACT official OTI roadbed 2022 source, not invented lane centerlines',()=>{
  assert.equal(road.schema,'patrol-nyc-dumbo-front-dock-oti-roadbed-2022-v1');
  assert.equal(road.source,ROADBED_SOURCE);
  assert.equal(road.year,2022);
  assert.equal(road.triangles.length,577);
  assert.equal(pilot.stats.sourceTriangles,577);
  assert.equal(pilot.stats.renderedTriangles,553);
  assert.equal(pilot.stats.skippedDegenerate,24,
    '0.001 m rounding by the upstream source exporter collapses 24 microtriangles');
  assert.equal(pilot.stats.featureIds,8);
  assert.ok(Math.abs(pilot.stats.originalAreaM2-3714.73)<.25);
  assert.ok(pilot.stats.discardedAreaM2<1e-7);
  assert.equal(pilot.stats.unit,'metres');
  assert.match(pilot.stats.note,/no lane directions/);
});

test('all road triangles share the SAME WGS84 to local-metre frame as 48 buildings',()=>{
  assert.equal(buildings.features.length,48);
  const origin=[road.origin.lon,road.origin.lat];
  const check=sourceRoadToWgs84([0,0],road.origin);
  assert.ok(check.every((v,i)=>near(v,origin[i],1e-11)));
  for(const point of [[110.771,17.333],[0,0],[-35,-23],[190,23]]){
    const geo=sourceRoadToWgs84(point,road.origin);
    const m=sourceRoadToDistrictMeters(point,road.origin);
    const reference=toLocalMeters(...geo);
    assert.ok(m.every((v,i)=>near(v,reference[i],1e-9)));
  }
  const xs=pilot.triangles.flatMap(t=>t.points.map(p=>p[0]));
  const zs=pilot.triangles.flatMap(t=>t.points.map(p=>p[1]));
  assert.ok(Math.max(...xs)-Math.min(...xs)>150);
  assert.ok(Math.max(...zs)-Math.min(...zs)>15);
  const bpts=buildings.features.flatMap(f=>f.ring.map(p=>toLocalMeters(...p)));
  const minB=[Math.min(...bpts.map(p=>p[0])),Math.min(...bpts.map(p=>p[1]))];
  const maxB=[Math.max(...bpts.map(p=>p[0])),Math.max(...bpts.map(p=>p[1]))];
  assert.ok(Math.min(...xs)<maxB[0]&&Math.max(...xs)>minB[0]);
  assert.ok(Math.min(...zs)<maxB[1]&&Math.max(...zs)>minB[1],
    'limited Front/Dock source must overlap the 48-building AOI');
});

test('fail closed on wrong source year, feature codes, arbitrary clip or fabricated polygons',()=>{
  assert.throws(()=>prepareOfficialDumboRoadbed({...road,year:2026}),/Unexpected/);
  assert.throws(()=>prepareOfficialDumboRoadbed({...road,source:'other'}),/Unexpected/);
  assert.throws(()=>prepareOfficialDumboRoadbed({...road,origin:{lon:-73.989,lat:40.702}}),/Unexpected/);
  assert.throws(()=>prepareOfficialDumboRoadbed({...road,triangles:[{
    ...road.triangles[0],sub:123}]}),/Unexpected|Invalid/);
  const fake=structuredClone(road);
  fake.triangles[0].v[0]=[400,400];
  assert.throws(()=>prepareOfficialDumboRoadbed(fake),/exceeds official source clip/);
});

test('roadbed is 2022 paved footprint and only appears in opt-in staging',()=>{
  const preview=readFileSync(new URL('../tools/nyc/dumbo-metric-preview.html',import.meta.url),'utf8');
  assert.match(preview,/prepareOfficialDumboRoadbed/);
  assert.match(preview,/dumbo-front-dock-roadbed-2022\.json/);
  assert.match(preview,/2022 paved roadbed/i,
    'source preview must still label its original 2022 paved roadbed');
  assert.doesNotMatch(preview,/advanceFlight\(|PatrolSpaceBridge/);
  const original=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(original,/dumbo-front-dock-roadbed-2022\.json/);
});

const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const bounds=pts=>[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),
  Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];
const bboxOverlaps=(a,b)=>a[0]<=b[2]&&b[0]<=a[2]&&a[1]<=b[3]&&b[1]<=a[3];
function inPoly(p,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&
       p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])
      inside=!inside;
  }
  return inside;
}
const pointInTriangle=(p,[a,b,c])=>{
  const signs=[cross(a,b,p),cross(b,c,p),cross(c,a,p)];
  return !(signs.some(x=>x>1e-9)&&signs.some(x=>x< -1e-9));
};
const segmentsProperlyCross=(a,b,c,d)=>{
  const u=cross(a,b,c),v=cross(a,b,d),w=cross(c,d,a),x=cross(c,d,b);
  return (u>1e-9&&v< -1e-9||u< -1e-9&&v>1e-9)&&
    (w>1e-9&&x< -1e-9||w< -1e-9&&x>1e-9);
};
function roadCutsBuilding(tri,ring){
  if(!bboxOverlaps(bounds(tri),bounds(ring)))return false;
  if(tri.some(p=>inPoly(p,ring))||ring.some(p=>pointInTriangle(p,tri)))return true;
  for(let i=0;i<3;i++)for(let j=0;j<ring.length;j++)
    if(segmentsProperlyCross(tri[i],tri[(i+1)%3],ring[j],ring[(j+1)%ring.length]))
      return true;
  return false;
}

test('official 2022 street polygon triangles do not cut through any of the 48 source building footprints',()=>{
  const district=prepareDistrict(buildings),conflicts=[];
  for(const segment of pilot.triangles){
    for(const b of district)
      if(roadCutsBuilding(segment.points,b.ring)){
        conflicts.push({roadObjectId:segment.id,buildingFid:b.fid});
        break;
      }
  }
  assert.deepEqual(conflicts,[],
    'a georeferenced road footprint overlapping an official building requires source/year review, never artistic repositioning');
});
