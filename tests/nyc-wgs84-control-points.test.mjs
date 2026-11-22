import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  TIMES_SQUARE_ORIGIN,wgs84ToMeters,metersToWgs84
} from '../assets/nyc/times-square-metered-massing.mjs';

const dataset=JSON.parse(await readFile(
  new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));

// Independent WGS84 ellipsoidal inverse-geodesic reference values
// (east/north = distance projected by initial azimuth), precomputed with
// GeographicLib WGS84. These are municipal footprint vertices, not camera
// photo-control points or survey monuments.
const controls=[
  {fid:22922,point:[-73.987839,40.759262],
    enu:[-114.05386843472101,167.90733298357256]},
  {fid:212747,point:[-73.986702,40.758299],
    enu:[-18.045208717743716,60.96605122940396]},
  {fid:384606,point:[-73.984607,40.757478],
    enu:[158.86227804544126,-30.20368665600265]}
];

test('three official NYC FID vertices agree with independent WGS84 geodesics',()=>{
  assert.equal(dataset.coordinateSystem,'WGS84 lon,lat; heights HEIGHTROOF in feet');
  for(const c of controls){
    const feature=dataset.features.find(f=>f.fid===c.fid);
    assert.ok(feature, 'missing official footprint FID '+c.fid);
    assert.ok(feature.rings.some(r=>r.some(p=>
      p[0]===c.point[0]&&p[1]===c.point[1])),
      'control coordinate is not an exact vertex of source FID '+c.fid);
    const actual=wgs84ToMeters(c.point,TIMES_SQUARE_ORIGIN);
    const residual=Math.hypot(actual[0]-c.enu[0],actual[1]-c.enu[1]);
    // Local tangent approximation is millimetre-accurate across this tile;
    // source coordinate rounding (~1e-6 degree) is a separate larger limit.
    assert.ok(residual<.004,
      'WGS84 ENU transform residual for FID '+c.fid+': '+residual+'m');
    const roundTrip=metersToWgs84(actual,TIMES_SQUARE_ORIGIN);
    assert.ok(Math.abs(roundTrip[0]-c.point[0])<1e-10);
    assert.ok(Math.abs(roundTrip[1]-c.point[1])<1e-10);
  }
});

test('the three transform checks are not mislabeled as surveyed camera GCPs',async()=>{
  const docs=await readFile(new URL('../docs/NYC_TRUE_SCALE_FLYTHROUGH_20261122.md',import.meta.url),'utf8');
  assert.ok(docs.includes('surveyed ground-control points'));
  assert.ok(docs.includes('source vertices themselves are rounded to 1e-6 degree'));
  assert.ok(docs.includes('absolute altitude remains null'));
});
