// Bounded PBR light/reflection for anonymous NYC apartment & office panes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('void nyManhattanGenericGlazing(');
const b=html.indexOf('void alaskaGlacierFace(',a);
assert.ok(a>0&&b>a,'NYC anonymous-window shader exists');
const src=html.slice(a,b);

test('window reflections only affect generic Manhattan building pane surface 5',()=>{
 assert.ok(html.slice(Math.max(0,a-360),b).includes('PATROL_NYC_ANON_WINDOW_REFLECTION_V1'),
   'the source marker must annotate the reflection shader declaration');
 for(const gate of ['!uManhattanView','!uCityFacade','!uSmooth',
   'uNyStreetQuality<1.5','vHarborSurface<4.5',
   'vHarborSurface>5.5','abs(n.y)>.35'])
  assert.ok(src.includes(gate),'missing isolation guard '+gate);
 assert.ok(src.includes('smoothstep(80.0,270.0,distance(vWorld,uEye))'));
});
test('office panes have stable per-window reflections and different occupancy',()=>{
 for(const detail of ['floor(vec2(dot(vWorld,tangent)*.77,vWorld.y*.41))',
   'nyStreetHash(bay+vec2(17.3,53.7))',
   'nyStreetHash(bay+vec2(91.1,7.9))',
   'pow(1.0-clamp(facing,0.0,1.0),5.0)',
   'step(.83,office)','roughness=mix(roughness,.19+.13*blind,close*.80)'])
  assert.ok(src.includes(detail),'missing PBR variation '+detail);
});
test('shader executes after GIS but affects neither cars nor other maps',()=>{
 const compose=html.indexOf('nyBuildingPbr(material,n,surfaceRoughness)');
 const official=html.indexOf('nyOfficialGisPbr(material,n,surfaceRoughness)',compose);
 const anonymous=html.indexOf('nyManhattanGenericGlazing(material,n,surfaceRoughness)',official);
 assert.ok(compose>0&&official>compose&&anonymous>official);
 assert.ok(html.includes('drawMeshWithOutline(backgroundBuildings,identity,false,true,true,visible)'));
 assert.ok(html.includes('function drawMeshWithOutline(mesh,modelMat,emissive=false,cityFacade=false'));
 assert.ok(html.includes('drawCityTraffic(drawMeshWithOutline)'));
});
