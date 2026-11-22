// Build a sourced 2022 roadbed surface for the existing 1:1 m low-fly
// scene. Both input files are independently fetched in the same CI run.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {compileOfficialRoadbedMesh} from '../tools/nyc/roadbed-source-mesh.mjs';
export function build(){
  const city=JSON.parse(readFileSync('artifacts/nyc-true-scale/source.json','utf8'));
  const source=JSON.parse(readFileSync('artifacts/nyc-roadbed-source/roadbed.json','utf8'));
  if(!city?.projection||!source?.projection||
     source.projection.originLonLat.join(',')!==city.projection.originLonLat.join(','))
    throw Error('Official buildings and roadbed sources have different local metre origins');
  const compiled=compileOfficialRoadbedMesh(source,city.buildings);
  mkdirSync('artifacts/nyc-true-scale',{recursive:true});
  writeFileSync('artifacts/nyc-true-scale/roadbed-mesh.json',JSON.stringify(compiled));
  console.log('Official OTI 2022 full roadbed source mesh:',JSON.stringify(compiled.counts));
  if(compiled.counts.trianglesInsideBuildings>compiled.counts.triangles*.06)
    throw Error('Excessive roadbed overlap with building source; review city year mismatch');
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href)
  try{build();}catch(e){console.error(e);process.exitCode=1;}
