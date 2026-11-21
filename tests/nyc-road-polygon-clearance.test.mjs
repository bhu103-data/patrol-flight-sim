// Regression: NYC road avoidance uses real municipal outlines without crossing roads.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const snapshot=JSON.parse(readFileSync(new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
function extract(from,to){
  const a=html.indexOf(from),b=html.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,'missing game road source: '+from);
  return html.slice(a,b);
}
const streets=new Function(extract('const CITY_STREETS = ','const CENTRAL_PARK_WATERS')+'return CITY_STREETS;')();
const express=new Function(extract('const CITY_EXPRESSWAY=','const VEGAS_EXPRESSWAY=')+'return CITY_EXPRESSWAY;')();
const inside=new Function(extract('  function insideCityFootprint(','  function nycParcelCrossesRoad(')+'return insideCityFootprint;')();
const production=extract('  function nycParcelCrossesRoad(','  function setupCityLots(');
const evaluate=(roads=streets,highways=express)=>
  new Function('CITY_STREETS','CITY_EXPRESSWAY','insideCityFootprint',
    production+'return nycParcelCrossesRoad;')(roads,highways,inside);
const lot=row=>[row[1],row[2],row[3],row[4],row[5],0,false,row[6],row[0]];

test('surveyed NYC polygons retain actual clear buildings near road bends',()=>{
  const policy=evaluate();
  const recovered=snapshot.footprints.find(row=>row[0]===579632);
  assert.ok(recovered);
  assert.equal(policy(lot(recovered)),false,'surveyed outline clears roads');
  const blocked=snapshot.footprints.filter(row=>policy(lot(row))).map(row=>row[0]);
  assert.equal(blocked.length,6,'six municipal buildings truly conflict with roads');
});
test('5.85 m setback and through-polygon road crossing remain protected',()=>{
  const policy=evaluate([[[0,0],[100,0]]],{points:[],ramp:[]});
  const shape=poly=>[45,8,20,20,8,0,false,poly];
  assert.equal(policy(shape([[38,8],[50,8],[44,16]])),false);
  assert.equal(policy(shape([[38,5.7],[50,5.7],[44,16]])),true);
  assert.equal(policy(shape([[38,6.2],[50,6.2],[44,16]])),false);
  assert.equal(policy(shape([[45,-2],[55,-2],[55,2],[45,2]])),true,
    'road crosses through polygon despite endpoints being outside');
});
test('procedural and malformed GIS parcels retain conservative fallback',()=>{
  const policy=evaluate([[[0,0],[100,0]]],{points:[],ramp:[]});
  assert.equal(policy([50,0,10,10]),true);
  assert.equal(policy([50,20,10,10]),false);
  assert.equal(policy([50,0,10,10,8,0,false,[[1,2]]]),true);
});