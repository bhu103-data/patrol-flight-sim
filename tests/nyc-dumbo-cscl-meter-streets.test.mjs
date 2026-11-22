// Source-exact, not procedural Manhattan/DUMBO road geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const path=p=>new URL('../'+p,import.meta.url);
const mod=async p=>import('data:text/javascript;base64,'+
  Buffer.from(readFileSync(path(p),'utf8')).toString('base64'));
const {makeDumboMetreFrame}=await mod('assets/nyc/dumbo-true-scale-geodesy.js');
const {clipCsclSegment,makeCsclRibbon,prepareDumboCsclStreetNetwork}=
  await mod('assets/nyc/dumbo-cscl-true-metre.js');
const snapshot=JSON.parse(readFileSync(path('assets/nyc/dumbo-cscl-official-snapshot.json'),'utf8'));
const buildings=JSON.parse(readFileSync(path('assets/nyc/dumbo-oti-true-scale-source.json'),'utf8'));
const frame=makeDumboMetreFrame(buildings.origin);
const roads=prepareDumboCsclStreetNetwork(snapshot,frame);
const crossY=(a,b,c)=>(b[2]-a[2])*(c[0]-a[0])-
  (b[0]-a[0])*(c[2]-a[2]);

test('2026 NYC OTI road snapshot is the exact inspected 404-feature CSCL source',()=>{
  assert.equal(snapshot.dataset,'inkn-q76z');
  assert.equal(snapshot.crs,'EPSG:4326');
  assert.equal(snapshot.role,'OFFICIAL_STREET_CENTERLINE_SOURCE_NOT_CURB_WIDTH_SURVEY');
  assert.equal(snapshot.acceptedRows,404);
  assert.equal(snapshot.records.length,404);
  assert.equal(snapshot.observedNames.length,55);
  const sha=createHash('sha256').update(JSON.stringify(snapshot.records)).digest('hex');
  assert.equal(sha,'21af6bf980db1605c7929207499d7d96066c2f71e7f8381c75036e033b5a0cb2');
  assert.deepEqual(snapshot.bbox,{west:-73.9945,south:40.6988,
    east:-73.9845,north:40.7048});
  assert.equal(new Set(snapshot.records.map(r=>r.physicalid)).size,404);
  assert.match(snapshot.canonicalDatasetUrl,/inkn-q76z/);
  assert.ok(snapshot.terms.includes('/Terms-of-Use/'));
});
test('only 213 at-level-13 street records become 295 actual bounded metre pieces',()=>{
  assert.equal(roads.sourceCount,404);
  assert.equal(roads.acceptedSourceRecordCount,213);
  assert.equal(roads.excludedSourceRecordCount,191);
  assert.equal(roads.segmentCount,295);
  assert.equal(roads.names.length,34);
  assert.ok(roads.names.includes('WATER ST'));
  assert.ok(roads.names.includes('WASHINGTON ST'));
  assert.ok(roads.names.includes('FRONT ST'));
  assert.ok(roads.names.includes('PLYMOUTH ST'));
  assert.ok(roads.names.includes('BRIDGE ST'),
    'Street named BRIDGE ST is NOT the Manhattan Bridge deck');
  assert.ok(!roads.names.includes('MANHATTAN BRG')&&
    !roads.names.includes('BROOKLYN BRG')&&
    !roads.names.includes('BROOKLYN QUEENS EXPY'),
    'bridge and expressway deck geometry lacks verified elevation in this 2D dataset');
  for(const rec of roads.diagnostics.excluded){
    assert.ok(rec.roadwayType!==1&&rec.roadwayType!==2||
      rec.levelCodes[0]!=='13'||rec.levelCodes[1]!=='13',
      'a forbidden bridge/highway record must not be mixed into y=0 streets');
  }
  const totalLength=roads.groundCenterlines.reduce((s,r)=>s+r.lengthMetres,0);
  assert.ok(totalLength>9800&&totalLength<10500,
    'actual 10km of source road polyline segments, not an invented grid');
});
test('every original WGS84 road segment stays in source bbox and projects in metres',()=>{
  const b=snapshot.bbox,eps=1e-9;
  for(const e of roads.groundCenterlines){
    assert.ok(e.lengthMetres>.01&&e.lengthMetres<500);
    assert.equal(e.sourceLevelCode,'13');
    assert.ok(e.roadwayType===1||e.roadwayType===2);
    assert.ok(Number.isSafeInteger(e.physicalid));
    assert.equal(e.wgs84.length,2);
    for(let i=0;i<2;i++){
      const [lon,lat]=e.wgs84[i];
      assert.ok(lon>=b.west-eps&&lon<=b.east+eps&&
        lat>=b.south-eps&&lat<=b.north+eps);
      const p=frame.project(lon,lat,0),s=e.metres[i];
      assert.ok(Math.hypot(...p.map((v,k)=>v-s[k]))<1e-6);
    }
  }
  const c=clipCsclSegment([-73.997,40.703],[-73.983,40.703],b);
  assert.equal(c?.[0][0],b.west);
  assert.equal(c?.[1][0],b.east);
  assert.equal(clipCsclSegment([-73.998,40.706],[-73.997,40.707],b),null);
});
test('all 590 road-guide triangles face upward; width remains symbolic not false road pavement',()=>{
  let triangles=0;
  for(const record of roads.groundCenterlines){
    const tris=makeCsclRibbon(record.metres,1.8);
    assert.equal(tris.length,2);
    for(const t of tris){
      assert.ok(crossY(...t)>0,'floor ribbon triangle must face +Y');
      assert.ok(t.every(p=>Math.abs(p[1]-.08)<1e-6));
      triangles++;
    }
  }
  assert.equal(triangles,590);
  assert.throws(()=>makeCsclRibbon(roads.groundCenterlines[0].metres,7),
    /symbolic/);
});
test('actual road positions share the official DUMBO building WGS84 metre frame',()=>{
  const centroids=buildings.buildings.map(r=>{
    const pts=r.ring.map(([lon,lat])=>frame.project(lon,lat));
    return [
      pts.reduce((s,p)=>s+p[0],0)/pts.length,
      pts.reduce((s,p)=>s+p[2],0)/pts.length
    ];
  });
  function distSegment(p,a,b){
    const x=b[0]-a[0],z=b[2]-a[2],
      t=Math.max(0,Math.min(1,
        ((p[0]-a[0])*x+(p[1]-a[2])*z)/(x*x+z*z)));
    return Math.hypot(p[0]-(a[0]+t*x),p[1]-(a[2]+t*z));
  }
  for(const p of centroids){
    const nearest=Math.min(...roads.groundCenterlines.map(r=>
      distSegment(p,...r.metres)));
    assert.ok(nearest>1&&nearest<120,
      'real city streets must be geographically near official footprints');
  }
  const source=readFileSync(path('nyc-dumbo-true-scale.html'),'utf8');
  assert.match(source,/prepareDumboCsclStreetNetwork\(csclSource,scene.frame\)/);
  assert.match(source,/assets\/nyc\/dumbo-cscl-official-snapshot\.json/);
  assert.doesNotMatch(source,/streetWidthSourceFeet\s*\*\s*0\.3048/);
});
