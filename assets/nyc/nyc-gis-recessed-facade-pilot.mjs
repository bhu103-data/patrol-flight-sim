// PATROL NYC architectural aperture pilot — opt-in & visual-only.
// Generates genuinely open upper-story apertures with recessed glass,
// jamb reveals and spandrel bands, not textured rectangles on a solid wall.
// The positioning of these openings is an authored design; only each host
// exterior wall line traces the city's supplied source FID footprint.
// This must NOT be described as an as-built NY building facade or 1:1 survey.
const finite=n=>Number.isFinite(n);
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
export function emitRecessedFacade({
  a,b,ground,top,wall,addQuad,maxWindows=16,
  glass=[.105,.205,.264],trim=[.34,.37,.39]
}){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==2||b.length!==2||
     ![...a,...b,ground,top].every(finite)||top<=ground+7.7||
     typeof addQuad!=='function'||!Array.isArray(wall)||wall.length!==3)
    return {windows:0,quads:0,reason:'not-eligible'};
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  if(length<3.4||maxWindows<1)return {windows:0,quads:0,reason:'short-edge'};
  // The source polygon is clockwise in XZ; outward = left of this edge.
  const nx=-dz/length,nz=dx/length;
  const recess=clamp(length*.017,.105,.185);
  const bays=clamp(Math.floor(length/2.2),2,5);
  const lowerStart=ground+2.9;
  const floorHeight=2.28;
  const possibleFloors=Math.max(0,Math.floor((top-lowerStart-.55)/floorHeight));
  const floors=Math.min(possibleFloors,4,Math.floor(maxWindows/bays));
  if(floors<1)return {windows:0,quads:0,reason:'height-budget'};
  const p=(t,y,d=0)=>[a[0]+t*dx+nx*d,y,a[1]+t*dz+nz*d];
  let quads=0;
  const panel=(u0,u1,y0,y1,d,col,material=6)=>{
    if(u1<=u0||y1<=y0)return;
    addQuad(p(u0,y0,d),p(u1,y0,d),p(u1,y1,d),p(u0,y1,d),col,material);
    quads++;
  };
  const quad=(v0,v1,v2,v3,col,material=6)=>{
    addQuad(v0,v1,v2,v3,col,material);quads++;
  };
  // A complete ground-floor curtainwall/entrance treatment is handled
  // by the existing GIS storefront builder. Preserve it unchanged.
  panel(0,1,ground,lowerStart,0,wall);
  let cursor=lowerStart,windows=0;
  const openings=[];
  for(let floor=0;floor<floors;floor++){
    const floorEnd=Math.min(top,cursor+floorHeight);
    const sill=cursor+.43,head=Math.min(floorEnd-.40,cursor+1.52);
    panel(0,1,cursor,sill,0,wall);
    let prev=0;
    for(let bay=0;bay<bays;bay++){
      const t0=(bay+.17)/bays,t1=(bay+.83)/bays;
      panel(prev,t0,sill,head,0,wall);
      // Nothing is emitted across this [t0,t1] aperture at wall-depth=0.
      // The real side/top/bottom geometry extends INSIDE the envelope.
      const end=-recess;
      const dark=glass.map((c,k)=>clamp(c*(.88+.09*((bay+floor+k)%3)),0,1));
      panel(t0,t1,sill,head,end,dark,7);
      quad(p(t0,sill,0),p(t0,sill,end),p(t0,head,end),p(t0,head,0),wall);
      quad(p(t1,sill,end),p(t1,sill,0),p(t1,head,0),p(t1,head,end),wall);
      quad(p(t0,sill,0),p(t1,sill,0),p(t1,sill,end),p(t0,sill,end),trim);
      quad(p(t0,head,end),p(t1,head,end),p(t1,head,0),p(t0,head,0),trim);
      // Depth-correct mullion is strictly in front of recessed glazing,
      // never an image painted onto the original opaque full wall.
      const bar=.036/length,mid=(t0+t1)*.5;
      panel(mid-bar,mid+bar,sill+.075,head-.075,end+.014,trim);
      panel(t0,t1,sill+.04,sill+.085,end+.016,trim);
      prev=t1;
      windows++;
      openings.push({t0,t1,y0:sill,y1:head,recess});
    }
    panel(prev,1,sill,head,0,wall);
    panel(0,1,head,floorEnd,0,wall);
    // Consistent floor-to-floor spandrel/cornice, tied to the true wall edge.
    panel(0,1,floorEnd-.055,floorEnd,.031,trim);
    cursor=floorEnd;
  }
  panel(0,1,cursor,top,0,wall);
  return {windows,bays,floors,quads,openings,recess,reason:'ok',
    authored:true,sourcedFootprintEdge:true,sourcedFacade:false};
}
