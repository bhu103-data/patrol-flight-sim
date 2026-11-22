// PATROL_NYC_DUMBO_FRONT_DOCK_2026_V1
// The factual ground outlines are NYC OTI 2022 ROADBED polygon triangles
// (official IDs and meter-native vertices: dumbo-front-dock-roadbed-2022.json).
// 2026 NYC DOT confirms a PROPOSED Dock→York two-way protected bike treatment
// and photographed traffic signal presence at Front/Dock; it supplies no
// as-built timing, accurate stop-bar locations or 3-D curbs.
// The 2022 source is uniformly scaled to MATCH PATROL'S EXISTING FICTIONAL
// DUMBO city. Do not ever claim this production pilot is a metric digital twin.
// https://www.nyc.gov/html/dot/downloads/pdf/dumbo-bike-network-whh2026.pdf
// https://data.cityofnewyork.us/Transportation/NYC-Planimetric-Database-Roadbed/i36f-5ih7
export const EXPECTED_SCHEMA='patrol-nyc-dumbo-front-dock-oti-roadbed-2022-v1';
export const FRONT_DOCK_GAME={x:343,z:-297,gameUnitsPerMetre:.32};
const ASF=[.25,.29,.31],BIKE=[.12,.30,.26],STEEL=[.26,.31,.35],
  WHITE=[.84,.86,.82],AMBER=[.84,.69,.20],DARK=[.14,.17,.19];
const world=([e,n],y)=>[
  FRONT_DOCK_GAME.x+e*FRONT_DOCK_GAME.gameUnitsPerMetre,
  y,FRONT_DOCK_GAME.z-n*FRONT_DOCK_GAME.gameUnitsPerMetre
];
const signed=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-
                     (b[1]-a[1])*(c[0]-a[0]);
