// Real NYC LED atlas regression: repeated product categories must not reuse
// identical hero composition and the static WebGL upload still works.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const src=await readFile(new URL('../assets/nyc/nyc-led.js',import.meta.url),'utf8');
const {campaignDetails,campaignProductComposition,createNycLedAtlas}=
  await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));

test('returning to the same product category produces different poster layouts',()=>{
  const nonce=0x561ca2a;
  for(let i=0;i<16;i++){
    const versions=Array.from({length:8},(_,j)=>campaignDetails(100+i+j*16,nonce));
    assert.equal(new Set(versions.map(x=>x.theme)).size,1,'same editorial category');
    assert.equal(new Set(versions.map(x=>x.serial)).size,8,'never reuse edition identity');
    const layouts=versions.map(campaignProductComposition);
    assert.equal(new Set(layouts.map(x=>JSON.stringify(x))).size,8,
      'campaigns 16 screens apart must not clone an identical product shot');
    for(const frame of layouts){
      assert.ok(frame.tilt>=-.051&&frame.tilt<=.051,'subtle studio tilt');
      assert.ok(frame.zoom>=.91&&frame.zoom<=1.02);
      assert.ok(frame.stretch>=.95&&frame.stretch<=1.02);
      assert.ok(Math.abs(frame.shiftX)<.06&&Math.abs(frame.shiftY)<.04);
      assert.ok(Number.isInteger(frame.finishHue)&&frame.finishHue>=0&&frame.finishHue<360);
    }
  }
});

test('static atlas rotates and scales hero products without moving editorial copy',()=>{
  const calls={rotate:[],scale:[],titles:[],upload:0};
  const ctx=new Proxy({
    createLinearGradient:()=>({addColorStop(){}}),
    createRadialGradient:()=>({addColorStop(){}}),
    rotate:v=>calls.rotate.push(v),
    scale:(x,y)=>calls.scale.push([x,y]),
    fillText:s=>calls.titles.push(s)
  },{get:(o,k)=>k in o?o[k]:()=>{}});
  const previous=globalThis.document;
  globalThis.document={createElement(){
    return {width:0,height:0,getContext:()=>ctx};
  }};
  const gl={
    MAX_TEXTURE_SIZE:1,UNPACK_FLIP_Y_WEBGL:2,TEXTURE10:10,TEXTURE0:0,
    TEXTURE_2D:11,RGBA:12,UNSIGNED_BYTE:13,TEXTURE_MIN_FILTER:14,
    LINEAR_MIPMAP_LINEAR:15,TEXTURE_MAG_FILTER:16,LINEAR:17,
    TEXTURE_WRAP_S:18,TEXTURE_WRAP_T:19,CLAMP_TO_EDGE:20,
    getParameter(key){return key===1?2048:false},
    createTexture(){return {atlas:true}},
    activeTexture(){},bindTexture(){},pixelStorei(){},
    texImage2D(){calls.upload++},texParameteri(){},generateMipmap(){}
  };
  try{
    const texture=createNycLedAtlas(gl,
      Array.from({length:32},(_,i)=>({label:'TIMES SQUARE '+i})));
    assert.equal(texture.atlas,true);
  }finally{
    if(previous===undefined)delete globalThis.document;
    else globalThis.document=previous;
  }
  assert.equal(calls.upload,1,'single 2K WebGL texture, no additional draw calls');
  assert.equal(calls.rotate.length,24,'twelve product genres per 16-panel cycle');
  assert.equal(calls.scale.length,24);
  assert.equal(calls.titles.length,32*4,'all titles and legal microcopy remain');
  assert.ok(calls.scale.every(([x,y])=>x>.9&&y>.9));
  assert.ok(new Set(calls.rotate.map(x=>x.toFixed(5))).size>8,
    'genuinely different hero angles, not the same rotated poster everywhere');
});
