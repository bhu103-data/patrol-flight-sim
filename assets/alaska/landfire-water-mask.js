/**
 * Opt-in, source-backed water classifier for the Tracy Arm terrain QA build.
 * USGS LANDFIRE LF2025 Existing Vegetation Cover (Alaska) water category 11,
 * U.S. government public domain. This is a coarse classification, not NOAA
 * shoreline geometry, bathymetry or permission to change floatplane physics.
 */
export function decodeLandfireWaterMask(payload) {
  if (!payload || payload.format !== 'patrol-landfire-water-rle-v1' ||
      payload.crs !== 'EPSG:4326' || payload.width !== 256 ||
      payload.height !== 256 || payload.waterCode !== 11 ||
      payload.firstRunValue !== 0 || !Array.isArray(payload.bbox) ||
      payload.bbox.length !== 4 || payload.bbox.some(v => !Number.isFinite(v)) ||
      typeof payload.rleBase64 !== 'string' ||
      payload.rleBase64.length > 8192)
    throw new Error('Unsupported or invalid Alaska water-class mask');
  const packed = atob(payload.rleBase64);
  const count = payload.width * payload.height;
  const cells = new Uint8Array(count);
  let pos = 0, offset = 0, bit = 0, waterCells = 0, runs = 0;
  while (pos < packed.length) {
    let run = 0, shift = 0, byte = 0;
    do {
      if (pos >= packed.length || shift > 21)
        throw new Error('Truncated or oversized Alaska water-class run');
      byte = packed.charCodeAt(pos++);
      run += (byte & 127) * 2 ** shift;
      shift += 7;
    } while (byte & 128);
    if (run < 1 || run > count - offset)
      throw new Error('Invalid Alaska water-class run length');
    if (bit) {
      cells.fill(1, offset, offset + run);
      waterCells += run;
    }
    offset += run;
    bit ^= 1;
    runs++;
  }
  if (offset !== count || waterCells !== payload.waterCount ||
      runs > count || waterCells < 1)
    throw new Error('Alaska water-class data count mismatch');
  return {width:payload.width,height:payload.height,cells,
    bbox:payload.bbox,source:payload.source,license:payload.license,
    waterCount:waterCells};
}

export async function loadLandfireWaterMask(
  url = './assets/alaska/landfire-evc-water-preview.json',
  fetchFn = fetch, signal
) {
  const response = await fetchFn(url, {signal,cache:'force-cache'});
  if (!response.ok) throw new Error('Alaska water-class HTTP ' + response.status);
  return decodeLandfireWaterMask(await response.json());
}
