// Run: node --test tests/nyc-oti-footprints.test.mjs
// Public NYC OTI GIS snapshot. Zero external runtime dependencies.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../index.html',import.meta.url),'utf8');
const snapshot=JSON.parse(await readFile(
  new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
const pick=(from,to)=>{
  const a=source.indexOf(from),b=source.indexOf(to,a+from.length);
  assert.ok(a>0&&b>a,'missing game helper '+from);
  return source.slice(a,b);
};
const mesh=new Function(pick('  function buildOfficialFootprintMesh(',
  '  function buildCityBuildings(')+'return buildOfficialFootprintMesh;')();
const contains=new Function(pick('  function insideCityFootprint(',
  '  function setupCityLots(')+'return insideCityFootprint;')();
const area=(p)=>Math.abs(p.reduce((a,b,i)=>
  a+b[0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*b[1],0))*.5;
const triArea=(a,b,c)=>{
  const u=[b[0]-a[0],b[2]-a[2]],v=[c[0]-a[0],c[2]-a[2]];
  return Math.abs(u[0]*v[1]-u[1]*v[0])*.5;
};

test('NYC government provenance, schema, unique building identifiers and bounded input',()=>{
  assert.equal(snapshot.schema,'patrol-nyc-oti-footprints-v1');
  assert.match(snapshot.provider,/NYC Office of Technology and Innovation/);
  assert.equal(snapshot.footprints.length,60);
  assert.equal(new Set(snapshot.footprints.map(x=>x[0])).size,60);
  for(const [id,x,z,w,d,h,poly] of snapshot.footprints){
    assert.ok(id>0&&w>.7&&d>.7&&h>=4&&h<=48);
    assert.ok(x>=-155&&x<=-50&&z>=-510&&z<=-408);
    assert.ok(poly.length>=3&&poly.length<=36);
    assert.ok(poly.every(p=>p.length===2&&p.every(Number.isFinite)));
    assert.ok(area(poly)>1);
    assert.ok(contains(x,z,poly),'projected footprint center should be inside itself');
  }
});

test('all official roof geometries are finite and cover the actual polygon (including concave footprints)',()=>{
  let totalWalls=0,totalWindows=0,totalTriangles=0;
  for(const [id,x,z,w,d,h,poly] of snapshot.footprints){
    let fill=0,triangles=0,invalid=0;
    const check=p=>{assert.equal(p.length,3);assert.ok(p.every(Number.isFinite));};
    const stats=mesh((a,b,c,color)=>{[a,b,c].forEach(check);
      const area=triArea(a,b,c);assert.ok(area>.000001,'nondegenerate roof');fill+=area;triangles++;
    },(a,b,c,d,color)=>{[a,b,c,d].forEach(check);
      assert.ok(triArea(a,b,c)>.000001,'nondegenerate wall/ornament');
    },[x,z,w,d,h,(id%101)/101,false,poly,id],14.58,3);
    assert.ok(Math.abs(fill-area(poly))<Math.max(.04,area(poly)*.015),
      'roof triangles cover municipal outline '+id);
    assert.ok(stats.windows<260&&stats.roof<=poly.length-2);
    totalWalls+=stats.walls;totalWindows+=stats.windows;totalTriangles+=triangles;
  }
  assert.ok(totalWalls>=500&&totalWindows<7000&&totalTriangles>500);
});

test('worker terrain snapshot and city collision index remain connected',()=>{
  assert.match(source,/officialLots=city&&Array\.isArray\(city\.officialFootprints\)/);
  assert.match(source,/officialLotAt\(east,north\)\|\|cityParcels\.get/);
  assert.match(source,/cityParcels\.set\(-10000000-i,officialLots\[i\]\)/);
  assert.match(source,/if\(!lot\[7\]\|\|insideCityFootprint\(x,z,lot\[7\]\)\)/);
  assert.match(source,/buildOfficialFootprintMesh\(addTri,addQuad,lot,y,detailBand\)/);
  assert.match(source,/official-financial-footprints\.json/);
});

test('terrain worker generates at least 50 official buildings with finite heights',()=>{
  const generator=new Function(pick('  function* generateTerrain(options) {',
    '  const workerSrc =')+'return generateTerrain;')();
  const city={
    tilt:.24,offset:30,blockWidth:24,blockLength:33,
    parkCenter:206,parkHalfLength:151,parkHalfWidth:43,
    landmarks:[{kind:'trade',x:-85,z:-398,w:17,d:17}],
    focusZones:[[-90,-453,118,169]],streets:[],
    timesSquareBounds:[-34,56,-52,68],
    railway:{west:250,east:400,z:-342,radius:4},
    runway:{x:354,z:-389,halfLength:40,halfWidth:8},
    officialFootprints:snapshot.footprints
  };
  let result;
  for(const msg of generator({size:96,span:1920,scale:54,water:12.2,
    city,landmarks:city.landmarks})){
    if(msg?.type==='done')result=msg;
  }
  assert.ok(result);
  const real=result.parcels.filter(lot=>lot[8]);
  assert.ok(real.length>=50&&real.length<=60);
  assert.ok(result.parcels.length>=real.length);
  assert.ok(Array.from(result.height).every(Number.isFinite));
});
