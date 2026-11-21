/**
 * Alaska-only glacial detail mesh for PATROL's native WebGL2 renderer.
 * Original procedural geometry; no external meshes, textures or network fetches.
 * Designed as a single GPU batch, keeping existing terrain/collision data intact.
 */
export function buildAlaskaFjordDetail({addTri, addQuad, terrainAt, waterY}) {
  if (typeof addTri !== 'function' || typeof addQuad !== 'function' ||
      typeof terrainAt !== 'function' || !Number.isFinite(waterY)) {
    throw new TypeError('Alaska detail requires mesh writers and terrain sampling');
  }
  const stats={crevasses:0,iceFloes:0,rockBands:0};
  // All geometry is cosmetic, measured heights still come from terrainAt.
  stats.seracs=0;stats.iceStrata=0;stats.branchlets=0;stats.talus=0;
  const hash=(n)=>{const s=Math.sin(n*127.1+78.233)*43758.5453;return s-Math.floor(s);};
  const lift=(p,y)=>[p[0],p[1]+y,p[2]];
  // Match the existing Glacier Head mesh in index.html. These cracks are a
  // surface-only detail pass; they must not alter sampled collision elevations.
  const cols=20,rows=17;
  function glacierPoint(col,row) {
    const across=2*col/cols-1, t=row/rows;
    const x=130+across*(66-24*t)+Math.sin(t*3.9)*12;
    const z=449+t*148-(1-across*across)*17+Math.sin(col*1.8)*2.3;
    const edge=1-Math.pow(Math.abs(across),8);
    const ice=(4.6+5.8*edge)*Math.min(1,(1-t)*5.8);
    const roughness=Math.sin(col*2.8+row*1.6)*0.56+Math.sin(row*3.7+col)*0.45;
    return [x,terrainAt(x,z)+ice+roughness,z];
  }
  for(let row=2;row<rows-2;row+=2) {
    for(let col=1+((row*3)%4);col<cols-3;col+=4) {
      const jitter=hash(row*38+col*13),r=row+(jitter-.5)*.25;
      const width=.04+.035*hash(row*49+col),span=1.1+.72*jitter;
      const a=glacierPoint(col,r),b=glacierPoint(col+span,r+.21);
      const c=glacierPoint(col+span+.13,r+.21+width);
      const d=glacierPoint(col+.08,r+width);
      const trench=[.045,.205,.285],inner=[.14,.39,.48];
      addQuad(lift(a,.15),lift(b,.15),lift(c,.13),lift(d,.13),trench);
      // Asymmetric turquoise fracture wall and snow-rich windward lip.
      addQuad(lift(d,.14),lift(c,.14),lift(c,.41),lift(d,.36),inner);
      const lip0=glacierPoint(col+.03,r+width+.045);
      const lip1=glacierPoint(col+span+.15,r+.21+width+.04);
      addQuad(lift(d,.37),lift(c,.42),lift(lip1,.14),lift(lip0,.14),
        [.73+.1*jitter,.88+.04*jitter,.92]);
      stats.crevasses++;
    }
  }

  // Dimensional calving face: narrow ice towers, fractured rock-blue walls,
  // sediment layers and irregular overhangs rather than a flat turquoise quad.
  // Follow the SAME glacier-front control curve used by the main terrain mesh.
  // The front looks toward south (-Z) down the flight route.
  for(let i=0;i<42;i++){
    const start=i/42*19.25+.32,end=(i+1)/42*19.25+.32;
    const L=glacierPoint(start,0),R=glacierPoint(end,0);
    const jitter=hash(283+i*37),jitter2=hash(94+i*71);
    const baseY=waterY-.28,topL=Math.max(waterY+2,L[1]+.3+2.2*jitter);
    const topR=Math.max(waterY+2,R[1]+.3+2.1*jitter2);
    const forward=.70+.32*hash(i*49+12);
    const zL=L[2]-forward,zR=R[2]-forward;
    const stripe=i%7===0;
    const dark= stripe?[.12,.30,.38]:[.32+.13*jitter,.56+.13*jitter,.65+.11*jitter];
    const lit=[.51+.12*jitter,.73+.08*jitter,.81+.06*jitter];
    const shadow=[.13+.08*jitter,.31+.06*jitter,.40+.07*jitter];
    const a=[L[0],baseY,zL],b=[R[0],baseY,zR],
      c=[R[0],topR,zR],d=[L[0],topL,zL];
    addQuad(a,b,c,d,dark);
    // Eroded, uneven lip produces a real oblique ice face and roof silhouette.
    const roof=[(L[0]+R[0])*.5,Math.max(topL,topR)+.85+1.7*jitter,
      (zL+zR)*.5+1.9+.4*jitter2];
    addTri(d,c,roof,lit);
    addTri([L[0],topL,zL+1.08],d,roof,shadow);
    for(let band=1;band<=3;band++){
      const t=band/4,uneven=(hash(i*167+band*23)-.5)*.38;
      const hL=baseY+(topL-baseY)*t+uneven;
      const hR=baseY+(topR-baseY)*t-uneven*.5;
      const col=band===1?[.25,.46,.55]:band===2?[.43,.65,.70]:[.56,.76,.79];
      addQuad([L[0],hL,zL-.065],[R[0],hR,zR-.065],
        [R[0],hR+.075,zR-.067],[L[0],hL+.075,zL-.067],col);
      stats.iceStrata++;
    }
    if(i%6===2){
      // Blue undercut and vertical fracture shadow; no false collision surface.
      const width=Math.max(.12,(R[0]-L[0])*.27);
      const xc=L[0]+(R[0]-L[0])*(.25+.34*jitter2);
      const z=(zL+zR)*.5-.13;
      addQuad([xc,baseY+.15,z],[xc+width,baseY+.15,z],
        [xc+width,Math.min(topL,topR)*.91,z],
        [xc,Math.min(topL,topR)*.96,z],[.075,.20,.27]);
    }
    stats.seracs++;
  }

  // Fjord floes with irregular perimeter (not repeated cone-shaped icebergs).
  // Filter water via the SAME CPU terrain sampler used for vehicle collision.
  // No shoreline changes or terrain tessellation.
  for (let i=0;i<86;i++) {
    const h=hash(i*11+17),j=hash(i*13+37);
    const north= i<56 ? 250+h*195 : -600+h*215;
    const east= i<56 ? 28+j*152 : 38+j*137;
    const radius=1.35+3.9*hash(i*19+3);
    if(terrainAt(east,north)>waterY+.12 ||
       terrainAt(east+radius,north)>waterY+.12 ||
       terrainAt(east-radius,north)>waterY+.12 ||
       terrainAt(east,north+radius)>waterY+.12 ||
       terrainAt(east,north-radius)>waterY+.12) continue;
    const corners=7+i%3;
    const y=waterY+.035,thick=.15+.27*hash(i*29+5);
    const top=[.69+.10*j,.85+.08*j,.90+.06*j];
    const side=[.27+.14*j,.53+.10*j,.62+.10*j];
    const center=[east,y+thick,north];
    const ring=[];
    for(let k=0;k<corners;k++){
      const a=k*2*Math.PI/corners,scale=.75+.31*hash(i*37+k*23);
      ring.push([east+Math.cos(a)*radius*scale,y+thick,
        north+Math.sin(a)*radius*(.53+.23*h)*scale]);
    }
    for(let k=0;k<corners;k++){
      const next=(k+1)%corners,a=ring[k],b=ring[next];
      addTri(center,a,b,top);
      addQuad(b,a,[a[0],y-.12,a[2]],[b[0],y-.12,b[2]],side);
    }
    stats.iceFloes++;
  }

  // A handful of narrow, terrain-draped geological bands along the western
  // cliff face. Far fewer polygons than a new mountain mesh.
  for(let i=0;i<28;i++){
    const x=-265+(i%7)*19, z=-510+Math.floor(i/7)*130;
    const a=[x,terrainAt(x,z)+.12,z],b=[x+11,terrainAt(x+11,z-4)+.12,z-4];
    if(a[1]<waterY+4||b[1]<waterY+4||a[1]>69||b[1]>69)continue;
    const ca=[a[0],a[1]+.24,a[2]+.9],cb=[b[0],b[1]+.24,b[2]+.9];
    addQuad(a,b,cb,ca,i%3?[.36,.41,.43]:[.50,.53,.53]);
    stats.rockBands++;
  }
  // Small talus fans at surveyed upland slopes, never invented giant cliffs.
  // Irregular triangular stone faces catch glancing light at low altitude.
  for(let i=0;i<110;i++){
    const x=-375+hash(321+i*11)*720,z=-650+hash(82+i*17)*1060;
    const ground=terrainAt(x,z),side=terrainAt(x+5,z+4);
    if(ground<waterY+6||ground>waterY+42||
       Math.abs(side-ground)<.32||Math.abs(side-ground)>10||
       Math.hypot(x-130,z-450)<140)continue;
    const extent=.55+hash(i*23+7)*1.5;
    const color=i%3===0?[.39,.44,.46]:[.30+.08*hash(i),.36,.39];
    const a=[x-extent,terrainAt(x-extent,z)+.05,z-extent*.5],
          b=[x+extent,terrainAt(x+extent,z)+.05,z+extent*.45],
          c=[x,ground+.22+extent*.48,z-.3*extent];
    addTri(a,b,c,color);
    stats.talus++;
  }
  // Alaska coastal spruce/hemlock silhouettes: one batched draw call, no
  // cloned cuboids or unique textures. Geographically sampled ground altitude
  // and slope determine placement, rather than repeating six tree clusters.
  // Tree geometry is deliberately bounded for GitHub Pages/mobile GPUs.
  stats.conifers=0;
  // Jittered shoreline corridors put visible forest where the pilot actually
  // sees the Alaska landscape, while preserving a strict single-batch cap.
  for(let i=0;i<4550 && stats.conifers<940;i++){
    let x,z;
    if(i<2500){
      const col=i%50,row=Math.floor(i/50);
      x=-390+col*8.25+(hash(i*113+8)-.5)*5.5;
      z=-770+row*21.7+(hash(i*157+3)-.5)*11;
    }else if(i<4050){
      const n=i-2500,col=n%50,row=Math.floor(n/50);
      x=130+col*8.3+(hash(i*113+8)-.5)*6;
      z=-735+row*33.8+(hash(i*157+3)-.5)*16;
    }else{
      x=-735+hash(i*71+53)*1470;
      z=-735+hash(i*107+19)*1470;
    }
    if(Math.hypot(x,z)>765 || Math.hypot(x-151,z+525)<78 ||
       Math.hypot(x+19,z+667)<38 || Math.hypot(x+155,z+610)<28 ||
       z>390&&Math.abs(x-130)<95)continue;
    const y=terrainAt(x,z);
    if(y<waterY+1.5||y>waterY+26)continue;
    const slope=Math.hypot(terrainAt(x+4,z)-terrainAt(x-4,z),
                           terrainAt(x,z+4)-terrainAt(x,z-4))/8;
    if(slope>.29)continue;
    const seed=hash(i*149+9),treeH=2.6+5.5*seed;
    const winter=Math.max(0,Math.min(1,(y-waterY-15)/11));
    const trunk=[.25+.07*seed,.22+.05*seed,.18+.035*seed];
    const dark=[.065+.045*seed,.14+.065*seed,.11+.034*seed];
    const bright=[.11+.065*seed,.23+.085*seed,.16+.040*seed];
    const trunkBase=[x,y+.1,z],trunkTop=[x,y+treeH*.55,z],stem=.075+.028*seed;
    addQuad([x-stem,y,z],[x+stem,y,z],
      [x+stem,y+treeH*.57,z],[x-stem,y+treeH*.57,z],trunk);
    addQuad([x,y,z-stem],[x,y,z+stem],
      [x,y+treeH*.57,z+stem],[x,y+treeH*.57,z-stem],trunk);
    for(let layer=0;layer<3;layer++){
      const start=y+treeH*(.11+.175*layer),tip=start+treeH*(.45-.038*layer);
      const radius=treeH*(.20-.033*layer),phase=seed*6.28+layer*.36;
      const tone=layer%2===0?dark:bright;
      for(let j=0;j<6;j++){
        const a=phase+j*Math.PI/3,b=a+Math.PI/3;
        const r1=radius*(.84+.26*hash(i*11+j*7+layer*9));
        const r2=radius*(.83+.27*hash(i*19+j*13+layer*17));
        const faceTint=1-(j%3)*.055;
        const iceDust=winter*(j%5===0?.42:.16);
        const color=tone.map((value,k)=>
          Math.min(1,value*faceTint*(1-iceDust)+[.76,.86,.87][k]*iceDust));
        addTri([x+Math.cos(a)*r1,start,z+Math.sin(a)*r1],
               [x+Math.cos(b)*r2,start,z+Math.sin(b)*r2],
               [x+Math.sin(phase)*radius*.10,tip,z+Math.cos(phase)*radius*.10],
               color);
        // Fine asymmetric branchlet curtains improve nearby spruce shape
        // with a bounded polygon budget. No repeated cone layers or billboards.
        if(i%7===0 && layer<2 && j%2===0){
          const a2=a+.22,b2=b-.16,twigY=start+treeH*.19;
          const spread=radius*.77,topY=tip-treeH*.10;
          const green=tone.map((v,k)=>Math.min(1,v*(k===1?1.18:.92)));
          addTri(
            [x+Math.cos(a2)*spread,start,z+Math.sin(a2)*spread],
            [x+Math.cos(b2)*spread*.86,start+treeH*.04,z+Math.sin(b2)*spread*.86],
            [x+Math.cos(a2+.1)*radius*.26,Math.max(twigY,topY),
              z+Math.sin(a2+.1)*radius*.26],
            green);
          stats.branchlets++;
        }
      }
    }
    // Irregular understorey tufts, not repeated billboard trees. Vary by
    // altitude and local measured slope; hide when collision ground differs.
    if(i%4===0)for(let k=0;k<3;k++){
      const theta=hash(i*43+k*19)*Math.PI*2;
      const length=1.1+hash(i*59+k*31)*2.1;
      const bx=x+Math.cos(theta)*length,bz=z+Math.sin(theta)*length;
      const by=terrainAt(bx,bz);
      if(Math.abs(by-y)>1.4 || by<waterY+1.3)continue;
      const w=.25+.24*hash(i*67+k*23),h=.36+.49*hash(i*71+k*37);
      const olive=[.09+.07*seed,.17+.08*seed,.11+.03*seed];
      addTri([bx-w,by+.03,bz],[bx+w,by+.03,bz],[bx,by+h,bz],olive);
      addTri([bx,by+.03,bz-w],[bx,by+.03,bz+w],[bx,by+h*.84,bz],olive);
    }
    stats.conifers++;
  }
  return stats;
}
