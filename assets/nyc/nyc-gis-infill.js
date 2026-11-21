// PATROL_NYC_GIS_INFILL_V12_PBR — true polygon materials using NYC public Building Footprints.
// Surface IDs: 6=masonry, 7=window glass, 8=roof. IDs are consumed by
// PATROL's existing WebGL2 shader and are not real-world material measurements.
// Exact source FIDs + lon/lat are in times-square-footprints.json.
// The calibrated X/Z scale is *not* 1:1 and cannot be presented as survey geometry.
// Meshes are deliberately restricted to the old procedural Times Square hole.
const EPS=1e-7,MIN_AREA=7.0,MAX_PIECES=110;
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
export function buildTimesSquareGisInfill(asset,{addQuad,addTri,box,ground,bounds,protectedSites}){
  if(!asset||!Array.isArray(asset.features)||!Array.isArray(bounds)||!Array.isArray(protectedSites))
    throw new TypeError('Invalid NYC GIS asset or scene configuration');
  const [west,east,south,north]=bounds;
  let buildings=0,pieces=0,roofTriangles=0,windows=0;
  const sourceFids=new Set();
  const exclusions=[
    ...protectedSites.map(s=>[s.x-s.w*.5-.32,s.x+s.w*.5+.32,
      s.z-s.d*.5-.32,s.z+s.d*.5+.32]),
    // The original One Times Square landmark and the TKTS viewing steps.
    [19.7,26.3,-51.6,-43.4],[-10.8,6.6,32.7,49.4]
  ];
  for(const rec of asset.features){
    if(pieces>=MAX_PIECES)break;
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
      for(let k=0;k<ring.length;k++){
        const a=ring[k],b=ring[(k+1)%ring.length];
        if(Math.hypot(a[0]-b[0],a[1]-b[1])<.15)continue;
        addQuad([a[0],ground,a[1]],[b[0],ground,b[1]],
          [b[0],top,b[1]],[a[0],top,a[1]],wall,6);
        // Narrow, recessed dark windows. Never exceed mobile detail budget.
        const len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(len<3.2||h<9||windows>=2200)continue;
        const bays=Math.min(8,Math.floor(len/1.75)),
          floors=Math.min(12,Math.floor((h-2.2)/2.35));
        const nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;
        for(let row=0;row<floors;row++)for(let bay=0;bay<bays;bay++){
          if(windows>=2200)break;
          const v0=(bay+.24)/bays,v1=(bay+.76)/bays;
          const q=(t,y)=>[a[0]+(b[0]-a[0])*t+nx*.045,y,
            a[1]+(b[1]-a[1])*t+nz*.045];
          const lower=ground+2.4+row*2.35,upper=lower+.99;
          if(upper>top-.5)continue;
          const shade=((rec.fid+row*17+bay*31)%11);
          const tint=shade<2?[.43,.51,.54]:shade<4?[.17,.26,.30]:[.12,.20,.25];
          addQuad(q(v0,lower),q(v1,lower),q(v1,upper),q(v0,upper),tint,7);
          windows++;
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
    infillPieces:pieces,roofTriangles,windowQuads:windows,
    maximumPieces:MAX_PIECES,visualOnly:true,materialSurfaceIds:[6,7,8]};
}
