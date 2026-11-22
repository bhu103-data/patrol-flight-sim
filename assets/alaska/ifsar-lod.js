/**
 * Browser-budget LOD for the verified USGS 5m source-native IfSAR DTM.
 *
 * The 5m source grid remains authoritative and is never overwritten. This
 * helper builds a 3x3 median LOD mesh (nominal 15m spacing) for a full-scene
 * overview. It preserves source bbox/cell-centre alignment and majority
 * water/land character better than a simple every-third-pixel decimation.
 */
export function decimateIfsarRaster(native,stride=3){
  if(!native||native.format!=='patrol-usgs-ifsar-5m-source-native-v1'||
     native.crs!=='EPSG:4326'||
     native.axis!=='x=east, z=north, south-first raster rows'||
     !Number.isInteger(stride)||stride!==3||
     !Number.isInteger(native.width)||!Number.isInteger(native.height)||
     native.width%stride!==0||native.height%stride!==0||
     !Array.isArray(native.bbox)||native.bbox.length!==4||
     !native.bbox.every(Number.isFinite)||
     !native.heights||native.heights.length!==native.width*native.height||
     !Array.isArray(native.sampleSpacingApproxMeters)||
     native.sampleSpacingApproxMeters.length!==2||
     !native.sampleSpacingApproxMeters.every(x=>x>4.8&&x<5.2))
    throw Error('Unverified native IfSAR raster for 15m LOD');
  const width=native.width/stride,height=native.height/stride;
  const heights=new Float32Array(width*height),samples=new Float32Array(9);
  for(let row=0;row<height;row++)for(let col=0;col<width;col++){
    let k=0;
    for(let dy=0;dy<stride;dy++)for(let dx=0;dx<stride;dx++){
      const value=native.heights[(row*stride+dy)*native.width+col*stride+dx];
      if(!Number.isFinite(value)||value< -250||value>3000)
        throw Error('Invalid native IfSAR height in LOD block');
      samples[k++]=value;
    }
    samples.sort();
    heights[row*width+col]=samples[4];
  }
  return {
    ...native,width,height,heights,
    sourceCellCount:native.width*native.height,
    meshCellCount:width*height,
    meshLodStride:stride,
    sourceResolutionMeters:[...native.sampleSpacingApproxMeters],
    sampleSpacingApproxMeters:native.sampleSpacingApproxMeters.map(x=>x*stride),
    meshLodMethod:'3x3 median, source-native 5m cells',
    sourceHeightRangeMeters:[...native.sourceElevationRangeMeters]
  };
}
