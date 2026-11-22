// Real production NYC landmark scope, not another standalone preview.
import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const from=src.indexOf('  function buildOneTimesSkywalk(addTri,addQuad){');
const to=src.indexOf('  function buildNewYorkLandmark(kind) {',from);
assert(from>0&&to>from,'Could not locate production One Times Skywalk helper');
const helper=src.slice(from,to);
const norms=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],
  a[0]*b[1]-a[1]*b[0]];
// Same actual closed-section beam helper as used by the production renderer.
const bStart=src.indexOf('  function addRideBeam(addQuad,a,b,width,color) {');
const bEnd=src.indexOf('  function buildVegasRides(geometry) {',bStart);
assert(bStart>0&&bEnd>bStart);
const beamSource=src.slice(bStart,bEnd);
const construct=Function('v3Norm','v3Cross',
  beamSource+'\n'+helper+'\nreturn buildOneTimesSkywalk;');
const builder=construct(norms,cross);

function build(){
  const faces=[];
  const emit=(pts,color,mat)=>{
    assert(pts.every(p=>p?.length===3&&p.every(Number.isFinite)));
    assert(color.every(Number.isFinite));
    faces.push({pts,color,material:mat||0});
  };
  const stats=builder(
    (a,b,c,col,m)=>emit([a,b,c],col,m),
    (a,b,c,d,col,m)=>emit([a,b,c,d],col,m));
  return {faces,stats};
}

test('2026 engineering reference: measured 55-ft north projection mapped once',()=>{
  const {stats}=build();
  assert.equal(stats.enabled,true);
  assert.equal(stats.realCantileverFeet,55);
  assert.equal(stats.sourceRoofFeet,337);
  assert.ok(Math.abs(stats.northProjectionGameUnits-55*30.9/337)<1e-10);
  assert(stats.northProjectionGameUnits>4&&stats.northProjectionGameUnits<6);
});
test('not a stretched box: roof triangulation, actual trusses and distinct panes',()=>{
  const {faces,stats}=build();
  assert(stats.beams>=20,'A real truss/rail support pattern is required');
  assert(stats.panes>=5,'Glass rail spans must be present');
  assert(faces.some(x=>x.material===10),'Existing PBR glass surface id');
  assert(faces.some(x=>x.pts.length===3),'Six-vertex roof triangulation');
  assert(faces.some(x=>x.pts.length===4),'Structurally deep profiles');
  const actualTriangles=faces.reduce((n,f)=>n+(f.pts.length===3?1:2),0);
  assert.equal(stats.triangles,actualTriangles);
  assert.equal(stats.vertexBudget,actualTriangles*3);
  assert(stats.triangles<600,'Keep bounded geometry');
  assert.equal(stats.newTextures,0);
  assert.equal(stats.addedDrawCalls,0);
});
test('deck projects north from the existing actual landmark, not across other maps',()=>{
  const {faces,stats}=build();
  const positions=faces.flatMap(f=>f.pts);
  assert(positions.some(p=>p[2]>11),'55-ft projection has visible shape');
  assert(positions.some(p=>p[2]<6.3),'Truss structure connects near facade');
  assert(positions.every(p=>p[1]>26.2&&p[1]<30),
    'Skywalk should not cross legacy lower LED sign or rooftop mast');
  assert(stats.deckY>26.28,'Deck must avoid old uppermost LED art');
  const switchStart=src.indexOf("} else if (kind === 'times') {");
  assert(switchStart>0&&src.slice(switchStart,switchStart+2000)
    .includes('buildOneTimesSkywalk(addTri,addQuad)'),
  'Not inserted into production landmark mesh');
  assert(src.includes("new URLSearchParams(location.search).get('nycSkywalk')==='on'"));
  assert(src.includes('if (kind === \'liberty\')'));
});
test('no external images, fake measured window counts or new controls',()=>{
  assert(!helper.includes('fetch('));
  assert(!helper.includes('new Image('));
  assert(!helper.includes('localStorage'));
  assert(!helper.includes('renderShip'));
  assert(!helper.includes('CITY_EXPRESSWAY'));
  assert(!helper.includes('newYorkMeshes='));
  assert(!helper.includes('setInterval('));
  assert(!helper.includes('solidAt('));
  assert(src.slice(from-900,from).includes('NOT a digital twin/as-built BIM'));
});
