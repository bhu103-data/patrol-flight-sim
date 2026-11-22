// Real LF2025 water classification is experimental and MUST remain opt-in.
// Test the original production generator and preserve the default 3DEP path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(
  new URL('../assets/alaska/landfire-evc-water-preview.json',import.meta.url),'utf8'));
const moduleSource=readFileSync(
  new URL('../assets/alaska/landfire-water-mask.js',import.meta.url),'utf8');
const {decodeLandfireWaterMask,loadLandfireWaterMask}=await import(
  'data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
const mask=decodeLandfireWaterMask(manifest);
const demFile=JSON.parse(readFileSync(
  new URL('../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
const demRaw=Buffer.from(demFile.heightsBase64,'base64');
const demHeights=new Uint16Array(256*256);
for(let i=0;i<demHeights.length;i++)demHeights[i]=demRaw.readUInt16LE(2*i);

function workerGenerator(){
  const start=html.indexOf('  function* generateTerrain(options) {');
  const end=html.indexOf('\n  const workerSrc = ',start);
  assert.ok(start>0&&end>start);
  return new Function('return ('+html.slice(start,end).trim()+')')();
}
const generateTerrain=workerGenerator(),span=1920,scale=75,water=12.2;
const verticalScale=Math.min(.04,(scale*.90-water)/demFile.maxElevationMeters);
const baseOptions={
  size:128,span,water,scale,landmarks:[],airfield:null,city:null,alaska:true,
  vegas:null,dc:null,chongqing:null,preview:true,
  alaskaDEM:{width:256,height:256,heights:demHeights,verticalScale}
};
function preview(options){
  for(const msg of generateTerrain(options))
    if(msg?.type==='preview')return msg.height;
  throw Error('No terrain preview');
}
function sourceMetres(u,v){
  const col=Math.max(0,Math.min(255,v*256-.5));
  const row=Math.max(0,Math.min(255,(1-u)*256-.5));
  const x0=Math.floor(col),z0=Math.floor(row);
  const tx=col-x0,tz=row-z0,x1=Math.min(255,x0+1),z1=Math.min(255,z0+1);
  const p=(x,z)=>demHeights[z*256+x];
  return (p(x0,z0)*(1-tx)+p(x1,z0)*tx)*(1-tz)+
         (p(x0,z1)*(1-tx)+p(x1,z1)*tx)*tz;
}
function classifiedWater(u,v){
  const col=Math.max(0,Math.min(255,Math.round(v*256-.5)));
  const row=Math.max(0,Math.min(255,Math.round((1-u)*256-.5)));
  return mask.cells[row*256+col]===1;
}

test('official water mask decodes to the known 256x256 class-11 cells with matching hash',()=>{
  assert.equal(manifest.crs,'EPSG:4326');
  assert.equal(manifest.sourceCrs,'EPSG:3338');
  assert.equal(manifest.waterCode,11);
  assert.deepEqual(mask.bbox,demFile.bbox);
  assert.equal(mask.width,256);
  assert.equal(mask.height,256);
  assert.equal(mask.cells.length,65536);
  assert.equal(mask.waterCount,13658);
  assert.equal(mask.cells.reduce((acc,v)=>acc+v,0),13658);
  assert.equal(createHash('sha256').update(mask.cells).digest('hex'),
    '266c062c4ff2cecb3091e329a74c3e5747404d8947097a1e01279c8f11eb9f28');
});

test('malformed or truncated mask safely rejects without replacing terrain',async()=>{
  assert.throws(()=>decodeLandfireWaterMask({...manifest,waterCount:1}));
  assert.throws(()=>decodeLandfireWaterMask({...manifest,rleBase64:'AAAA'}));
  assert.throws(()=>decodeLandfireWaterMask({...manifest,width:512}));
  await assert.rejects(loadLandfireWaterMask('missing.json',
    async()=>({ok:false,status:404})),/HTTP 404/);
});

test('real 3DEP+LF2025 opt-in only carves low-elevation class-11 cells',()=>{
  const baseline=preview(baseOptions);
  const staging=preview({...baseOptions,alaskaWaterMask:mask});
  assert.equal(baseline.length,128*128);
  assert.equal(staging.length,baseline.length);
  let changed=0,dryPreserved=0;
  for(let i=0;i<staging.length;i++){
    const row=Math.floor(i/128),col=i%128;
    const u=(col+.5)/128,v=(row+.5)/128;
    const metres=sourceMetres(u,v);
    const permitted=metres>1&&metres<=12&&classifiedWater(u,v);
    const delta=staging[i]-baseline[i];
    if(Math.abs(delta)>1e-7){
      changed++;
      assert.ok(permitted,'NOAA-unverified high cliffs or dry classes cannot be carved');
      assert.ok(staging[i]*scale<water-1,'preview water must be below displayed sea level');
    }else if(metres>12||!classifiedWater(u,v)){dryPreserved++;}
  }
  assert.ok(changed>5,'opt-in actually changes at least five low coastal test cells');
  assert.ok(dryPreserved>10000,'most of 3DEP terrain remains exactly unchanged');
  assert.equal(preview({...baseOptions,alaskaWaterMask:undefined}).length,baseline.length);
  assert.ok(!html.includes("const alaskaWaterMask = await import("),
    'mask should be downloaded only in the explicitly gated loader');
});

test('only explicit Alaska preview can load classification; compat and legacy stay unchanged',()=>{
  assert.match(html,/get\('alaskaShore'\)==='landfire-preview'/);
  assert.match(html,/if\(selectedMap\.alaska && terrainOptions\.alaskaDEM && !graphicsCompat &&/);
  assert.match(html,/metres>1 && metres<=12 &&/);
  assert.match(html,/landfirePreview && metres>1 && metres<=12/);
  assert.match(html,/if\(selectedMap\.alaska &&\s*new URLSearchParams\(location\.search\)\.get\('alaskaTerrain'\)!=='legacy'\)/);
  assert.match(html,/controller\.abort\(\),3500/);
  assert.match(html,/terrainOptions\.alaskaWaterMask=waterMask/);
});
