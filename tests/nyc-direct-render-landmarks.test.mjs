// Native WebGL2 can render approved GLB landmarks even when the offscreen
// framebuffer is unavailable and PATROL switches to direct drawing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('function prepareNycRealismAssets(){');
const end=html.indexOf('nycRealismLoading=true;',start);
assert.ok(start>0&&end>start,'the production NYC asset preparation guard exists');
const guard=html.slice(start,end);
const match=guard.match(/if\(([\s\S]*?)\)return;/);
assert.ok(match,'asset loader must retain an early return guard');
const mayLoad=new Function('selectedMap','graphicsCompat','directRendering',
  'nycRealismAssets','nycRealismLoading',
  'if('+match[1]+')return false;return true;');

test('approved NYC models load in both framebuffer and direct WebGL2 paths',()=>{
  for(const directRendering of [false,true]){
    assert.equal(mayLoad({city:true},false,directRendering,null,false),true,
      'a missing offscreen compositor must not hide GLB landmarks');
  }
});

test('inactive cities, unsupported GPU shaders and duplicate loads remain guarded',()=>{
  for(const directRendering of [false,true]){
    assert.equal(mayLoad({city:false},false,directRendering,null,false),false);
    assert.equal(mayLoad({city:true},true,directRendering,null,false),false);
    assert.equal(mayLoad({city:true},false,directRendering,{},false),false);
    assert.equal(mayLoad({city:true},false,directRendering,null,true),false);
  }
});

test('direct WebGL draw path still selects approved imported meshes and atlas',()=>{
  assert.match(html,/nycRealismAssets\?\.models\[mark\.kind\]/);
  assert.match(html,/imported\.source==='scenario'/);
  assert.match(html,/const hasBlenderDiffuse=Boolean\(selectedMap\.city && mesh\.texture\)/);
  assert.match(html,/gl\.uniform1f\(uMesh\.scenarioDiffuseReady,hasBlenderDiffuse\?1:0\)/);
  assert.match(html,/gl\.bindTexture\(gl\.TEXTURE_2D,mesh\.texture\)/);
});
