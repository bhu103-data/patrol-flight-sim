// Reproduce the actual harbor scenic-camera math; never photograph inside
// a waterfront tower and mistake its wall for an empty WebGL frame.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const match=html.match(/\{name:'Lower Manhattan · Window Facades',x:([-\d.]+),z:([-\d.]+),height:([\d.]+),\s*bearing:([\d.]+),radius:([\d.]+),rise:([\d.]+)/);
assert.ok(match,'Harbor OTI scenic view exists');
const [,xx,zz,yy,bearing,rad,rise]=match;
const view={name:'Lower Manhattan · Window Facades',x:Number(xx),z:Number(zz),
 height:Number(yy),bearing:Number(bearing),radius:Number(rad),rise:Number(rise)};
const start=html.indexOf('  function getScenicCamera()'),open=html.indexOf('{',start);
assert.ok(start>0&&open>start);
let depth=0,end=-1;
for(let i=open;i<html.length;i++){
 if(html[i]==='{')depth++;
 else if(html[i]==='}'&&--depth===0){end=i+1;break;}
}
assert.ok(end>open);
const getCamera=new Function('scenicViews','hotelTarget','hotelAngle','hotelZoom',
 'onboardView','sampleTerrainHeight','navigationSurface','lerp','worldUp',
 'return ('+html.slice(start,end)+')')(
 ()=>[view],{selectedIndex:0},{value:'0'},{value:'42'},false,
 ()=>14.86,()=>12.2,(a,b,t)=>a+(b-a)*t,[0,1,0]);

test('OTI camera stands outside the close-walled Manhattan grid',()=>{
 const {eye,look}=getCamera();
 assert.ok(eye[0]<-145 && eye[2]<-490,
  'harbor observation point southwest of tower density: '+eye);
 assert.ok(Math.hypot(eye[0]-look[0],eye[2]-look[2])>65,
  'observe facades at a readable distance, not through the walls');
 assert.equal(look[0],view.x);
 assert.equal(look[2],view.z);
 assert.ok(eye[1]>look[1]+8,'camera looks down from above street level');
});
test('scenic view remains within a bounded practical focus zone',()=>{
 assert.ok(view.radius<110 && view.radius>68);
 assert.ok(view.bearing>210 && view.bearing<240);
 assert.ok(view.height>9 && view.rise>9);
 assert.ok(html.includes('PATROL_NYC_OTI_HARBOR_CAMERA_CLEAR_V2'));
 assert.ok(html.includes("await capture('09-manhattan-window-facades.png')")===false,
  'browser script controls screenshot, not the game HTML');
});
