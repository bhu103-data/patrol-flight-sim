// Production NYC traffic vs Brooklyn Bridge waterline regression.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function sourceOf(name){
 const at=html.indexOf('  function '+name+'(');
 assert.ok(at>=0,'missing '+name);
 const begin=html.indexOf('{',at);
 let depth=0,close=-1;
 for(let i=begin;i<html.length;i++){
  if(html[i]==='{')depth++;
  else if(html[i]==='}'&&--depth===0){close=i+1;break;}
 }
 assert.ok(close>begin);
 return html.slice(at,close);
}
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const bridge={x:82,z:-342,halfLength:109,deck:24,halfWidth:4.2,ramp:62};
const bridgeRoadHeight=new Function(
 'EAST_RIVER_BRIDGE','clamp','lerp','STREET_Y',
 'return ('+sourceOf('bridgeRoadHeight')+')')(bridge,clamp,lerp,14.86);
const trafficPose=new Function('lerp','VEGAS_FAST_LANE','sampleTerrainHeight',
 'STREET_Y','WATER_H','bridgeRoadHeight','return ('+sourceOf('trafficPose')+')')(
 lerp,1.2,()=>12.2,14.86,12.2,bridgeRoadHeight);
function roadwayActor(bridgeFlag){
 return {kind:'suv',bridge:bridgeFlag,route:{
  points:[[-89,-342],[253,-342]],lengths:[0,342],total:342},
  offset:171,pace:0};
}
test('bridge lane height is elevated for every car style, not only taxis',()=>{
 const car=trafficPose(roadwayActor(true),0);
 assert.ok(car.x>80&&car.x<84);
 assert.ok(car.y>24.5&&car.y<24.8,'cars drive on Brooklyn Bridge deck');
 assert.equal(trafficPose(roadwayActor(false),0).y,14.93,
  'missing bridge flag previously drew SUV down near waterline');
 const builder=sourceOf('prepareCityTraffic');
 assert.match(builder,/\['sedan','suv','sedan','van','suv'\]\[j\]/);
 assert.match(builder,/offset:23\+j\*route\.total\/5\.9\+i\*15,pace:5\.2\+\(j%3\)\*\.55,bridge:i===0/);
});
test('actual city renderer suppresses ordinary cars over water but preserves elevated bridge and expressway',()=>{
 const vehicles=[
  {kind:'taxi',pose:{x:100,y:14.93,z:-330,yaw:0}}, // wet ordinary street
  {kind:'suv',bridge:true,pose:{x:82,y:24.65,z:-342,yaw:1.57}},
  {kind:'sedan',pose:{x:150,y:14.93,z:-50,yaw:0}}, // dry downtown
  {kind:'van',expressway:true,pose:{x:180,y:22,z:-310,yaw:1.57}}
 ];
 const identities={taxi:'wet ordinary car',suv:'Brooklyn Bridge SUV',
  sedan:'dry downtown car',van:'elevated expressway van'};
 const mesh=Object.fromEntries(Object.entries(identities).map(([kind,id])=>[kind,{id}]));
 const drawn=[];
 const render=new Function(
  'selectedMap','bridgeRails','cityTraffic','mat4FromBasis','camPos',
  'railPose','sceneryTime','streetMeshes','nycDetailBand','trafficPose',
  'drawStreetWalker','worldUp','wreckedTaxiMesh','taxiLamps',
  'sampleTerrainHeight','WATER_H',
  'return ('+sourceOf('drawCityTraffic')+')')(
  {city:true},null,vehicles,(p)=>p,[0,0,0],()=>null,0,mesh,
  ()=>3,actor=>actor.pose,()=>{},[0,1,0],null,null,
  (x,z)=>z<-200?12.2:30,12.2);
 render((id)=>drawn.push(id.id));
 assert.deepEqual(drawn,['Brooklyn Bridge SUV','dry downtown car',
  'elevated expressway van']);
});
