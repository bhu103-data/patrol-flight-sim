import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildMeteredMassing} from '../assets/nyc/times-square-metered-massing.mjs';
import {buildNeighborhoodMesh} from '../assets/nyc/nyc-true-scale-neighborhood.mjs';

const load=async path=>JSON.parse(await readFile(new URL('../assets/nyc/'+path,import.meta.url),'utf8'));
const [asset,footprints,roads]=await Promise.all([
 load('nyc-mn05-2014-source-mesh.json'),
 load('times-square-footprints.json'),
 load('nyc-dcm-centerlines-sample.json')
]);
const massing=buildMeteredMassing(footprints);

test('official MN05 2014 roof and facade meshes are imported with source identity',()=>{
 assert.equal(asset.schema,'patrol-nyc-mn05-2014-matched-source-mesh-v1');
 assert.equal(asset.sourceVintage,2014);
 assert.equal(asset.sourceVerticalUnitVerified,true);
 assert.equal(asset.sourceVerticalDatumVerified,false);
 assert.equal(asset.gameCollision,false);
 assert.equal(asset.modelIs2026Survey,false);
 assert.equal(asset.sourceRhinoSha256,'b41afdad1243d12858f7f446325af30667175b1eb36e9689304a4299f1c0df57');
 assert.equal(asset.counts.roofTriangles,asset.roofTriangles.length);
 assert.equal(asset.counts.facadeTriangles,asset.facadeTriangles.length);
 assert.ok(asset.counts.roofFids>=30);
 assert.ok(asset.counts.facadeFids>=25);
 assert.ok(asset.roofTriangles.length>=100);
 assert.ok(asset.facadeTriangles.length>=50);
 const fids=new Set(footprints.features.map(x=>Number(x.fid)));
 for(const tri of asset.roofTriangles){
  assert.ok(fids.has(Number(tri.matched2022BuildingFid)));
  assert.ok(tri.matchAreaRatio>=.6);
  assert.equal(tri.vertices.length,3);
 }
 for(const tri of asset.facadeTriangles){
  assert.ok(fids.has(Number(tri.matched2022BuildingFid)));
  assert.ok(tri.matchCoverage>=.65);
  assert.ok(tri.boundaryDistanceMetres<=1.5);
  assert.equal(tri.vertices.length,3);
 }
});

test('original 2014 source meshes enter the same 1:1 WebGL vertex buffer',()=>{
 const geometry=buildNeighborhoodMesh(massing,roads,{detail:true,historicalMesh:asset});
 assert.equal(geometry.counts.historicalRoofTriangles,asset.roofTriangles.length);
 assert.equal(geometry.counts.historicalFacadeTriangles,asset.facadeTriangles.length);
 assert.equal(geometry.counts.historicalRoofFids,asset.counts.roofFids);
 assert.equal(geometry.counts.historicalFacadeFids,asset.counts.facadeFids);
 assert.ok(geometry.counts.historicalSourceFacadeWindows>=100);
 assert.ok(geometry.counts.historicalSourceFacadeWindowFidList.includes(212747));
 assert.ok(geometry.counts.facadeWindows>=geometry.counts.historicalSourceFacadeWindows);
 const materialIds=new Set();
 for(let i=9;i<geometry.interleaved.length;i+=10)materialIds.add(geometry.interleaved[i]);
 // Official OTI roadbed (2) and ground plane (4) are separate viewer meshes,
 // not part of this neighborhood-builder interleaved buffer.
 for(const material of [0,1,3,5])assert.ok(materialIds.has(material),'missing render material '+material);
 assert.ok(geometry.counts.dcmFallbackBands>0&&geometry.counts.dcmFallbackTriangles>0);
 assert.ok(geometry.counts.triangles>geometry.counts.historicalRoofTriangles+
   geometry.counts.historicalFacadeTriangles);
 assert.ok(geometry.interleaved.every(Number.isFinite));
 assert.equal(geometry.provenance.historicalMesh.sourceRhinoSha256,asset.sourceRhinoSha256);
 assert.equal(geometry.provenance.historicalMesh.sourceVerticalDatumVerified,false);
});
