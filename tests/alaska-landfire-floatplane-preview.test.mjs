// 1024² real terrain and original 25-point C185 water gate, opt-in A/B.
// No graphics changes, no NOAA coast polygon inference, no network request.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(
  new URL('../assets/alaska/landfire-evc-water-preview.json',import.meta.url),'utf8'));
const moduleSource=readFileSync(
  new URL('../assets/alaska/landfire-water-mask.js',import.meta.url),'utf8');
const {decodeLandfireWaterMask}=await import('data:text/javascript;base64,'+
  Buffer.from(moduleSource).toString('base64'));
const mask=decodeLandfireWaterMask(manifest);
const dem=JSON.parse(readFileSync(
  new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const bytes=Buffer.from(dem.heightsBase64,'base64'),heights=new Uint16Array(65536);
for(let i=0;i<65536;i++)heights[i]=bytes.readUInt16LE(i*2);
const waterY=12.2,scale=75,N=1024,SPAN=1920;
const verticalScale=Math.min(.04,(scale*.90-waterY)/dem.maxElevationMeters);

const start=html.indexOf('  function* generateTerrain(options) {');
const end=html.indexOf('\n  const workerSrc = ',start);
assert.ok(start>0 && end>start);
const generate=new Function('return ('+html.slice(start,end).trim()+')')();
function makeHeight(preview){
  const options={
    size:N,span:SPAN,scale,water:waterY,landmarks:[],alaska:true,
    airfield:null,city:null,vegas:null,dc:null,chongqing:null,preview:true,
    alaskaDEM:{width:256,height:256,heights,verticalScale},
    ...(preview?{alaskaWaterMask:mask}:{})
  };
  for(const msg of generate(options)){
    if(msg?.type==='preview'){
      // Match worker's exact RGBA8 CPU heightfield quantization.
      return Float32Array.from(msg.height,v=>Math.round(v*255)/255);
    }
  }
  throw Error('No production preview generated');
}
function makeGameSampling(field){
  function terrainAt(x,z){
    const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
    const lerp=(a,b,t)=>a+(b-a)*t;
    const fx=clamp((x/SPAN+.5)*N-.5,0,N-1);
    const fy=clamp((z/SPAN+.5)*N-.5,0,N-1);
    const ix=Math.floor(fx),iy=Math.floor(fy),ix1=Math.min(ix+1,N-1),
      iy1=Math.min(iy+1,N-1),tx=fx-ix,ty=fy-iy;
    const h=lerp(lerp(field[iy*N+ix],field[iy*N+ix1],tx),
      lerp(field[iy1*N+ix],field[iy1*N+ix1],tx),ty)*scale;
    return Math.max(h,waterY);
  }
  const waterStart=html.indexOf('  function usableFloatWater(');
  const runwayStart=html.indexOf('  function findFloatWaterStart()',waterStart);
  const runwayEnd=html.indexOf('  let gearDown = false;',runwayStart);
  assert.ok(waterStart>0 && runwayStart>waterStart && runwayEnd>runwayStart);
  const alaska={alaska:true,city:false,spawn:[-19,33,-667]};
  const usable=new Function('plane','WATER_H','sampleTerrainHeight','cityLotAt',
    'sceneryObstacle','selectedMap','alaskaObstacles','clearOfNycHeroDocks',
    html.slice(waterStart,runwayStart)+';return usableFloatWater;')(
      {yaw:0},waterY,terrainAt,()=>null,()=>null,alaska,[],()=>true);
  const locate=new Function('selectedMap','NYC_FLIGHT_RADIUS','FLIGHT_RADIUS',
    'WARNING_DISTANCE','usableFloatWater','boats','sceneryPose','sceneryTime',
    html.slice(runwayStart,runwayEnd)+';return findFloatWaterStart;')(
      alaska,735,860,130,usable,[],()=>[0,0,0],0);
  return {terrainAt,usable,locate};
}

test('actual LF2025 opt-in affects exactly the expected 1024² low-coast cells',()=>{
  const baseline=makeHeight(false),staging=makeHeight(true);
  assert.equal(baseline.length,1024*1024);
  assert.equal(staging.length,baseline.length);
  let changed=0,addedWet=0;
  for(let i=0;i<baseline.length;i++){
    if(staging[i]===baseline[i])continue;
    changed++;
    assert.ok(staging[i]<baseline[i],'the preview may only lower wet-class coastal terrain');
    if(baseline[i]*scale>waterY&&staging[i]*scale<=waterY)addedWet++;
  }
  assert.equal(changed,6428,'protect 660 low-coast pixels near C185 runway and authored harbor');
  assert.equal(addedWet,changed,'all changed samples become visibly submerged');
});

test('real C185 25-contact start runway and high glacier remain protected in preview',()=>{
  const old=makeGameSampling(makeHeight(false));
  const opt=makeGameSampling(makeHeight(true));
  const [ox,oz,oyaw]=old.locate(),[px,pz,pyaw]=opt.locate();
  assert.ok(Math.hypot(ox+19,oz+667)<1);
  assert.ok(Math.hypot(px+19,pz+667)<1);
  assert.ok(old.usable(ox,oz,oyaw));
  assert.ok(opt.usable(px,pz,pyaw));
  assert.ok(Math.abs(pyaw-Math.PI/2)<1e-3,'default safe eastern water takeoff remains clear');
  for(let d=0;d<=132;d+=6){
    const x=px+Math.sin(pyaw)*d,z=pz+Math.cos(pyaw)*d;
    assert.ok(opt.usable(x,z,pyaw),'no float pier/shore collision along 132-unit takeoff at '+d);
  }
  assert.ok(old.terrainAt(130,558)>waterY+5);
  assert.ok(Math.abs(old.terrainAt(130,558)-opt.terrainAt(130,558))<1e-6,
    'glacier must not be carved into the sea');
  assert.ok(!opt.usable(-19,-631,0),'known actual fjord bank must stay unlandable');
});