function sourceTriangleValid(t){
  return t && Number.isSafeInteger(t.id)&&
    [350000,350010].includes(t.sub) &&
    Array.isArray(t.v)&&t.v.length===3 &&
    t.v.every(p=>Array.isArray(p)&&p.length===2&&
      p.every(Number.isFinite)&&p[0]>=-35.01&&p[0]<=190.01&&
      p[1]>=-23.01&&p[1]<=23.01)&&
    Math.abs(signed(...t.v))>.00004;
}
function barycentric(point,triangle){
  const [a,b,c]=triangle.v;
  const d=signed(a,b,c),u=signed(point,b,c)/d,
    v=signed(a,point,c)/d,w=signed(a,b,point)/d;
  return u>=-.0001&&v>=-.0001&&w>=-.0001;
}
export function validateFrontDockOfficialSource(data){
  if(data?.schema!==EXPECTED_SCHEMA||data.year!==2022||
    data.origin?.lon!==-73.992042||data.origin?.lat!==40.702634||
    !Array.isArray(data.triangles)||data.triangles.length<150||
    data.triangles.length>2500)
    throw new Error('Untrusted or missing official OTI 2022 DUMBO pavement source');
  // The pinned source preserves the exact clipped FID audit. Rounding to
  // 0.001 m collapses 24 ultra-thin intersections; NEVER render a degenerate
  // triangle or silently bridge it with a synthetic road rectangle.
  const bad=data.triangles.filter(t=>!sourceTriangleValid(t));
  if(bad.some(t=>!t||!Number.isSafeInteger(t.id)||
      !Array.isArray(t.v)||t.v.length!==3||
      t.v.some(p=>!Array.isArray(p)||p.length!==2||
        p.some(n=>!Number.isFinite(n)))))
    throw new Error('OTI source has an invalid or nonfinite coordinate');
  const renderable=data.triangles.filter(sourceTriangleValid);
  if(renderable.length<150||bad.length>data.triangles.length*.15)
    throw new Error('Too many OTI source triangles collapsed after clipping');
  const ids=new Set(renderable.map(t=>t.id));
  if(ids.size<3)throw new Error('OTI source has too few distinct official FIDs');
  return {triangleCount:data.triangles.length,renderableTriangles:renderable.length,
    droppedDegenerateTriangles:bad.length,uniqueFids:ids.size,
    areaSquareMetres:data.areaSquareMetres,
    source:data.source,year:data.year};
}
export function buildDumboFrontDockRoad(data,{
  addTri,addQuad,box,beam,ribbon,terrainAt,isClear,
  streetY,waterY,detailBand
}){
  if(!data)return {enabled:false,officialTriangles:0,reason:'opt-in disabled'};
  const verified=validateFrontDockOfficialSource(data);
  const roadY=streetY+.150,paintY=streetY+.188;
  const isSafe=([e,n],y=roadY)=>{
    const [x,,z]=world([e,n],y);
    return terrainAt(x,z)>=waterY+1.58&&isClear(x,z,.12);
  };
  const accepted=[];
  for(const t of data.triangles.filter(sourceTriangleValid)){
    const centroid=[
      t.v.reduce((s,p)=>s+p[0],0)/3,
      t.v.reduce((s,p)=>s+p[1],0)/3
    ];
    if(![...t.v,centroid].every(p=>isSafe(p)))continue;
    accepted.push(t);
  }
  if(accepted.length<40)
    return {enabled:false,officialTriangles:0,
      rejectedRoadTriangles:verified.triangleCount,
      reason:'source pavement would collide with old fictional city or water'};
  let triangles=0,lanes=0,signalTriangles=0,signalHeads=0;
  for(const t of accepted){
    const ring=t.v.slice();
    if(signed(...ring)<0)[ring[1],ring[2]]=[ring[2],ring[1]];
    addTri(...ring.map(p=>world(p,roadY)),ASF);
    triangles++;
  }
  // 2026 DOT's planned south-curb TWO-WAY protected bike lane from Dock to
  // York is represented only where BOTH corners are inside the original
  // official roadbed mesh. Width/color are visual estimates, NOT DOT as-built.
  const isPavement=p=>accepted.some(t=>barycentric(p,t));
  const min=7,max=73,pitch=3.0;
  const rectOnSource=(e0,e1,n0,n1,color,y,allowTouch=false)=>{
    const ps=[[e0,n0],[e1,n0],[e1,n1],[e0,n1]];
    const center=[(e0+e1)*.5,(n0+n1)*.5];
    if(![...ps,center].every(p=>isPavement(p)&&isSafe(p)))return false;
    const poly=ps.map(p=>world(p,y));
    // Source east/north is CCW in this ring.
    addQuad(poly[0],poly[1],poly[2],poly[3],color);
    triangles+=2;
    lanes++;
    return true;
  };
  for(let e=min;e<max;e+=pitch){
    const end=Math.min(max,e+pitch);
    rectOnSource(e,end,-11.35,-8.25,BIKE,roadY+.024);
    // Two directions marked by intermittent center dashes, separated from
    // the moving lane; positions are local source-inspired, NOT measured.
    if(Math.floor(e/pitch)%2===0)
      rectOnSource(e+.35,end-.35,-9.88,-9.71,AMBER,paintY);
    rectOnSource(e,end,-8.20,-8.05,WHITE,paintY);
  }
  // Triangular bicycle motion arrows, painted only on accepted roadbed.
  let arrows=0;
  for(const [e,dir] of [[22,1],[50,-1]]){
    const n=dir>0?-10.55:-9.0;
    const pts=[[e+dir*1.3,n],[e-dir*.62,n-.65],[e-dir*.62,n+.65]];
    if(pts.every(p=>isPavement(p)&&isSafe(p))){
      if(signed(...pts)<0)[pts[1],pts[2]]=[pts[2],pts[1]];
      addTri(...pts.map(p=>world(p,paintY+.012)),WHITE);
      triangles++;arrows++;
    }
  }
  // Signal presence is documented by the NYC DOT 2026 Front/Dock street
  // photograph. No authentic timing plan was published. Static RED/AMBER/
  // GREEN colored lenses are visual props ONLY; no simulated car obedience.
  // Do not fabricate a traffic cycle or claim cross-street ROW authority.
  const poleAt=[-1.8,5.5],anchor=world(poleAt,streetY+.16);
  if(isSafe(poleAt)){
    const [x,y,z]=anchor;
    box(x,y+2.18,z,.17,4.35,.17,STEEL);triangles+=12;
    const armEnd=world([6.5,5.5],streetY+.16);
    beam([x,y+3.90,z],[armEnd[0],y+3.90,armEnd[2]],.12,STEEL);
    triangles+=12;
    for(const e of [3.2,6.4]){
      const [hx,,hz]=world([e,5.5],streetY+.16);
      box(hx,y+3.26,hz,.44,1.17,.33,AMBER);triangles+=12;
      box(hx,y+3.26,hz-.182,.34,1.06,.055,DARK);triangles+=12;
      for(const [index,col] of [
        [0,[.81,.14,.12]],[1,[.41,.31,.10]],[2,[.09,.29,.14]]
      ]){
        const cy=y+3.60-index*.34;
        const N=8,pt=(angle,rad)=>[
          hx+Math.sin(angle)*rad,cy+Math.cos(angle)*rad,hz-.224];
        for(let k=0;k<N;k++){
          const a=k*2*Math.PI/N,b=(k+1)*2*Math.PI/N;
          addTri([hx,cy,hz-.225],pt(a,.117),pt(b,.117),col);
          triangles++;signalTriangles++;
        }
      }
      signalHeads++;
    }
    // NYC-style directional sign blades and bounded street-name labels.
    box(x,y+4.12,z-.05,1.48,.30,.08,[.07,.33,.24]);triangles+=12;
  }
  return {
    enabled:true,sourceYear:2022,sourceFids:verified.uniqueFids,
    sourceTriangles:verified.triangleCount,officialTriangles:accepted.length,
    rejectedRoadTriangles:verified.triangleCount-accepted.length,
    droppedDegenerateTriangles:verified.droppedDegenerateTriangles,
    triangles,estimatedVertexBufferBytes:triangles*3*(3+3+3+1)*4,
    bikePaintQuads:lanes,bikeArrows:arrows,signalHeads,
    signalLensTriangles:signalTriangles,
    newTextures:0,additionalDrawCalls:0,
    skipFictionalStreetSegments:[[16,-9],[17,-9]],
    caveat:'Official 2022 shapes scaled uniformly 0.32 game units/m; 2026 planned bicycle markings and approximate traffic-signal props, no as-built timings/collidable curb or native metre street.'
  };
}
