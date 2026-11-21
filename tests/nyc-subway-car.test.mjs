import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const a=html.indexOf('  function buildStreetVehicle(');
const b=html.indexOf('  const streetMeshes=',a);
assert.ok(a>0&&b>a,'NYC street vehicle generator must be extractable');
const boxes=[];
const make=new Function('createTriangleMesh','addModelBox','addVegasLettering',
  html.slice(a,b)+';return buildStreetVehicle;')(
  ()=>({addTri(){},addQuad(){},upload(){return {boxes}}}),
  (_quad,...parts)=>{boxes.push(parts);},()=>{});

test('modern NYC railcar has multiple flush glass windows and paired subway doors',()=>{
  boxes.length=0;
  make('train');
  assert.ok(boxes.length>=110&&boxes.length<160,
    'single batched subway car stays within a bounded detail budget');
  const windows=boxes.filter(b=>b.at(-1)===5);
  assert.ok(windows.length>=18,'side glazing and end cab must use glass material');
  const doors=boxes.filter(b=>Math.abs(b[3]-.058)<.001&&Math.abs(b[4]-1.94)<.001);
  assert.equal(doors.length,6,'three door portals on each side');
  const undercarriage=boxes.filter(b=>Math.abs(b[1]-.22)<.001&&Math.abs(b[4]-.33)<.001);
  assert.equal(undercarriage.length,2,'two low-profile steel bogies');
});

test('NYC train uses muted stainless silver, not one untextured white box',()=>{
  boxes.length=0;make('train');
  assert.deepEqual(boxes[0].at(-1),[.54,.59,.61]);
  assert.equal(boxes[0][5],12.62,'full-length rolling-stock shell is preserved');
  assert.ok(boxes.some(b=>b.at(-1)?.[2]===.43),
    'separate subdued blue side stripe');
});
