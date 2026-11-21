// Real Times Square storefront regression. Every site comes from the game's
// 13 curated NYC municipal-footprint records, not fictitious test parcels.
// The original official GIS building/polygon geometry is never altered.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const first=html.indexOf('function buildOfficialFootprintMesh(');
const opener=html.indexOf('{',first);let depth=0,last=-1;
for(let i=opener;i<html.length;i++){
  if(html[i]==='{')depth++;
  else if(html[i]==='}'&&--depth===0){last=i+1;break;}
}
assert.ok(last>first);
const source=html.slice(first,last);
const marker='const timesGroundShop=detailBand===4 && y>14 &&';
assert.ok(source.includes(marker),'production Times ground floor polygon gating');
const renderSource=fn=>new Function(fn+';return buildOfficialFootprintMesh')();
const actual=renderSource(source);
const baseline=renderSource(source.replace(marker,'const timesGroundShop=false &&'));
function declaration(name){
 const i=html.indexOf('const '+name+' = ');
 assert.ok(i>=0,'missing '+name);
 const from=html.indexOf('=',i)+1,to=html.indexOf(';',from);
 return new Function('return ('+html.slice(from,to)+')')();
}
const municipal=declaration('NYC_TIMES_VERIFIED_FOOTPRINTS');
const city=html.indexOf('function buildTimesSquareDistrict(');
const bs=html.indexOf('    const blocks=[',city);
const be=html.indexOf('    ];',bs);
assert.ok(bs>=0&&be>bs,'production Times Square named sites');
const blocks=new Function('return '+html.slice(bs+'    const blocks='.length,be+6))();
assert.equal(blocks.length,13,'13 pre-verified sites are the live test fixtures');

function scene(builder,block,{lod=4,y=14.95,destroyed=false}={}){
 const study=municipal[block.name];
 assert.ok(study?.uv?.length>=3,'verified municipal geometry for '+block.name);
 const polygon=study.uv.map(([u,v])=>[block.x+u*block.w,block.z+v*block.d]);
 const ledTop=Math.max(...block.panels.map(([height,span])=>height+span*.5))+1.25;
 const height=Math.max(ledTop,Math.min(block.h*1.45,
  Math.max(block.h*.66,study.ft*.3048*.32)));
 const isGlass=block.name.includes('Marriott')||block.name.includes('EDITION')||
  blocks.indexOf(block)%6===0||blocks.indexOf(block)%6===3;
 const tone=isGlass?.61:.24;
 const tris=[],quads=[];
 const stats=builder((...x)=>tris.push(x),(...x)=>quads.push(x),
  [block.x,block.z,block.w,block.d,height,tone,destroyed,polygon,study.fid],
  y,lod);
 return {tris,quads,stats,polygon,height};
}
function additions(block,options={}){
 const old=scene(baseline,block,options),current=scene(actual,block,options);
 let pos=0;const added=[];
 for(const q of current.quads){
  if(pos<old.quads.length&&JSON.stringify(q)===JSON.stringify(old.quads[pos]))pos++;
  else added.push(q);
 }
 assert.equal(pos,old.quads.length,
  'original municipal facade faces must remain unchanged');
 assert.deepEqual(current.tris,old.tris,'existing roof triangulation unchanged');
 assert.equal(current.stats.roof,old.stats.roof);
 assert.equal(current.stats.walls,old.stats.walls);
 return {added,current,old};
}
function distanceToSegment(p,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz;
 if(!len2)return Math.hypot(p[0]-a[0],p[2]-a[1]);
 const t=Math.max(0,Math.min(1,
  ((p[0]-a[0])*dx+(p[2]-a[1])*dz)/len2));
 return Math.hypot(p[0]-a[0]-dx*t,p[2]-a[1]-dz*t);
}

test('all 13 actually mapped Times Square facades gain physical street-level storefronts',()=>{
 let enhanced=0,extraQuads=0,glass=0,vertices=0;
 for(const block of blocks){
  const {added,current,old}=additions(block);
  assert.ok(added.length>=15&&added.length<75,
   'bounded lower shop details on actual '+block.name);
  enhanced++;
  extraQuads+=added.length;
  assert.ok(current.stats.windows>old.stats.windows);
  for(const q of added){
   assert.ok(q.at(-1)===9||q.at(-1)===10,
    'existing GIS masonry/window material tags only');
   if(q.at(-1)===10)glass++;
   for(const p of q.slice(0,4)){
    assert.ok(p.every(Number.isFinite));
    assert.ok(p[1]>=14.95+.35&&p[1]<=14.95+2.50,
     'no shop face above first storey or below ground');
    const poly=current.polygon;
    let near=Infinity;
    for(let i=0;i<poly.length;i++)near=Math.min(near,
     distanceToSegment(p,poly[i],poly[(i+1)%poly.length]));
    assert.ok(near<=.133,'shop frame must project <=.133 game units from original FID');
    vertices++;
   }
  }
 }
 assert.equal(enhanced,13);
 assert.ok(extraQuads>=350&&extraQuads<=700,
  '13 live sites have a strict mesh-detail budget');
 assert.ok(glass>=60&&glass<=155);
 assert.ok(vertices>1200);
});

test('financial district and One Times Square local geometry remain untouched',async()=>{
 const b=blocks.find(x=>x.name==='1500 Broadway');
 assert.deepEqual(additions(b,{lod:2}).added,[]);
 assert.deepEqual(additions(b,{lod:3}).added,[]);
 assert.deepEqual(additions(b,{lod:4,y:0}).added,[],
  'One Times landmark uses local ground and must not get financial-district windows');
 assert.deepEqual(additions(b,{lod:4,destroyed:true}).added,[]);
 const financial=JSON.parse(await readFile(new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8')).footprints;
 for(const row of financial){
  const poly=row[6],lot=[row[1],row[2],row[3],row[4],row[5],.51,false,poly,row[0]];
  const trace=fn=>{const quad=[],tri=[];
    fn((...a)=>tri.push(a),(...a)=>quad.push(a),lot,14.58,3);
    return {quad,tri};};
  assert.deepEqual(trace(actual),trace(baseline),
   'official Manhattan FID map keeps its existing materials and window layout');
 }
});

// Keep external IO explicit and bounded at test startup.
