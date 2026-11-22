// node --test tests/nyc-petalwake-road-chunks.test.mjs
// MIT source provenance: assets/nyc/PETALWAKE_MIT_NOTICE.md
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// PATROL has no package.json type=module, so import the browser ES module
// through a data URL for Node 18/20 compatibility (same as existing road tests).
const moduleSource=await readFile(new URL(
  '../assets/nyc/petalwake-road-chunks.js',import.meta.url),'utf8');
const {buildNycBridgeheadDetailChunks,selectNycRoadChunkLod}=await import(
  'data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));

const grid={
  tilt:.24,offset:30,blockWidth:24,blockLength:33,
  parkHalfWidth:43,parkCenter:206,parkHalfLength:151
};
const mesh=()=>({quads:[],addQuad(...a){this.quads.push(a)}});
const props={
  makeMesh:mesh,terrainAt:()=>100,isClear:()=>true,detailBand:()=>3,
  grid,streetY:14.86,waterY:12.2,existingStreets:[]
};

test('Petalwake-style AABB distance selects true 3-level LOD, including altitude',()=>{
  const box={minX:0,maxX:24,minY:14,maxY:16,minZ:0,maxZ:24};
  assert.equal(selectNycRoadChunkLod(box,[12,15,12]),2);
  assert.equal(selectNycRoadChunkLod(box,[100,15,12]),1);
  assert.equal(selectNycRoadChunkLod(box,[200,15,12]),0);
  assert.equal(selectNycRoadChunkLod(box,[12,200,12]),0);
  assert.equal(selectNycRoadChunkLod(box,null),0);
});

test('deterministic contiguous blocks and upward-facing painted utility grates',()=>{
  const a=buildNycBridgeheadDetailChunks(props);
  const b=buildNycBridgeheadDetailChunks(props);
  assert.equal(a.length,4);
  assert.deepEqual(a.map(x=>x.id),b.map(x=>x.id));
  assert.deepEqual(a.map(x=>x.utility),b.map(x=>x.utility));
  assert.deepEqual(a.map(x=>x.bounds),b.map(x=>x.bounds));
  for(const chunk of a){
    assert.equal(chunk.mid.quads.length,5);
    assert.equal(chunk.near.quads.length,7);
    // The game shader identifies asphalt by a color-key neighborhood.
    // Metal drain covers must not inherit asphalt's wet-road reflection.
    for(const quad of [...chunk.mid.quads,...chunk.near.quads]){
      const tint=quad[4];
      const asphaltA=[.25,.28,.30],asphaltB=[.28,.29,.32];
      const dist=key=>Math.hypot(...tint.map((v,k)=>v-key[k]));
      assert.ok(dist(asphaltA)>=.137&&dist(asphaltB)>=.128,
        'street utility metal overlaps wet asphalt shader color key');
    }
    for(const q of [...chunk.mid.quads,...chunk.near.quads]){
      const [A,B,C]=q,d1=B.map((x,i)=>x-A[i]),d2=C.map((x,i)=>x-A[i]);
      // PATROL's geometric cross-product must face upward for culling.
      const ny=d1[2]*d2[0]-d1[0]*d2[2];
      assert.ok(ny>0,'grate quad is wound downward');
    }
    assert.equal(selectNycRoadChunkLod(chunk.bounds,
      [chunk.utility[0],16,chunk.utility[2]]),2);
    assert.equal(selectNycRoadChunkLod(chunk.bounds,
      [chunk.utility[0],16,chunk.utility[2]+70]),1);
    assert.equal(selectNycRoadChunkLod(chunk.bounds,
      [chunk.utility[0],16,chunk.utility[2]+250]),0);
  }
});

test('fully occupied or submerged corridors emit no new road geometry',()=>{
  assert.equal(buildNycBridgeheadDetailChunks({...props,isClear:()=>false}).length,0);
  assert.equal(buildNycBridgeheadDetailChunks({...props,terrainAt:()=>0}).length,0);
  assert.equal(buildNycBridgeheadDetailChunks({...props,detailBand:()=>1}).length,0);
});

test('actual NYC terrain and building footprints keep live bridgehead chunks',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const snapshot=JSON.parse(await readFile(new URL(
    '../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
  const expression=name=>{
    const i=html.indexOf('const '+name);
    assert.ok(i>=0,'missing '+name);
    const first=html.indexOf('=',i)+1,end=html.indexOf(';',first);
    return new Function('return ('+html.slice(first,end)+')')();
  };
  const functionSource=name=>{
    const i=html.indexOf('function '+name+'(');
    assert.ok(i>=0,'missing '+name);
    let depth=0,end=-1;
    for(let j=html.indexOf('{',i);j<html.length;j++){
      if(html[j]==='{')depth++;
      else if(html[j]==='}'&&--depth===0){end=j+1;break}
    }
    assert.ok(end>i,'invalid function '+name);
    return html.slice(i,end);
  };
  const routes=expression('CITY_STREETS'),express=expression('CITY_EXPRESSWAY');
  const city={...grid,parkWaters:[],landmarks:[],
    officialFootprints:snapshot.footprints,
    streets:[...routes,express.points,express.ramp],
    focusZones:expression('NYC_FOCUS_ZONES'),
    railway:expression('BROOKLYN_RAIL'),runway:expression('HARBOR_RUNWAY'),
    timesSquareBounds:expression('TIMES_SQUARE').bounds};
  const tag='function* generateTerrain(options)',start=html.indexOf(tag);
  assert.ok(start>=0,'generator missing');
  let depth=0,end=-1;
  for(let k=html.indexOf('{',start);k<html.length;k++){
    if(html[k]==='{')depth++;
    else if(html[k]==='}'&&--depth===0){end=k+1;break}
  }
  const generate=new Function('return ('+html.slice(start,end)+')')();
  const terrain=[...generate({size:64,span:1920,landmarks:[],scale:54,
    water:12.2,city})].find(x=>x?.type==='done');
  assert.ok(terrain,'terrain generation failed');
  const hash=(ix,iy,seed)=>{
    let n=(ix*374761393+iy*668265263+seed*1442695041)|0;
    n=(n^(n>>>13))*1274126177;
    return ((n^(n>>>16))>>>0)/4294967295;
  };
  const ground=new Function('city','hash','water','scale','clamp',
    'return ('+functionSource('cityHeight')+')')(
    city,hash,12.2,54,(v,a,b)=>Math.max(a,Math.min(b,v)));
  const details=(x,z)=>city.focusZones.some(zone=>
    (x-zone[0])**2+(z-zone[1])**2<zone[2]**2)?2:0;
  const clear=(x,z,r=.1)=>!terrain.parcels.some(lot=>
    Math.abs(x-lot[0])<=lot[2]/2+r&&
    Math.abs(z-lot[1])<=lot[3]/2+r);
  const chunks=buildNycBridgeheadDetailChunks({
    ...props,grid:city,terrainAt:(x,z)=>ground(x,z)*54,
    isClear:clear,detailBand:details,existingStreets:city.streets
  });
  assert.equal(chunks.length,4,'bridgehead layout must survive real land checks');
  assert.ok(chunks.every(c=>c.mid.quads.length===5&&c.near.quads.length===7));
  // Draft #88 uses these authored CITY_STREETS for its proposed bridge
  // connector. This 2D clearance assertion is not a live vehicle test.
  const connector=routes[2];
  const distanceSegment=(x,z,a,b)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,
      ((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
  };
  const guardrailZ=-11*city.blockLength-(5.65/2+1.16);
  for(const chunk of chunks){
    const [x,,z]=chunk.utility;
    const distanceToRoute=Math.min(...connector.slice(1).map((p,i)=>
      distanceSegment(x,z,connector[i],p)));
    assert.ok(distanceToRoute>5.0,
      'grate intrudes into planned bridgehead vehicle corridor');
    assert.ok(z-guardrailZ>5.0,
      'north sidewalk grate overlaps #100 south-side guardrail');
  }
});

test('road LOD uses PATROL render lifecycle and rain is gated to NYC/wetness',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/nycRoadChunkLevel\(chunk.bounds,camPos\)/);
  assert.match(html,/disposeSceneMesh\(chunk.mid\)/);
  assert.match(html,/disposeSceneMesh\(chunk.near\)/);
  assert.match(html,/PATROL_NYC_BRIDGEHEAD_WET_REFLECTION_V1/);
  assert.match(html,/road<0\.01 \|\| wet<0\.025/);
  assert.match(html,/bridgeDetail=bridgeWetZone\*step\(1\.5,uNyStreetQuality\)/);
  assert.match(html,/float microfacet=a2\/\(3\.14159\*/);
  assert.match(html,/step\(0\.40,wet\)/);
  assert.match(html,/if\(selectedMap.city && nycRoadChunkLevel\)/);
});
