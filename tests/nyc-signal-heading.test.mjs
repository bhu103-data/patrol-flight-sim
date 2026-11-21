// Execute the production street generator; verify 3D traffic heads are
// oriented with Manhattan's diagonal avenues, not world-axis stickers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/nyc-street-network.js',import.meta.url),'utf8');
const {buildNycStreetNetwork}=await import('data:text/javascript;base64,'+
  Buffer.from(source).toString('base64'));
const grid={blockWidth:24,blockLength:33,tilt:.24,offset:30,
  parkHalfWidth:43,parkHalfLength:150,parkCenter:10000};

function render(){
  const quads=[];
  const stats=buildNycStreetNetwork({
    addQuad:(...q)=>quads.push(q),addTri(){},box(){},beam(){},ribbon(){},
    terrainAt:()=>100,detailBand:()=>3,grid,streetY:20,waterY:0,
    timesBounds:[900,1000,900,1000],existingStreets:[],isClear:()=>true,
    lettering(){},pavementText(){}
  });
  return {quads,stats};
}
const {quads,stats}=render();
const yellowShells=quads.filter(q=>Array.isArray(q[4])&&
  q[4].length===3&&Math.abs(q[4][0]-.86)<1e-8&&
  Math.abs(q[4][1]-.69)<1e-8&&Math.abs(q[4][2]-.24)<1e-8);
const direction=[grid.tilt,1].map(v=>v/Math.hypot(grid.tilt,1));
function facing(q){
  const [a,b,,d]=q;
  const vx=b[0]-a[0],vz=b[2]-a[2],dy=d[1]-a[1];
  if(Math.abs(dy)<.65)return null;
  const nx=-vz*dy,nz=vx*dy,len=Math.hypot(nx,nz);
  return len<1e-8?null:{dot:(nx*direction[0]+nz*direction[1])/len,
    xSpan:Math.abs(vx),zSpan:Math.abs(vz)};
}

test('yellow signal housings include angled 3D faces that look up the avenue',()=>{
  assert.ok(stats.signals>10,'live NYC street grid emits signal heads');
  assert.ok(yellowShells.length>=stats.signals*3,
    'traffic heads have side, rear and top shell geometry');
  const faces=yellowShells.map(facing).filter(Boolean);
  const aligned=faces.filter(f=>f.dot>.98&&f.xSpan>.10&&f.zSpan>.02);
  assert.ok(aligned.length>=stats.signals,
    'every signal has at least one substantial street-aligned housing face');
  assert.ok(faces.every(f=>Number.isFinite(f.dot)),'finite rotated normals');
});

test('each traffic light keeps three colored circular lenses and no new renderer',()=>{
  const pigment=quads.filter(q=>Array.isArray(q[4])&&
    // Bright and darkened RGB signal glass are separate from pavement greys.
    (Math.abs(q[4][0]-.72)<1e-8&&Math.abs(q[4][1]-.12)<1e-8||
     Math.abs(q[4][0]-.15)<1e-8&&Math.abs(q[4][1]-.60)<1e-8));
  assert.ok(pigment.length>stats.signals*3,
    'round red/green lens segments remain true geometry');
  assert.ok(quads.length<40000,'keep geometry within the shared street draw batch');
  assert.equal(stats.signals>0,true);
});
