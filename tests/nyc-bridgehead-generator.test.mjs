// node --test tests/nyc-bridgehead-generator.test.mjs
// Run the actual terrain generator with the repository's full OTI dataset.
// Unlike source-string assertions this verifies the city parcel output.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const snapshot=JSON.parse(await readFile(
  new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
function expression(name){
  const i=source.indexOf('const '+name);
  assert.ok(i>=0,'missing '+name);
  const start=source.indexOf('=',i)+1,end=source.indexOf(';',start);
  return new Function('return ('+source.slice(start,end)+')')();
}
function functionSource(name){
  const i=source.indexOf('function '+name+'(');
  assert.ok(i>=0,'missing '+name);
  let depth=0,after=-1;
  for(let j=source.indexOf('{',i);j<source.length;j++){
    if(source[j]==='{')depth++;
    else if(source[j]==='}'&&--depth===0){after=j+1;break}
  }
  assert.ok(after>i,'unclosed '+name);
  return source.slice(i,after);
}
const roads=expression('CITY_STREETS');
const expressway=expression('CITY_EXPRESSWAY');
const city={
  tilt:.24,offset:30,blockWidth:24,blockLength:33,
  parkHalfWidth:43,parkCenter:206,parkHalfLength:151,
  parkWaters:[],landmarks:[],officialFootprints:snapshot.footprints,
  streets:[...roads,expressway.points,expressway.ramp],
  focusZones:expression('NYC_FOCUS_ZONES'),
  railway:expression('BROOKLYN_RAIL'),
  runway:expression('HARBOR_RUNWAY'),
  timesSquareBounds:expression('TIMES_SQUARE').bounds
};
const genName='function* generateTerrain(options)';
const begin=source.indexOf(genName);
assert.ok(begin>=0,'terrain generator exists');
let depth=0,end=-1;
for(let i=source.indexOf('{',begin);i<source.length;i++){
  if(source[i]==='{')depth++;
  else if(source[i]==='}'&&--depth===0){end=i+1;break}
}
assert.ok(end>begin,'terrain generator closes');
const generateTerrain=new Function('return ('+source.slice(begin,end)+')')();
const terrain=[...generateTerrain({
  size:64,span:1920,landmarks:[],scale:54,water:12.2,city
})].find(step=>step?.type==='done');
assert.ok(terrain,'generator finished without errors');
const brooklyn=terrain.parcels.filter(lot=>
  lot[0]>210&&lot[0]<435&&lot[1]>-415&&lot[1]<-195);
const fills=brooklyn.filter(lot=>lot[8]==='bridgehead-gapfill');
test('Brooklyn Bridge district contains bounded additional building footprints',()=>{
  assert.equal(snapshot.footprints.length,100);
  assert.ok(brooklyn.length>=38,'compact DUMBO lots should restore more bridgehead blocks');
  // Disabling the fictitious railway lets generic parcels occupy former
  // empty rail lots; therefore some secondary gapfills are no longer needed.
  assert.ok(fills.length>=16,'retain safe infill around genuine road corridors');
  const footprintArea=brooklyn.reduce((area,lot)=>area+lot[2]*lot[3],0);
  assert.ok(footprintArea>=4500,
    'compact layouts increase occupied streetscape area without crossing roads');
  assert.equal(terrain.height.length,64*64);
});
test('modern Brooklyn reclaims empty parcels from the obsolete elevated rail loop',()=>{
  assert.equal(city.railway.enabled,false,'modern DUMBO has no elevated loop');
  const {west,east,z,radius}=city.railway;
  const reclaimed=brooklyn.filter(([x,zz,w,d])=>{
    const dx=Math.max(0,west-x,x-east);
    const distance=Math.hypot(dx,zz-z);
    return Math.abs(distance-radius)<4+Math.hypot(w,d)*.43;
  });
  assert.ok(reclaimed.length>=8,
    'previous fake rail right-of-way now accommodates safe Brooklyn parcels');
});

