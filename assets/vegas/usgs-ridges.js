// Small, strictly validated *source-derived* USGS 3DEP Vegas ridge profile.
// No network access on other maps. A missing/invalid asset must never create
// invented measurements or prevent game launch.
const SCHEMA='patrol-vegas-usgs-3dep-ridges-v1';
export function decodeVegasRidgeDEM(payload){
  if(!payload||payload.schema!==SCHEMA)throw new Error('Wrong Vegas USGS DEM schema');
  const source=payload.source,bbox=payload.boundsWgs84;
  if(source?.agency!=='USGS'||source?.crs!=='EPSG:4326'||
    source?.verticalUnits!=='meters'||
    !/^([0-9a-f]{64})$/.test(source?.rawGeoTiffSHA256||'')||
    !Array.isArray(bbox)||bbox.length!==4||!bbox.every(Number.isFinite)||
    Math.abs(bbox[0]+115.395)>.00001||Math.abs(bbox[1]-36.035)>.00001||
    Math.abs(bbox[2]+114.965)>.00001||Math.abs(bbox[3]-36.245)>.00001)
    throw new Error('Unverified or mislocated Vegas DEM provenance');
  const rows=49,elevationMeters=payload.elevationMeters;
  for(const key of ['west','center','east']){
    const values=elevationMeters?.[key];
    if(!Array.isArray(values)||values.length!==rows||
      !values.every(v=>Number.isFinite(v)&&v>100&&v<4500))
      throw new Error('Missing or invalid Vegas '+key+' USGS elevations');
  }
  const latitudes=payload.sampleLatitudesNorthing;
  if(!Array.isArray(latitudes)||latitudes.length!==rows||
    !latitudes.every((v,i)=>Number.isFinite(v)&&v>=bbox[1]-.0001&&
      v<=bbox[3]+.0001&&(i===0||v>latitudes[i-1])))
    throw new Error('Invalid south-north Vegas DEM sample georeferencing');
  for(const key of ['west','east']){
    const values=elevationMeters[key];
    if(Math.max(...values)-Math.min(...values)<6)
      throw new Error('Vegas '+key+' profile lacks measured relief');
  }
  return {source,boundsWgs84:[...bbox],sampleLatitudesNorthing:[...latitudes],
    elevationMeters:{
      west:[...elevationMeters.west],
      center:[...elevationMeters.center],
      east:[...elevationMeters.east]
    }};
}
export async function loadVegasRidgeDEM(url='./assets/vegas/strip-ridges-3dep.json',fetchFn=fetch,signal){
  const response=await fetchFn(url,{cache:'force-cache',signal});
  if(!response.ok)throw new Error('Vegas 3DEP profile HTTP '+response.status);
  return decodeVegasRidgeDEM(await response.json());
}
