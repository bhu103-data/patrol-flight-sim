// PATROL_NYC_GIS_INFILL_V12_PBR — true polygon materials using NYC public Building Footprints.
// Surface IDs: 6=masonry, 7=window glass, 8=roof. IDs are consumed by
// PATROL's existing WebGL2 shader and are not real-world material measurements.
// Exact source FIDs + lon/lat are in times-square-footprints.json.
// The calibrated X/Z scale is *not* 1:1 and cannot be presented as survey geometry.
// Meshes are deliberately restricted to the old procedural Times Square hole.
const EPS=1e-7,MIN_AREA=7.0,MAX_PIECES=110,MAX_WINDOW_TRIM_QUADS=240,
  MAX_SHOPFRONT_FACES=12;
const crossingZ=[-40,-19,-2,14,31,50];
function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function signed(poly){return poly.reduce((s,a,i)=>{const b=poly[(i+1)%poly.length];return s+a[0]*b[1]-a[1]*b[0]},0)*.5;}
function clip(poly,A,B,C){
  if(poly.length<3)return [];
  const out=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const fa=A*a[0]+B*a[1]-C,fb=A*b[0]+B*b[1]-C;
    if(fa>=-EPS)out.push(a);
    if((fa>=-EPS)!==(fb>=-EPS)){
      const d=fa-fb;
      if(Math.abs(d)>EPS){
        const t=fa/d;
        out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
      }
    }
  }
  const clean=[];
  for(const p of out){
    if(!clean.length||Math.hypot(p[0]-clean.at(-1)[0],p[1]-clean.at(-1)[1])>1e-5)clean.push(p);
  }
  if(clean.length>2&&Math.hypot(clean[0][0]-clean.at(-1)[0],
      clean[0][1]-clean.at(-1)[1])<1e-5)clean.pop();
  return clean;
}
function withoutBand(polygons,A,B,min,max){
  return polygons.flatMap(p=>[clip(p,A,B,max),clip(p,-A,-B,-min)])
    .filter(p=>p.length>=3&&Math.abs(signed(p))>=MIN_AREA);
}
function withoutRectangle(poly,x0,x1,z0,z1){
  // Ordered CSG complement: non-overlapping union of four exterior regions.
  let rest=poly;
  const result=[];
  for(const [a,b,c] of [[1,0,x0],[-1,0,-x1],[0,1,z0],[0,-1,-z1]]){
    const exterior=clip(rest,-a,-b,-c);
    if(exterior.length>=3&&Math.abs(signed(exterior))>=MIN_AREA)
      result.push(exterior);
    rest=clip(rest,a,b,c);
    if(rest.length<3)break;
  }
  return result;
}
function geoToGame(pair){
  const east=(pair[0]+73.9864883)*84300,north=(pair[1]-40.756421)*110900;
  return [23+.2611738439351339*east-.1844443206835113*north,
    -47.5+.1844443206835113*east+.2611738439351339*north];
}
function insideTriangle(p,a,b,c){
  const ab=cross(a,b,p),bc=cross(b,c,p),ca=cross(c,a,p);
  return ab<=EPS&&bc<=EPS&&ca<=EPS;
}
function roof(poly,y,color,addTri){
  // Ear clipping preserves real polygon concavities. This avoids a roof fan
  // spanning courtyard indentations or exterior space.
  const ids=poly.map((_,i)=>i);
  let emitted=0,safety=0;
  while(ids.length>3&&safety++<poly.length*poly.length){
    let done=false;
    for(let i=0;i<ids.length;i++){
      const a=poly[ids[(i+ids.length-1)%ids.length]],b=poly[ids[i]],
        c=poly[ids[(i+1)%ids.length]];
      if(cross(a,b,c)>=-1e-5)continue;
      if(ids.some(id=>{
        const p=poly[id];
        return p!==a&&p!==b&&p!==c&&insideTriangle(p,a,b,c);
      }))continue;
      addTri([a[0],y,a[1]],[b[0],y,b[1]],[c[0],y,c[1]],color);
      ids.splice(i,1);emitted++;done=true;break;
    }
    if(!done)break;
  }
  if(ids.length===3){
    const [a,b,c]=ids.map(i=>poly[i]);
    if(cross(a,b,c)<-EPS){
      addTri([a[0],y,a[1]],[b[0],y,b[1]],[c[0],y,c[1]],color);
      emitted++;
    }
  }
  return emitted;
}
export function buildTimesSquareGisInfill(asset,{addQuad,addTri,box,ground,bounds,protectedSites,skipFids=null}){
  if(!asset||!Array.isArray(asset.features)||!Array.isArray(bounds)||!Array.isArray(protectedSites))
    throw new TypeError('Invalid NYC GIS asset or scene configuration');
  if(skipFids!==null && !(skipFids instanceof Set))
    throw new TypeError('Diagnostic skipFids must be a Set');
  if(skipFids && [...skipFids].some(fid=>!Number.isSafeInteger(fid)))
    throw new TypeError('Diagnostic skipFids contains a non-integer source FID');
  const [west,east,south,north]=bounds;
  let buildings=0,pieces=0,roofTriangles=0,windows=0,storefrontQuads=0,windowTrimQuads=0,
    shopfrontFaces=0,shopfrontQuads=0;
  const sourceFids=new Set();
  let skippedDiagnosticFids=0;
  const exclusions=[
    ...protectedSites.map(s=>[s.x-s.w*.5-.32,s.x+s.w*.5+.32,
      s.z-s.d*.5-.32,s.z+s.d*.5+.32]),
    // The original One Times Square landmark and the TKTS viewing steps.
    [19.7,26.3,-51.6,-43.4],[-10.8,6.6,32.7,49.4]
  ];
  for(const rec of asset.features){
    if(pieces>=MAX_PIECES)break;
    if(skipFids?.has(rec.fid)){skippedDiagnosticFids++;continue;}
    if(!Number.isSafeInteger(rec.fid)||sourceFids.has(rec.fid)||
        !(rec.heightFt>0&&rec.heightFt<2500)||!Array.isArray(rec.rings?.[0])||
        rec.rings[0].length<4||rec.rings[0].length>64)continue;
    if(rec.rings.length>1)continue; // Never fill holes/courtyards blindly.
    let poly=rec.rings[0].slice(0,-1).map(geoToGame);
    if(poly.length<3||poly.some(p=>!p.every(Number.isFinite)))continue;
    poly=clip(clip(clip(clip(poly,1,0,west),-1,0,-east),0,1,south),0,-1,-north);
    if(Math.abs(signed(poly))<MIN_AREA)continue;
    let parts=[poly];
    for(const z of crossingZ){
      parts=withoutBand(parts,0,1,z-3.05,z+3.05);
      if(!parts.length)break;
    }
    if(!parts.length)continue;
    parts=withoutBand(parts,1,0,7.6,16.4);
    if(!parts.length)continue;
    // Broadway diagonal, deliberately reserved even through pedestrian plaza.
    const mid=20.15,half=4.60*Math.hypot(1,.43);
    parts=withoutBand(parts,1,.43,mid-half,mid+half);
    for(const [x0,x1,z0,z1] of exclusions){
      if(!parts.length)break;
      parts=parts.flatMap(p=>withoutRectangle(p,x0,x1,z0,z1));
    }
    if(!parts.length)continue;
    let used=false;
    const h=Math.max(3.3,Math.min(66,rec.heightFt*.3048*.32));
    const family=(Math.imul(rec.fid,2654435761)>>>0)%7;
    const families=[
      [.56,.55,.51],[.38,.46,.49],[.63,.58,.49],[.36,.39,.42],
      [.43,.36,.34],[.53,.50,.46],[.29,.42,.47]
    ];
    const base=families[family];
    const wall=base.map(c=>c*.92),roofCol=base.map(c=>Math.min(.94,c*1.15));
    for(const part of parts){
      if(pieces>=MAX_PIECES)break;
      if(part.length<3||part.length>48||Math.abs(signed(part))<MIN_AREA)continue;
      // Downward x-z winding creates upward +Y roofs and outward wall normals.
      const ring=signed(part)>0?part.slice().reverse():part;
      const top=ground+h;
      let addedGroundShop=false;
      for(let k=0;k<ring.length;k++){
        const a=ring[k],b=ring[(k+1)%ring.length];
        if(Math.hypot(a[0]-b[0],a[1]-b[1])<.15)continue;
        addQuad([a[0],ground,a[1]],[b[0],ground,b[1]],
          [b[0],top,b[1]],[a[0],top,a[1]],wall,6);
        // Narrow, recessed dark windows. Never exceed mobile detail budget.
        const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        const nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;
        // PATROL_NYC_TIMES_FID384606_SHOPFRONT_V1: the 5.98-unit polygon
        // at the 44th Street camera's right foreground had zero window quads:
        // the generic h<9 infill gate skipped it. Keep the municipal polygon,
        // intersection cuts, roofs and collision proxies intact. The west-
        // facing frontage alone gains shallow, batched doors and glazing.
        // Authored storefront layout, not surveyed shop-window locations.
        if(rec.fid===384606 && h>5.5 && nx<-.45 && len>=3.2){
          const bays=Math.max(2,Math.min(7,Math.floor(len/1.7)));
          const q=(t,y,depth)=>[a[0]+(b[0]-a[0])*t+nx*depth,
            y,a[1]+(b[1]-a[1])*t+nz*depth];
          const panel=(u,v,y0,y1,depth,color,tag=6)=>{
            addQuad(q(u,y0,depth),q(v,y0,depth),
              q(v,y1,depth),q(u,y1,depth),color,tag);
            storefrontQuads++;
          };
          const frame=[.30,.33,.35],recess=[.105,.14,.17],
            slate=[.54,.51,.47],clear=[.11,.26,.35],
            shaded=[.17,.27,.31];
          for(let bay=0;bay<bays;bay++){
            const t0=(bay+.085)/bays,t1=(bay+.915)/bays;
            const door=bay===Math.floor(bays*.5);
            panel(t0,t1,ground+.48,ground+2.78,.031,recess);
            panel(t0+.009/bays,t1-.009/bays,ground+.62,
              ground+2.52,.049,door?shaded:bay%3===0?clear:shaded,7);
            panel(t0,t1,ground+2.57,ground+2.67,.065,frame);
            panel(t0,t1,ground+.54,ground+.64,.065,frame);
            panel(t0,t0+.037/bays,ground+.54,ground+2.63,.067,frame);
            panel(t1-.037/bays,t1,ground+.54,ground+2.63,.067,frame);
            if(door){
              const middle=(t0+t1)*.5;
              panel(middle,middle+.018/bays,ground+.64,
                ground+2.52,.071,frame);
              panel(middle+.035/bays,middle+.085/bays,
                ground+1.33,ground+1.42,.079,slate);
            }else{
              panel(t0+.016/bays,t1-.016/bays,ground+1.91,
                ground+1.958,.070,frame);
            }
            // A restrained upper window band leaves the 6-unit roof intact.
            panel(t0,t1,ground+3.42,ground+5.13,.033,recess);
            panel(t0+.012/bays,t1-.012/bays,ground+3.56,
              ground+4.89,.054,bay%2===0?clear:shaded,7);
            panel(t0,t1,ground+4.86,ground+4.95,.069,frame);
            panel(t0,t1,ground+3.47,ground+3.56,.069,slate);
            if(bay%2===0)panel((t0+t1)*.5-.012/bays,
              (t0+t1)*.5+.012/bays,ground+3.56,
              ground+4.89,.071,frame);
          }
        }
        // A handful of low-rise municipal footprints otherwise had no
        // street-level glass at all: h<9 skipped the regular upper windows.
        // Add one authored shopfront per clipped piece, with a sensible
        // ground-accessible entry, narrow mullions and a transom. This is
        // NOT a claim about a surveyed store or its tenant identity.
        // Cap visible fronts and emit into the existing GIS mesh only.
        if(rec.fid!==384606 && h>=5.7 && len>=5.5 &&
            !addedGroundShop && shopfrontFaces<MAX_SHOPFRONT_FACES &&
            (Math.imul(rec.fid,2654435761)>>>0)%3!==1){
          const count=Math.min(4,Math.max(2,Math.floor(len/2.55)));
          const span=Math.min(len-.60,count*2.4);
          const u0=(1-span/len)*.5,u1=1-u0;
          const entry=(Math.imul(rec.fid,2246822519)>>>0)%count;
          const tone=(Math.imul(rec.fid,3266489917)>>>0)%3;
          const glassColors=[
            [.125,.205,.255],[.18,.245,.27],[.11,.17,.22]];
          const glass=glassColors[tone];
          const trim=wall.map(c=>Math.min(.82,c*.80+.055));
          const p=(u,y,d=.051)=>[a[0]+(b[0]-a[0])*u+nx*d,
            y,a[1]+(b[1]-a[1])*u+nz*d];
          const panel=(u,v,y0,y1,color,surface,d=.051)=>{
            addQuad(p(u,y0,d),p(v,y0,d),p(v,y1,d),p(u,y1,d),
              color,surface);
            shopfrontQuads++;
          };
          for(let bay=0;bay<count;bay++){
            const left=u0+(u1-u0)*(bay+.055)/count;
            const right=u0+(u1-u0)*(bay+.945)/count;
            const isDoor=bay===entry;
            // Window kick plate is solid; the entry begins near pavement.
            panel(left,right,ground+(isDoor?.12:.33),ground+1.69,
              glass,7);
            panel(left,right,ground+1.80,ground+2.04,
              glass.map(c=>c*1.16),7);
            panel(left,right,ground+1.70,ground+1.79,trim,6,.070);
            const edge=.035/len;
            panel(left-edge,left,ground+.12,ground+2.08,trim,6,.074);
            panel(right,right+edge,ground+.12,ground+2.08,trim,6,.074);
            if(isDoor){
              const mid=(left+right)*.5;
              panel(mid,mid+.018/len,ground+.12,ground+1.69,
                trim,6,.077);
              panel(mid+.06/len,mid+.12/len,ground+.85,
                ground+.95,trim,6,.079);
            }else{
              panel(left,right,ground+.28,ground+.36,trim,6,.074);
            }
          }
          panel(u0,u1,ground+2.09,ground+2.20,trim,6,.076);
          shopfrontFaces++;
          addedGroundShop=true;
        }
        if(len<3.2||h<9||windows>=2200)continue;
        const bays=Math.min(8,Math.floor(len/1.75)),
          floors=Math.min(12,Math.floor((h-2.2)/2.35));
        for(let row=0;row<floors;row++)for(let bay=0;bay<bays;bay++){
          if(windows>=2200)break;
          // Footprint/edge-specific window widths prevent adjacent GIS
          // facades from sharing one stamped grid. Widths stay aligned
          // vertically within each bay, while glass occupancy differs by
          // storey. This only affects the existing Times Square infill.
          const style=(Math.imul(rec.fid^(k+1)*131,2246822519)>>>0)+bay*17;
          const inset=.195+(style%4)*.023;
          const v0=(bay+inset)/bays,v1=(bay+1-inset)/bays;
          const q=(t,y,depth=.045)=>[a[0]+(b[0]-a[0])*t+nx*depth,y,
            a[1]+(b[1]-a[1])*t+nz*depth];
          const lower=ground+2.4+row*2.35;
          const upper=lower+.88+(family%3)*.052;
          if(upper>top-.5)continue;
          const shade=(Math.imul(rec.fid+row*31+bay*17+k*53,
            2654435761)>>>0)%13;
          const tint=shade<2?[.40,.48,.52]:shade<5?[.17,.26,.30]:
            shade<8?[.12,.20,.25]:[.145,.22,.265];
          addQuad(q(v0,lower),q(v1,lower),q(v1,upper),q(v0,upper),tint,7);
          windows++;
          // A small set of near-pedestrian facades gains masonry jambs,
          // sills and lintels in the same mesh (no new GPU buffers).
          // All trim projects <=.067 game units outside the GIS wall.
          if(row<2 && len>=4.8 && (rec.fid+k)%4===0 &&
              windowTrimQuads<=MAX_WINDOW_TRIM_QUADS-4){
            const bar=.055/len,trim=wall.map(c=>Math.min(.86,c*1.12));
            const quad=(t0,t1,y0,y1)=>{
              addQuad(q(t0,y0,.067),q(t1,y0,.067),
                q(t1,y1,.067),q(t0,y1,.067),trim,6);
              windowTrimQuads++;
            };
            quad(v0-bar,v0,lower-.065,upper+.055);
            quad(v1,v1+bar,lower-.065,upper+.055);
            quad(v0-bar,v1+bar,lower-.07,lower+.012);
            quad(v0-bar,v1+bar,upper-.012,upper+.065);
          }
        }
      }
      // Finish transition: one slim horizontal cornice near the crown and
      // alternating corner piers, attached to real extruded polygon edges.
      // Keep decorations within existing FID polygon and face budgets.
      if(h>12 && pieces<90){
        const corniceY=top-.52;
        for(let side=0;side<ring.length;side++){
          const a=ring[side],b=ring[(side+1)%ring.length];
          const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
          if(length<2.5)continue;
          const dx=-(b[1]-a[1])/length*.034,
                dz=(b[0]-a[0])/length*.034;
          addQuad([a[0]+dx,corniceY,a[1]+dz],
            [b[0]+dx,corniceY,b[1]+dz],
            [b[0]+dx,corniceY+.09,b[1]+dz],
            [a[0]+dx,corniceY+.09,a[1]+dz],
            roofCol,6);
        }
      }
      const tris=roof(ring,top,roofCol,(a,b,c,color)=>addTri(a,b,c,color,8));
      if(tris===0)continue;
      roofTriangles+=tris;
      pieces++;used=true;
      if(pieces<66&&pieces%3===0){
        const cx=ring.reduce((n,p)=>n+p[0],0)/ring.length,
          cz=ring.reduce((n,p)=>n+p[1],0)/ring.length;
        box(cx,top+.27,cz,.32,.54,.33,[.35,.38,.40]);
      }
    }
    if(used){buildings++;sourceFids.add(rec.fid);}
  }
  return {inputRecords:asset.features.length,sourceBuildings:buildings,
    infillPieces:pieces,roofTriangles,windowQuads:windows,storefrontQuads,
    windowTrimQuads,maximumWindowTrimQuads:MAX_WINDOW_TRIM_QUADS,
    shopfrontFaces,shopfrontQuads,maximumShopfrontFaces:MAX_SHOPFRONT_FACES,
    maximumPieces:MAX_PIECES,visualOnly:true,materialSurfaceIds:[6,7,8],
    sourceFids:[...sourceFids],skippedDiagnosticFids};
}
