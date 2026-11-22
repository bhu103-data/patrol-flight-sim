// Source-FID keyed ART-DIRECTION material slot registry for 1:1 NYC pilot.
// Does not claim sampled NYC facades or supply third-party images. A FID is
// ONLY a geometry identity, not evidence of a specific surface finish.
export const MATERIAL_SCHEMA='patrol-nyc-fid-material-slots-v1';
const PERMITTED=Object.freeze({
  'brick-proxy':3,
  'glass-proxy':4,
  'stone-proxy':5
});
const validKey=k=>Object.prototype.hasOwnProperty.call(PERMITTED,k);
export function validateNycMaterialCatalog(catalog){
  if(!catalog||catalog.schema!==MATERIAL_SCHEMA||
    catalog.fidelity!=='visual-proxy-only-not-as-built'||
    !catalog.materials||!catalog.fallback||!catalog.fidOverrides)
    throw Error('Invalid NYC material provenance schema');
  const m=catalog.materials;
  if(Object.keys(m).length!==3||Object.keys(m).some(k=>!validKey(k)))
    throw Error('Material slots must match reviewed procedural shader IDs');
  for(const [name,id] of Object.entries(PERMITTED)){
    const v=m[name];
    if(!v||v.shaderId!==id||v.source!=='original-procedural'||
      v.license!=='project-authored'||v.externalTextures!==null||
      !Array.isArray(v.tileMeters)||v.tileMeters.length!==2||
      !v.tileMeters.every(t=>Number.isFinite(t)&&t>0))
      throw Error('Unverified external image or invalid NYC material slot: '+name);
  }
  if(!Number.isFinite(catalog.fallback.thresholdMeters)||
    catalog.fallback.thresholdMeters<1||
    !validKey(catalog.fallback.below90m)||
    !validKey(catalog.fallback.atOrAbove90m))
    throw Error('Invalid FID material fallback');
  for(const [fid,entry] of Object.entries(catalog.fidOverrides)){
    if(!/^[1-9]\d*$/.test(fid)||!Number.isSafeInteger(Number(fid))||
      !entry||!validKey(entry.wall)||
      entry.materialEvidence!=='not-surveyed-art-direction'||
      entry.licenseEvidence!==null)
      throw Error('NYC material FID not approved for art-only preview: '+fid);
  }
  return true;
}
export function materialForNycFID(fid,roofHeightMeters,catalog){
  if(!Number.isSafeInteger(fid)||fid<1||
    !Number.isFinite(roofHeightMeters)||roofHeightMeters<=0)
    throw Error('Expected valid NYC source FID and uncompressed roof metres');
  const explicit=catalog.fidOverrides[String(fid)];
  const name=explicit?.wall||(roofHeightMeters>=catalog.fallback.thresholdMeters?
    catalog.fallback.atOrAbove90m:catalog.fallback.below90m);
  return {
    fid,name,shaderId:PERMITTED[name],
    evidence:'artist-proxy-not-surveyed',
    source:catalog.materials[name].source,
    externalTextures:false
  };
}
