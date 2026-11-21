// node --test tests/nyc-road-geometry.test.mjs
// Execute the SAME geometric clearance helpers embedded in the browser game.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function getFunction(name,scope={}){
  const at=html.indexOf('function '+name+'(');
  assert.ok(at>=0,'missing '+name);
  const open=html.indexOf('{',at);
  let depth=0,end=-1;
  for(let i=open;i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}' && --depth===0){end=i+1;break}
  }
  assert.ok(end>open,'unclosed '+name);
  return vm.runInNewContext('('+html.slice(at,end)+')',scope);
}
const roadBegin=html.indexOf('const CITY_STREETS = ');
const roadEnd=html.indexOf('];',roadBegin)+1;
assert.ok(roadBegin>=0 && roadEnd>roadBegin);
const roads=JSON.parse(html.slice(roadBegin+'const CITY_STREETS = '.length,roadEnd));
const expressway=html.slice(html.indexOf('const CITY_EXPRESSWAY='),html.indexOf('const VEGAS_EXPRESSWAY='));
for(const key of ['points','ramp']){
  const p=expressway.indexOf(key+':');
  const start=expressway.indexOf('[',p);
  const end=expressway.indexOf(']]',start)+2;
  assert.ok(p>=0 && end>start);
  roads.push(JSON.parse(expressway.slice(start,end)));
}
const overlaps=getFunction('generatedCityRoadOverlap',{city:{streets:roads}});
test('Brooklyn Bridge asphalt lane remains free of building volumes',()=>{
  assert.equal(overlaps([238,-342,12,19],5.85),true);
  assert.equal(overlaps([253,-342,12,19],5.85),true);
});
test('adjacent Brooklyn building lot survives without touching the road',()=>{
  const lot=[276.5,-315.8,13.34,17.4];
  assert.equal(overlaps(lot,5.85),false);
  // This is near enough to a surveyed corridor to trigger the old
  // circumcircle heuristic, despite the lot not crossing the road.
  const oldMargin=6.4+Math.hypot(lot[2],lot[3])*.5;
  const oldRejected=roads.some(path=>path.some((b,i)=>{
    if(!i)return false;
    const a=path[i-1],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((lot[0]-a[0])*dx+(lot[1]-a[1])*dz)/(dx*dx+dz*dz)||0));
    return Math.hypot(lot[0]-a[0]-t*dx,lot[1]-a[1]-t*dz)<oldMargin;
  }));
  assert.equal(oldRejected,true);
  assert.match(html,/const inStreet=generatedCityRoadOverlap\(\[x,z,width,length\],5\.85\)/);
});
test('official polygon rejects building-height terrain inside empty L-shaped notch',()=>{
  const inPolygon=getFunction('inOfficialPolygon');
  const poly=[[0,0],[3,0],[3,1],[1,1],[1,3],[0,3]];
  assert.equal(inPolygon(.5,.5,poly),true);
  assert.equal(inPolygon(2,2,poly),false);
  assert.match(html,/!parcel\[7\] \|\| inOfficialPolygon\(east,north,parcel\[7\]\)/);
});
