// Street-level realism: repeated NYC resident cars no longer share one paint.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function extract(name){
 const start=html.indexOf('function '+name+'(');
 assert.ok(start>=0,'missing '+name);
 const open=html.indexOf('{',start);let depth=0,end=-1;
 for(let i=open;i<html.length;i++){
  if(html[i]==='{')depth++;
  else if(html[i]==='}'&&--depth===0){end=i+1;break;}
 }
 assert.ok(end>open,'unbalanced function '+name);
 return html.slice(start,end);
}
const builder=new Function('createTriangleMesh','addModelBox',
 'addVegasLettering','return ('+extract('buildStreetVehicle')+')')(
 ()=>{const colors=[];return {addQuad(...args){colors.push(args.at(-2))},
  addTri(){},upload(){return {colors}}}},()=>{},()=>{});

test('three NYC resident vehicle classes retain distinct original body color',()=>{
 for(const [kind,expected] of [
  ['sedan',[.24,.28,.34]],['suv',[.65,.69,.70]],
  ['van',[.88,.89,.87]]
 ]){
  const mesh=builder(kind);
  assert.deepEqual(mesh.colors[0],expected,kind+' base body unchanged');
 }
});
test('paint override is only for ordinary cars, never yellow taxi or police',()=>{
 for(const [kind,paint] of [
  ['sedan',[.76,.77,.74]],['suv',[.18,.22,.24]],
  ['van',[.76,.71,.61]]
 ])assert.deepEqual(builder(kind,undefined,undefined,paint).colors[0],paint);
 assert.deepEqual(builder('taxi',undefined,undefined,[.10,.10,.10]).colors[0],
  [.96,.66,.11]);
 assert.deepEqual(builder('police',undefined,undefined,[.10,.10,.10]).colors[0],
  [.80,.83,.86]);
});
test('additional paint meshes are built only once, outside the render loop',()=>{
 const start=html.indexOf('PATROL_NYC_RESIDENT_FLEET_LIVERIES_V1');
 const end=html.indexOf('function buildCivilAirlinerMesh',start);
 assert.ok(start>0&&end>start);
 const block=html.slice(start,end);
 assert.match(block,/streetMeshes\[kind\],\.\.\.paint\.slice\(1\)/);
 assert.match(block,/buildStreetVehicle\(kind,undefined,undefined,color\)/);
 assert.ok(html.indexOf('const nycResidentMeshes=')<html.indexOf('function drawCityTraffic'));
 const draw=extract('drawCityTraffic');
 assert.match(draw,/nycResidentMeshes\[actor\.kind\]\[actor\.livery%3\]/);
 assert.match(draw,/selectedMap\.city && !actor\.wreck/);
});
test('main roads, plaza loop and expressway each cover all three paint variants',()=>{
 const fromRoad=(j,i)=>(j*5+i*3+Math.floor(j/3))%3;
 const fromPlaza=j=>(j+Math.floor(j/3))%3;
 const fromExpressway=i=>(i+Math.floor(i/4))%3;
 assert.equal(new Set(Array.from({length:5},(_,j)=>fromRoad(j,0))).size,3);
 assert.equal(new Set(Array.from({length:9},(_,j)=>fromPlaza(j))).size,3);
 assert.equal(new Set(Array.from({length:8},(_,i)=>fromExpressway(i))).size,3);
 const prep=extract('prepareCityTraffic');
 assert.match(prep,/livery:\(j\*5\+i\*3\+Math\.floor\(j\/3\)\)%3/);
 assert.match(prep,/livery:\(j\+Math\.floor\(j\/3\)\)%3/);
 assert.match(prep,/livery:\(i\+Math\.floor\(i\/4\)\)%3/);
});
