import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const [scene,street,loader,manifest]=await Promise.all([
  readFile(new URL('assets/chongqing/chongqing.js',root),'utf8'),
  readFile(new URL('assets/chongqing/streetlife.js',root),'utf8'),
  readFile(new URL('assets/chongqing/3dassets-lamp-preview.js',root),'utf8'),
  readFile(new URL('assets/chongqing/scenario-manifest.json',root),'utf8')
]);
test('3DAssets candidate is opt-in, hash-locked and same-origin',()=>{
  assert.match(scene,/lampPreviewChoice==='3dassets'/);
  assert.match(loader,/SHA256='78665c352776386f7b968b6bccb14e022e326238632577becf6df396428a4a88'/);
  assert.match(loader,/BYTES=205696/);
  assert.match(loader,/crypto\.subtle\.digest\('SHA-256'/);
  assert.match(loader,/url\.origin!==location\.origin/);
  assert.doesNotMatch(scene,/https:\/\/cdn\.3dassets\.dev/);
});
test('existing batched geometry stays installed and recoverable',()=>{
  assert.match(street,/setReviewLampVisible\(visible\)/);
  assert.match(street,/new THREE\.Matrix4\(\)\.makeScale\(0,0,0\)/);
  assert.match(loader,/streetBuild\.setReviewLampVisible\(true\)/);
  assert.match(scene,/lampPreviewChoice==='3dassets'&&qualityMode==='low'/);
  assert.match(scene,/dataset\.streetlampReview='low-fallback'/);
});
test('review camera samples roadway terrain and does not persist to default runtime',()=>{
  assert.match(scene,/if\(\(reviewPose==='street'\|\|reviewPose==='air'\)/);
  assert.match(scene,/Math\.max\(ground\(x,z\)\+5,a\.y\+3\)/);
  assert.doesNotMatch(manifest,/3dassets|street-light|lampReview/i);
});
