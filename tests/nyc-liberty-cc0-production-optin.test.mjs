import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const loader=readFileSync(new URL('../assets/nyc/nyc-realism.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../assets/nyc/scenario-manifest.json',import.meta.url),'utf8'));
const glb=readFileSync(new URL('../assets/nyc/scenario/liberty.glb',import.meta.url));
const sourceSha='34ed58d06e008adcced5e60376bbcc11d675f3d4ec01434016df92d244f33225';

test('reuse EXACT already optimized audited CC0 GLB, do not upload or generate another block',()=>{
  assert.equal(createHash('sha256').update(glb).digest('hex'),sourceSha);
  assert.equal(glb.length,913936);
  assert.equal(glb.readUInt32LE(0),0x46546c67);
  assert.equal(glb.readUInt32LE(4),2);
  assert.equal(glb.readUInt32LE(8),glb.length);
  const jsonLength=glb.readUInt32LE(12),data=JSON.parse(glb.subarray(20,20+jsonLength).toString());
  assert.equal(data.images?.length,1,'single compressed atlas, no unlicensed extra materials');
  assert.ok(glb.length<1024*1024,'optimized GLB fits under 1 MiB download budget');
});

test('publisher CC0 attribution is explicit but Liberty remains OFF in default game',()=>{
  const liberty=manifest.landmarks.liberty;
  assert.equal(liberty.enabled,false);
  assert.equal(liberty.file,'scenario/liberty.glb');
  assert.match(liberty.license,/Innerscene.*CC0/);
  assert.match(liberty.license,/innerscene\.com\/tools\/library/);
  assert.match(loader,/options\.get\('nycLibertyCC0'\)==='1'/);
  assert.match(loader,/spec\.enabled===false&&spec\.file==='scenario\/liberty\.glb'/);
  assert.match(loader,/libertyCC0Pilot=options\.get\('nycLibertyCC0'\)==='1' && !useProceduralLandmarks/);
});

test('production render uses 3 distance bands with eye AND aircraft safety guard',()=>{
  assert.match(html,/const libertyCC0Pilot = new URLSearchParams\(location\.search\)\.get\('nycLibertyCC0'\)==='1'/);
  assert.match(html,/photoModel\.triangleCount===15900/);
  assert.match(html,/const distance=Math\.min\(eyeDist,aircraftDist\)/);
  assert.match(html,/if\(distance<105\)/);
  assert.match(html,/distance<275/);
  assert.match(html,/near-cc0/);
  assert.match(html,/mid-bundled-glb/);
  assert.match(html,/far-built-in/);
  assert.match(html,/meshes\.body\.count<candidate\.count/);
  assert.match(html,/drawMeshWithOutline\(displayedModel,model/);
  assert.match(html,/if\(meshes\.lights\.count && displayedModel===meshes\.body\)/);
});

test('existing native WebGL fallback and separate map physics stay intact',()=>{
  assert.match(loader,/models\.libertyLow=models\[kind\]/);
  assert.match(loader,/models\[kind\]=mesh/);
  assert.match(html,/nycRealismAssets\?\.models\[mark\.kind\]/);
  assert.match(html,/const selectedMap|let selectedMap/);
  assert.match(html,/selectedMap\.city/);
  assert.match(html,/nycModels/);
  assert.match(html,/floatOceanPose\(/);
  assert.match(html,/selectedAircraft==='seaplane'/);
  assert.match(html,/chongqing\.html/);
  assert.match(html,/NYC_CC0_LIBERTY_LOD_V1/);
});
