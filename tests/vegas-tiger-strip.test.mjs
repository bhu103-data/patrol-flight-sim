import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeVegasTIGERCenterline,vegasMeasuredRoadX,loadVegasTIGERCenterline} from '../assets/vegas/tiger-strip.js';

const read=async()=>JSON.parse(await readFile(new URL('../assets/vegas/strip-centerline-tiger-2026.json',import.meta.url),'utf8'));
test('authentic TIGER source checksum, bounded road curvature and safe gameplay alignment',async()=>{
 const raw=await read(),data=decodeVegasTIGERCenterline(raw);
 assert.equal(data.source.archiveSHA256,'dba759001381d6c502160dc6f8b1987bef4e89544ac475943820cd870f07fbf9');
 assert.equal(data.points.length,25);
 assert.equal(data.points[0][1],36.1073);
 assert.equal(data.points.at(-1)[1],36.1151);
 const bounds=Array.from({length:177},(_,i)=>-210+i*.5);
 assert.ok(bounds.every(z=>Math.abs(vegasMeasuredRoadX(data,z)+35)<=.30));
 assert.equal(vegasMeasuredRoadX(data,-220),-35);
 assert.equal(vegasMeasuredRoadX(data,-120),-35);
 assert.ok(Math.abs(vegasMeasuredRoadX(data,-166)+35)>.20,
   'measured curvature must actually change the visual road centerline');
});
test('reject forged TIGER source, invalid coordinates, unverified curvature and absent files',async()=>{
 const original=await read();
 const wrong=structuredClone(original);wrong.source.archiveSHA256='0'.repeat(64);
 assert.throws(()=>decodeVegasTIGERCenterline(wrong),/Unverified/);
 const out=structuredClone(original);out.samplesWgs84[4][0]=-80;
 assert.throws(()=>decodeVegasTIGERCenterline(out),/out-of-scope/);
 const offset=structuredClone(original);offset.gameReference.sampledLateralOffsets[10]=6;
 assert.throws(()=>decodeVegasTIGERCenterline(offset),/Unreconciled/);
 await assert.rejects(loadVegasTIGERCenterline('/missing',async()=>({ok:false,status:404})),/404/);
});
test('real measured TIGER bends only flush Strip joints and preserves road and flight physics',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/vegasMeasuredStripX\(z\)/);
 assert.match(html,/Vegas Census TIGER measured Strip loaded/);
 assert.match(html,/buildVegasRoads\(box,lamp,addQuad\)/);
 const a=html.indexOf('  function buildVegasCoreRidgeSample(geometry) {');
 const b=html.indexOf('  function buildVegasStrip(geometry)',a);
 assert.ok(a>0&&b>a);
 const source=html.slice(a,b);
 assert.doesNotMatch(source,/sceneryObjects\.push|solidAt\(|makeVegasTraffic\(|plane\.pos/);
 const verified=decodeVegasTIGERCenterline(await read());
 const build=new Function('sampleTerrainHeight','VEGAS_BOULEVARD',
   'vegasMeasuredRidges','vegasMeasuredStripX',
   source+'return buildVegasCoreRidgeSample;')(
   ()=>13.6,-35,null,z=>vegasMeasuredRoadX(verified,z));
 const repairs=[];
 const stats=build({addTri:()=>{},addQuad:(a,b,c,d)=>repairs.push([a,b,c,d])});
 assert.equal(stats.roadTriangles,114);
 assert.equal(repairs.length,57);
 for(const [i,vertices] of repairs.slice(0,9).entries()){
   const z=-210+i*11;
   const center=vegasMeasuredRoadX(verified,z);
   const actual=(vertices[0][0]+vertices[2][0])/2;
   assert.ok(Math.abs(actual-center)<1e-7,'road repair aligns with real geodata');
 }
 for(const vertices of repairs.slice(9)){
   const [a,b,c,d]=vertices;
   const centerA=vegasMeasuredRoadX(verified,a[2]);
   const centerB=vegasMeasuredRoadX(verified,c[2]);
   assert.ok(Math.abs(Math.abs((a[0]+d[0])/2-centerA)-7.18)<.0001,
     'TIGER seam start follows the measured road centreline');
   assert.ok(Math.abs(Math.abs((b[0]+c[0])/2-centerB)-7.18)<.0001,
     'TIGER seam end follows the measured road centreline');
   const normalY=(b[2]-a[2])*(c[0]-a[0])-
     (b[0]-a[0])*(c[2]-a[2]);
   assert.ok(normalY>0,'both roadside strips must face upward');
   assert.ok([a,b,c,d].every(p=>p[0]>=-43&&p[0]<=-27 &&
       p[2]>=-210&&p[2]<=-122),
       'TIGER seams remain within original asphalt footprint');
 }
});
