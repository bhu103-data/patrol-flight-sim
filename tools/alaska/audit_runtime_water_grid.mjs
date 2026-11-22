#!/usr/bin/env node
// Reproduce PATROL's production Alaska heightfield -> Floatplane water-gate
// using the REAL 3DEP DEM and NOAA CUSP shorelines. QA only, never runtime
// mutation. No private network calls; inputs from prior official CI steps.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const html = readFileSync('index.html', 'utf8');
const demFile = JSON.parse(readFileSync('assets/alaska/tracy-arm-3dep.json', 'utf8'));
const noaaPath = 'alaska-official-aoi-results/noaa-cusp-tracy-arm-qa/tracy-arm-cusp-qa-only.geojson';
const noaaFile = readFileSync(noaaPath);
const noaa = JSON.parse(noaaFile.toString('utf8'));
const raw = Buffer.from(demFile.heightsBase64, 'base64');
const heights = new Uint16Array(256 * 256);
for (let k = 0; k < heights.length; k++)
  heights[k] = raw.readUInt16LE(k * 2);

const begin = html.indexOf('  function* generateTerrain(options) {');
const end = html.indexOf('\n  const workerSrc = ' + String.fromCharCode(96), begin);
if (begin < 0 || end < 0) throw Error('Cannot locate production terrain generator');
const generateTerrain = new Function('return (' + html.slice(begin, end).trim() + ')')();

const span = 1920, N = 1024, water = 12.2, scale = 75;
const verticalScale = Math.min(.04, (scale * .90 - water) / demFile.maxElevationMeters);
const options = {
  size: N, span, landmarks: [], scale, water,
  airfield: null, city: null, alaska: true, vegas: null,
  dc: null, chongqing: null, preview: true,
  alaskaDEM: { heights, width:256, height:256, verticalScale },
};
let preview;
for (const result of generateTerrain(options)) {
  if (result?.type === 'preview') { preview = result.height; break; }
}
if (!preview || preview.length !== N*N) throw Error('Unexpected terrain preview');
const data = new Uint8Array(N * N);
let rawWetCells = 0, quantizedWetCells = 0;
for (let i = 0; i < data.length; i++) {
  if (preview[i] * scale <= water) rawWetCells++;
  data[i] = Math.round(preview[i] * 255);
  if (data[i] / 255 * scale <= water) quantizedWetCells++;
}
const clamp = (v,a,b) => Math.min(b, Math.max(a,v));
const lerp = (a,b,t) => a + (b-a)*t;
function terrainAt(x,z) {
  const fx=clamp((x/span+.5)*N-.5,0,N-1);
  const fy=clamp((z/span+.5)*N-.5,0,N-1);
  const ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy;
  const ix1=Math.min(ix+1,N-1),iy1=Math.min(iy+1,N-1);
  const H=(a,b)=>data[b*N+a]/255;
  const h=lerp(lerp(H(ix,iy),H(ix1,iy),tx),
               lerp(H(ix,iy1),H(ix1,iy1),tx),ty)*scale;
  return Math.max(h,water);
}
const waterStart=html.indexOf('  function usableFloatWater(');
const waterEnd=html.indexOf('  function findFloatWaterStart()',waterStart);
if (waterStart<0||waterEnd<=waterStart) throw Error('Cannot locate float water gate');
const factory=new Function(
  'plane','WATER_H','sampleTerrainHeight','cityLotAt',
  'sceneryObstacle','selectedMap','alaskaObstacles','clearOfNycHeroDocks',
  html.slice(waterStart,waterEnd)+';return usableFloatWater;');
const usableFloatWater=factory(
  {yaw:0},water,terrainAt,()=>null,()=>null,
  {alaska:true,city:false},[],()=>true);

const bbox=demFile.bbox;
const deltaLon=bbox[2]-bbox[0], deltaLat=bbox[3]-bbox[1];
function toGame(lon,lat) {
  return [(0.5-(lat-bbox[1])/deltaLat)*span,
          ((lon-bbox[0])/deltaLon-0.5)*span];
}

const segment = {
  sampleCount:0, wetCenterCount:0, dryCenterCount:0,
  floatFootprintWaterCount:0, floatFootprintBlockedCount:0,
  excludedOutsideWorld:0, sampledLengthGameUnits:0,
};
let processedFeatures=0;
for (const feature of noaa.features) {
  if (feature.properties?.DAT_SET_CR !== 'NOAA') throw Error('Uncleared NOAA feature found');
  const geom=feature.geometry;
  const paths=geom.type==='LineString'?[geom.coordinates]:
    geom.type==='MultiLineString'?geom.coordinates:[];
  processedFeatures++;
  for (const path of paths) {
    for(let i=0;i<path.length-1;i++){
      const a=toGame(...path[i]), b=toGame(...path[i+1]);
      const length=Math.hypot(a[0]-b[0],a[1]-b[1]);
      const steps=Math.max(1,Math.ceil(length/2));
      segment.sampledLengthGameUnits+=length;
      for (let j=0;j<steps;j++){
        const t=(j+.5)/steps;
        const x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t);
        if(Math.max(Math.abs(x),Math.abs(z))>span/2) {
          segment.excludedOutsideWorld++; continue;
        }
        segment.sampleCount++;
        if (terrainAt(x,z)<=water+.06) segment.wetCenterCount++;
        else segment.dryCenterCount++;
        if (usableFloatWater(x,z,0)) segment.floatFootprintWaterCount++;
        else segment.floatFootprintBlockedCount++;
      }
    }
  }
}
if(processedFeatures!==7||segment.sampleCount<100)
  throw Error('Expected official clipped NOAA 7 line dataset and many coast samples');
const out={
  status:'QA_ONLY_NO_RUNTIME_CHANGE',
  source:'real NOAA CUSP N55W135 clipped GeoJSON and real 3DEP DEM',
  noaa_sha256:createHash('sha256').update(noaaFile).digest('hex'),
  alaska_dem_file_source:demFile.source,
  runtime_source_extract:'index.html production generateTerrain() and usableFloatWater()',
  map_span:span, map_size:N, world_water_height:water, vertical_scale:verticalScale,
  height_quantization:'match height[i] = round(height[i]*255)/255; clamp to WATER_H on CPU',
  raw_preview_wet_grid_cells:rawWetCells,
  quantized_wet_grid_cells:quantizedWetCells,
  shoreline_vertex_feature_count:processedFeatures,
  noaa_shore_samples:segment,
  near_shore_wet_center_fraction:+(segment.wetCenterCount/segment.sampleCount).toFixed(6),
  near_shore_float_25point_fraction:+(segment.floatFootprintWaterCount/segment.sampleCount).toFixed(6),
  note:[
    'NOAA lines are historic mean-high-water, not closed polygons or 2026 coastline.',
    'Line sampling is spaced in GAME units (2 units) not survey-metre accuracy.',
    'The 25-point gate here excludes moving vessels, docks and boat obstacles; it is a terrain-only water contact test.',
    'This does not prove WebGL2 GPU frame time, seaplane animation or physical hydrographic datum.'
  ]
};
const outDir='alaska-official-aoi-results/runtime-water-qa';
mkdirSync(outDir,{recursive:true});
writeFileSync(outDir+'/actual-1024-water-contact-report.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
