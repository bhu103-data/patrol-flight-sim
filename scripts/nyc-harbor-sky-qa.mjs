// A default daylight harbor-side facade camera must see open sky above
// Manhattan, not an almost screen-filling nearby wall. Pure pixel analysis:
// no browser, GPU, geometry or production game code dependency.
export const MIN_HARBOR_SKY_FRACTION = 0.10;
export function visibleHarborSkyFraction(image, step=10) {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
      image.width<=0 || image.height<=0 || !image.data ||
      image.data.length<image.width*image.height*4 || !Number.isInteger(step) || step<1)
    throw Error('Invalid RGBA image for NYC harbor sky check');
  let sky=0, samples=0;
  for(let y=0;y<Math.floor(image.height*.48);y+=step){
    for(let x=0;x<image.width;x+=step){
      const k=(y*image.width+x)*4;
      if(image.data[k+3]<200)continue;
      const r=image.data[k],g=image.data[k+1],b=image.data[k+2];
      // The current default NYC daylight renderer has blue-cyan atmosphere.
      // Dark blue glazing, granite and shadowed wall colors fail the
      // brightness / green channel checks. This is a framing guard, not a
      // photorealism metric or a general-purpose sky classifier.
      if(r>80 && g>105 && b>130 && b>r*1.05 && g>r*1.05 && b>g*.94)sky++;
      samples++;
    }
  }
  return sky/Math.max(1,samples);
}
