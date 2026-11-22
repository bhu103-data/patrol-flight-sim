import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const TAG_KEYS=['height','building:levels','building:part','roof:shape','roof:height','roof:material','building:material','building:colour','name','wikidata'];
export const OSM_LICENSE='ODbL-1.0';
export const OSM_ATTRIBUTION='© OpenStreetMap contributors';
export const NYCOSM_COMMIT='75ec01ced7fdd85619493d59f4e7e9236e0990fd';

export function polygonMetrics(ring){
  if(!Array.isArray(ring)||ring.length<4)return null;
  const pts=ring.map(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)?p:null);
  if(pts.some(p=>!p))return null;
  const lat0=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  const origin=pts[0],rad=Math.PI/180,R=6378137;
  const xy=pts.map(p=>[R*Math.cos(lat0*rad)*(p[0]-origin[0])*rad,R*(p[1]-origin[1])*rad]);
  if(Math.hypot(xy[0][0]-xy.at(-1)[0],xy[0][1]-xy.at(-1)[1])<.02)xy.pop();
  if(xy.length<3)return null;
  let twiceArea=0,cx=0,cy=0;
  for(let i=0;i<xy.length;i++){
    const a=xy[i],b=xy[(i+1)%xy.length],cross=a[0]*b[1]-b[0]*a[1];
    twiceArea+=cross;cx+=(a[0]+b[0])*cross;cy+=(a[1]+b[1])*cross;
  }
  if(Math.abs(twiceArea)<.01)return null;
  const area=Math.abs(twiceArea/2),center=[cx/(3*twiceArea),cy/(3*twiceArea)];
  return {areaSquareMeters:area,centroidWGS84:[
    origin[0]+center[0]/(R*Math.cos(lat0*rad))/rad,
    origin[1]+center[1]/R/rad
  ]};
}
function normalizeWay(element){
  if(element?.type!=='way'||!element.tags?.building||element.tags['building:part'])return null;
  if(!Array.isArray(element.geometry)||element.geometry.length<4)return null;
  const metrics=polygonMetrics(element.geometry.map(p=>[p.lon,p.lat]));
  return metrics?{id:element.id,tags:element.tags,...metrics}:null;
}
function validFootprint(f){
  if(!Number.isSafeInteger(f?.fid)||!Array.isArray(f.rings)||f.rings.length!==1)return null;
  const metrics=polygonMetrics(f.rings[0]);
  return metrics?{fid:f.fid,...metrics}:null;
}
function distanceMeters(a,b){
  const lat0=(a[1]+b[1])/2*Math.PI/180,R=6378137,rad=Math.PI/180;
  return Math.hypot((a[0]-b[0])*rad*R*Math.cos(lat0),(a[1]-b[1])*rad*R);
}
function median(values){
  if(!values.length)return null;
  const a=[...values].sort((x,y)=>x-y);
  return Number(a[Math.floor(a.length/2)].toFixed(3));
}
export function analyzeOsmFeatures(source,osm,{retrievedAt=new Date().toISOString(),bbox=source.bboxWGS84}={}){
  if(!Array.isArray(source?.features)||!Array.isArray(osm?.elements))throw new TypeError('Expected NYC source footprints and ODbL OSM elements');
  const ways=osm.elements.map(normalizeWay).filter(Boolean);
  const relations=osm.elements.filter(e=>e?.type==='relation'&&e.tags?.building);
  const partRelations=osm.elements.filter(e=>e?.type==='relation'&&e.tags?.['building:part']);
  const parts=osm.elements.filter(e=>e?.tags?.['building:part']);
  const official=source.features.map(validFootprint).filter(Boolean);
  const matches=[],ambiguous=[],unmatched=[];
  for(const f of official){
    const candidates=ways.map(w=>{
      const distance=distanceMeters(f.centroidWGS84,w.centroidWGS84),ratio=w.areaSquareMeters/f.areaSquareMeters;
      return {way:w,distance,areaRatio:ratio};
    }).filter(x=>x.distance<=8&&x.areaRatio>=.5&&x.areaRatio<=2)
      .sort((a,b)=>a.distance-b.distance||Math.abs(Math.log(a.areaRatio))-Math.abs(Math.log(b.areaRatio)));
    if(candidates.length===1){
      const x=candidates[0];
      matches.push({centroidDistanceMeters:Number(x.distance.toFixed(3)),areaRatio:Number(x.areaRatio.toFixed(4)),tags:x.way.tags});
    }else if(candidates.length>1)ambiguous.push(candidates);
    else unmatched.push(f.fid);
  }
  const coverage=Object.fromEntries(TAG_KEYS.map(key=>[key,matches.filter(w=>typeof w.tags[key]==='string'&&w.tags[key].trim()!=='').length]));
  const allCoverage=Object.fromEntries(TAG_KEYS.map(key=>[key,ways.filter(w=>typeof w.tags[key]==='string'&&w.tags[key].trim()!=='').length]));
  const distances=matches.map(x=>x.centroidDistanceMeters),ratios=matches.map(x=>x.areaRatio);
  return {
    schema:'patrol-nyc-osm-times-square-audit-v1',status:'source-audit-only-no-game-import',retrievedAt,
    source:{
      name:'OpenStreetMap contributors',sourceMode:'Pinned NYC OSM GeoParquet source extract',
      package:'kjhealy/nycosm',packageCommit:NYCOSM_COMMIT,extractDate:'2026-10-18',
      dataFiles:['inst/extdata/nyc_osm_buildings_manhattan.parquet','inst/extdata/nyc_osm_areas.parquet'],
      queryBboxWGS84:bbox,queryType:'EPSG:2263 geometry intersection with Times Square bbox; Manhattan building layer plus area-layer building parts',
      license:OSM_LICENSE,attribution:OSM_ATTRIBUTION,shareAlike:'Derived OSM database remains under ODbL-1.0'
    },
    officialFootprintReference:{
      source:source.reference,retrieved:source.retrieved,featuresInSnapshot:source.features.length,
      singleRingValidFeatures:official.length,
      matchingPolicy:'unique OSM building way only; centroid distance <= 8m; OSM/official area ratio 0.5..2.0; building:part ways excluded'
    },
    osmCounts:{allElements:osm.elements.length,buildingWays:ways.length,buildingRelations:relations.length,buildingPartRelations:partRelations.length,buildingParts:parts.length},
    join:{
      uniqueMatches:matches.length,ambiguousCount:ambiguous.length,unmatchedCount:unmatched.length,
      matchQuality:{
        medianCentroidDistanceMeters:median(distances),
        maxCentroidDistanceMeters:distances.length?Number(Math.max(...distances).toFixed(3)):null,
        minAreaRatio:ratios.length?Number(Math.min(...ratios).toFixed(4)):null,
        maxAreaRatio:ratios.length?Number(Math.max(...ratios).toFixed(4)):null
      },
      matchPolicy:'unique candidate only; aggregate metrics exported, no FID/OSM-ID pair list'
    },
    tagCoverage:{denominatorUniqueMatches:matches.length,matched:coverage,allBuildingWaysDenominator:ways.length,allBuildingWays:allCoverage},
    caveats:[
      'OSM is volunteer-maintained, not an authoritative building survey.',
      'Tags are optional; absence is unknown, not permission to infer a value.',
      'OSM building geometry may derive from municipal footprints; OSM-specific enrichment is not an independent survey.',
      'Only unique way-to-footprint centroid/area matches are counted; relations and ambiguous candidates are reported separately.',
      'This report does not authorize any runtime import, facade reconstruction, or claim of photorealism.'
    ],
    redistribution:{license:OSM_LICENSE,attribution:OSM_ATTRIBUTION,rawOsmSnapshotCommitted:false,rawOsmSnapshotUploaded:false,runtimeImport:false,exportedMunicipalOsmPairings:false}
  };
}
async function main(){
  const source=JSON.parse(await readFile(resolve(ROOT,'assets/nyc/times-square-footprints.json'),'utf8'));
  const inputPath=process.env.PATROL_OSM_AUDIT_INPUT;
  if(!inputPath)throw new Error('PATROL_OSM_AUDIT_INPUT must point to the temporary, uncommitted OSM elements JSON');
  const osm=JSON.parse(await readFile(inputPath,'utf8'));
  const report=analyzeOsmFeatures(source,osm,{bbox:source.bboxWGS84});
  const outDir=resolve(ROOT,'artifacts/nyc-osm-times-square-audit');
  await mkdir(outDir,{recursive:true});
  await writeFile(resolve(outDir,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,osmCounts:report.osmCounts,sourceFootprints:report.officialFootprintReference.singleRingValidFeatures,uniqueMatches:report.join.uniqueMatches,ambiguous:report.join.ambiguousCount,unmatched:report.join.unmatchedCount,tagCoverage:report.tagCoverage.matched,license:report.source.license,attribution:report.source.attribution},null,2));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))main().catch(error=>{console.error(error);process.exitCode=1;});
