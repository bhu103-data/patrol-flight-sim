// Camera-backed Times Square FID 384606 wall: production GIS fixture, not
// synthetic test parcels. Checks the exact original masonry and roof geometry.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildTimesSquareGisInfill} from '../assets/nyc/nyc-gis-infill.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const asset=JSON.parse(await readFile(new URL('../assets/nyc/times-square-footprints.json',import.meta.url),'utf8'));
const source=await readFile(new URL('../assets/nyc/nyc-gis-infill.js',import.meta.url),'utf8');
const start=html.indexOf('    const blocks=[',html.indexOf('function buildTimesSquareDistrict('));
const stop=html.indexOf('    ];',start);
assert.ok(start>0&&stop>start,'actual named Times Square sites');
const protectedSites=new Function(html.slice(start,stop+6)+'return blocks')();
const marker='if(rec.fid===384606 && h>5.5';
assert.ok(source.includes(marker),'verified FID low-rise glazing gate');
const withoutFix=new Function(source.replace(
 'export function buildTimesSquareGisInfill','function buildTimesSquareGisInfill')
 .replace(marker,'if(false && rec.fid===384606 && h>5.5')+
 ';return buildTimesSquareGisInfill')();

function generate(build){
 const quads=[],triangles=[];
 const stats=build(asset,{ground:14.95,bounds:[-34,56,-52,68],
  protectedSites,addQuad:(...args)=>quads.push(args),
  addTri:(...args)=>triangles.push(args),box:()=>{}});
 return {quads,triangles,stats};
}
function distanceFromSegment(p,a,b){
 const dx=b[0]-a[0],dz=b[2]-a[2],d2=dx*dx+dz*dz;
 const t=d2?Math.max(0,Math.min(1,
  ((p[0]-a[0])*dx+(p[2]-a[2])*dz)/d2)):0;
 return Math.hypot(p[0]-a[0]-t*dx,p[2]-a[2]-t*dz);
}
const before=generate(withoutFix),after=generate(buildTimesSquareGisInfill);
const added=[];
let matched=0;
for(const q of after.quads){
 if(matched<before.quads.length &&
   JSON.stringify(q)===JSON.stringify(before.quads[matched]))matched++;
 else added.push(q);
}

test('verified Times Square FID 384606 contributes genuinely new visible glazing',()=>{
 const rec=asset.features.find(f=>f.fid===384606);
 assert.ok(rec,'municipal FID 384606 must be in the bundled source');
 const height=Math.max(3.3,Math.min(66,rec.heightFt*.3048*.32));
 assert.ok(Math.abs(height-5.97993216)<.001);
 assert.equal(before.stats.storefrontQuads,0);
 assert.equal(after.stats.storefrontQuads,added.length);
 assert.ok(added.length>=120&&added.length<=250,'strict near-camera geometry budget');
 assert.ok(added.filter(q=>q[5]===7).length>=24,'genuine batched glass panes');
 assert.ok(added.some(q=>q[5]===7&&q.slice(0,4).some(p=>
  p[0]>20.8&&p[0]<24.8&&p[2]>1&&p[2]<10.5)),
  'camera-facing 44th Street wall must receive glass, not an unrelated lot');
});
test('GIS roofs, parcels, existing windows and original face order survive unchanged',()=>{
 assert.deepEqual(after.triangles,before.triangles,
  'no existing municipal roof triangulation changed');
 assert.equal(matched,before.quads.length,
  'every old wall/window quad survives in its original order');
 for(const key of ['sourceBuildings','infillPieces','roofTriangles','windowQuads'])
  assert.equal(after.stats[key],before.stats[key],key+' must stay unchanged');
 assert.deepEqual(after.stats.materialSurfaceIds,before.stats.materialSurfaceIds);
 assert.equal(before.stats.sourceBuildings,33);
 assert.equal(before.stats.infillPieces,74);
 // Source polygons and all original face ordering survive the storefront
 // delta; the infill window budget is now fairly spread across later FIDs.
 assert.ok(before.stats.windowQuads>500&&before.stats.windowQuads<=2200,
   'bounded GIS glazing must remain present after fair coverage');
});
test('new glazing remains close to the FID wall and under the original roof',()=>{
 const rec=asset.features.find(f=>f.fid===384606);
 const top=14.95+Math.max(3.3,Math.min(66,rec.heightFt*.3048*.32));
 const faceColor=[.43,.36,.34].map(v=>v*.92);
 const originalFaces=before.quads.filter(q=>q[5]===6&&
  q[4].every((c,i)=>Math.abs(c-faceColor[i])<1e-7)&&
  Math.abs(q[2][1]-top)<.0001);
 assert.ok(originalFaces.length>=12,'real front wall, not an invented parcel');
 for(const q of added){
  assert.ok(q[5]===6||q[5]===7,'reuse existing PBR surface classes only');
  for(const p of q.slice(0,4)){
   assert.ok(p.every(Number.isFinite));
   assert.ok(p[1]>=14.95+.47&&p[1]<top-.50,
    'no added geometry through the roof or below the original building');
   const nearest=Math.min(...originalFaces.map(f=>distanceFromSegment(p,f[0],f[1])));
   assert.ok(nearest<=.081,'facade must stay within 8.1cm of source polygon walls');
  }
 }
});
