// Regression: the real NYC road renderer must emit BUS pavement decals without
// referencing the bikeIcon() helper's local cross vector.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
const {buildNycStreetNetwork}=await import(
  'data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('NYC bus lane produces finite decals through public pavementText callback',()=>{
  const labels=[];
  const stats=buildNycStreetNetwork({
    addQuad(){},addTri(){},box(){},beam(){},ribbon(){},
    terrainAt:()=>100,detailBand:()=>3,
    grid:{blockWidth:24,blockLength:33,tilt:.24,offset:30,
      parkHalfWidth:43,parkHalfLength:150,parkCenter:10000},
    streetY:20,waterY:0,timesBounds:[900,1000,900,1000],
    existingStreets:[],isClear:()=>true,lettering(){},
    pavementText(word,point,width,height,color){
      labels.push({word,point,width,height,color});
    }
  });
  assert.ok(stats.busLaneSegments>0,'NYC bus-only corridors should be generated');
  assert.ok(labels.length>0,'BUS lane labels must reach the real render callback');
  assert.ok(labels.every(l=>l.word==='BUS'&&
    l.point.length===3&&l.point.every(Number.isFinite)&&
    Number.isFinite(l.width)&&Number.isFinite(l.height)),
    'all BUS decals have valid finite positions and sizes');
});
