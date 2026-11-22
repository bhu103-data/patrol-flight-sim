/** Off-line-generated NYC official CSCL physical centerline mesh.
 * These lines are deliberately NOT asphalt, curb, bike lane, crosswalk or
 * surveyed road edge polygons. They share the building WGS84 -> ENU origin.
 */
import {wgs84ToLocalMetres} from './nyc-metric-footprints.mjs';

const NUM=p=>Array.isArray(p)&&p.length>=2&&
  Number.isFinite(p[0])&&Number.isFinite(p[1])&&
  Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const COLOR=[.93,.64,.21], NORMAL=[0,1,0];
function emit(vertices,a,b){
  for(const [x,z] of [a,b]){
    vertices.push(x,.65,z,...NORMAL,...COLOR);
  }
}
export function buildMetricCenterlines(asset){
  if(asset?.sourceDataset!=='NYC Street Centerline (CSCL) / inkn-q76z'||
      !Array.isArray(asset.segments))
    throw TypeError('NYC CSCL official snapshot and source ID required');
  const verts=[],fids=new Set(),names=new Set(),rejected=[];
  let edges=0,parts=0,roadLengthMetres=0,records=0;
  for(const rec of asset.segments){
    const id=String(rec?.physicalid??'');
    if(!/^\d+$/.test(id)||fids.has(id)){
      rejected.push({id,reason:'invalid/duplicate physicalid'});continue;
    }
    fids.add(id);
    if(!Array.isArray(rec.parts)||!rec.parts.length){
      rejected.push({id,reason:'no valid source geometry'});continue;
    }
    let used=false;
    for(const part of rec.parts){
      if(!Array.isArray(part)||part.length<2||part.length>256||
         !part.every(NUM)){
        rejected.push({id,reason:'invalid polyline part'});continue;
      }
      const xy=part.map(p=>wgs84ToLocalMetres(p));
      let emitted=0;
      for(let i=1;i<xy.length;i++){
        const a=xy[i-1],b=xy[i],dist=Math.hypot(a[0]-b[0],a[1]-b[1]);
        if(dist<.03)continue;
        if(!Number.isFinite(dist)||dist>1500){
          rejected.push({id,reason:'implausible source segment'});continue;
        }
        emit(verts,a,b);edges++;roadLengthMetres+=dist;emitted++;
      }
      if(emitted){used=true;parts++;}
    }
    if(used){
      records++;
      if(rec.name)names.add(rec.name);
    }
  }
  if(records<1||verts.some(x=>!Number.isFinite(x)))
    throw Error('No valid finite NYC CSCL road centerline data');
  return {
    vertexBuffer:new Float32Array(verts),
    stats:{
      source:'NYC CSCL inkn-q76z, centerlines only',
      records,edges,parts,uniqueStreetNames:names.size,
      totalLengthMetres:Math.round(roadLengthMetres*100)/100,
      boundsWGS84:asset.boundsWGS84,
      fetchedUtc:asset.fetchedUtc,
      queryUrl:asset.queryUrl,
      noRoadEdgesOrPavement:true
    },
    rejected
  };
}
