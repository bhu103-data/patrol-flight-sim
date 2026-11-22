// The playable hotpot shop sits on Chongqing's strongly graded hillside.
// Smooth only its REAL 72x50 game-unit footprint and adjacent entry apron.
// Public terrain remains unchanged outside this compact smoothstep envelope.
// This is a game-scale grading treatment, not a surveyed civil-earthwork plan.
export const HOTPOT_TERRACE={
  centerX:285,centerZ:225,
  innerHalfWidth:44,outerHalfWidth:109,
  innerHalfDepth:34,outerHalfDepth:112,
  anchorX:285,anchorZ:253
};
function smoothRamp(distance,inner,outer){
  const t=Math.max(0,Math.min(1,(distance-inner)/(outer-inner)));
  return t*t*(3-2*t);
}
export function hotpotTerraceWeight(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return 0;
  const site=HOTPOT_TERRACE;
  const wx=1-smoothRamp(Math.abs(x-site.centerX),
    site.innerHalfWidth,site.outerHalfWidth);
  const wz=1-smoothRamp(Math.abs(z-site.centerZ),
    site.innerHalfDepth,site.outerHalfDepth);
  return wx*wz;
}
export function gradeChongqingHotpotTerrain(rawHeight,anchorHeight,x,z){
  if(![rawHeight,anchorHeight,x,z].every(Number.isFinite))
    throw new RangeError('Hotpot terrain values must be finite');
  const weight=hotpotTerraceWeight(x,z);
  if(weight===0)return rawHeight;
  return rawHeight+(anchorHeight-rawHeight)*weight;
}
