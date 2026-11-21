import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const payload=JSON.parse(readFileSync(new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const bytes=Buffer.from(payload.heightsBase64,'base64');
const scale=Math.min(.04,(75*.9-12.2)/payload.maxElevationMeters);

function terrain(x,z){
  const cx=Math.max(0,Math.min(255,(z/1920+.5)*256-.5));
  const rz=Math.max(0,Math.min(255,(1-(x/1920+.5))*256-.5));
  const xi=Math.floor(cx),zi=Math.floor(rz),tx=cx-xi,tz=rz-zi;
  const sample=(a,b)=>bytes.readUInt16LE((b*256+a)*2);
  const x2=Math.min(xi+1,255),z2=Math.min(zi+1,255);
  const meters=(sample(xi,zi)*(1-tx)+sample(x2,zi)*tx)*(1-tz)+
    (sample(xi,z2)*(1-tx)+sample(x2,z2)*tx)*tz;
  return 12.2+meters*scale;
}
const alaska={alaska:true,city:false,spawn:[-19,33,-667]};
const waterStart=html.indexOf('  function usableFloatWater(');
const runwayStart=html.indexOf('  function findFloatWaterStart()',waterStart);
const end=html.indexOf('  let gearDown = false;',runwayStart);
assert.ok(waterStart>0&&runwayStart>waterStart&&end>runwayStart);
const water=new Function('plane','WATER_H','sampleTerrainHeight','cityLotAt',
  'sceneryObstacle','selectedMap','alaskaObstacles',
  html.slice(waterStart,runwayStart)+'return usableFloatWater;')(
    {yaw:0},12.2,terrain,()=>false,()=>false,alaska,[]);
const find=new Function('selectedMap','NYC_FLIGHT_RADIUS','FLIGHT_RADIUS','WARNING_DISTANCE',
  'usableFloatWater','boats','sceneryPose','sceneryTime',
  html.slice(runwayStart,end)+'return findFloatWaterStart;')(
    alaska,735,860,130,water,[],()=>[0,0,0],0);

test('real USGS Alaska spawn faces a shoreline too near for a safe takeoff',()=>{
  assert.ok(water(-19,-667,0),'starting floats are over water');
  assert.ok(!water(-19,-631,0),
    'north at 36 units is already a shallow surveyed bank, not a runway');
});

test('same global launch point chooses a 132-unit unobstructed water corridor outside boundary assist',()=>{
  const [x,z,yaw]=find();
  assert.ok(Math.hypot(x+19,z+667)<1,
    'keep the historic spawn location when changing its heading is enough');
  assert.ok(Math.abs(yaw-Math.PI/2)<1e-4,
    'initial eastbound fjord channel is long enough; avoid northbound shoreline');
  for(let d=0;d<=132;d+=6){
    const px=x+Math.sin(yaw)*d,pz=z+Math.cos(yaw)*d;
    assert.ok(water(px,pz,yaw),'float runway at advance '+d+' must stay open');
    assert.ok(Math.hypot(px,pz)<=860-130-8,
      'avoid autopilot boundary assist during water takeoff');
  }
});
