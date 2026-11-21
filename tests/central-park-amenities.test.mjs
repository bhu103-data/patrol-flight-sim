import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const source=readFileSync(new URL('../assets/nyc/central-park-amenities.js',
  import.meta.url),'utf8');
const context={};
new Script(source.replace(/^export /gm,'')+
  '\n;globalThis.am=buildCentralParkAmenities;').runInNewContext(context);
const grid={offset:30,tilt:.24,parkCenter:206,parkHalfLength:151,parkHalfWidth:43};

function run(quality){
  const count={tri:0,quad:0,boxes:0,beams:0,ribbons:0,bad:0};
  const valid=(...positions)=>positions.every(a=>Array.isArray(a)&&
    a.length===3&&a.every(Number.isFinite)&&a[0]>-100&&a[0]<220&&
    a[1]>13&&a[1]<32&&a[2]>52&&a[2]<360);
  const stats=context.am({grid,quality,waterY:12.2,
    terrainAt:(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24),
    addTri:(a,b,c)=>{count.tri++;if(!valid(a,b,c))count.bad++;},
    addQuad:(a,b,c,d)=>{count.quad++;if(!valid(a,b,c,d))count.bad++;},
    box:(...n)=>{count.boxes++;if(n.slice(0,6).some(x=>!Number.isFinite(x)))count.bad++;},
    beam:(a,b)=>{count.beams++;if(!valid(a,b))count.bad++;},
    ribbon:(a,b)=>{count.ribbons++;if(!valid(a,b))count.bad++;}
  });
  return {stats,count};
}
test('Central Park visitor models parse and remain inside Manhattan bounds',()=>{
  assert.doesNotThrow(()=>new Script(source.replace(/^export /gm,'')));
  const low=run('low'),high=run('high');
  for(const {stats,count} of [low,high]){
    assert.equal(count.bad,0);
    assert.equal(stats.attractions,5);
    assert.equal(stats.boats,4);
    assert.ok(stats.benches>=4);
    assert.ok(stats.lamps>=9);
    assert.ok(count.tri>130 && count.tri<400);
    assert.ok(count.quad<350 && count.boxes<125 && count.beams<250);
  }
  assert.ok(high.stats.lamps>low.stats.lamps);
});
test('NY Central Park camera button and all 8 views preserve flight',()=>{
  const city=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(city,/id="centralParkShortcutButton"/);
  assert.match(city,/centralParkShortcutButton\.hidden=!selectedMap\.city/);
  assert.match(city,/e\.code==='KeyP'/);
  assert.match(city,/Promise\.all\(\[import\('\.\/assets\/nyc\/central-park\.js'\)/);
  assert.match(city,/import\('\.\/assets\/nyc\/central-park-amenities\.js'\)/);
  assert.match(city,/const amenityStats=buildCentralParkAmenities\(parkOpts\)/);
  assert.match(city,/if\(!selectedMap\.city\|\|!flying\|\|crash\|\|/);
  for(const name of ['Central Park · Reservoir Aerial',
    'Central Park · Bethesda Terrace','Central Park · Bow Bridge',
    'Central Park · Belvedere Castle','Central Park · Great Lawn',
    'Central Park · Zoo','Central Park · Strawberry Fields',
    'Central Park · Loeb Boathouse'])
    assert.ok(city.includes(name),'missing '+name);
  assert.match(city,/NYC_ORBIT_CEILING\s*=\s*180/);
});
