// Compile public-domain USGS EPQS point samples to an inspectable 1-D
// elevation profile. This is NOT a full DEM or surveyed skyline/line of sight.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const src=process.argv[2]||'artifacts/vegas-usgs/epqs-transects.json';
const dst=process.argv[3]||'artifacts/vegas-usgs/verified-ridge-profile.json';
const data=JSON.parse(await readFile(src,'utf8'));
if(data.source!=='USGS National Map EPQS v1 (interpolated 3DEP point elevation)'||
   data.status!=='sample-complete'||data.isFullDEM!==false||
   data.errors?.length||data.samples?.length!==24)
 throw Error('USGS input incomplete or not the expected 24 public-domain point samples');
const expectations=[
 {sourceId:'west-red-rock-sample-line',side:'west',lon:-115.48,minCrest:1500},
 {sourceId:'east-frenchman-sample-line',side:'east',lon:-114.997,minCrest:900}
];
const profiles={};
for(const line of expectations){
 const entries=data.samples.filter(p=>p.transect===line.sourceId).sort((a,b)=>a.latitude-b.latitude);
 if(entries.length!==12)throw Error('Expected 12 distinct elevations for '+line.side);
 if(entries[0].latitude!==36.06||entries.at(-1).latitude!==36.22)
  throw Error('Unexpected latitudinal extent of '+line.side);
 const unique=new Set(entries.map(p=>p.latitude));
 if(unique.size!==12||!unique.has(36.1792))
  throw Error('Missing or duplicated summit-adjacent latitude in '+line.side);
 for(const p of entries){
  if(p.longitude!==line.lon||!Number.isFinite(p.elevationMeters)||
     p.elevationMeters<100||p.elevationMeters>5000||
     !(p.resolutionMeters>0&&p.resolutionMeters<=30)||
     typeof p.requestUrl!=='string'||
     !p.requestUrl.startsWith('https://epqs.nationalmap.gov/v1/json?'))
    throw Error('Invalid coordinates, elevation or provenance at '+line.side+' / '+p.latitude);
 }
 if(Math.max(...entries.map(p=>p.elevationMeters))<line.minCrest)
  throw Error('Crest altitude missing: '+line.side+' may be on valley floor');
 if(line.side==='east'){
  const summit=entries.find(p=>p.latitude===36.1792);
  if(summit.elevationMeters<800)
   throw Error('Frenchman summit-meridian sanity check failed; do not enable visual profile');
 }
 profiles[line.side]={
  sourceTransect:line.sourceId,longitude:line.lon,
  elevations:entries.map(p=>[p.latitude,p.elevationMeters]),
  sourceRasters:[...new Set(entries.map(p=>p.rasterId))]
 };
}
const profile={
 dataset:'USGS EPQS 3DEP sampled 1-D transects (not a gridded DEM)',
 source:data.docs,
 provenance:data.accuracy,
 dataLicense:data.license,
 sourceDateUtc:data.downloadedAtUtc,
 coordinateReferenceSystem:'NAD83 EPSG:4326',
 verticalUnit:'meters',
 isFullDEM:false,
 isGeoreferencedGameMap:false,
 gameMapping:'Optional visual-only sample line: southern game z=-666 => lat=36.06, northern z=666 => lat=36.22. This mapping is illustrative; PATROL Las Vegas coordinates are compressed and not surveyed.',
 profiles
};
await mkdir(dst.slice(0,dst.lastIndexOf('/'))||'.',{recursive:true});
await writeFile(dst,JSON.stringify(profile,null,2)+'\n');
console.log(JSON.stringify({result:'profile validated',west:profiles.west.elevations.length,
 east:profiles.east.elevations.length,date:profile.sourceDateUtc,output:dst}));
