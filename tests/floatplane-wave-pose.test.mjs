import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const html=source('../index.html');
const start=html.indexOf('  const oceanBands =');
const stop=html.indexOf('  const oceanVec4 =',start);
assert.ok(start>=0&&stop>start);
const pose=new Function(html.slice(start,stop)+'\nreturn floatOceanPose;')();
const water=12.2,abyss=()=>2;
test('ocean float pose follows both pontoons and changes on a stationary plane',()=>{
  const run=(t,map={})=>pose(88,-602,.44,t,map,water,abyss);
  const a=run(1),b=run(2),quiet=run(1,{alaska:true});
  assert.notEqual(a.height,b.height);
  assert.ok(Math.abs(a.pitch)>1e-5 && Math.abs(a.bank)>1e-5);
  assert.equal(a.height,(a.left+a.right)*.5);
  assert.ok(Math.abs(quiet.height-a.height*.3)<1e-9);
  assert.ok(Math.abs(Math.tan(quiet.bank)-Math.tan(a.bank)*.3)<1e-9);
  assert.deepEqual(run(1,{dc:true}),{height:0,left:0,right:0,pitch:0,bank:0});
  assert.equal(pose(88,-602,.44,1,{},water,()=>water-.05).height,0);
});
test('Chongqing river pose uses the rendered wave phase and preserves branch level',()=>{
  const cq=source('../assets/chongqing/chongqing.js');
  const at=cq.indexOf('function cqFloatWavePose(');
  const to=cq.indexOf('function moveSharedFloatplane',at);
  assert.ok(at>=0&&to>at);
  const build=new Function('riverCenter',cq.slice(at,to)+'return cqFloatWavePose;');
  const main=build(()=>0),branch=build(()=>100);
  const a=main(49,0,1,4),b=main(49,0,1,5);
  assert.notEqual(a.height,b.height);
  assert.notEqual(a.pitch,0);
  assert.notEqual(a.bank,0);
  assert.ok(Math.abs(branch(49,0,1,4).height-a.height+.10)<1e-9);
  assert.match(cq,/waterUniforms\.uTime\.value=time/);
});

test('NYC waterborne physics uses the same four-pontoon spectrum and RAF clock as WebGL',()=>{
  const a=html.indexOf('          const floatHeave=selectedMap.city');
  const tail='          plane.pos[1]=WATER_H+FLOAT_CLEARANCE+floatHeave;';
  const b=html.indexOf(tail,a);
  assert.ok(a>0&&b>a,'waterborne buoyancy block must be active');
  const waterStep=new Function('selectedMap','x','z','plane','lastTime','WATER_H',
    'FLOAT_CLEARANCE','sampleFloatOceanFloor','floatOceanPose','sceneryTime',
    html.slice(a,b+tail.length)+'return plane.pos[1];');
  const clock=17283.354,at=Math.fround(clock*.001),x=88,z=-602,yaw=.44;
  const city={city:true},plane={pos:[x,0,z],yaw,speed:8};
  const sampled=pose(x,z,yaw,at,city,water,abyss);
  const afloat=waterStep(city,x,z,plane,clock,water,1.5,abyss,pose,2);
  assert.ok(Math.abs(afloat-(water+1.5+sampled.height))<1e-11);
  const alaska={alaska:true},legacy={pos:[x,0,z],yaw,speed:8};
  const oldHeave=.024*Math.sin(2*2.3+legacy.speed*.28);
  const other=waterStep(alaska,x,z,legacy,clock,water,1.5,abyss,pose,2);
  assert.ok(Math.abs(other-(water+1.5+oldHeave))<1e-11,
    'Alaska and other maps must preserve legacy water physics');
  assert.match(html,/gl\.uniform1f\(uWorld\.time, time\)/);
  assert.match(html,/floatOceanPose\(plane\.pos\[0\],plane\.pos\[2\],plane\.yaw,Math\.fround\(time\)/);
  assert.match(html,/selectedMap\.city\?floatOceanPose\(x,z,plane\.yaw,/);
  assert.match(html,/selectedMap\.city\?floatOceanPose\(prevPos\[0\],prevPos\[2\],prevYaw,/);
});

test('NYC float ocean floor retains actual depth below water collision plane',()=>{
  const start=html.indexOf('  function sampleRawOceanFloorHeight(');
  const stop=html.indexOf('  function sampleTerrainHeight(x,z)',start);
  assert.ok(start>0&&stop>start,'raw bathymetry sampler exists');
  const field=new Float32Array(1024*1024).fill(.12);
  const selectedMap={city:true};
  const f=new Function('cityGroundField','heightField','MAP_SIZE','MAP_SPAN',
    'clamp','lerp','terrainScaleFor','selectedMap','WATER_H','sampleTerrainHeight',
    html.slice(start,stop)+'return {sampleRawOceanFloorHeight,sampleFloatOceanFloor};')(
      field,null,1024,1920,(v,a,b)=>Math.min(Math.max(v,a),b),
      (a,b,t)=>a+(b-a)*t,()=>54,selectedMap,water,()=>water);
  assert.ok(Math.abs(f.sampleRawOceanFloorHeight(0,0)-6.48)<.001);
  assert.ok(Math.abs(f.sampleFloatOceanFloor(0,0)-6.48)<.001,
    'waterborne wave depth cannot be clamped to the collision waterline');
  selectedMap.city=false;
  assert.equal(f.sampleFloatOceanFloor(0,0),water,'other map fallback untouched');
  assert.match(html,/selectedMap,WATER_H,sampleFloatOceanFloor\)/);
});

test('only confirmed floating C185 avoids static waterline collision at wave trough',()=>{
  const at=html.indexOf('  function checkFlightCollision(');
  const a=html.indexOf('      const surface = sampleGroundHeight(x,z);',at);
  const b=html.indexOf('      const vehicle=vehicleAt(',a);
  assert.ok(at>0&&a>at&&b>a,'isolate real terrain collision gate');
  const impact=new Function('x','y','z','selectedAircraft','waterborne',
    'selectedMap','sampleGroundHeight','WATER_H','finishFlight',
    html.slice(a,b)+'return false;');
  const trial=({aircraft='seaplane',afloat=false,surface=12.2,y=12.55,city=true}={})=>{
    const hits=[];
    impact(0,y,0,aircraft,afloat,{city},()=>surface,12.2,(...args)=>hits.push(args));
    return hits;
  };
  assert.equal(trial({afloat:true}).length,0,'float on trough cannot crash on still-water plane');
  assert.equal(trial({afloat:false}).length,1,'airborne C185 still collides with water');
  assert.equal(trial({aircraft:'fighter',afloat:true}).length,1,'fighter cannot bypass impact');
  assert.equal(trial({afloat:true,city:false}).length,1,'other maps retain original collision gate');
  assert.equal(trial({afloat:true,surface:13.4}).length,1,'shore and land remain solid');
});
