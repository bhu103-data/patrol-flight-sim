// OTI single-building camera is not a skyline; test a source-window ROI
// without hiding failures in the regular 10-camera city WebGL smoke.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../scripts/nyc-road-browser-smoke.mjs',import.meta.url),'utf8');
const begin=script.indexOf('function otiSourceWindowProbe(');
const end=script.indexOf('function timesWallDetail(',begin);
assert.ok(begin>=0&&end>begin,'close-view diagnostic is present');
const source=script.slice(begin,end);
const probe=new Function('PNG',source+'return otiSourceWindowProbe;')({
 sync:{read:sample=>sample}
});
function image(window={enabled:false}){
 const width=1280,height=720,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;
  const glass=window.enabled&&x>=window.left&&x<window.right&&
    y>=window.top&&y<window.bottom;
  data[i]=glass?62:50;
  data[i+1]=glass?73:54;
  data[i+2]=glass?80:53;
  data[i+3]=255;
 }
 return {width,height,data};
}
test('uniform near-black or flat wall cannot pass source-window gate',()=>{
 const result=probe(image());
 assert.equal(result.valid,false);
 assert.equal(result.glassWallContrast,0);
 assert.equal(result.leftEdgeCoverage,0);
 assert.equal(result.rightEdgeCoverage,0);
 assert.equal(result.topEdgeCoverage,0);
});
test('actual aperture-shaped fixture has independently visible left/right/top edges',()=>{
 const result=probe(image({enabled:true,left:430,right:850,top:150,bottom:465}));
 assert.ok(result.glassWallContrast>12);
 assert.equal(result.leftEdgeCoverage,1);
 assert.equal(result.rightEdgeCoverage,1);
 assert.equal(result.topEdgeCoverage,1);
 assert.equal(result.valid,true);
});
test('missing source aperture edge fails even if glass is high contrast',()=>{
 const result=probe(image({enabled:true,left:430,right:850,top:0,bottom:465}));
 assert.ok(result.glassWallContrast>12);
 assert.equal(result.topEdgeCoverage,0);
 assert.equal(result.valid,false);
});
test('other NYC and Brooklyn views retain their original strict color-bin gate',()=>{
 assert.match(script,/stats\.colorBins>32/);
 assert.match(script,/stats\.nearBlackFraction<\.97/);
 assert.match(script,/name==='12-oti-doorway-street\.png'/);
 assert.match(script,/stats\.otiSourceWindow=otiSourceWindowProbe\(image\)/);
 assert.match(script,/result=\{passed:true,state,bridge,dumbo,liberty,screenshots,pixels,controlPixels,captureTimings,warnings\}/);
});
