import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const data=JSON.parse(read('assets/nyc/manhattan-footprints-v1.json'));
const landmarks=new Function(html.slice(html.indexOf('  const NEW_YORK_LANDMARKS ='),
  html.indexOf('  const EAST_RIVER_BRIDGE ='))+'return NEW_YORK_LANDMARKS;')();
const generate=new Function(html.slice(html.indexOf('  function* generateTerrain(options) {'),
  html.indexOf('  const workerSrc ='))+'return generateTerrain;')();

test('dense Manhattan building data reaches the terrain worker without reserving a city-sized landmark',()=>{
  assert.equal(data.sourceCount,45195);
  assert.ok(data.footprints.length>40000);
  assert.ok(landmarks.every(mark=>mark.w<40&&mark.d<40));
  const city={tilt:.24,offset:30,blockWidth:24,blockLength:33,
    parkCenter:206,parkHalfLength:151,parkHalfWidth:43,parkWaters:[],
    landmarks,streets:[],timesSquareBounds:[-34,56,-52,68],
    railway:{west:250,east:400,z:-342,radius:4},
    runway:{x:354,z:-389,halfLength:40,halfWidth:8},
    manhattanFootprints:[...data.footprints].sort((a,b)=>b[5]-a[5]||a[0]-b[0])};
  let result;
  for(const msg of generate({size:96,span:1920,scale:54,water:12.2,
    city,landmarks}))if(msg?.type==='done')result=msg;
  const real=result.parcels.filter(lot=>lot[9]==='manhattan-survey');
  for(const [lo,hi] of [[-525,-245],[-245,55],[55,365],[365,665]])
    assert.ok(real.filter(lot=>lot[1]>=lo&&lot[1]<hi).length>=350);
  for(const lot of real){
    assert.ok(lot[7].every(([x,z])=>Math.abs(x-z*.24-30)>=44||Math.abs(z-206)>=152));
  }
});

test('CityGML East River parcels retain individual polygons and keep the bridge and runway clear',()=>{
  const bank=JSON.parse(read('assets/nyc/east-bank-footprints-v2.json'));
  assert.equal(bank.schema,'patrol-east-bank-footprints-v2');
  assert.equal(bank.sourceCount,1082015);
  assert.ok(bank.footprints.length>6000);
  const runway={x:354,z:-389,halfLength:40,halfWidth:8};
  const city={tilt:.24,offset:30,blockWidth:24,blockLength:33,
    parkCenter:206,parkHalfLength:151,parkHalfWidth:43,parkWaters:[],
    landmarks,streets:[],timesSquareBounds:[-34,56,-52,68],
    railway:{west:250,east:400,z:-342,radius:4},
    runway,eastBankFootprints:bank.footprints.sort((a,b)=>b[5]-a[5]||a[0]-b[0])};
  let result;
  for(const msg of generate({size:96,span:1920,scale:54,water:12.2,
    city,landmarks}))if(msg?.type==='done')result=msg;
  const real=result.parcels.filter(lot=>lot[9]==='east-bank-survey');
  assert.ok(real.filter(lot=>lot[10]===3).length>500);
  assert.ok(real.filter(lot=>lot[10]===4).length>100);
  const bronx=real.filter(lot=>lot[10]===2);
  assert.ok(bronx.length>250);
  assert.ok(bronx.every(([x,z])=>z>460&&Math.hypot(x,z)<745));
  assert.match(html,/South Bronx · Aerial/);
  let contacts=0, openWater=0;
  for(let i=0;i<result.ground.length;i++){
    const contact=result.packed[i*4+2];
    if(contact>0)contacts++;
    if(result.ground[i]<=12.2/54){assert.equal(contact,0);openWater++;}
  }
  assert.ok(contacts>250&&openWater>250,'contact shading must be on land, not water');
  for(const [x,z,w,d,h,,,outline] of real){
    assert.ok(outline.length>=3&&h>0);
    assert.ok(x>=255+w/2||Math.abs(z+342)>=6+d/2);
    assert.ok(Math.abs(x-runway.x)>=runway.halfLength+w/2+5||
              Math.abs(z-runway.z)>=runway.halfWidth+d/2+5);
  }
});
