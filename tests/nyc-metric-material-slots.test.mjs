import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMeteredMassing} from '../assets/nyc/times-square-metered-massing.mjs';
import {buildNeighborhoodMesh,MESH_STRIDE} from '../assets/nyc/nyc-true-scale-neighborhood.mjs';
import {
  validateNycMaterialCatalog,materialForNycFID,MATERIAL_SCHEMA
} from '../assets/nyc/nyc-metric-material-slots.mjs';
import {NYC_MATERIAL_PREVIEW_GLSL}
  from '../assets/nyc/nyc-metric-material-shader.mjs';

const load=async name=>JSON.parse(await readFile(
  new URL('../assets/nyc/'+name,import.meta.url),'utf8'));
const [catalog,buildings,roads,roadbed]=await Promise.all([
  load('nyc-material-slots.json'),load('times-square-footprints.json'),
  load('nyc-dcm-centerlines-sample.json'),load('nyc-oti-roadbed-core-2022.json')
]);
const massing=buildMeteredMassing(buildings);

test('registry labels ALL surface choices as artist-authored proxies; no unlicensed photos',()=>{
  assert.equal(catalog.schema,MATERIAL_SCHEMA);
  assert.equal(validateNycMaterialCatalog(catalog),true);
  assert.equal(catalog.fidelity,'visual-proxy-only-not-as-built');
  for(const m of Object.values(catalog.materials)){
    assert.equal(m.externalTextures,null);
    assert.equal(m.source,'original-procedural');
    assert.equal(m.license,'project-authored');
  }
  assert.equal(materialForNycFID(212747,200,catalog).shaderId,4);
  assert.equal(materialForNycFID(22922,13,catalog).shaderId,5);
  assert.equal(materialForNycFID(50000001,12,catalog).shaderId,3);
  assert.equal(materialForNycFID(50000001,200,catalog).shaderId,4);
  assert.match(materialForNycFID(22922,13,catalog).evidence,/not-surveyed/);
  assert.ok(Array.isArray(NYC_MATERIAL_PREVIEW_GLSL));
  assert.ok(NYC_MATERIAL_PREVIEW_GLSL.some(x=>x.includes('.62,.21')),
    'brick tile measures metres, not arbitrary game units');
});

test('material registry rejects fabricated verification, wrong FID and remote texture map',()=>{
  const clone=()=>structuredClone(catalog);
  assert.throws(()=>validateNycMaterialCatalog({
    ...clone(),schema:'unreviewed'
  }),/Invalid NYC material provenance schema/);
  const unsafe=clone();unsafe.materials['brick-proxy'].externalTextures=
    {baseColor:'https://unknown.example/photo.jpg'};
  assert.throws(()=>validateNycMaterialCatalog(unsafe),
    /Unverified external image/);
  const fudged=clone();
  fudged.fidOverrides['22922'].materialEvidence='surveyed-photogrammetry';
  assert.throws(()=>validateNycMaterialCatalog(fudged),/not approved/);
  const extra=clone();
  extra.fidOverrides['-1']={wall:'stone-proxy',materialEvidence:
    'not-surveyed-art-direction',licenseEvidence:null};
  assert.throws(()=>validateNycMaterialCatalog(extra),/not approved/);
  assert.throws(()=>materialForNycFID(0,10,catalog),/valid NYC source FID/);
});

test('preview changes ONLY wall material IDs, not official positions, geometry, roofs, collision',()=>{
  const args={detail:true,officialRoadbed:roadbed,sourceRoadbedOnly:true};
  const normal=buildNeighborhoodMesh(massing,roads,args);
  const preview=buildNeighborhoodMesh(massing,roads,{
    ...args,materialCatalog:catalog
  });
  assert.equal(preview.counts.buildings,118);
  assert.equal(preview.counts.previewMaterialBuildings,118);
  assert.equal(preview.counts.previewMaterialWallTriangles,preview.counts.wallTriangles);
  assert.equal(normal.counts.previewMaterialBuildings,0);
  assert.equal(normal.counts.officialRoadbedTriangles,207);
  assert.equal(preview.counts.officialRoadbedTriangles,207);
  assert.equal(preview.counts.illustrativeRoadBandTriangles,0);
  assert.deepEqual(preview.center,normal.center);
  assert.deepEqual(preview.bounds,normal.bounds);
  assert.equal(preview.counts.triangles,normal.counts.triangles);
  assert.equal(preview.interleaved.length,normal.interleaved.length);
  let materialFlips=0;
  const seen=new Set();
  for(let i=0;i<normal.interleaved.length;i+=MESH_STRIDE){
    for(let j=0;j<MESH_STRIDE-1;j++){
      assert.equal(preview.interleaved[i+j],normal.interleaved[i+j],
        'material preview must not modify vertices, normals, colours or geometry');
    }
    if(preview.interleaved[i+9]!==normal.interleaved[i+9]){
      assert.equal(normal.interleaved[i+9],0,
        'only default wall material IDs may change');
      assert.ok([3,4,5].includes(preview.interleaved[i+9]));
      materialFlips++;seen.add(preview.interleaved[i+9]);
    }
  }
  assert.equal(materialFlips,preview.counts.wallTriangles*3);
  assert.ok(seen.has(3)&&seen.has(4)&&seen.has(5),
    'brick, glass and explicit stone proxies all emitted');
  assert.equal(preview.provenance.materialCatalogSchema,catalog.schema);
  assert.equal(preview.provenance.materialFidelity,catalog.fidelity);
  assert.equal(normal.provenance.materialCatalogSchema,null);
});

test('WebGL opt-in does not load external textures or change launcher/default flight',async()=>{
  const html=await readFile(
    new URL('../assets/nyc/nyc-true-scale-flight.html',import.meta.url),'utf8');
  const index=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/params\.get\('materials'\)==='preview'/);
  assert.match(html,/materialPreview\?NYC_MATERIAL_PREVIEW_GLSL:\[\]/);
  assert.match(html,/materialCatalog/);
  assert.match(html,/nyc-material-slots\.json/);
  assert.match(html,/materialPreviewWallTriangles/);
  assert.ok(!index.includes('nyc-material-slots.json'),
    'original aircraft map must not be changed by preview');
});
