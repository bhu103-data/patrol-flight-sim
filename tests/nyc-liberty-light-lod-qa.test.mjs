// Isolated reduced triangle study only; never enable the Liberty manifest.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const bake=readFileSync(new URL('../tools/nyc/bake-liberty-cc0.py',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../.github/workflows/nyc-liberty-cc0-webgl.yml',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../assets/nyc/scenario-manifest.json',import.meta.url)));
test('experimental lower triangle count retains original UV atlas, provenance and gate',()=>{
 assert.match(bake,/15900 \/ source_triangles/);
 assert.ok(!bake.includes('24400 / source_triangles'));
 for(const gate of ['sourceTriangles','outputTrianglesBeforeGLTFExport',
  '"targetTriangles": 15900','"qaLightLOD": True',
  'PATROL_BASECOLOR_ATLAS','sourceUV=source_coords',
  'rasterize-liberty-colors.py',
  'export_texcoords=True','export_normals=True'])
  assert.ok(bake.includes(gate),'Missing geometry or atlas gate '+gate);
 assert.equal(manifest.landmarks.liberty.enabled,false);
 // Original source branch now has an explicitly guarded staging-to-QA step.
 // A lower-LOD experiment MUST NOT push to the original QA branch, because
 // the exact HEAD comparison requires a source-branch commit.
 const push=workflow.indexOf('git push origin HEAD:refs/heads/');
 assert.ok(push>=0,'the upstream staging destination needs an explicit gate');
 assert.match(workflow.slice(push,push+120),
  /git push origin HEAD:refs\/heads\/qa\/nyc-liberty-cc0-glb-20261121/);
 assert.ok(!workflow.includes('git push origin HEAD:refs/heads/main'),
  'never commit to production main');
 assert.ok(workflow.includes('git rev-parse HEAD'),
  'QA model commits require a freshness/branch identity comparison');
 assert.ok(workflow.includes('git rev-parse refs/remotes/origin/qa/nyc-liberty-cc0-glb-20261121'),
  'experimental branches cannot write the original model branch');
});
test('the same real WebGL candidate and fallback are captured without committing binary',()=>{
 for(const t of ['scripts/nyc-liberty-static-webgl.mjs','check-liberty-glb.mjs',
 'check-liberty-harbor-placement.mjs',
 'assets/nyc/scenario/liberty.glb','upload-artifact@v4','if: always()'])
  assert.ok(workflow.includes(t),'Missing screenshot or geometry audit '+t);
});
