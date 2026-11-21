import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const amenities=readFileSync(new URL('../assets/nyc/central-park-amenities.js',import.meta.url),'utf8');
const mod={};
new Script(amenities.replace(/^export /gm,'')+
  '\n;globalThis.build=buildCentralParkAmenities;').runInNewContext(mod);
const grid={offset:30,tilt:.24,parkCenter:206,parkHalfLength:151,parkHalfWidth:43};
const terrainAt=(x,z)=>15.5+.12*Math.cos(x/30)+.13*Math.sin(z/24);
const sample=(quality)=>{
  const boxes=[],beams=[],invalid=[];
  const validPoint=(p)=>Array.isArray(p)&&p.length===3&&
    p.every(Number.isFinite)&&p[0]>-100&&p[0]<220&&
    p[1]>13&&p[1]<32&&p[2]>52&&p[2]<360;
  const checkPoint=(p)=>{if(!validPoint(p))invalid.push(p);};
  const stats=mod.build({grid,quality,waterY:12.2,terrainAt,
    box:(x,y,z,w,h,d,color)=>{
      if([x,y,z,w,h,d].some(n=>!Number.isFinite(n))||
         !Array.isArray(color)||color.length!==3)invalid.push([x,y,z,w,h,d]);
      boxes.push({x,y,z,w,h,d,color});
    },
    beam:(a,b,width,color)=>{
      checkPoint(a);checkPoint(b);
      if(!Number.isFinite(width)||!Array.isArray(color))invalid.push([a,b,width]);
      beams.push({a,b,width,color});
    },
    addQuad:(a,b,c,d,color)=>{
      [a,b,c,d].forEach(checkPoint);
      if(!Array.isArray(color))invalid.push(color);
    },
    addTri:(a,b,c,color)=>{
      [a,b,c].forEach(checkPoint);
      if(!Array.isArray(color))invalid.push(color);
    },
    ribbon:(a,b)=>{checkPoint(a);checkPoint(b);}
  });
  return {boxes,beams,invalid,stats};
};
const rgb=(c,v)=>c.join(',')===v.join(',');
const seatColors=[[.37,.25,.17],[.39,.27,.18]];
const isSeat=c=>seatColors.some(v=>rgb(c,v));
const isIron=c=>rgb(c,[.15,.20,.18]);

test('one seven-slat original settee is present on high but not low quality',()=>{
  const high=sample('high'),low=sample('low');
  assert.equal(high.stats.benches,10,'nine boundary benches plus Lake settee');
  assert.equal(low.stats.benches,5,'low detail must keep the baseline five benches');
  assert.equal(high.invalid.length,0);
  assert.equal(low.invalid.length,0);
  const slats=high.boxes.filter(b=>isSeat(b.color));
  assert.equal(slats.length,7,'five seat and two back slats');
  assert.equal(low.boxes.filter(b=>isSeat(b.color)).length,0);
  assert.ok(slats.every(b=>Math.abs(b.x-78.12)<1.0&&
    b.z===163&&b.d===1.8&&b.h>=.06),
    'settee must be in the nominated dry Loeb Boathouse Lake path');
  const ironBeams=high.beams.filter(b=>isIron(b.color));
  assert.equal(ironBeams.length,12,'two complete open cast-iron supports');
  const feet=high.boxes.filter(b=>isIron(b.color));
  assert.equal(feet.length,4,'four individually grounded shoe plates');
  for(const f of feet){
    assert.ok(Math.abs(f.z-163)<.80);
    assert.ok(Math.abs(f.y-(terrainAt(f.x,f.z)+.031))<1e-8,
      'feet must follow sampled terrain rather than floating');
  }
});

test('Lake bench footprint is dry at every corner, not only its center',()=>{
  const distance=(u,z)=>{
    const dx=(u+14)/24,dz=(z-150)/16.2;
    const a=Math.atan2(dz,dx);
    const shore=1+.055*Math.sin(3*a+1.15)+.025*Math.cos(7*a-1.15);
    return Math.hypot(dx,dz)/shore;
  };
  for(const u of [8.42,9.58])for(const z of [162.05,163.95])
    assert.ok(distance(u,z)>1.19,`Lake edge clearance failed at ${u},${z}`);
  assert.equal(sample('high').stats.attractions,5,
    'added settee must not displace park attractions or boats');
  assert.equal(sample('high').stats.boats,4);
});

test('settee uses one existing batched mesh, with bounded extra primitives',()=>{
  const high=sample('high'),low=sample('low');
  assert.ok(high.boxes.length<130);
  assert.ok(high.beams.length<260);
  assert.ok(high.boxes.length-low.boxes.length<45);
  assert.ok(high.beams.length-low.beams.length<90);
  const city=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(city,/const amenityStats=buildCentralParkAmenities\(parkOpts\)/);
});
