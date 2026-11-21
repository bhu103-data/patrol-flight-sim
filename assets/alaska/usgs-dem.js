/**
 * Strict decoder for the baked USGS 3DEP Alaska digital elevation model.
 * Data is derived from the public-domain USGS 3DEP dynamic image service.
 *
 * This is a georeferenced digital terrain slice, resampled to a compact
 * 256×256 game asset. It is NOT a 5-m native-resolution texture nor a
 * physically 1:1 model of the entire Alaska coastline.
 */
export function decodeAlaskaDEM(payload) {
  if(!payload || payload.format!=='usgs-3dep-u16le-v1')
    throw new Error('Unsupported Alaska DEM format');
  const {width,height,heightsBase64,bbox}=payload;
  if(!Number.isInteger(width)||!Number.isInteger(height)||
     width<64||width>512||height<64||height>512||
     !Array.isArray(bbox)||bbox.length!==4||
     !bbox.every(Number.isFinite)||bbox[0]>=bbox[2]||bbox[1]>=bbox[3]||
     typeof heightsBase64!=='string')throw new Error('Invalid Alaska DEM metadata');
  const packed=atob(heightsBase64);
  const count=width*height;
  if(packed.length!==2*count)throw new Error('Alaska DEM byte count mismatch');
  const heights=new Uint16Array(count);
  let max=0,above=0;
  for(let i=0;i<count;i++){
    const h=packed.charCodeAt(i*2)|(packed.charCodeAt(i*2+1)<<8);
    if(h>8000)throw new Error('Alaska DEM contains invalid elevation');
    heights[i]=h;
    if(h>max)max=h;
    if(h>3)above++;
  }
  if(max<250||above/count<.20)
    throw new Error('Alaska DEM lacks usable mountain elevations');
  return {width,height,heights,bbox,source:payload.source};
}
export async function loadAlaskaDEM(url='./assets/alaska/tracy-arm-3dep.json',fetchFn=fetch,signal) {
  const response=await fetchFn(url,{signal,cache:'force-cache'});
  if(!response.ok)throw new Error('Alaska DEM HTTP '+response.status);
  return decodeAlaskaDEM(await response.json());
}
