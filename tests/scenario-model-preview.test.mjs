// node --test tests/scenario-model-preview.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const page=await readFile(new URL('tools/scenario_model_preview.html',root),'utf8');
const loader=await readFile(new URL('assets/nyc/nyc-realism.js',root),'utf8');
const manifest=JSON.parse(await readFile(
  new URL('assets/nyc/scenario-manifest.json',root),'utf8'));
const script=page.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];

test('standalone preview has valid client JavaScript',()=>{
  assert.ok(script,'module script exists');
  assert.doesNotThrow(()=>new Function(script));
  assert.match(page,/<canvas id="preview"/);
  assert.match(page,/type="file"[^>]*accept="[^"]*\.glb/);
});
test('uses the production GLB parser and local-only file input',()=>{
  assert.match(script,/import\('\.\.\/assets\/nyc\/nyc-realism\.js'\)/);
  assert.match(script,/entry\.arrayBuffer\(\)/);
  assert.match(script,/entry\.size>MAX_BYTES/);
  assert.match(script,/MAX_BYTES=8388608/);
  assert.doesNotMatch(script,/fetch\([^)]*(?:scenario\.com|scenario\.ai|api\.scenario)/i);
});
test('viewer can preview existing bundled Liberty GLB without activation',async()=>{
  const binary=new URL('assets/nyc/statue-of-liberty.glb',root);
  const file=await stat(binary);
  assert.ok(file.size>100&&file.size<8388608);
  assert.match(script,/\.\.\/assets\/nyc\/statue-of-liberty\.glb/);
  assert.equal(manifest.landmarks.liberty.enabled,false);
  assert.match(script,/targetHeight=Number\(/);
});
test('viewer audits polygon count, footprint, embedded atlas and orientation',()=>{
  assert.match(loader,/triangleCount:pos\.length\/9/);
  assert.match(loader,/dimensions:\{width:\(maxX-minX\)\*scale/);
  assert.match(script,/incoming\.triangleCount\.toLocaleString\(\)/);
  assert.match(script,/dim\.width\.toFixed\(1\)/);
  assert.match(script,/mesh\.texture/);
  assert.match(script,/gl\.drawArrays\(gl\.TRIANGLES/);
  assert.match(script,/canvas\.toBlob\(blob/);
});
test('preview never enables unreviewed models or edits manifests',()=>{
  for(const [kind,asset] of Object.entries(manifest.landmarks)){
    if(kind==='trade'||kind==='empire'||kind==='chrysler'){
      assert.equal(asset.enabled,true,'reviewed original GLB is activated');
      assert.match(asset.license,/Original/);
    }else assert.equal(asset.enabled,false,'other landmarks retain their original models');
  }
  assert.doesNotMatch(script,/PUT|POST|PATCH|--activate|writeFile|gh api/);
});
