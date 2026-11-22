/**
 * Source-grounded WGS84 metre frame for the existing USGS 3DEP Tracy Arm tile.
 *
 * This module is NOT wired to the current compressed PATROL flight world.
 * No 90-degree rotation, uniform miniaturization, vertical exaggeration or
 * invented coastline is permitted here. It is an independent foundation for
 * a future metre-accurate source-aligned landscape renderer and flight world.
 *
 * Public source datum: USGS 3DEP raster, EPSG:4326, rows increase northward.
 * Coordinates are ellipsoidal ECEF/ENU metres (height above WGS84 ellipsoid).
 * Existing DEM heights are labelled metres of terrain elevation, but their
 * vertical reference has NOT been verified as WGS84 ellipsoidal height. Do
 * not combine DEM elevations with ENU up as survey-grade height until the
 * DEM vertical datum is confirmed and converted.
 */

export const WGS84 = Object.freeze({
  semiMajorMetres: 6378137,
  inverseFlattening: 298.257223563
});
const A=WGS84.semiMajorMetres;
const F=1/WGS84.inverseFlattening;
const E2=F*(2-F);
const B=A*(1-F);
const EP2=(A*A-B*B)/(B*B);
const RAD=Math.PI/180;
const DEG=180/Math.PI;

function checkLongitudeLatitude(lon,lat){
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||
     lon < -180||lon > 180||lat < -90||lat > 90)
    throw new RangeError('Invalid WGS84 longitude/latitude');
}
export function validateTracyArmRaster(meta){
  if(!meta||meta.crs!=='EPSG:4326'||
     !Array.isArray(meta.bbox)||meta.bbox.length!==4||
     !meta.bbox.every(Number.isFinite)||
     !Number.isInteger(meta.width)||!Number.isInteger(meta.height)||
     meta.width<2||meta.height<2||
     meta.axis!=='x=east, z=north, south-first raster rows')
    throw new Error('Unsupported geospatial raster metadata');
  const [west,south,east,north]=meta.bbox;
  checkLongitudeLatitude(west,south);
  checkLongitudeLatitude(east,north);
  if(east<=west||north<=south)
    throw new Error('Non-increasing WGS84 DEM bounds');
  return meta;
}
export function rasterCellWgs84(meta,col,row){
  validateTracyArmRaster(meta);
  if(!Number.isInteger(col)||col<0||col>=meta.width||
     !Number.isInteger(row)||row<0||row>=meta.height)
    throw new RangeError('DEM cell outside source extent');
  const [west,south,east,north]=meta.bbox;
  // Centre-of-cell semantics, not tile-boundary semantics; south-first rows.
  return [west+(col+.5)*(east-west)/meta.width,
    south+(row+.5)*(north-south)/meta.height];
}
function ecef(lon,lat,ellipsoidHeight){
  checkLongitudeLatitude(lon,lat);
  if(!Number.isFinite(ellipsoidHeight))
    throw new RangeError('Invalid WGS84 ellipsoid height');
  const lambda=lon*RAD,phi=lat*RAD,sinPhi=Math.sin(phi),
    cosPhi=Math.cos(phi),n=A/Math.sqrt(1-E2*sinPhi*sinPhi);
  return [(n+ellipsoidHeight)*cosPhi*Math.cos(lambda),
    (n+ellipsoidHeight)*cosPhi*Math.sin(lambda),
    (n*(1-E2)+ellipsoidHeight)*sinPhi];
}
function geodeticFromEcef(x,y,z){
  const lon=Math.atan2(y,x),p=Math.hypot(x,y);
  const theta=Math.atan2(z*A,p*B),sinTheta=Math.sin(theta),
    cosTheta=Math.cos(theta);
  const lat=Math.atan2(z+EP2*B*sinTheta**3,
    p-E2*A*cosTheta**3);
  const n=A/Math.sqrt(1-E2*Math.sin(lat)**2);
  const height=p/Math.cos(lat)-n;
  return [lon*DEG,lat*DEG,height];
}
export function wgs84ToLocalEnu(lon,lat,height,originLon,originLat,originHeight=0){
  checkLongitudeLatitude(originLon,originLat);
  const a=ecef(lon,lat,height),o=ecef(originLon,originLat,originHeight);
  const dx=a[0]-o[0],dy=a[1]-o[1],dz=a[2]-o[2];
  const lambda=originLon*RAD,phi=originLat*RAD,
    sl=Math.sin(lambda),cl=Math.cos(lambda),
    sp=Math.sin(phi),cp=Math.cos(phi);
  const east=-sl*dx+cl*dy;
  const north=-sp*cl*dx-sp*sl*dy+cp*dz;
  const up=cp*cl*dx+cp*sl*dy+sp*dz;
  return [east,north,up];
}
export function localEnuToWgs84(east,north,up,originLon,originLat,originHeight=0){
  if(![east,north,up].every(Number.isFinite))
    throw new RangeError('Non-finite local metre coordinate');
  checkLongitudeLatitude(originLon,originLat);
  const lambda=originLon*RAD,phi=originLat*RAD,
    sl=Math.sin(lambda),cl=Math.cos(lambda),
    sp=Math.sin(phi),cp=Math.cos(phi);
  const o=ecef(originLon,originLat,originHeight);
  const x=o[0]-sl*east-sp*cl*north+cp*cl*up;
  const y=o[1]+cl*east-sp*sl*north+cp*sl*up;
  const z=o[2]+cp*north+sp*up;
  return geodeticFromEcef(x,y,z);
}
export function sourceTileOrigin(meta){
  validateTracyArmRaster(meta);
  const [west,south,east,north]=meta.bbox;
  return [(west+east)/2,(south+north)/2];
}
export function rasterCellToLocalEnu(meta,col,row,ellipsoidHeight=0){
  const [lon,lat]=rasterCellWgs84(meta,col,row);
  const [originLon,originLat]=sourceTileOrigin(meta);
  return wgs84ToLocalEnu(lon,lat,ellipsoidHeight,originLon,originLat);
}
export function sampleSourceElevationMetres(dem,lon,lat){
  validateTracyArmRaster(dem);
  checkLongitudeLatitude(lon,lat);
  const [west,south,east,north]=dem.bbox;
  if(lon<west||lon>east||lat<south||lat>north)
    throw new RangeError('Outside verified USGS DEM extent; no invented outside elevation');
  if(!dem.heights||dem.heights.length!==dem.width*dem.height)
    throw new Error('Decoded DEM is not available');
  const fx=Math.max(0,Math.min(dem.width-1,
    (lon-west)/(east-west)*dem.width-.5));
  const fy=Math.max(0,Math.min(dem.height-1,
    (lat-south)/(north-south)*dem.height-.5));
  const col=Math.floor(fx),row=Math.floor(fy),
    col1=Math.min(col+1,dem.width-1),row1=Math.min(row+1,dem.height-1);
  const tx=fx-col,ty=fy-row,h=dem.heights,w=dem.width;
  const first=h[row*w+col]*(1-tx)+h[row*w+col1]*tx;
  const second=h[row1*w+col]*(1-tx)+h[row1*w+col1]*tx;
  return first*(1-ty)+second*ty;
}
export function oldPatrolGamePointToWgs84(meta,gameEast,gameNorth,span=1920){
  validateTracyArmRaster(meta);
  if(![gameEast,gameNorth,span].every(Number.isFinite)||span<=0)
    throw new RangeError('Invalid legacy game coordinates');
  const [west,south,east,north]=meta.bbox;
  // Diagnostic ONLY: worker measuredHeight() rotates geographic east into
  // game north, and geographic south into game east to fit the invented route.
  // Never use this as a true north-up world transform.
  const u=gameEast/span+.5,v=gameNorth/span+.5;
  return [west+v*(east-west),south+(1-u)*(north-south)];
}
