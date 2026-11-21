import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=JSON.parse(readFileSync(new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
const a=html.indexOf('  function buildOfficialFootprintMesh(');
const b=html.indexOf('  function buildCityBuildings(',a);
assert.ok(a>=0&&b>a);
const fn=new Function(html.slice(a,b)+'return buildOfficialFootprintMesh;')();
function build(rec,detail=3,destroyed=false){
 const [id,x,z,w,d,h,poly]=rec;
 const tris=[],quads=[];
 const stats=fn((...args)=>tris.push(args),(...args)=>quads.push(args),
   [x,z,w,d,h,(id%101)/101,destroyed,poly,id],14.58,detail);
 return {stats,tris,quads};
}
test('existing lower Manhattan OTI outlines generate finite, bounded near-flight details',()=>{
 let entrances=0,cornices=0;
 for(const lot of source.footprints){
  const {stats,tris,quads}=build(lot);
  const {stats:low}=build(lot,1);
  assert.ok(stats.streetEntrances>=0&&stats.streetEntrances<=2);
  assert.ok(stats.corniceBands>=0&&stats.corniceBands<=8);
  assert.equal(low.streetEntrances,0);
  assert.equal(low.corniceBands,0);
  assert.equal(stats.roof,low.roof,'unchanged municipal roof tessellation');
  assert.equal(stats.walls,low.walls,'unchanged polygon wall topology');
  assert.ok(quads.length<400,'decorative quads remain bounded per existing building');
  assert.ok(tris.every(t=>t.slice(0,3).every(p=>p.every(Number.isFinite))));
  assert.ok(quads.every(t=>t.slice(0,4).every(p=>p.every(Number.isFinite))));
  entrances+=stats.streetEntrances;cornices+=stats.corniceBands;
 }
 assert.ok(entrances>=12,'real OTI lower-Manhattan frontage gains shop/entry relief');
 assert.ok(cornices>=30,'existing polygon rooflines gain measurable cornice geometry');
});
test('destroyed buildings never receive intact storefront/roof ornaments',()=>{
 for(const lot of source.footprints.slice(0,25)){
  const {stats}=build(lot,3,true);
  assert.equal(stats.streetEntrances,0);
  assert.equal(stats.corniceBands,0);
 }
});
test('no new lot files, collision rules, roads or flying controls',()=>{
 const diffSource=html.slice(a,b);
 assert.match(diffSource,/streetEntrances<2/);
 assert.match(diffSource,/corniceBands<8/);
 assert.match(diffSource,/roofY-\.30/);
 assert.match(diffSource,/detailBand===3/);
 assert.match(html,/official-financial-footprints\.json/);
 assert.match(html,/officialLotAt\(east,north\)\|\|cityParcels\.get/);
});