test('synthetic NYC buildings preserve the local grid road and sidewalk corridors',()=>{
  const normalizer=Math.hypot(1,city.tilt);
  let checked=0;
  for(const lot of terrain.parcels){
    if(lot[7]||lot[8]==='bridgehead-gapfill')continue;
    const [x,z,w,d]=lot;
    const u=(x-city.tilt*z-city.offset)/city.blockWidth;
    const v=z/city.blockLength;
    const ix=Math.floor(u),iz=Math.floor(v);
    const onStreetGrid=(ix>=-10&&ix<=8&&iz>=-17&&iz<=12)||
      (ix>=9&&ix<=20&&iz>=-13&&iz<=-7);
    if(!onStreetGrid)continue;
    checked++;
    const fracU=u-ix,fracV=v-iz;
    const avenueDist=Math.min(fracU,1-fracU)*city.blockWidth/normalizer;
    const buildingExtent=(w+Math.abs(city.tilt)*d)*.5/normalizer;
    const crossDist=Math.min(fracV,1-fracV)*city.blockLength;
    assert.ok(avenueDist>=buildingExtent+4.65-1e-6,
      'Avenue corridor blocked by parcel '+x.toFixed(1)+','+z.toFixed(1));
    assert.ok(crossDist>=d*.5+4.35-1e-6,
      'Cross street blocked by parcel '+x.toFixed(1)+','+z.toFixed(1));
  }
  assert.ok(checked>=100,'enough generated buildings were inspected');
});
test('generated bridgehead buildings do not intrude into authored road corridors',()=>{
  const crosses=new Function('city','return ('+
    functionSource('generatedCityRoadOverlap')+')')(city);
  for(const lot of brooklyn)
    assert.equal(crosses(lot,5.85),false,
      'road overlap at '+lot[0].toFixed(1)+', '+lot[1].toFixed(1));
});
test('gapfills preserve the compact grid streets and adjoining sidewalks',()=>{
  const tiltMag=Math.hypot(1,city.tilt);
  for(const [x,z,w,d] of fills){
    const u=(x-city.tilt*z-city.offset)/city.blockWidth;
    const v=z/city.blockLength;
    const fu=u-Math.floor(u),fv=v-Math.floor(v);
    const avenueSpace=Math.min(fu,1-fu)*city.blockWidth/tiltMag;
    const avenueExtent=(w+Math.abs(city.tilt)*d)*.5/tiltMag;
    const crossSpace=Math.min(fv,1-fv)*city.blockLength;
    assert.ok(avenueSpace>=avenueExtent+4.65-1e-6,
      'avenue and sidewalk clear');
    assert.ok(crossSpace>=d*.5+4.35-1e-6,
      'cross street and sidewalk clear');
  }
});
test('gapfill buildings do not overlap neighboring parcels',()=>{
  for(const lot of fills)for(const neighbor of brooklyn){
    if(lot===neighbor)continue;
    const overlapX=Math.abs(lot[0]-neighbor[0])<
      (lot[2]+neighbor[2])*.5+1.25;
    const overlapZ=Math.abs(lot[1]-neighbor[1])<
      (lot[3]+neighbor[3])*.5+1.25;
    assert.equal(overlapX&&overlapZ,false,
      'building overlap near '+lot[0].toFixed(1)+', '+lot[1].toFixed(1));
  }
});
test('gapfill buildings keep away from real runway and enabled railway guard bands',()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  for(const lot of fills){
    const [x,z,w,d]=lot,track=city.railway,runway=city.runway;
    const dist=Math.hypot(x-clamp(x,track.west,track.east),z-track.z);
    if(track.enabled)assert.ok(Math.abs(dist-track.radius)>=4+Math.hypot(w,d)*.43,
      'only an explicitly enabled legacy rail corridor reserves land');
    assert.equal(Math.abs(x-runway.x)<runway.halfLength+w/2+5 &&
      Math.abs(z-runway.z)<runway.halfWidth+d/2+5,false,
    'runway clear');
  }
});

test('Brooklyn road ribbons are rendered as actual clear segments',async()=>{
  const streetSource=await readFile(
    new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
  const {buildNycStreetNetwork}=await import('data:text/javascript;base64,'+
    Buffer.from(streetSource).toString('base64'));
  const hash=(ix,iy,seed)=>{
    let n=(ix*374761393+iy*668265263+seed*1442695041)|0;
    n=(n^(n>>>13))*1274126177;
    return ((n^(n>>>16))>>>0)/4294967295;
  };
  const ground=new Function('city','hash','water','scale','clamp','return ('+
    functionSource('cityHeight')+')')(city,hash,12.2,54,
    (v,a,b)=>Math.max(a,Math.min(b,v)));
  const detailBand=(x,z)=>city.focusZones.some(zone=>
    (x-zone[0])**2+(z-zone[1])**2<zone[2]**2)?2:0;
  const isClear=(x,z,r=.1)=>!terrain.parcels.some(lot=>
    Math.abs(x-lot[0])<=lot[2]/2+r&&Math.abs(z-lot[1])<=lot[3]/2+r);
  let bridgeRibbons=0;
  const stats=buildNycStreetNetwork({
    addQuad(){},addTri(){},box(){},beam(){},
    ribbon(a,b){
      if(a[0]>210&&a[0]<435&&a[2]>-415&&a[2]<-195)
        bridgeRibbons++;
    },
    terrainAt:(x,z)=>ground(x,z)*54,
    detailBand,grid:city,streetY:14.86,waterY:12.2,
    timesBounds:city.timesSquareBounds,
    existingStreets:city.streets,isClear
  });
  assert.ok(stats.avenues>=35,'several Brooklyn avenues accepted');
  assert.ok(stats.streets>=90,'cross streets grow across the bridgehead');
  assert.ok(bridgeRibbons>300,'nonempty visible Brooklyn street batch');
});
