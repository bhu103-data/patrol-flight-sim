// Geometry-first regression: execute the ACTUAL WebGL mesh-roofline helper.
// These three game-scale infill parcels are not surveyed DUMBO structures.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function extract(name){
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,'missing production source: '+name);
  const first=html.indexOf('{',start);
  let depth=0;
  for(let i=first;i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}'&&--depth===0)return html.slice(start,i+1);
  }
  throw Error('unclosed '+name);
}
const roof=new Function(extract('buildDumboBridgeheadInfillRoofline')+
  '\nreturn buildDumboBridgeheadInfillRoofline')();
const apertures=new Function(extract('buildDumboBridgeheadInfillApertures')+
  '\nreturn buildDumboBridgeheadInfillApertures')();
const builderSource=extract('buildCityBuildings');
const sites=[
  [269.6,-351.5,8.8,9.2,15.5,.41,false],
  [294.8,-346.5,8.8,13.8,13.4,.41,false],
  [318.8,-346.5,10.2,11.8,11.7,.41,false]
];
const grid={tilt:.24,offset:30,blockWidth:24,blockLength:33};
function seedFor(x,z){
  const gx=Math.floor((x-grid.tilt*z-grid.offset)/grid.blockWidth);
  const gz=Math.floor(z/grid.blockLength);
  return (Math.imul(gx,73856093)^Math.imul(gz,19349663)^
    Math.imul(gx*gz,83492791))>>>0;
}
function audit(lot){
  const [x,z,w,d,h]=lot,quads=[],triangles=[],boxes=[],beams=[],y=14.58;
  const meta=roof((...v)=>triangles.push(v),(...v)=>quads.push(v),
    (...v)=>boxes.push(v),(...v)=>beams.push(v),{
      x,y,z,w,d,h,seed:seedFor(x,z)%13,
      brick:[.54,.32,.27],stone:[.69,.65,.58]});
  return {lot,meta,quads,triangles,boxes,beams,roofY:y+h};
}
function build(lot,band=3,compat=false,smooth=true){
  const boxes=[],triangles=[],quads=[],beams=[],roofCalls=[];
  const makeMesh=()=>({addTri(...v){triangles.push(v)},
    addQuad(...v){quads.push(v)},upload(){return {boxes,quads,triangles,beams}}});
  const fn=new Function('createTriangleMesh','addModelBox','addRideBeam',
    'nycDetailBand','MANHATTAN_GRID','WATER_H','tintSeed',
    'addDowntownFacadeRelief','buildDumboBridgeheadInfillApertures',
    'buildDumboBridgeheadInfillRoofline','graphicsCompat',
    'smoothScenery','buildOfficialFootprintMesh',
    'return ('+builderSource+')')(
    makeMesh,(_add,...v)=>boxes.push(v),(_add,...v)=>beams.push(v),
    ()=>band,grid,12.2,()=>.5,()=>0,apertures,
    (...args)=>{roofCalls.push(1);return roof(...args)},
    compat,()=>smooth,()=>{});
  fn([lot]);
  return {boxes,triangles,quads,beams,roofCalls};
}

test('three adjacent DUMBO infill roofs have distinct actual parapet profiles',()=>{
  const audits=sites.map(audit);
  assert.equal(new Set(audits.map(a=>a.meta.style)).size,3,
    'adjacent lots must not receive cloned roofline profiles');
  for(const a of audits){
    assert.ok(a.meta.boxes>=20&&a.meta.boxes<=29);
    assert.equal(a.meta.quads,2,'two real tilted glass rooflight panels');
    assert.equal(a.meta.triangles,2,'rooflight has physical triangular endcaps');
    assert.equal(a.meta.beams,5,'rooflight has two pairs of rafters and a ridge');
    assert.equal(a.quads.length,2);
    for(const pane of a.quads){
      assert.equal(pane.at(-1),13,'rooflight needs glass material, not masonry');
      assert.ok(new Set(pane.slice(0,4).map(p=>p[1].toFixed(4))).size===2,
        'the rooflight must slope in actual 3D, not be a flat decal');
    }
  }
});

test('roofline geometry stays inside cleared lot and under old equipment-height budget',()=>{
  for(const a of sites.map(audit)){
    const [x,z,w,d]=a.lot,pts=[];
    for(const q of a.quads)pts.push(...q.slice(0,4));
    for(const t of a.triangles)pts.push(...t.slice(0,3));
    for(const b of a.beams)pts.push(b[0],b[1]);
    for(const box of a.boxes){
      const [bx,by,bz,bw,bh,bd]=box;
      for(const sx of [-1,1])for(const sy of [-1,1])for(const sz of [-1,1])
        pts.push([bx+sx*bw*.5,by+sy*bh*.5,bz+sz*bd*.5]);
    }
    assert.ok(pts.length>90);
    for(const p of pts){
      assert.ok(p.every(Number.isFinite));
      assert.ok(Math.abs(p[0]-x)<w*.5+.10 &&
        Math.abs(p[2]-z)<d*.5+.10,
        'roof component extends past the old parcel clearance margin');
      assert.ok(p[1]>=a.roofY-.065 && p[1]<=a.roofY+.90,
        'new rooftop detail crosses ground or original equipment envelope');
    }
    assert.ok(a.meta.maxNewHeight<=a.roofY+.90);
    const conservativeTris=a.boxes.length*12+a.quads.length*2+
      a.triangles.length+a.beams.length*12;
    assert.ok(conservativeTris<450,'roofline exceeds local triangle budget');
  }
});

test('only the three chosen LOD3 parcels receive roofline; fallback remains',()=>{
  for(const lot of sites){
    assert.equal(build(lot,3,false,true).roofCalls.length,1);
    assert.equal(build(lot,2,false,true).roofCalls.length,0);
    assert.equal(build(lot,1,false,true).roofCalls.length,0);
    assert.equal(build(lot,3,true,true).roofCalls.length,0);
    assert.equal(build(lot,3,false,false).roofCalls.length,0);
  }
  for(const lot of [
    [278.7,-313.6,9,16,12.7,.41,false],
    [372,-285,9,18,17,.41,false],
    [342.76,-346.16,9,19,13.82,.41,false],
    [-78,-335,9,19,23.5,.41,false]
  ])assert.equal(build(lot).roofCalls.length,0,
    'do not rewrite special warehouse PR sites or Manhattan');
  const approved=[294.8,-346.5,8.8,13.8,13.4,.41,false,
    [[290,-352],[299,-352],[299,-340],[290,-340]]];
  assert.equal(build(approved).roofCalls.length,0,
    'OTI municipal footprint renderer must remain the authority');
});

test('new roofline shares existing mesh and leaves maps, road, signal, collision intact',()=>{
  assert.match(html,/PATROL_DUMBO_BRIDGEHEAD_ROOFLINE_V1/);
  assert.match(builderSource,/if\(dumboInfillRecessed\)\{/);
  assert.match(builderSource,/buildDumboBridgeheadInfillRoofline\(addTri,addQuad/);
  assert.match(html,/function isBridgeCollision\(x,y,z,radius=0\)/);
  assert.match(html,/function bridgeheadSignalState\(time\)/);
  assert.match(html,/renderExpressway\(CITY_EXPRESSWAY,/);
  assert.match(html,/renderExpressway\(VEGAS_EXPRESSWAY,/);
  assert.ok(!/texture\(/.test(extract('buildDumboBridgeheadInfillRoofline')),
    'cannot add a new external texture sample in roof helper');
});
