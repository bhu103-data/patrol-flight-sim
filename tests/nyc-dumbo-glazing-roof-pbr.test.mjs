// Validate the actual fragment shader's bounded DUMBO facade treatments.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('void nyOfficialGisPbr(');
const end=html.indexOf('void alaskaGlacierFace(',begin);
assert.ok(begin>0&&end>begin);
const shader=html.slice(begin,end);

test('warehouse glass changes only surface 13 and not municipal glass',()=>{
 assert.match(shader,/PATROL_DUMBO_WINDOW_DEPTH_V2/);
 assert.match(shader,/if\(vHarborSurface>12\.5 && vHarborSurface<13\.5\)/);
 assert.match(shader,/vec2 bayId=floor\(bay\)/);
 assert.match(shader,/nyStreetHash\(bayId\+vec2\(21\.7,73\.9\)\)/);
 assert.match(shader,/nyStreetHash\(bayId\+vec2\(84\.3,9\.1\)\)/);
 assert.match(shader,/float blind=step\(\.78,interior\)/);
 assert.match(shader,/pane=mix\(pane,room,nearDetail/);
 assert.doesNotMatch(shader,/texture\(uNyAsphaltPhoto/);
});

test('roof repairs only modify tagged Brooklyn roof plane 14',()=>{
 assert.match(shader,/PATROL_DUMBO_ROOF_SURFACE_V2/);
 assert.match(shader,/if\(vHarborSurface>13\.5 && vHarborSurface<14\.5\)/);
 assert.match(shader,/vec2 seams=abs\(fract\(tarUv\)-\.5\)/);
 assert.match(shader,/float seamX=smoothstep\(\.46,\.495\+aa\.x,seams\.x\)/);
 assert.match(shader,/float seamZ=smoothstep\(\.46,\.495\+aa\.y,seams\.y\)/);
 assert.match(shader,/fwidth\(tarUv\)\*1\.3/);
 assert.match(shader,/nearDetail\*\(line\*\.17\+patches\*\.21\)/);
});

test('roof seam coverage is sparse and periodic, not all black rooftops',()=>{
 const smooth=(a,b,v)=>{const x=Math.max(0,Math.min(1,(v-a)/(b-a)));return x*x*(3-2*x)};
 let blackened=0;
 for(let i=0;i<1000;i++){
  const f=i/1000,seam=Math.abs(f-.5);
  const s=smooth(.46,.495+.004,seam);
  if(s>.5)blackened++;
 }
 assert.ok(blackened>45&&blackened<130,'approximately 8% joint area');
 const world=(u,v)=>[Math.abs((u*.28%1)-.5),Math.abs((v*.28%1)-.5)];
 const [x0,z0]=world(6.8,13.2);
 const [x1,z1]=world(6.8+1/.28,13.2+1/.28);
 assert.ok(Math.abs(x0-x1)<1e-8&&Math.abs(z0-z1)<1e-8,
  'tar repair grid remains stable in world space');
});
