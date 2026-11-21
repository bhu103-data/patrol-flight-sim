import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CHONGQING_STREET_LAMP_REVIEW as candidates}
  from '../assets/chongqing/street-lamp-review.js';

test('web candidates remain inert until original binary + texture + license review',()=>{
  assert.equal(candidates.length,4);
  const ids=new Set();
  for(const candidate of candidates){
    assert.equal(ids.has(candidate.id),false,'candidate IDs must be unique');
    ids.add(candidate.id);
    assert.match(candidate.source,/^https:\/\//);
    assert.equal(candidate.runtimeEnabled,false);
    assert.equal(candidate.redistributionApproved,false);
    assert.equal(candidate.originalFileAudited,false);
    assert.equal(candidate.texturesAudited,false);
    assert.doesNotMatch(candidate.displayedLicense,/\b(?:NC|ND|Editorial)\b/i);
  }
});
test('Cyrus_JS is never silently substituted before source-file and attribution review',()=>{
  const original=candidates.find(c=>c.id==='sketchfab-cyrus-js-fotuguan');
  assert.ok(original);
  assert.equal(original.creditRequired,true);
  assert.equal(original.downloads,'downloadable-listing-only');
  assert.match(original.source,/ce9d029fe1c14d01b9193b2c31f7c484/);
});
test('direct-source alternatives are bounded and decoder differences are explicit',()=>{
  const grab=candidates.find(c=>c.id==='grab3d-modern-street-light');
  assert.equal(grab.displayedBytes,702900);
  assert.equal(grab.displayedTrianglesApprox,5280);
  assert.match(grab.producerManifest,/manifest\.json$/);
  assert.match(grab.directGlb,/\.glb$/);
  for(const alt of candidates.filter(c=>c.provider==='tevy')){
    assert.match(alt.directGlb,/\/v1\/lod1\.glb$/);
    assert.ok(alt.lod2Triangles<=360);
    assert.match(alt.decoderRequirement,/KTX2/);
  }
});
test('review catalogue is not referenced by runtime and production landmark manifest is unchanged',async()=>{
  const root=new URL('../',import.meta.url);
  const [scene,street,manifest]=await Promise.all([
    readFile(new URL('assets/chongqing/chongqing.js',root),'utf8'),
    readFile(new URL('assets/chongqing/streetlife.js',root),'utf8'),
    readFile(new URL('assets/chongqing/scenario-manifest.json',root),'utf8')
  ]);
  assert.doesNotMatch(scene,/street-lamp-review|grab3d\.com|tevy\.dev/);
  assert.doesNotMatch(street,/street-lamp-review|grab3d\.com|tevy\.dev/);
  assert.doesNotMatch(manifest,/street-lamp-review|grab3d\.com|tevy\.dev/);
});
