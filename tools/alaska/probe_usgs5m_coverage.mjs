/**
 * Verify actual public USGS Alaska 5 m DEM index coverage of PATROL's *exact*
 * Tracy Arm tile, instead of inferring it from a generic Alaska catalog.
 *
 * Source: USGS 3DEPElevationIndex/MapServer, 5 m Alaska product footprint
 * layer 3. Optional layer 20 lists collection metadata/vertical CRS. Read-only
 * requests with explicit WGS84 point/envelope spatial intersects.
 *
 * This is a discovery report, not 5 m elevation data, native-resolution proof,
 * vertical-datum conversion, or permission to redistribute other imagery.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const source=JSON.parse(readFileSync(
  new URL('../../assets/alaska/tracy-arm-3dep.json',import.meta.url),'utf8'));
if(source.crs!=='EPSG:4326'||source.width!==256||source.height!==256)
  throw Error('Unexpected source DEM CRS/shape; do not query wrong region');
const [west,south,east,north]=source.bbox;
if(!(west<-133&&east>-134&&south>57&&north<59))
  throw Error('Tracy Arm source geographic guard mismatch');
const base='https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer';
const saved=[];
const report={
  sourceName:'USGS 3DEP 5m Alaska coverage index, NOT an actual elevation raster',
  sourceUrl:base+'/3',
  sourceMetadataUrl:base+'/20',
  exactDemBbox:source.bbox,
  sourceResolutionMeters:source.sampleSpacingApproxMeters,
  checkedAt:new Date().toISOString(),
  lookup:'WGS84 lon/lat 3×3 exact raster-bbox grid point intersections; coverage cannot be extrapolated from envelope intersection',
  points:[],
  tileEnvelope:{},
  metadataCandidates:[],
  uncertainty:[],
  coverageConfirmed:false
};
async function query(layer,params,tag){
  const url=new URL(base+'/'+layer+'/query');
  for(const [k,v] of Object.entries({f:'json',where:'1=1',...params}))
    url.searchParams.set(k,String(v));
  let response,text;
  try{
    response=await fetch(url,{headers:{Accept:'application/json'},
      signal:AbortSignal.timeout(18000)});
    text=await response.text();
  }catch(e){throw Error('USGS '+tag+' request failure: '+e.message)}
  if(!response.ok)throw Error('USGS '+tag+' HTTP '+response.status+
    ': '+text.slice(0,150));
  let json;
  try{json=JSON.parse(text)}catch{throw Error('USGS '+tag+' not JSON: '+text.slice(0,120))}
  if(json.error)throw Error('USGS '+tag+' ArcGIS error '+JSON.stringify(json.error).slice(0,300));
  saved.push({tag,url:url.toString(),status:response.status,
    count:json.count??json.features?.length??null});
  return json;
}
function pointParams(lon,lat){
  return {
    geometry:JSON.stringify({x:lon,y:lat,spatialReference:{wkid:4326}}),
    geometryType:'esriGeometryPoint',inSR:4326,
    spatialRel:'esriSpatialRelIntersects',returnCountOnly:true
  };
}
function envParams(){
  return {
    geometry:west+','+south+','+east+','+north,
    geometryType:'esriGeometryEnvelope',inSR:4326,
    spatialRel:'esriSpatialRelIntersects'
  };
}
try{
  const env=await query(3,{...envParams(),returnCountOnly:true},
    '5m-envelope-intersect-count');
  report.tileEnvelope.fiveMetreProductsIntersecting=env.count;
  const meta=await query(20,{...envParams(),returnGeometry:false,
    outFields:'workunit,project,collect_start,collect_end,ql,dem_gsd_meters,horiz_crs,vert_crs,geoid,sourcedem_category,sourcedem_pub_date,metadata_link,sourcedem_link',
    resultRecordCount:25},
    '5m-project-metadata');
  report.metadataCandidates=(meta.features||[]).map(x=>x.attributes)
    .slice(0,25);
  const fractions=[.03,.5,.97];
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const lon=west+(east-west)*fractions[col],
      lat=south+(north-south)*fractions[row];
    const data=await query(3,pointParams(lon,lat),
      'point-'+row+'-'+col);
    if(!Number.isInteger(data.count)||data.count<0)
      throw Error('USGS point count invalid at '+col+','+row);
    report.points.push({col,row,lon:+lon.toFixed(7),lat:+lat.toFixed(7),
      fiveMetreProductCount:data.count,covered:data.count>0});
    console.log('USGS 5m grid '+col+','+row+': '+data.count+
      ' index polygon(s) at '+lon.toFixed(6)+','+lat.toFixed(6));
  }
  report.coverageConfirmed=report.points.length===9&&
    report.points.every(x=>x.covered);
  const count=report.points.filter(x=>x.covered).length;
  report.interpretation=report.coverageConfirmed
    ? 'All nine sample points intersect 5m footprints. This verifies sample coverage, NOT complete polygon coverage or a downloadable DEM at every pixel.'
    : count===0
    ? 'No sampled location intersects the published 5m DEM index. Do NOT describe this tile as having verified 5m source coverage.'
    : 'Partial sampled footprint coverage ('+count+'/9). Do not replace the full tile or invent 5m detail outside confirmed footprint.';
  report.uncertainty.push(
    'Nine sample intersections do not certify full polygon coverage; download exact product extent and raster nodata if proceeding.',
    '5m index is availability metadata. Actual vertical CRS and acquisition dates require product-specific verification.',
    'No 2025/2026 glacier state can be inferred from older survey data.',
    'NOAA AK1803-CM-T shoreline spans this bbox but survey imagery is 2015-2017; separate vector acquisition is required.'
  );
  report.requests=saved;
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/alaska-usgs5m-coverage.json',
    JSON.stringify(report,null,2));
  console.log('USGS 5m COVERAGE RESULT '+
    JSON.stringify({sampled:count,total:report.points.length,
      anyEnvelope:report.tileEnvelope.fiveMetreProductsIntersecting,
      metadataCandidates:report.metadataCandidates.length,
      coverageConfirmed:report.coverageConfirmed,
      interpretation:report.interpretation}));
}catch(error){
  report.uncertainty.push('USGS index query failed: '+error.message);
  report.requests=saved;
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/alaska-usgs5m-coverage.json',
    JSON.stringify(report,null,2));
  console.error('UNVERIFIED USGS 5m coverage: '+error.message);
  process.exitCode=1;
}
