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
    assert.ok(count.tri>=90 && count.tri<400);
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

test('the four original Lake boats have watertight-looking tapered 3D hulls',()=>{
  const lakeWater=12.2+2.83,panels=[],stems=[],paddles=[];
  const isHull=rgb=>Array.isArray(rgb)&&
    (rgb.join(',')==='0.42,0.28,0.2'||rgb.join(',')==='0.29,0.34,0.36');
  const isPaddle=rgb=>Array.isArray(rgb)&&rgb.join(',')==='0.57,0.43,0.28';
  const capture=(out,points)=>out.push(...points);
  const stats=context.am({
    grid,quality:'high',waterY:12.2,
    terrainAt:(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24),
    addTri:(a,b,c,color)=>{if(isHull(color))capture(stems,[a,b,c]);},
    addQuad:(a,b,c,d,color)=>{
      if(isHull(color))capture(panels,[a,b,c,d]);
      if(isPaddle(color))paddles.push([a,b,c,d]);
    },
    box(){},beam(){},ribbon(){}
  });
  assert.equal(stats.boats,4);
  assert.equal(panels.length,4*8*4,'four boats have two hull sides per section');
  assert.equal(stems.length,4*2*3,'each rowboat has a formed bow and stern');
  assert.equal(paddles.length,8,'both oars have real paddle blades');
  assert.ok(Math.min(...panels.map(p=>p[1]))<lakeWater-.07,
    'keel must project beneath water');
  assert.ok(Math.max(...panels.map(p=>p[1]))>lakeWater+.25,
    'gunwales rise above water, rather than a single flat rectangle');
  // Audit every actual hull vertex against the same irregular Lake geometry
  // defined in central-park.js. No boat may be positioned on the shoreline.
  for(const p of [...panels,...stems,...paddles.flat()]){
    const u=p[0]-grid.offset-grid.tilt*p[2],z=p[2];
    const dx=(u+14)/24,dz=(z-150)/16.2;
    const a=Math.atan2(dz,dx);
    const shore=1+.055*Math.sin(3*a+1.15)+.025*Math.cos(7*a-1.15);
    assert.ok(Math.hypot(dx,dz)/shore<.84,
      'rowboat geometry must remain over open Lake water at '+u+','+z);
  }
});
