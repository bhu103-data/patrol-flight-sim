// U.S. Census TIGER/Line georeferenced, public-domain Strip road centerline.
// This record deliberately does not encode lanes, width or traffic signals.
const SOURCE_SHA='dba759001381d6c502160dc6f8b1987bef4e89544ac475943820cd870f07fbf9';
export function decodeVegasTIGERCenterline(payload) {
  if(payload?.schema!=='patrol-vegas-census-tiger-strip-v1'||
     payload.source?.agency!=='U.S. Census Bureau'||
     payload.source?.crs!=='EPSG:4326'||
     payload.source?.archiveSHA256!==SOURCE_SHA)
    throw new Error('Unverified Census Strip road data');
  const samples=payload.samplesWgs84,game=payload.gameReference;
  if(!Array.isArray(samples)||samples.length!==25||
     !samples.every((p,i)=>Array.isArray(p)&&p.length===2&&
       Number.isFinite(p[0])&&Number.isFinite(p[1])&&
       p[0]>-115.181&&p[0]<-115.167&&
       p[1]>=36.10729&&p[1]<=36.11511&&
       (i===0||p[1]>samples[i-1][1]))||
     game?.startZ!==-210||game?.endZ!==-122||
     game?.baseCenterX!==-35||
     game?.roadWidthGameUnits!==null||
     game?.trafficDirections!=='not encoded in TIGER centreline'||
     !Array.isArray(game?.sampledLateralOffsets)||
     game.sampledLateralOffsets.length!==samples.length)
    throw new Error('Invalid or out-of-scope Census Strip centerline');
  const offsets=game.sampledLateralOffsets;
  const first=samples[0][0],last=samples.at(-1)[0];
  if(!offsets.every((v,i)=>{
    if(!Number.isFinite(v)||Math.abs(v)>0.35)return false;
    const trend=first+(last-first)*i/(samples.length-1);
    return Math.abs(v-(samples[i][0]-trend)*3600)<.0003;
  }))throw new Error('Unreconciled Census road curvature or unsafe offset');
  return {source:payload.source,reference:game,
    points:samples.map((p,i)=>[p[0],p[1],offsets[i]])};
}
export function vegasMeasuredRoadX(centerline,z){
  if(!centerline||!Number.isFinite(z))return -35;
  const {startZ,endZ,baseCenterX}=centerline.reference;
  if(z<startZ||z>endZ)return baseCenterX;
  const pos=(z-startZ)/(endZ-startZ)*(centerline.points.length-1);
  const i=Math.min(centerline.points.length-2,Math.max(0,Math.floor(pos)));
  const t=pos-i;
  return baseCenterX+centerline.points[i][2]*(1-t)+centerline.points[i+1][2]*t;
}
export async function loadVegasTIGERCenterline(
  url='./assets/vegas/strip-centerline-tiger-2026.json',fetchFn=fetch,signal) {
  const response=await fetchFn(url,{cache:'force-cache',signal});
  if(!response.ok)throw new Error('Census TIGER file HTTP '+response.status);
  return decodeVegasTIGERCenterline(await response.json());
}
