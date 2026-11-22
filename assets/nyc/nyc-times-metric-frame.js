// Source-derived NYC Times Square geometry in a single metric local frame.
//
// This converts the *existing* public NYC Building Footprints WGS84 snapshot
// without PATROL's old .32 scene/height compression, clipping, or fake roads.
// The origin is an APPROXIMATE reference position of One Times Square.
// This is NOT surveyed 3-D reality, a replacement for the old game renderer,
// a vertical datum, a complete city inventory, or a photogrammetry model.
//
// Axes: +X east (metres), +Z north (metres), +Y up (metres).
// Short-distance local tangent frame is valid for this ~0.6 km pilot. Do not
// extend it citywide or to Alaska without a proper projected/geocentric CRS.
export const TIMES_METRIC_ORIGIN=Object.freeze({
  longitude:-73.9864883,
  latitude:40.756421,
  description:'Approximate One Times Square reference, not surveyed point'
});
const RAD=Math.PI/180;
const WGS84_A=6378137;
const WGS84_E2=6.6943799901413165e-3;
const latitude0=TIMES_METRIC_ORIGIN.latitude*RAD;
const sin0=Math.sin(latitude0);
const w=Math.sqrt(1-WGS84_E2*sin0*sin0);
// WGS84 local radii of curvature at the pilot reference latitude.
const metersPerLongitudeRadian=WGS84_A*Math.cos(latitude0)/w;
const metersPerLatitudeRadian=WGS84_A*(1-WGS84_E2)/(w*w*w);
const validPair=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
export function wgs84ToLocalMeters(pair){
  if(!validPair(pair))throw new TypeError('A finite [longitude, latitude] is required');
  const [longitude,latitude]=pair;
  if(longitude< -180||longitude>180||latitude< -90||latitude>90)
    throw new RangeError('Invalid WGS84 degrees');
  return [
    (longitude-TIMES_METRIC_ORIGIN.longitude)*RAD*metersPerLongitudeRadian,
    (latitude-TIMES_METRIC_ORIGIN.latitude)*RAD*metersPerLatitudeRadian
  ];
}
export function localMetersToWgs84(pair){
  if(!validPair(pair))throw new TypeError('A finite [east, north] metre pair is required');
  return [
    TIMES_METRIC_ORIGIN.longitude+pair[0]/(RAD*metersPerLongitudeRadian),
    TIMES_METRIC_ORIGIN.latitude+pair[1]/(RAD*metersPerLatitudeRadian)
  ];
}
function signedArea(ring){
  let sum=0;
  for(let i=0;i+1<ring.length;i++){
    const a=ring[i],b=ring[i+1];
    sum+=a[0]*b[1]-b[0]*a[1];
  }
  return .5*sum;
}
export function uncompressedTimesSquareFootprints(dataset){
  if(!dataset||!Array.isArray(dataset.features)||
     !String(dataset.source||'').includes('NYC Building Footprints'))
    throw new TypeError('Expected unmodified NYC Building Footprints WGS84 snapshot');
  if(dataset.coordinateSystem?.startsWith('WGS84')!==true)
    throw new TypeError('WGS84 source must be identified explicitly');
  const buildings=[],seen=new Set();
  let ringCount=0,holesPreserved=0;
  for(const source of dataset.features){
    if(!Number.isSafeInteger(source.fid)||seen.has(source.fid))
      throw new Error('Missing/duplicate official FID');
    seen.add(source.fid);
    if(!(Number.isFinite(source.heightFt)&&source.heightFt>0))
      throw new Error('Missing nonzero NYC HEIGHTROOF for FID '+source.fid);
    if(!Array.isArray(source.rings)||!source.rings.length)
      throw new Error('Missing building rings for FID '+source.fid);
    const rings=source.rings.map(ring=>{
      if(!Array.isArray(ring)||ring.length<4||ring.length>4096||
         !ring.every(validPair))
        throw new Error('Invalid polygon vertices on FID '+source.fid);
      const [a,b]=[ring[0],ring[ring.length-1]];
      if(a[0]!==b[0]||a[1]!==b[1])
        throw new Error('Open source ring must be handled explicitly, FID '+source.fid);
      // Preserve all source vertices AND every inner ring. Never silently
      // flatten a real courtyard, clip to fictional roads or simplify again.
      const projected=ring.map(wgs84ToLocalMeters);
      if(Math.abs(signedArea(projected))<.05)
        throw new Error('Degenerate ring on FID '+source.fid);
      ringCount++;
      return projected;
    });
    holesPreserved+=rings.length-1;
    const vertices=rings.flat();
    const east=vertices.map(p=>p[0]),north=vertices.map(p=>p[1]);
    buildings.push({
      fid:source.fid,
      roofHeightMeters:source.heightFt*.3048, // feet above local ground, NOT AMSL
      rings,
      boundsMeters:[Math.min(...east),Math.min(...north),
                    Math.max(...east),Math.max(...north)]
    });
  }
  return {
    referenceFrame:{
      axes:'X=east metres, Z=north metres, Y=up metres',
      originWgs84:[TIMES_METRIC_ORIGIN.longitude,TIMES_METRIC_ORIGIN.latitude],
      method:'local WGS84 tangent-plane radii; approximate origin',
      sourceSnapshotDate:dataset.retrieved,
      verticalDatum:null
    },
    buildings,
    stats:{buildingCount:buildings.length,ringCount,holesPreserved,
      minimumRoofMeters:Math.min(...buildings.map(b=>b.roofHeightMeters)),
      maximumRoofMeters:Math.max(...buildings.map(b=>b.roofHeightMeters))}
  };
}
// A green geometry test MUST NOT be allowed to mean the city is rebuilt.
// The city has no surveyed street alignment, complete facade models, or
// common terrain/sea-level datum yet.
export function checkTimesSquareReconstructionGate(scene,{
  officialStreetCenterlines=null,
  verticalDatum=null,
  licensedFacadeGeometry=null,
  measuredReferenceViews=null
}={}){
  const blockers=[];
  if(!scene?.buildings?.length)blockers.push('No metric NYC building footprints');
  if(!Array.isArray(officialStreetCenterlines)||officialStreetCenterlines.length===0)
    blockers.push('No official street centerlines in same metre frame');
  if(typeof verticalDatum!=='string'||!verticalDatum.trim())
    blockers.push('No specified terrain/building vertical datum');
  if(!licensedFacadeGeometry)
    blockers.push('No source-provenanced building facades and roof detail');
  if(!measuredReferenceViews)
    blockers.push('No fixed-site photo or survey alignment QA');
  return {ready:blockers.length===0,blockers};
}
