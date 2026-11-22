// Source-level geometry regression on the actual PATROL game facade builder.
// New relief affects only an isolated, non-OTI DUMBO infill pocket at LOD3.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
function extract(name){
  const from=html.indexOf('function '+name+'(');
  assert.ok(from>=0,'missing production function '+name);
  const begin=html.indexOf('{',from);
  let depth=0;
  for(let i=begin;i<html.length;i++){
    if(html[i]==='{')depth++;
    else if(html[i]==='}'&&--depth===0)return html.slice(from,i+1);
  }
  throw Error('unclosed '+name);
}
const source=extract('buildDumboBridgeheadInfillApertures');
const geometry=new Function(source+
  '\nreturn buildDumboBridgeheadInfillApertures;')();
const builderSource=extract('buildCityBuildings');
const grid={tilt:.24,offset:30,blockWidth:24,blockLength:33};

function build(lot,band=3,compat=false,smooth=true){
  const boxes=[],quads=[],beams=[];
  const mesh=()=>({addTri(){},addQuad(...args){quads.push(args)},
    upload(){return {boxes,quads,beams}}});
  const fn=new Function(
    'createTriangleMesh','addModelBox','addRideBeam','nycDetailBand',
    'MANHATTAN_GRID','WATER_H','tintSeed','addDowntownFacadeRelief',
    'buildDumboBridgeheadInfillApertures','buildDumboBridgeheadInfillRoofline',
    'graphicsCompat','smoothScenery',
    'return ('+builderSource+')'
  )(mesh,(_q,...args)=>boxes.push(args),(_q,a,b,c)=>beams.push([a,b,c]),
    ()=>band,grid,12.2,()=>.5,()=>0,geometry,
    ()=>null,compat,()=>smooth);
  fn([lot]);
  return {boxes,quads,beams};
}

const sites=[
  [269.6,-351.5,8.8,9.2,15.5,.41,false],
  [294.8,-346.5,8.8,13.8,13.4,.41,false],
  [318.8,-346.5,10.2,11.8,11.7,.41,false]
];

test('three newly exposed non-surveyed DUMBO infill buildings get real wall openings',()=>{
  for(const lot of sites){
    const [x,z,w,d,h]=lot,atY=12.2+2.38;
    const quads=[];
    const site={x,y:atY,z,w,d,h,brick:[.52,.32,.27],
      stone:[.68,.64,.58],seed:5};
    const stats=geometry((...args)=>quads.push(args),site);
    assert.ok(stats.openings>=16&&stats.openings<=52);
    assert.equal(stats.returns,stats.openings*4,
      'every glass opening needs left/right/upper/lower depth surfaces');
    assert.ok(stats.faces>stats.openings*5&&stats.faces<850,
      'bounded window and brick faces, no draw-call explosion');
    const glass=quads.filter(q=>q.at(-1)===13);
    assert.equal(glass.length,stats.openings,
      'no hidden duplicate solid glass-on-wall decals');
    assert.ok(glass.some(q=>q.slice(0,4).every(p=>typeof p==='object'&&
      Math.abs(p[2]-(z+d*.5-.16))<.001)),
      'front glazing must be behind the positive-Z street face');
    assert.ok(glass.some(q=>q.slice(0,4).every(p=>typeof p==='object'&&
      Math.abs(p[2]-(z-d*.5+.16))<.001)),
      'rear glazing must be behind the negative-Z street face');
    assert.ok(glass.some(q=>q.slice(0,4).every(p=>typeof p==='object'&&
      Math.abs(p[0]-(x+w*.5-.16))<.001)),
      'east-side facade requires an actual x-facing opening');
    for(const q of quads){
      for(const p of q.slice(0,4)){
        assert.ok(p.every(Number.isFinite));
        assert.ok(Math.abs(p[0]-x)<=w/2+.10 &&
          Math.abs(p[2]-z)<=d/2+.10,
          'window returns and sills stay in original lot margin');
        assert.ok(p[1]>=atY-.001&&p[1]<=atY+h+.001,
          'no new overhanging roof or below-ground window geometry');
      }
    }
  }
});

test('bridgehead LOD3 replaces opaque boxes, while LOD2 preserves old fallback',()=>{
  for(const lot of sites){
    const [x,z,w,d,h]=lot;
    const near=build(lot),mid=build(lot,2),far=build(lot,1);
    assert.ok(near.quads.filter(q=>q.at(-1)===13).length>=16);
    assert.ok(!near.boxes.some(b=>b[0]===x&&b[2]===z&&
      b[3]===w&&b[4]===h&&b[5]===d),
      'a full original cuboid would hide the recessed glazing');
    assert.ok(mid.boxes.some(b=>b[0]===x&&b[2]===z&&
      b[3]===w&&b[4]===h&&b[5]===d),
      'middle LOD must preserve the existing compact opaque body');
    assert.ok(far.quads.filter(q=>q.at(-1)===13).length===0,
      'LOD1 must not allocate detailed inset glazing');
    assert.ok(near.quads.length<700,'bounded full building mesh for WebGL');
  }
});

test('graphics compatibility and low-detail settings retain the original body',()=>{
  const lot=sites[1],x=lot[0],z=lot[1],w=lot[2],d=lot[3],h=lot[4];
  for(const {boxes,quads} of [build(lot,3,true,true),build(lot,3,false,false)]){
    assert.ok(boxes.some(b=>b[0]===x&&b[2]===z&&
      b[3]===w&&b[4]===h&&b[5]===d),
      'low-quality rendering must keep the original cheap cuboid');
    assert.ok(quads.length<140,
      'fallback must keep old light facade, not 400+ aperture wall faces');
  }
});

test('warehouse-specific PR sites, official lots and other maps remain untouched',()=>{
  for(const lot of [
    [278.7,-313.6,9,16,12.7,.41,false],
    [372,-285,9,18,17,.41,false],
    [342.76,-346.16,9,19,13.82,.41,false],
    [-78,-335,9,19,23.5,.41,false]
  ]){
    const [x,z,w,d,h]=lot,{boxes}=build(lot);
    assert.ok(x<0
      ?boxes.some(b=>b[0]===x&&b[2]===z&&b[4]>h*.1)
      :boxes.some(b=>b[0]===x&&b[2]===z&&
        b[3]===w&&b[4]===h&&b[5]===d),
      'non-target sites retain their original block or Manhattan tower tiers');
  }
  assert.match(html,/if\(!local&&lot\[7\]\)/,
    'municipal footprint paths stay ahead of the synthetic infill gate');
  assert.match(html,/if\(!dumboInfillRecessed\)for\(let floor=/,
    'old upper-window mesh still available for all other buildings');
  assert.match(html,/renderExpressway\(CITY_EXPRESSWAY,/);
  assert.match(html,/renderExpressway\(VEGAS_EXPRESSWAY,/);
  assert.match(html,/function isBridgeCollision\(x,y,z,radius=0\)/);
});
