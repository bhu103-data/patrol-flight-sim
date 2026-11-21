// Verify low-rise street-level geometry in the real NYC building generator.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const pos=html.indexOf('function buildCityBuildings('),start=html.indexOf('{',pos);
assert.ok(pos>0&&start>pos);
let depth=0,end=-1;
for(let i=start;i<html.length;i++){
 if(html[i]==='{')depth++;
 else if(html[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>start);
const source=html.slice(pos,end);

function generate(x,z,h=6,detail=2,official=false){
 const boxes=[],quads=[];
 const fn=new Function('createTriangleMesh','addModelBox','addRideBeam',
  'nycDetailBand','MANHATTAN_GRID','WATER_H','tintSeed',
  'addDowntownFacadeRelief','return ('+source+')')(
   ()=>({addTri(){},addQuad(...args){quads.push(args)},
     upload(){return {boxes,quads};}}),
   (_addQuad,...args)=>boxes.push(args),()=>{},
   ()=>detail,{tilt:.24,offset:30,blockWidth:24,blockLength:33},
   12.2,()=>.45,()=>0
  );
 const lot=[x,z,9,11,h,.45,false];
 if(official)lot[7]=[[x-4,z-5],[x+4,z-5],[x+4,z+5],[x-4,z+5]];
 return fn([lot]);
}
test('short Times Square anonymous shops gain window doors and real framed frontages',()=>{
 const near=generate(20,10),out=generate(140,10);
 assert.ok(near.boxes.length>out.boxes.length+12,
  'short 6m shop gains physical framing while unrelated district stays low-cost');
 const glass=near.boxes.filter(b=>b.at(-1)===5);
 assert.ok(glass.length>=4,'individual glass panes on both street fronts');
 const trim=near.boxes.filter(b=>Array.isArray(b[6])&&b[4]<.25);
 assert.ok(trim.length>=4,'mullions and window sill structure');
 assert.ok(html.includes('PATROL_NYC_TIMES_SHORT_FACADE_V1'));
});
test('low storefront additions stay within reserved sidewalk margins and roof height',()=>{
 const x=20,z=10,h=6,w=9,d=11;
 const details=generate(x,z,h);
 for(const b of details.boxes){
  const [cx,cy,cz,bw,bh,bd]=b;
  assert.ok([cx,cy,cz,bw,bh,bd].every(Number.isFinite));
  assert.ok(cx-bw/2>=x-w/2-.60 && cx+bw/2<=x+w/2+.60,
   'no frontage fills protected road');
  assert.ok(cz-bd/2>=z-d/2-.60 && cz+bd/2<=z+d/2+.60,
   'no storefront protrudes into traffic');
  assert.ok(cy+bh/2<=12.2+2.38+h+.20,'no floating tower above short roof');
 }
});
test('distant parcels and other neighborhoods retain compact existing LOD',()=>{
 const short=generate(20,10,6,1);
 const old=generate(140,10,6,2);
 assert.ok(short.boxes.length<6);
 assert.ok(old.boxes.length<8);
});
test('official footprint parcels still bypass procedural frontage altogether',()=>{
 // FID polygons are handled before the procedural near-field branch.
 const a=generate(20,10,6,2,true);
 assert.equal(a.boxes.length,0);
 assert.ok(a.quads.length>0);
});
