// Production waterfront geometry, not a simplified mock of the pier builder.
// Run: node --test tests/nyc-waterfront-pier-grounding.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/nyc/nyc-hero.js',import.meta.url),'utf8');
const {buildManhattanWaterfront}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));
const channel=(x,z)=>x>-120&&x<50?20:0;
function scene(terrain,waterY=0){
  let quads=0,boxes=0,beams=0;
  const report=buildManhattanWaterfront({
    terrain,waterY,
    addQuad(){quads++},box(){boxes++},beam(){beams++}
  });
  return {...report,quads,boxes,beams};
}
test('a connected harbor gives six physically anchored and registered docks',()=>{
  const s=scene(channel);
  assert.equal(s.pierCount,6);
  assert.equal(s.pierObstacles.length,s.pierCount);
  assert.deepEqual(s.pierObstacles.map(p=>p.z),[-475,-448,-411,-377,-456,-384]);
  assert.ok(s.quads>20&&s.boxes>30&&s.beams>30);
  for(const pier of s.pierObstacles){
    assert.equal(pier.name,'Lower Manhattan pier');
    for(const key of ['x','z','y','top','halfX','halfZ'])
      assert.ok(Number.isFinite(pier[key]),key+' must be finite');
    assert.ok(pier.top>pier.y&&pier.halfX>5&&pier.halfZ>2);
  }
});
test('an inland shoal under the pier deck is not rendered or registered',()=>{
  // The bank scanner sees wet ground immediately after x=-120, but an
  // offshore islet is hidden under the center/end of the first deck.
  const land=(x,z)=>z>-478&&z<-472&&x<-132&&x>-149
    ?20:channel(x,z);
  const s=scene(land);
  assert.equal(s.pierCount,5);
  assert.equal(s.pierObstacles.some(p=>p.z===-475),false);
});
test('a narrow wet inlet underneath a landside deck corner is rejected',()=>{
  // Dry dock center and dry middle shoreline do not prove both edges dry.
  const land=(x,z)=>z>-451.2&&z<-450&&x>-120&&x<-115
    ?0:channel(x,z);
  const s=scene(land);
  assert.equal(s.pierCount,5);
  assert.equal(s.pierObstacles.some(p=>p.z===-448),false);
});
test('never create floating piers in open sea or unbroken dry land',()=>{
  for(const terrain of [()=>0,()=>20]){
    const s=scene(terrain);
    assert.equal(s.pierCount,0);
    assert.deepEqual(s.pierObstacles,[]);
    assert.equal(s.quads+s.boxes+s.beams,0);
  }
});
test('live Manhattan flight registers only active pier geometry as water obstacles',async()=>{
  const game=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(game,/const waterfront=buildManhattanWaterfront\(\{/);
  assert.match(game,/sceneryObjects\.push\(\.\.\.waterfront\.pierObstacles\)/);
  assert.match(game,/if\(heroEpoch!==nycHeroEpoch\|\|gl\.isContextLost\(\)\)disposeSceneMesh\(uploaded\)/);
  assert.match(game,/sceneryObjects=\[\]/);
  assert.match(game,/function sceneryObstacle\(x,z,y\)/);
  assert.match(game,/cityLotAt\(px,pz\)\|\|sceneryObstacle\(px,pz\)/);
});
