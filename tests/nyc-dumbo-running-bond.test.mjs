// Validate scale-correct, antialiased Brooklyn brick in the production shader.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=page.indexOf('void nyOfficialGisPbr(');
const end=page.indexOf('void alaskaGlacierFace(',start);
assert.ok(start>0&&end>start,'NYC source-aware masonry shader exists');
const pbr=page.slice(start,end);

test('running bond applies only to Brooklyn procedural wall material 12',()=>{
 assert.ok(pbr.includes('!uManhattanView'),'other maps retain original shader');
 assert.ok(pbr.includes('vHarborSurface>11.5 && vHarborSurface<12.5'));
 assert.ok(pbr.includes('PATROL_DUMBO_RUNNING_BOND_V1'));
 assert.ok(pbr.includes('roughness=mix(roughness,.85,mortar*nearDetail*.45)'));
});
test('brick dimensions approximate true urban brick courses, not giant cuboids',()=>{
 assert.ok(pbr.includes('PATROL_DUMBO_BRICK_REAL_SCALE_V2'));
 assert.ok(pbr.includes('dot(vWorld,t)*4.60,vWorld.y*11.60'));
 const width=1/4.6,height=1/11.6;
 assert.ok(width>.19 && width<.24,'module width 19-24 cm');
 assert.ok(height>.075 && height<.095,'module height 7.5-9.5 cm');
 const wrap=n=>n-Math.floor(n),joint=(x,row)=>wrap(x*4.6+(row%2)*.5);
 assert.ok(Math.abs(joint(.21,0)-joint(.21,1))>.45);
 assert.equal(joint(.21,0),joint(.21,2));
 assert.equal(joint(.21,1),joint(.21,3));
 assert.ok(pbr.includes('brick.x+=mod(course,2.0)*.5'));
});
test('mortar and fired clay fade before becoming subpixel shimmer',()=>{
 assert.ok(pbr.includes('max(fwidth(brick.x),fwidth(brick.y))'));
 assert.ok(pbr.includes('brickVisible=1.0-smoothstep(.30,.92,texel)'));
 assert.ok(pbr.includes('mortar=max(vertical,horizontal)*brickVisible'));
 assert.ok(pbr.includes('fwidth(brick)*.92'));
 assert.ok(pbr.includes('smoothstep(.036,.077+aa.x,edge.x)'));
 assert.ok(pbr.includes('smoothstep(.044,.086+aa.y,edge.y)'));
 assert.ok(pbr.includes('nyStreetNoise(vec2(floor(brick.x),course)'));
 assert.ok(pbr.includes('albedo*.61,mortar*nearDetail*.67'));
 const visible=x=>{
  const t=Math.max(0,Math.min(1,(x-.30)/(.92-.30)));
  return 1-(t*t*(3-2*t));
 };
 assert.ok(visible(.12)>.99 && visible(.68)<.5 && visible(1.2)===0);
});
