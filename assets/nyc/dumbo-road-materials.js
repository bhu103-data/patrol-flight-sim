// NYC-only material-space pass for the DUMBO close-up sample.
// Source pixels are the already-bundled Poly Haven CC0 asphalt_04 and
// concrete_floor_damaged_01 images (see THIRD_PARTY_NOTICES.md).
// No road mesh, GIS coordinates, third-party geometry or shader changes.
const clampByte=value=>Math.max(0,Math.min(255,Math.round(value)));
const smooth=(a,b,x)=>{
  const t=Math.max(0,Math.min(1,(x-a)/(b-a)));
  return t*t*(3-2*t);
};
const windowed=(x,a,b,feather)=>
  smooth(a-feather,a,x)*(1-smooth(b,b+feather,x));
function grain(x,y,seed=0){
  let n=Math.imul(x+seed*31,374761393)^Math.imul(y-seed*13,668265263);
  n=Math.imul(n^(n>>>13),1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}

export function enhanceNycDumboRoadCanvases(canvases){
  // These offsets match the existing nyc-realism.js seven-image PBR layout:
  // asphalt diffuse, sidewalk concrete, three walls, asphalt normal, ARM.
  const road=canvases[0],concrete=canvases[1],
    normal=canvases[5],arm=canvases[6];
  if(![road,concrete,normal,arm].every(c=>c&&c.width===512&&c.height===512))
    throw Error('NYC road material atlas must be 512 square');
  const contexts=[road,concrete,normal,arm].map(c=>
    c.getContext('2d',{willReadFrequently:true}));
  if(contexts.some(c=>!c))throw Error('NYC road material 2D context unavailable');
  const [roadCtx,concreteCtx,normalCtx,armCtx]=contexts;
  const roadPixels=roadCtx.getImageData(0,0,512,512),
    walkPixels=concreteCtx.getImageData(0,0,512,512),
    normalPixels=normalCtx.getImageData(0,0,512,512),
    armPixels=armCtx.getImageData(0,0,512,512);
  const rd=roadPixels.data,walk=walkPixels.data,
    nr=normalPixels.data,ar=armPixels.data;
  for(let y=0;y<512;y++){
    const v=(y+.5)/512;
    for(let x=0;x<512;x++){
      const u=(x+.5)/512,index=(y*512+x)*4;
      // Fade the edits to zero at atlas borders so REPEAT wrapping stays
      // seamless. The original photo micrograin remains at every edge.
      const edge=smooth(.025,.095,Math.min(u,1-u,v,1-v));
      const irregular=.010*Math.sin(u*20.0)+.003*Math.sin(u*79.0);
      const cutY=.438+irregular;
      const cutX=.588+.010*Math.sin(v*22.0)+.004*Math.sin(v*67.0);
      const distH=Math.abs(v-cutY),distV=Math.abs(u-cutX);
      const h=windowed(u,.13,.88,.018)*(1-smooth(.003,.009,distH));
      const vertical=windowed(v,.18,.81,.022)*(1-smooth(.0025,.008,distV));
      // Isolated hairline cracks, not an artificial full-frame tile grid.
      const crack=windowed(u,.21,.53,.025)*
        windowed(v,.61,.83,.025)*
        (1-smooth(.0015,.006,Math.abs(v-(.59+.31*(u-.21)+.006*Math.sin(u*57.0)))));
      const seam=Math.max(h,vertical*.80,crack*.48)*edge;
      const borderA=Math.sin(v*41.0)*.004+Math.sin(u*53.0)*.004;
      const patchA=windowed(u,.19,.48,.018)*
        windowed(v,.20+borderA,.41+borderA,.022)*edge;
      const patchB=windowed(u,.64,.84,.019)*
        windowed(v,.53+borderA,.78+borderA,.020)*edge;
      const aggregate=(grain(x,y,3)-.5)*edge;
      // Source albedo survives: this is localized repair aggregate, faded
      // cold patches and bitumen-filled saw cuts, not flat procedural paint.
      const shade=1-patchA*.125+patchB*.083-seam*.37+aggregate*.038;
      for(let channel=0;channel<3;channel++)
        rd[index+channel]=clampByte(rd[index+channel]*shade);
      // G is roughness in the bundled Poly Haven ARM map. Keep A/O and
      // metallic channels untouched; dark repaired seams are smoother than
      // surrounding aged aggregate. Deterministic per-pixel alignment with
      // the diffuse and normal maps avoids sliding physical highlights.
      ar[index+1]=clampByte(Math.max(90,Math.min(245,
        ar[index+1]+patchA*27-patchB*29-seam*38+aggregate*11)));
      const rimH=windowed(u,.13,.88,.018)*edge*
        (smooth(.003,.008,distH)-smooth(.009,.017,distH));
      const rimV=windowed(v,.18,.81,.022)*edge*
        (smooth(.0025,.007,distV)-smooth(.008,.016,distV));
      nr[index]=clampByte(nr[index]+Math.sign(v-cutY)*rimH*11);
      nr[index+1]=clampByte(nr[index+1]+Math.sign(u-cutX)*rimV*11);
      // Concrete sidewalk uses its own CC0 photograph. The renderer already
      // owns geospatial slab joints; here only fine saw cuts, repairs and
      // warm/cool panel variation are baked, without new geometry.
      const walkJoint=windowed(u,.12,.89,.028)*
        (1-smooth(.002,.006,Math.abs(v-(.52+.004*Math.sin(u*37)))));
      const walkPatch=windowed(u,.17,.53,.028)*
        windowed(v,.15,.48,.025);
      const walkWear=windowed(u,.59,.85,.022)*
        windowed(v,.56,.82,.024);
      const walkTone=1+edge*(walkPatch*.047-walkWear*.061-
        walkJoint*.21+(grain(x,y,7)-.5)*.014);
      for(let channel=0;channel<3;channel++)
        walk[index+channel]=clampByte(walk[index+channel]*walkTone);
    }
  }
  roadCtx.putImageData(roadPixels,0,0);
  concreteCtx.putImageData(walkPixels,0,0);
  normalCtx.putImageData(normalPixels,0,0);
  armCtx.putImageData(armPixels,0,0);
}
