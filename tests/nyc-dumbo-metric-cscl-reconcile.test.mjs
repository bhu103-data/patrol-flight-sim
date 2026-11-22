// Cross-year, cross-dataset *source-disagreement* gate, not a real street scan.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {toLocalMeters} from '../assets/nyc/dumbo-oti-metric.mjs';
import {reconcileMetricStreets,lineCutsBuilding,sourceLineRibbon}
  from '../assets/nyc/dumbo-cscl-metric-reconcile.mjs';

const json=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const source=json('../assets/nyc/dumbo-cscl-official-snapshot.json');
const buildings=json('../assets/nyc/dumbo-oti-metric-48.json');
const network=reconcileMetricStreets(source,buildings);

test('the 404 official CSCL rows are exactly #266 pinned source and never regenerated',()=>{
  assert.equal(source.dataset,'inkn-q76z');
  assert.equal(source.role,'OFFICIAL_STREET_CENTERLINE_SOURCE_NOT_CURB_WIDTH_SURVEY');
  assert.equal(source.acceptedRows,404);
  assert.equal(source.records.length,404);
  const hash=createHash('sha256').update(JSON.stringify(source.records)).digest('hex');
  assert.equal(hash,'21af6bf980db1605c7929207499d7d96066c2f71e7f8381c75036e033b5a0cb2');
  assert.ok(source.extractionDateUTC);
  assert.equal(new Set(source.records.map(r=>r.physicalid)).size,404);
});

test('source-filtered DUMBO CSCL ground lines use same coordinates as 48 OTI roofs',()=>{
  assert.equal(network.sourceCount,404);
  assert.equal(network.groundRecords,213);
  assert.equal(network.excludedRecords,191);
  assert.equal(network.segmentCount,295);
  assert.equal(network.streetNames.length,34);
  assert.ok(network.networkLengthMetres>8000&&network.networkLengthMetres<12000);
  for(const line of network.lines){
    assert.equal(line.sourceLevelCode,'13');
    assert.ok(line.points.every(p=>p.length===2&&p.every(Number.isFinite)));
    assert.ok(line.wgs84.every((p,i)=>{
      const projected=toLocalMeters(...p),actual=line.points[i];
      return actual.every((n,k)=>Math.abs(projected[k]-n)<1e-9);
    }));
    assert.equal(sourceLineRibbon(line.points).length,2);
  }
});

test('four real CSCL/OTI footprint conflicts stay visible, NEVER source-shifted',()=>{
  const normalized=network.conflicts.flatMap(c=>
    c.buildingFids.map(fid=>[c.physicalid,c.name,fid]))
    .sort((a,b)=>a[0]-b[0]);
  assert.deepEqual(normalized,[
    [57818,'PEARL ST',64281],
    [57819,'PEARL ST',64279],
    [57893,'PROSPECT ST',64278],
    [57894,'PROSPECT ST',64280]
  ],'New or removed discrepancies require a source/date review');
  assert.equal(network.lines.filter(l=>l.conflictFids.length).length,4);
  assert.match(network.limitations,/not pavement\/curb widths/);
});

test('segment/polygon audit rejects interior crossing, not a distant parallel',()=>{
  const square=[[0,0],[10,0],[10,10],[0,10]];
  assert.equal(lineCutsBuilding([[-2,5],[12,5]],square),true);
  assert.equal(lineCutsBuilding([[1,1],[2,2]],square),true);
  assert.equal(lineCutsBuilding([[-2,-2],[-1,-1]],square),false);
  assert.equal(lineCutsBuilding([[11,0],[11,10]],square),false);
  assert.throws(()=>sourceLineRibbon([[0,0],[1,0]],4),/Invalid/);
  assert.throws(()=>reconcileMetricStreets({...source,acceptedRows:403},buildings),/pinned/);
});

test('live flight map remains untouched; CSCL, 2022 roadbed and 48 OTI roofs only in opt-in preview',()=>{
  const text=p=>readFileSync(new URL(p,import.meta.url),'utf8');
  const preview=text('../tools/nyc/dumbo-metric-preview.html');
  const flight=text('../index.html');
  assert.match(preview,/reconcileMetricStreets/);
  assert.match(preview,/dumbo-cscl-official-snapshot\.json/);
  assert.match(preview,/2022 pavement/);
  assert.match(preview,/CSCL/);
  assert.doesNotMatch(flight,/dumbo-cscl-official-snapshot\.json/);
  assert.doesNotMatch(preview,/advanceFlight\(|PatrolSpaceBridge/);
});
