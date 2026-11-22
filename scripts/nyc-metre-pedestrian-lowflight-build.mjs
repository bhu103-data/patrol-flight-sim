/**
 * Official NYC OTI pedestrian-surface triangulation for source-metre low-flight.
 * All geometry is a 2022 planimetric QA overlay (NOT surveyed y elevations).
 * Inputs are fetched by verified source pipelines from PR #269 and #262.
 * Sidewalk data must agree across the independent pipelines; no fallback.
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

export async function build(){
  const {default:earcut,deviation}=await import('earcut');
  const source=JSON.parse(readFileSync('artifacts/nyc-true-scale/source.json','utf8'));
  const roadbed=JSON.parse(readFileSync('artifacts/nyc-roadbed-source/roadbed.json','utf8'));
  const pedestrian=JSON.parse(readFileSync(
    'artifacts/nyc-oti-pedestrian-source/pedestrian-surfaces.json','utf8'));
  const edges=JSON.parse(readFileSync(
    'artifacts/nyc-curb-sidewalk-source/edges.json','utf8'));
  const sidewalkDisplay=JSON.parse(readFileSync(
    'artifacts/nyc-curb-sidewalk-source/sidewalk-display.json','utf8'));
  const maskReport=JSON.parse(readFileSync(
    'artifacts/nyc-curb-sidewalk-source/sidewalk-occlusion-report.json','utf8'));
  if(pedestrian.schema!=='patrol-nyc-oti-plaza-sidewalk-2022-source-v1'||
     pedestrian.role!=='SOURCE_GEO_REFERENCE_ONLY_NOT_ENABLED_IN_GAME'||
     edges.schema!=='patrol-nyc-oti-sidewalk-curb-metre-source-v1'||
     edges.role!=='SOURCE_QA_ONLY_NOT_3D_CURB_HEIGHT_OR_GAME_TRAFFIC'||
     pedestrian.imageryYear!==2022||edges.sourceImageryYear!==2022||
     source.projection?.scaleMetresPerGameUnit!==null||
     roadbed.referenceImageryYear!==2022)
    throw Error('Official 2022 WGS84 source provenance mismatch; no synthetic fallback');
  const ref=JSON.stringify(source.projection);
  if([roadbed.projection,pedestrian.projection,edges.projection]
      .some(p=>JSON.stringify(p)!==ref))
    throw Error('Building, roadbed, pedestrian and curb CRS must be identical');
  if(pedestrian.plaza?.length<5||pedestrian.sidewalk?.length<40||
     edges.curbs?.length<150||edges.curbCuts?.length<150)
    throw Error('Insufficient true OTI pedestrian/curb source coverage');
  // Both upstream sources independently query the same Sidewalk_2022 layer.
  // Never silently draw inconsistent versions of the official FIDs.
  const ids=features=>features.map(f=>f.objectId).sort((a,b)=>a-b);
  if(JSON.stringify(ids(pedestrian.sidewalk))!==JSON.stringify(ids(edges.sidewalks)))
    throw Error('Inconsistent official sidewalk OBJECTIDs between two sources');
  if(sidewalkDisplay.schema!=='patrol-nyc-sidewalk-visual-mask-v1'||
     sidewalkDisplay.assetRole!=='VISUAL_ONLY_SOURCE_PRESERVING_DERIVATION'||
     JSON.stringify(sidewalkDisplay.projection)!==ref||
     sidewalkDisplay.counts?.sourceFeatures!==edges.sidewalks.length||
     sidewalkDisplay.counts?.displayFeatures<40||
     maskReport.schema!=='patrol-nyc-sidewalk-building-visual-mask-audit-v1'||
     maskReport.sourceGeometryMutated!==false||
     maskReport.displaySubtractsBuildingsOnly!==true||
     maskReport.areas?.displayUnionBuildingOverlapSquareMetres>1e-6||
     Math.abs(maskReport.areas?.sourceUnionBuildingOverlapSquareMetres-
       maskReport.areas?.maskedPartSumSquareMetres)>.001)
    throw Error('Missing, altered or building-penetrating visual-only sidewalk mask');
  const sourceSidewalkIds=ids(edges.sidewalks);
  const displaySidewalkIds=ids(sidewalkDisplay.sidewalks);
  if(displaySidewalkIds.some(id=>!sourceSidewalkIds.includes(id))||
     new Set(displaySidewalkIds).size!==displaySidewalkIds.length)
    throw Error('Display mask lost or duplicated municipal sidewalk source IDs');
  const positions=[],kinds=[],sourceIds=[],linePositions=[],lineKinds=[],lineIds=[];
  let invalid=0,ringCount=0,polygonCount=0;
  for(const [kind,records,y] of [
    ['sidewalk',sidewalkDisplay.sidewalks,0.10],
    ['plaza',pedestrian.plaza,0.12]
  ]){
    const seen=new Set();
    for(const feature of records){
      if(!Number.isSafeInteger(feature.objectId)||seen.has(feature.objectId))
        throw Error('Duplicate or invalid pedestrian OBJECTID');
      seen.add(feature.objectId);
      for(const rings of feature.polygons){
        if(!Array.isArray(rings)||!rings.length)throw Error('Missing source polygon rings');
        const flat=[],holes=[];let n=0;
        for(let i=0;i<rings.length;i++){
          const ring=rings[i];
          if(!Array.isArray(ring)||ring.length<4)
            throw Error('Official pedestrian source ring invalid');
          if(i)holes.push(n);
          for(const p of ring.slice(0,-1)){
            if(!Array.isArray(p)||p.length!==2||
               !p.every(v=>Number.isFinite(v)&&Math.abs(v)<10000))
              throw Error('Bad official pedestrian geometry coordinate');
            flat.push(p[0],p[1]);n++;
          }
          ringCount++;
        }
        const triangles=earcut(flat,holes,2);
        const error=deviation(flat,holes,2,triangles);
        if(triangles.length<3||triangles.length%3||
           !Number.isFinite(error)||error>0.0005)
          throw Error('Official pedestrian hole/area triangulation failed '+feature.objectId);
        for(let i=0;i<triangles.length;i+=3){
          const pts=triangles.slice(i,i+3).map(k=>[flat[2*k],flat[2*k+1]]);
          const area=Math.abs((pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-
            (pts[1][1]-pts[0][1])*(pts[2][0]-pts[0][0]))*.5;
          if(area<1e-7){invalid++;continue;}
          for(const [east,north] of pts)positions.push(east,y,north);
          kinds.push(kind);sourceIds.push(feature.objectId);
        }
        polygonCount++;
      }
    }
  }
  for(const [kind,features,y] of [
    ['curb',edges.curbs,0.16],
    ['curbCut',edges.curbCuts,0.18]
  ]){
    const seen=new Set();
    for(const feature of features){
      if(!Number.isSafeInteger(feature.objectId)||seen.has(feature.objectId))
        throw Error('Invalid or repeated official curb identifier');
      seen.add(feature.objectId);
      for(const line of feature.parts){
        for(let i=1;i<line.length;i++){
          const a=line[i-1],b=line[i];
          if(a.length!==2||b.length!==2||
             !a.concat(b).every(v=>Number.isFinite(v)&&Math.abs(v)<10000))
            throw Error('Invalid official curb segment');
          if(Math.hypot(a[0]-b[0],a[1]-b[1])<0.001)continue;
          linePositions.push(a[0],y,a[1],b[0],y,b[1]);
          lineKinds.push(kind);lineIds.push(feature.objectId);
        }
      }
    }
  }
  if(positions.length/9<7000||positions.length/9>50000||
     linePositions.length/6<2000||linePositions.length/6>25000)
    throw Error('Official pedestrian QA geometry coverage or budget violated');
  const payload={
    schema:'patrol-nyc-oti-pedestrian-metre-lowflight-v1',
    mode:'OFFICIAL_2022_PLANIMETRIC_NO_DEFAULT_GAME_EDIT',
    year:2022,projection:source.projection,
    sources:{plaza:pedestrian.sources.plaza,
      sidewalk:pedestrian.sources.sidewalk,
      curb:edges.sources.curb,curbCut:edges.sources.curbCut},
    warning:'Viewer-only flat y offsets; sidewalk polygons are a source-preserving VISUAL_ONLY building-footprint mask. NOT actual NYC 2026 elevations, curb ramps, crossing rights, routing or accessibility.',
    sourceSidewalkMask:{
      visualOnly:true,originalSourceIntact:maskReport.sourceGeometryMutated===false,
      maskedSquareMetres:maskReport.areas.maskedPartSumSquareMetres,
      postMaskBuildingOverlapSquareMetres:
        maskReport.areas.displayUnionBuildingOverlapSquareMetres,
      reportSchema:maskReport.schema
    },
    counts:{
      plazaFeatures:pedestrian.plaza.length,
      sidewalkFeatures:pedestrian.sidewalk.length,
      displaySidewalkFeatures:sidewalkDisplay.counts.displayFeatures,
      displaySidewalkPolygons:sidewalkDisplay.counts.displayPolygons,
      sidewalkSourceClippedAreaSquareMetres:
        maskReport.areas.sourceClippedPartSumSquareMetres,
      sidewalkDisplayAreaSquareMetres:
        maskReport.areas.displayPartSumSquareMetres,
      sidewalkVisualMaskedSquareMetres:
        maskReport.areas.maskedPartSumSquareMetres,
      sidewalkPostMaskBuildingOverlapSquareMetres:
        maskReport.areas.displayUnionBuildingOverlapSquareMetres,
      curbFeatures:edges.curbs.length,
      curbCutFeatures:edges.curbCuts.length,
      polygons:polygonCount,rings:ringCount,
      surfaceTriangles:positions.length/9,
      lineSegments:linePositions.length/6,
      discardedDegenerate:invalid
    },positions,kinds,sourceIds,linePositions,lineKinds,lineIds
  };
  mkdirSync('artifacts/nyc-true-scale',{recursive:true});
  writeFileSync('artifacts/nyc-true-scale/pedestrian-mesh.json',JSON.stringify(payload));
  console.log('[NYC OFFICIAL PEDESTRIAN LOWFLIGHT]',JSON.stringify(payload.counts));
  return payload.counts;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
  build().catch(e=>{console.error(e);process.exitCode=1;});
