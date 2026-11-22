/**
 * Strict optional USGS ImageServer ~5m source sub-tile for Tracy Arm.
 * NOT a full 8-km DEM replacement; NEVER pretend the parent 30m tile became
 * higher-resolution or claim current-year conditions.
 */
import {rasterCellWgs84,validateTracyArmRaster} from './tracy-arm-geodesy.js';
const EXPECTED_COLS=[150,190,85,125];
export function decodeAlaskaFiveMetreTile(payload,parent){
  if(!payload || payload.format!=='usgs-3dep-i16dm-southfirst-v1' ||
     payload.crs!=='EPSG:4326'||
     payload.axis!=='x=east, z=north, south-first raster rows' ||
     payload.width!==256||payload.height!==256||
     payload.metresPerInteger!==.1||payload.noDataInt16!==-32768||
     payload.adjustAspectRatio!==false||
     !Array.isArray(payload.actualBboxVerifiedFromServer)||
     payload.actualBboxVerifiedFromServer.length!==4||
     !payload.actualBboxVerifiedFromServer.every(Number.isFinite)||
     !payload.actualBboxVerifiedFromServer.every((v,i)=>
       Math.abs(v-payload.bbox[i])<1e-8)||
     !Array.isArray(payload.parentCoarseCellCentres)||
     payload.parentCoarseCellCentres.join(',')!==EXPECTED_COLS.join(',')||
     payload.sourceUrl!=='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage'||
     !/^https:\/\/elevation\.nationalmap\.gov\/arcgis\/rest\/services\/3DEPElevation\/ImageServer\/exportImage\?/.test(payload.sourceQuery)||
     !/^[a-f0-9]{64}$/.test(payload.sourceRawTiffSha256||'')||
     payload.projectIndexEvidence?.workunit!=='AK_IFSAR_Sum_L4_C353_2010'||
     Number(payload.projectIndexEvidence?.dem_gsd_meters)!==5||
     String(payload.projectIndexEvidence?.vert_crs)!=='5703')
    throw Error('Unverified experimental Tracy Arm high-resolution tile');
  validateTracyArmRaster(payload);
  validateTracyArmRaster(parent);
  // Explicit server f=json verification is mandatory: with default auto-
  // aspect a 256x256 TIFF silently expands the latitude bounds, and the
  // historical source raster was previously mislabelled as its request bbox.
  const request=new URL(payload.sourceQuery);
  if(request.searchParams.get('adjustAspectRatio')!=='false'||
     request.searchParams.get('bboxSR')!=='4326'||
     request.searchParams.get('imageSR')!=='4326'||
     request.searchParams.get('size')!=='256,256')
    throw Error('USGS 5m TIFF was not explicitly exported at WGS84 bbox');
  const [west,south,east,north]=parent.bbox;
  if(payload.bbox[0]<=west||payload.bbox[1]<=south||
     payload.bbox[2]>=east||payload.bbox[3]>=north)
    throw Error('High-resolution tile escapes known USGS source extent');
  // This is a validation of the requested historic bbox grid, NOT a claim
  // that the legacy 30m TIFF pixel centres were truly at those coordinates.
  // The old TIFF has a different ArcGIS effective latitude extent.
  for(const [col,row,targetCol,targetRow] of [[0,0,150,85],[255,255,190,125]]){
    const expected=rasterCellWgs84(parent,targetCol,targetRow);
    const actual=rasterCellWgs84(payload,col,row);
    if(Math.abs(actual[0]-expected[0])>1e-7||
       Math.abs(actual[1]-expected[1])>1e-7)
      throw Error('High-resolution tile request anchor mismatch (historical stored bbox only)');
  }
  const [sx,sy]=payload.sampleSpacingApproxMeters||[];
  if(!(sx>4.4&&sx<5.3&&sy>4.4&&sy<5.3))
    throw Error('High-resolution tile has false sample-size metadata');
  if(typeof payload.heightsBase64!=='string'||
     payload.heightsBase64.length>180000)
    throw Error('Invalid high-resolution tile packing');
  const packed=atob(payload.heightsBase64);
  if(packed.length!==256*256*2)
    throw Error('Truncated high-resolution source raster');
  const heights=new Float32Array(256*256);
  let max=-Infinity,min=Infinity;
  for(let i=0;i<heights.length;i++){
    const bits=packed.charCodeAt(2*i)|(packed.charCodeAt(2*i+1)<<8);
    const signed=bits<32768?bits:bits-65536;
    if(signed===-32768)throw Error('NoData found in experimental 5m source tile');
    const metres=signed*.1;
    if(metres< -250||metres>3000)
      throw Error('Invalid 5m source elevation '+metres);
    heights[i]=metres;max=Math.max(max,metres);min=Math.min(min,metres);
  }
  if(max<350||min< -20)
    throw Error('5m source tile lacks expected Tracy Arm relief/water');
  // The project INDEX says EPSG5703 NAVD88; this does NOT prove an arbitrary
  // dynamic ImageServer export has been vertically transformed.
  return {...payload,heights,highRes:true,
    sourceElevationRangeMeters:[min,max]};
}
