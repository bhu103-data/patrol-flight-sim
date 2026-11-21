// node --test tests/nyc-roof-setback-grounding.test.mjs
// Exercises the ACTUAL production building mesh generator with instrumented
// box geometry; no duplicated roof-placement implementation or WebGL driver.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function buildCityBuildings(');
assert.ok(start>=0,'production generator is present');
const open=html.indexOf('{',start);
let depth=0,end=-1;
for(let i=open;i<html.length;i++){
  if(html[i]==='{')depth++;
  else if(html[i]==='}' && --depth===0){end=i+1;break;}
}
assert.ok(end>start,'production generator is closed');
const production=html.slice(start,end);
const GRID={tilt:.24,offset:30,blockWidth:24,blockLength:33};
const FLOOR=12.2+2.38;
function typeOf(x,z){
  const a=Math.floor((x-GRID.tilt*z-GRID.offset)/GRID.blockWidth);
  const b=Math.floor(z/GRID.blockLength);
  return ((Math.imul(a,73856093)^Math.imul(b,19349663)^
    Math.imul(a*b,83492791))>>>0)%13;
}
function render(lot,detail=2,local=false){
  const boxes=[];
  const make=new Function(
    'createTriangleMesh','addModelBox','addRideBeam','nycDetailBand',
    'MANHATTAN_GRID','WATER_H','tintSeed','addDowntownFacadeRelief',
    'return ('+production+')'
  )(
    ()=>({addTri(){},addQuad(){},upload(){return {}}}),
    (_quad,...args)=>{
      for(const value of args.slice(0,6))
        assert.ok(Number.isFinite(value),'geometry must remain finite');
      for(const size of args.slice(3,6))
        assert.ok(size>0,'cuboids cannot have negative or zero dimensions');
      boxes.push(args);
    },
    ()=>{},()=>detail,GRID,12.2,()=>.5,()=>0
  );
  make([lot],local);
  return boxes;
}
const near=(a,b)=>Math.abs(a-b)<1e-5;
function coping(boxes,top){
  const found=boxes.filter(box=>near(box[1],top-.16) && near(box[4],.29));
  assert.equal(found.length,1,'one continuous top-tier coping');
  return found[0];
}
const styles=[];
for(let k=0;k<13;k++){
  let found;
  for(let z=-500;z<-245&&!found;z+=14)
    for(let x=-152;x<77;x+=11)if(typeOf(x,z)===k){found=[x,z];break;}
  assert.ok(found,'found representative financial-district lot style '+k);
  styles.push(found);
}
for(let k=0;k<13;k++){
  test('downtown style '+k+' anchors parapet, HVAC and facade bands to crown',()=>{
    const [x,z]=styles[k],w=9,d=19,h=23.5,tone=.41;
    const boxes=render([x,z,w,d,h,tone,false]);
    const crown=.43+(k%3)*.10,roofW=w*crown,roofD=d*crown,top=FLOOR+h;
    const cap=coping(boxes,top);
    assert.ok(near(cap[0],x)&&near(cap[2],z));
    assert.ok(near(cap[3],roofW+.12) && near(cap[5],roofD+.12),
      'top coping must match the final setback, not the ground podium');
    const heavy=boxes.filter(b=>b[1]>=top-.03 && b[3]>=.30 && b[5]>=.30);
    assert.ok(heavy.length>=4,'real parapet, roof plant and vent are present');
    for(const b of heavy){
      const dx=Math.abs(b[0]-x)+b[3]*.5-roofW*.5;
      const dz=Math.abs(b[2]-z)+b[5]*.5-roofD*.5;
      assert.ok(dx<=.15 && dz<=.15,
        'roof fixture overhangs tower crown by '+dx.toFixed(3)+'/'+dz.toFixed(3));
    }
    // Horizontal stone courses must step IN with the actual tower levels.
    // Full podium-width strips at upper floors were visibly suspended.
    const low=[.57,.68,.77,.63,.73][k%5];
    const mid=[.87,.91,.94,.83,.89][k%5];
    // Tall Art Deco fins stop on the supporting first tier; they previously
    // extended beside the smaller middle/upper block with no connecting wall.
    if(k%5===0||k%5===4){
      const small=k%5===0?.18:.14,deep=k%5===0?.20:.16;
      const fins=boxes.filter(b=>near(b[3],small)&&near(b[5],deep)&&b[4]>2);
      assert.equal(fins.length,2,'two masonry fins on the podium facade');
      for(const fin of fins)
        assert.ok(fin[1]+fin[4]*.5<=FLOOR+h*low+.01,
          'cantilevered facade fin extends beyond supporting first tier');
    }
    if(k%5===1||k%5===3){
      const aerials=boxes.filter(b=>near(b[3],.11)&&near(b[4],.77)&&near(b[5],.11));
      assert.equal(aerials.length,2);
      for(const antenna of aerials)
        assert.ok(Math.abs(antenna[0]-x)+.055<=roofW*.5+.01,
          'roof antenna must be seated on its narrow crown');
    }
    for(let level=3.7;level<h-.6;level+=3.5){
      const band=boxes.filter(b=>near(b[1],FLOOR+level)&&near(b[4],.12));
      assert.equal(band.length,1,'one band at floor elevation '+level);
      const stage=level<h*low-.16?0:level<h*mid-.16?1:2;
      const width=stage===0?w:stage===1?w*(.68+(k%4)*.055):roofW;
      const length=stage===0?d:stage===1?d*(.68+(k%4)*.055):roofD;
      assert.ok(near(band[0][3],width+.08));
      assert.ok(near(band[0][5],length+.08));
    }
  });
}
test('vertical masonry piers terminate before upper setbacks',()=>{
  const [x,z]=styles[3],w=9,d=19,h=23.5;
  const boxes=render([x,z,w,d,h,.8,false]);
  const baseTop=FLOOR+h*[.57,.68,.77,.63,.73][3%5];
  const piers=boxes.filter(b=>near(b[3],.38)&&near(b[5],.13)&&b[4]>2);
  assert.equal(piers.length,4);
  for(const p of piers){
    assert.ok(p[1]+p[4]/2<=baseTop-.10,'column no longer floats beside crown');
    assert.ok(p[1]-p[4]/2>=FLOOR-.01,'column starts at podium base');
  }
});
test('distant city LOD1 roof ledge follows its own narrower top floor',()=>{
  const lot=[280,105,8.4,15.5,26,.41,false];
  const boxes=render(lot,1);
  const cap=coping(boxes,FLOOR+lot[4]);
  const style=typeOf(lot[0],lot[1]);
  assert.ok(near(cap[3],lot[2]*(.68+(style%3)*.05)+.12));
  assert.ok(near(cap[5],lot[3]*(.69+(style%4)*.045)+.12));
});
test('Brooklyn warehouse rooftops and destroyed buildings stay unchanged',()=>{
  const lot=[342.76,-346.16,9,19,13.82,.41,false];
  const boxes=render(lot);
  const cap=coping(boxes,FLOOR+lot[4]);
  assert.ok(near(cap[3],lot[2]+.12)&&near(cap[5],lot[3]+.12));
  const rubble=render([...lot.slice(0,6),true]);
  assert.ok(rubble.every(b=>b[1]<FLOOR+lot[4]-1),
    'destroyed lots are still rubble without intact roof fixtures');
});
