// PATROL NYC LED V8: verify the real canvas atlas path and creative diversity.
// Run: node --test tests/nyc-led-creative.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../assets/nyc/nyc-led.js',import.meta.url),'utf8');
const {campaignDetails,createNycLedAtlas}=await import(
  'data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('16 neighboring LED screens use 16 distinct genres and campaign headlines',()=>{
  const campaigns=Array.from({length:16},(_,i)=>campaignDetails(100+i,0x59147));
  assert.equal(new Set(campaigns.map(x=>x.theme)).size,16);
  assert.equal(new Set(campaigns.map(x=>x.headline)).size,16);
  assert.equal(new Set(campaigns.map(x=>x.strapline)).size,16);
  assert.equal(new Set(campaigns.map(x=>x.serial)).size,16);
  assert.ok(campaigns.every(x=>x.title&&x.headline&&x.strapline));
});

test('campaign identity is never silently reused within a long city tour',()=>{
  const campaigns=Array.from({length:160},(_,i)=>campaignDetails(i+1,0x29115));
  assert.equal(new Set(campaigns.map(x=>x.serial)).size,campaigns.length);
  assert.equal(new Set(campaigns.map(x=>x.theme)).size,16);
  for(let i=1;i<campaigns.length;i++)
    assert.notEqual(campaigns[i].theme,campaigns[i-1].theme);
});

test('old browsers with large creative histories never produce a negative theme',()=>{
  for(const serial of [200000000,2147483647,4294967295,9007199254740990]){
    const campaign=campaignDetails(serial,0);
    assert.ok(Number.isInteger(campaign.theme)&&campaign.theme>=0&&campaign.theme<16);
    assert.ok(campaign.headline&&campaign.strapline,'copy exists at high serial');
  }
});

test('real WebGL atlas artwork contains original advert copy, not debug labels',()=>{
  const texts=[];
  const gradient=()=>({addColorStop(){}});
  const ctx=new Proxy({
    createLinearGradient:gradient,createRadialGradient:gradient,
    fillText(text){texts.push(text)}
  },{
    get(target,property){return property in target?target[property]:()=>{}}
  });
  const oldDocument=globalThis.document;
  globalThis.document={createElement(name){
    assert.equal(name,'canvas');
    return {width:0,height:0,getContext:()=>ctx};
  }};
  const gl={
    MAX_TEXTURE_SIZE:1,UNPACK_FLIP_Y_WEBGL:2,
    TEXTURE10:10,TEXTURE0:0,TEXTURE_2D:11,
    RGBA:12,UNSIGNED_BYTE:13,TEXTURE_MIN_FILTER:14,
    LINEAR_MIPMAP_LINEAR:15,TEXTURE_MAG_FILTER:16,LINEAR:17,
    TEXTURE_WRAP_S:18,TEXTURE_WRAP_T:19,CLAMP_TO_EDGE:20,
    getParameter(key){return key===this.MAX_TEXTURE_SIZE?2048:false},
    createTexture(){return {id:'atlas'}},
    activeTexture(){},bindTexture(){},pixelStorei(){},
    texImage2D(){},texParameteri(){},generateMipmap(){}
  };
  try{
    assert.deepEqual(createNycLedAtlas(gl,Array.from({length:16},(_,i)=>({label:'TEST '+i}))),
      {id:'atlas'});
  }finally{
    if(oldDocument===undefined)delete globalThis.document;
    else globalThis.document=oldDocument;
  }
  assert.equal(texts.length,16*4,'title, strapline, headline and microcopy per panel');
  assert.equal(new Set(texts.filter((_,i)=>i%4===2)).size,16);
  assert.ok(!texts.some(x=>/^(?:CREATIVE|CAMPAIGN)\s/i.test(x)),
    'large diagnostic identifiers must not appear on ads');
  assert.equal(texts.filter(x=>/EDITION [0-9A-Z]{6,}/.test(x)).length,16,
    'each screen keeps a unique edition identifier in microtype');
});
