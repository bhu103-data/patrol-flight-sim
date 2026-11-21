// Execute the production Alaska site-survey and path clipping functions
// against artificial narrow inlets to catch false-dry foundations and roads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

function extract(from,to){
  const a=html.indexOf(from),b=html.indexOf(to,a+from.length);
  assert.ok(a>0&&b>a,'missing production land/water function '+from);
  return html.slice(a,b);
}

const survey=extract('  function findScenerySite(', '  function createMapScenery()');
const siteFor=terrain=>new Function('sampleTerrainHeight','selectedMap',
  'NYC_FLIGHT_RADIUS','FLIGHT_RADIUS','cityLotAt','WATER_H',
  survey+';return findScenerySite;')(
  terrain,{alaska:true},840,840,()=>null,12.2);

test('Alaska foundations reject a narrow water inlet missed by corners',()=>{
  const allDry=siteFor(()=>18);
  assert.deepEqual(allDry(0,0,{footprint:7,range:0}),{x:0,z:0,y:18});
  // One tiny inlet crosses the interior grid at (3.5,0), not the
  // foundation center or its four corners at (±7,±7).
  const inlandPocket=siteFor((x,z)=>
    Math.hypot(x-3.5,z)<.13?12.2:18);
  assert.equal(inlandPocket(0,0,{footprint:7,range:0}),null);
  assert.match(html,/ALASKA_FULL_FOOTPRINT_V1/);
});

const pathSrc=extract('    const terrainPath=(points,width,color,lift=0.09)=>{',
  '    const walkwayRail=');
const pathFor=(terrain,quads)=>new Function('addQuad','level','lerp',
  'sampleTerrainHeight','selectedMap','WATER_H',
  pathSrc+';return terrainPath;')(
  (a,b,c,d)=>quads.push([a,b,c,d]),terrain,
  (a,b,t)=>a+(b-a)*t,terrain,{alaska:true},12.2);

test('Alaska paths clip wet strips but preserve dry pieces',()=>{
  const dry=[];pathFor(()=>18,dry)([[0,0],[24,0]],4,[.5,.5,.5]);
  assert.ok(dry.length>=7,'baseline dry path should be connected');
  const terrain=(x,z)=>x>=7&&x<=14?12.2:18;
  const clipped=[];pathFor(terrain,clipped)([[0,0],[24,0]],4,[.5,.5,.5]);
  assert.ok(clipped.length>0 && clipped.length<dry.length,
    'only water-crossing pieces must disappear');
  for(const quad of clipped)for(const p of quad)
    assert.ok(terrain(p[0],p[2])>13.12,'no road vertex may touch the fjord');
  assert.match(html,/ALASKA_SAFE_ROAD_GATE_V1/);
});