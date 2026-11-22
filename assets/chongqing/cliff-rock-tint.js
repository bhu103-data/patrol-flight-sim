// Narrow Hongyadong market-cliff vertex tint. This does not alter the terrain
// heightfield, mesh topology, collision volumes or existing hillside PBR atlas.
// A smooth edge avoids a rectangular rock-colored patch in surrounding grass.
const smooth=(v,a,b)=>{
  const t=Math.max(0,Math.min(1,(v-a)/(b-a)));
  return t*t*(3-2*t);
};
export function marketCliffRockTint(x,z,slope,height){
  if(![x,z,slope,height].every(Number.isFinite))
    return {weight:0,r:0,g:0,b:0};
  // Actual narrow slope to the left of x=284,z=345 market inspector.
  const horizontal=smooth(x,195,225)*(1-smooth(x,270,294));
  const longitudinal=smooth(z,275,310)*(1-smooth(z,413,444));
  const steep=smooth(Math.abs(slope),.36,.90);
  const weight=.72*horizontal*longitudinal*steep;
  if(weight<=0)return {weight:0,r:0,g:0,b:0};
  // Subdued, broken shale bands retain the same game's existing rocky atlas;
  // no grid-aligned stripes, external downloads, shader or extra draw call.
  const lamina=Math.sin(height*.24+x*.037-z*.019+.75*Math.sin(z*.06));
  const fine=Math.sin(x*.103+z*.041);
  const tone=.57+.085*lamina+.009*fine;
  return {weight,r:tone*.96,g:tone*.99,b:tone*.96};
}
