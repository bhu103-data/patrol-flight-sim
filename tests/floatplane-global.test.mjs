import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=url=>readFileSync(new URL(url,import.meta.url));
const game=file('../index.html').toString('utf8');
const glbFile=file('../assets/aircraft/cessna185-floats.glb');
const parser=file('../assets/aircraft/floatplane-glb.js').toString('utf8');
const {decodeFloatplaneGLB}=await import('data:text/javascript;base64,'+
  Buffer.from(parser).toString('base64'));

test('one global aircraft selector includes the floatplane outside map-specific art',()=>{
  assert.match(game,/<input type="radio" name="aircraft" value="seaplane">/);
  assert.match(game,/seaplane:\s*\{\s*name:\s*'Cessna 185 Floatplane'/);
  assert.match(game,/selectedAircraft\s*===\s*'seaplane'\)prepareFloatplaneAsset\(\)/);
  assert.match(game,/aircraftMeshes\[selectedAircraft\]/);
  assert.match(game,/loadFloatplaneGLB\('\.\/assets\/aircraft\/cessna185-floats\.glb'/);
});

test('published Blender model is real-scale, bounded, triangulated and loadable',()=>{
  const buf=glbFile.buffer.slice(glbFile.byteOffset,glbFile.byteOffset+glbFile.byteLength);
  let actual=0,finite=true;
  const result=decodeFloatplaneGLB(buf,(a,b,c,color)=>{
    actual++;
    finite&&=[a,b,c,color].flat().every(Number.isFinite);
  });
  assert.equal(actual,result.triangles);
  assert.ok(actual>100 && actual<50000);
  assert.ok(finite);
  assert.ok(Math.abs(result.span-10.922)<0.05,'C185 physical wingspan in metres');
  // Blender's full airframe (including tail fin and spinner) is now baked
  // to the official 7.8105-m overall length, within 3 cm export tolerance.
  assert.ok(Math.abs(result.length-7.8105)<0.03,
    'C185 full airframe and spinner must retain 1:1 physical overall length');
  assert.ok(result.bounds.min[1]<-1.40 && result.bounds.min[1]>-1.75,
    'two floats should extend about 1.5 metres below airframe origin');
});

function waterCheck({terrain=()=>12.2,cityLot=()=>null,scenery=()=>null,
  alaska=false,obstacles=[]}={}){
  const start=game.indexOf('  function usableFloatWater(');
  const end=game.indexOf('  let gearDown = false;',start);
  assert.ok(start>=0 && end>start,'water footprint function can be isolated');
  const source=game.slice(start,end);
  // Evaluate the actual game function with deterministic world samplers.
  return new Function('plane','WATER_H','sampleTerrainHeight','cityLotAt',
    'sceneryObstacle','selectedMap','alaskaObstacles',source+';return usableFloatWater;')(
    {yaw:0},12.2,terrain,cityLot,scenery,{alaska},obstacles);
}

test('twin float water clearance checks both ends and outboard pontoons',()=>{
  assert.equal(waterCheck()(0,0,0),true,'open water is safe');
  assert.equal(waterCheck({terrain:(x,z)=>z>2.9?13.5:12.2})(0,0,0),false,
    'bow would strike land even when aircraft center is over water');
  assert.equal(waterCheck({terrain:(x,z)=>x>1.6?13.5:12.2})(0,0,0),false,
    'right pontoon would beach on shoreline');
  assert.equal(waterCheck({terrain:(x,z)=>x<-1.6?13.5:12.2})(0,0,0),false,
    'left pontoon would beach on shoreline');
  assert.equal(waterCheck({terrain:(x,z)=>x>2.9?13.5:12.2})(0,0,Math.PI/2),false,
    'sampled footprint follows rotated nose');
});

test('pier, city lot and Alaska moorings block float landing',()=>{
  assert.equal(waterCheck({cityLot:(x,z)=>z>2?{type:'lot'}:null})(0,0,0),false);
  assert.equal(waterCheck({scenery:(x,z)=>x<-1.4?{name:'pier'}:null})(0,0,0),false);
  assert.equal(waterCheck({alaska:true,obstacles:[{
    x:0,z:2.7,halfX:2,halfZ:1,y:12.2,top:13.8
  }]})(0,0,0),false);
  assert.equal(waterCheck({alaska:false,obstacles:[{
    x:0,z:2.7,halfX:2,halfZ:1
  }]})(0,0,0),true,'Alaska-only obstacles do not leak into other maps');
});

test('floatplane uses its own touchdown, takeoff and crash recovery states',()=>{
  assert.match(game,/FLOAT_CLEARANCE=1\.50,FLOAT_ROTATE_SPEED=17\.5/);
  assert.match(game,/const floatRotate=waterborne && plane\.afterburner/);
  assert.match(game,/waterborne=true;[\s\S]{0,110}plane\.pos\[1\]=WATER_H\+FLOAT_CLEARANCE;/);
  assert.match(game,/if\(usableFloatWater\(x,z,plane\.yaw\)\)\{\s+const smooth=sink/);
  assert.match(game,/usableFloatWater\(prevPos\[0\],prevPos\[2\],prevYaw\)/);
  assert.match(game,/if\(selectedAircraft==='seaplane'&&waterborne&&plane\.speed>1\.5\)/);
  assert.match(game,/waterborne=false;\s*gearDown=grounded;/,'reset on new launch');
  assert.match(game,/crash = \{ startedAt: null, age: 0, reason \};[\s\S]{0,210}waterborne=false;/,
    'reset after crash');
});
