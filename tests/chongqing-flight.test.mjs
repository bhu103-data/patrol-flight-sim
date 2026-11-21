// node --test tests/chongqing-flight.test.mjs
// Executes the actual move(dt) body with a lightweight game-state harness.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const main=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');
const start=main.indexOf('function move(dt){');
const end=main.indexOf('\nconst visited=',start);
assert.ok(start>=0&&end>start,'moving player function must be extractable');
const movement=main.slice(start,end);

class Vector {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  copy(v){return this.set(v.x,v.y,v.z)}
  lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}
  normalize(){const n=Math.sqrt(this.lengthSq())||1;this.x/=n;this.y/=n;this.z/=n;return this}
}
function makeFlight(y=302,ceiling=Infinity){
  const state={
    pos:new Vector(0,y,0),vel:new Vector(),heading:0,
    flying:true,onGround:false,boosting:false,spicy:0,jumpCount:0
  };
  const keys=new Set(['Space']);
  const avatar={position:{copy(){}},rotation:{x:0,y:0,z:0}};
  const part=()=>({rotation:{x:0}});
  const pilotLimbs={arms:[part(),part()],legs:[part(),part()]};
  const flyingScarf={rotation:{x:0,y:0}};
  const flameLight={intensity:0};
  const obstacleIndex={
    ceilingSurface(_x,_z,previous,next){
      if(previous<=ceiling+.07&&next>=ceiling-.06)return ceiling;
      return Infinity;
    },
    landingSurface(){return 12.35}
  };
  const riverBuild={deckSurface(){return -Infinity},deckDrift(){return {dx:0,dz:0}}};
  const streetBuild={nearby(){return false}};
  const fn=new Function(
    'state','keys','temp','viewYaw','touchForward','touchSideways',
    'clamp','jumpQueued','intersectsBuilding','streetBuild','riverBuild',
    'obstacleIndex','ground','avatar','pilotLimbs','flyingScarf',
    'flameLight','time','message',
    movement+';return move;'
  );
  const move=fn(state,keys,new Vector(),0,0,0,
    (v,min,max)=>Math.max(min,Math.min(max,v)),
    false,()=>false,streetBuild,riverBuild,obstacleIndex,()=>10,
    avatar,pilotLimbs,flyingScarf,flameLight,0,()=>{});
  return {state,keys,move};
}
test('ascending past the old 300-unit limit reaches 350m towers and 650m portal',()=>{
  const {state,move}=makeFlight();
  for(let frame=0;frame<1200;frame++)move(1/60);
  assert.ok(state.pos.y>=650,'flight should climb to cosmos height');
  assert.ok(state.pos.y<=725,'world height remains bounded');
  assert.ok(state.vel.y>=0);
  assert.ok(main.includes('state.pos.y>=650'));
  assert.ok(!main.includes('if(py>300&&state.vel.y>0)'));
});
test('descent from 725m works after releasing Space',()=>{
  const {state,move,keys}=makeFlight();
  for(let i=0;i<1200;i++)move(1/60);
  keys.delete('Space');keys.add('ControlLeft');
  for(let i=0;i<200;i++)move(1/60);
  assert.ok(state.pos.y<690,'player can leave high altitude again');
});
test('upward flight stops at the actual underside of an elevated volume',()=>{
  const {state,move}=makeFlight(100.6,100.9);
  for(let i=0;i<90;i++)move(1/60);
  assert.ok(state.pos.y<=100.901);
  assert.ok(state.pos.y>100.55);
});
