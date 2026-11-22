import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildOfficialStreetWidthEnvelopes} from '../tools/nyc/true-scale-street-envelope.mjs';

test('right-of-way polygons honor actual official DCM Streetwidth, not invented lanes',()=>{
  const sample={roads:[
    {objectId:7,streetName:'West 42 Street',featureStatus:'City_St',
      buildStatus:'Improved',paperStreet:'N',streetWidthFeet:100,
      lines:[[[0,0],[0,20]]]},
    {objectId:8,streetName:'No official width',featureStatus:'City_St',
      buildStatus:'Improved',paperStreet:'N',streetWidthFeet:null,
      lines:[[[30,0],[30,20]]]},
    {objectId:9,featureStatus:'Way_on_record',buildStatus:'Improved',
      paperStreet:'N',streetWidthFeet:60,lines:[[[50,0],[50,20]]]},
    {objectId:10,featureStatus:'City_St',buildStatus:'Improved',
      paperStreet:'Y',streetWidthFeet:60,lines:[[[70,0],[70,20]]]}
  ]};
  const result=buildOfficialStreetWidthEnvelopes(sample);
  assert.equal(result.stats.derivedWidthFeatures,1);
  assert.equal(result.stats.missingWidthRecords,1);
  assert.equal(result.stats.excludedNoncityRecords,2);
  assert.equal(result.stats.triangles,2);
  assert.equal(result.positions.length,18);
  assert.equal(result.colors.length,18);
  assert.equal(result.normals.length,18);
  const A=[result.positions[0],result.positions[2]];
  const B=[result.positions[3],result.positions[5]];
  assert.ok(Math.abs(Math.hypot(A[0]-B[0],A[1]-B[1])-30.48)<1e-8,
    'exact source 100ft becomes 30.48 metres, not a guessed asphalt curb');
  assert.match(result.stats.role,/NOT surveyed paved roadbed/);
});

test('unknown street widths cause omission; lines and buildings remain source-owned',()=>{
  const source={roads:[{objectId:4,featureStatus:'City_St',
    paperStreet:'N',buildStatus:'Improved',streetWidthFeet:null,
    lines:[[[0,0],[100,0]]]}]};
  const result=buildOfficialStreetWidthEnvelopes(source);
  assert.equal(result.positions.length,0);
  assert.equal(result.stats.missingWidthRecords,1);
  assert.throws(()=>buildOfficialStreetWidthEnvelopes({}),/NYC DCM/);
});

test('source-width visual envelope shares true-metre low-fly WebGL but not default game',async()=>{
  const preview=await readFile(new URL('../tools/nyc/true-scale-preview.html',import.meta.url),'utf8');
  const workflow=await readFile(new URL('../.github/workflows/nyc-times-true-scale-flight.yml',import.meta.url),'utf8');
  const game=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(preview,/buildOfficialStreetWidthEnvelopes\(source\)/);
  assert.match(preview,/gl\.drawArrays\(gl\.TRIANGLES,0,pavement\.count\)/);
  assert.doesNotMatch(preview,/gl\.drawArrays\(gl\.TRIANGLES,0,rowSurface\.count\)/);
  assert.match(preview,/streetWidthEnvelopes:envelopes\.stats/);
  assert.match(preview,/官方 OTI 2022 道路面/);
  assert.match(workflow,/cp tools\/nyc\/true-scale-street-envelope\.mjs artifacts\/nyc-true-scale\/street-envelope\.mjs/);
  assert.ok(!game.includes('street-envelope.mjs'),'no false ROW overlays on existing game');
});
