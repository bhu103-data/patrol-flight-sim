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
  // Append instrumentation after the five canonical glacier log fields.
  stats.iceFloesRejectedShore=0;
  const hash=(n)=>{const s=Math.sin(n*127.1+78.233)*43758.5453;return s-Math.floor(s);};
  const lift=(p,y)=>[p[0],p[1]+y,p[2]];
  // Surface 12 requests Alaska's PBR ice photo/normal/roughness shader.
  const iceQuad=(a,b,c,d,color)=>addQuad(a,b,c,d,color,12);
  const iceTri=(a,b,c,color)=>addTri(a,b,c,color,12);
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
      const trench=[.16,.33,.40],inner=[.25,.48,.57];
      iceQuad(lift(a,.15),lift(b,.15),lift(c,.13),lift(d,.13),trench);
      // Asymmetric turquoise fracture wall and snow-rich windward lip.
      iceQuad(lift(d,.14),lift(c,.14),lift(c,.41),lift(d,.36),inner);
      const lip0=glacierPoint(col+.03,r+width+.045);
      const lip1=glacierPoint(col+span+.15,r+.21+width+.04);
      iceQuad(lift(d,.37),lift(c,.42),lift(lip1,.14),lift(lip0,.14),
        [.73+.1*jitter,.88+.04*jitter,.92]);
      stats.crevasses++;
    }
  }

  // A continuous, *irregular* calving face rather than a fence of identical
  // spikes. 28 broad panels follow the original glacier tongue boundary.
  // Slower coherent top undulation + scattered rare overhangs avoid repetition.
  // The survey-derived terrain remains unmodified; ice is cosmetic only.
  const seracCount=28;
  for(let i=0;i<seracCount;i++){
    const start=i/seracCount*19.25+.32,end=(i+1)/seracCount*19.25+.32;
    const L=glacierPoint(start,0),R=glacierPoint(end,0);
    const j=hash(i*17+71),q=hash(i*59+3);
    const coherent=.58*Math.sin(i*.51)+.31*Math.sin(i*.19+.4);
    const topL=Math.max(waterY+1.3,L[1]+.10+coherent*.56+j*.58);
    const topR=Math.max(waterY+1.3,R[1]+.10+coherent*.54+q*.55);
    const forward=.68+.84*hash(i*31+1);
    const zL=L[2]-forward,zR=R[2]-forward;
    const deepFracture=i%9===3;
    const muted=deepFracture?[.20,.38,.46]:
      [.32+.065*j,.54+.065*j,.63+.055*j];
    const light=[.49+.075*j,.68+.085*j,.76+.055*j];
    const undercut=[.14+.06*j,.31+.05*j,.39+.05*j];
    const a=[L[0],waterY-.23,zL],b=[R[0],waterY-.23,zR],
          c=[R[0],topR,zR],d=[L[0],topL,zL];
    iceQuad(a,b,c,d,muted);
    // Not every section has a rooftop. Rare undercut, broad sloping crowns
    // create realistic ice mass shapes instead of same-height vertical teeth.
    if(i%4===1 || i%9===7){
      const roof=[(L[0]+R[0])*.5,Math.max(topL,topR)+.28+.52*j,
        (zL+zR)*.5+1.45+.8*q];
      iceTri(d,c,roof,light);
      if(i%3===1)iceTri([L[0],topL,zL+1.0],d,roof,undercut);
    }
    // Subtle sediment/ice layering in non-uniform elevation bands.
    // A few sections have a third band; most have only two.
    const bands=i%5===0?3:2;
    for(let band=1;band<=bands;band++){
      const t=(band+.2*hash(i*67+band*13))/(bands+1);
      const jitter=(hash(i*23+band*71)-.5)*.27;
      const hL=waterY-.23+(topL-waterY+.23)*t+jitter;
      const hR=waterY-.23+(topR-waterY+.23)*t-jitter*.53;
      const color=band===1?[.28,.45,.51]:band===2?[.38,.56,.61]:[.50,.68,.71];
      iceQuad([L[0],hL,zL-.064],[R[0],hR,zR-.065],
        [R[0],hR+.06,zR-.067],[L[0],hL+.06,zL-.067],color);
      stats.iceStrata++;
    }
    if(i%6===2){
      const width=Math.max(.14,(R[0]-L[0])*.23);
      const xc=L[0]+(R[0]-L[0])*(.25+.33*q),z=(zL+zR)*.5-.10;
      iceQuad([xc,waterY-.09,z],[xc+width,waterY-.09,z],
        [xc+width,Math.min(topL,topR)*.85,z],
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
    // Check the whole floe footprint against the surveyed coast, including
    // diagonal banks. Four cardinal samples alone let ice intersect narrow
    // diagonal spits even while its center was on navigable water.
    const isWater=(x,z)=>{
      const sample=terrainAt(x,z);
      return Number.isFinite(sample)&&sample<=waterY+.12;
    };
    let whollyAfloat=isWater(east,north);
    for(let edge=0;edge<8 && whollyAfloat;edge++){
      const angle=edge*Math.PI/4;
      if(!isWater(east+Math.cos(angle)*radius,
                  north+Math.sin(angle)*radius))
        whollyAfloat=false;
    }
    if(!whollyAfloat){stats.iceFloesRejectedShore++;continue;}
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
    // The eight outward radial probes alone still miss shallow patches within
    // the polygon. Check the exact triangle-fan boundary and interior too.
    const touchesShore=ring.some((point,k)=>{
      const next=ring[(k+1)%corners];
      return !isWater(point[0],point[2]) ||
        !isWater((point[0]+next[0])*.5,(point[2]+next[2])*.5) ||
        !isWater((point[0]+east)*.5,(point[2]+north)*.5);
    });
    if(touchesShore){stats.iceFloesRejectedShore++;continue;}
    for(let k=0;k<corners;k++){
      const next=(k+1)%corners,a=ring[k],b=ring[next];
      // Existing Alaska glacier surface 12 reuses bundled CC0 snow PBR.
      // Only the face tag changes; no extra faces, atlas bytes or collision.
      // The mesh shader keeps the color-only fallback if the atlas is absent.
      iceTri(center,a,b,top);
      // Break up the uniform cyan wall at the waterline. Subtle darker facets
      // separate the floe silhouette from bright coastal snow at a distance;
      // no new shoreline geometry, height samples or collision surfaces.
      const facet=hash(i*41+k*17+11);
      const sideShade=side.map((v,channel)=>Math.min(1,
        v*(.73+.23*facet)*(channel===0?.94:1)));
      addQuad(b,a,[a[0],y-.12,a[2]],[b[0],y-.12,b[2]],sideShade);
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
  stats.conifers=0;stats.foliageWhorls=0;stats.snowBoughs=0;
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
       z>423&&Math.abs(x-130)<71)continue;
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
    const stem=.064+.033*seed;
    addQuad([x-stem,y,z],[x+stem,y,z],
      [x+stem,y+treeH*.87,z],[x-stem,y+treeH*.87,z],trunk);
    addQuad([x,y,z-stem],[x,y,z+stem],
      [x,y+treeH*.87,z+stem],[x,y+treeH*.87,z-stem],trunk);
    // Ragged layered branches, not three stacked identical conical crowns.
    // 5-6 irregular whorls and 7 uneven needles per whorl: ~40 tiny faces.
    // The two shades and sparse snow catches add volume at close distances.
    const whorlCount=5+(i%3===0?1:0);
    for(let layer=0;layer<whorlCount;layer++){
      const t=layer/(whorlCount-1);
      const start=y+treeH*(.09+.70*t);
      const tip=y+treeH*(.40+.58*t);
      const radius=treeH*.24*Math.pow(1.0-t,.86)*(1.0+.10*Math.sin(layer*1.73+seed*5));
      const phase=seed*6.28+layer*.48;
      const tone=layer%2===0?dark:bright;
      for(let j=0;j<7;j++){
        const a=phase+j*Math.PI*2/7,b=phase+(j+1)*Math.PI*2/7;
        const r1=radius*(.76+.39*hash(i*11+j*7+layer*9));
        const r2=radius*(.78+.38*hash(i*19+j*13+layer*17));
        const drop=treeH*(.025+.042*hash(i*23+j*31+layer*27))*(1.0-t);
        const iceDust=winter*(j%5===0?.35:.075);
        const faceTint=1.0-(j%4)*.038;
        const color=tone.map((value,k)=>
          Math.min(1,value*faceTint*(1-iceDust)+[.72,.84,.85][k]*iceDust));
        addTri([x+Math.cos(a)*r1,start-drop,z+Math.sin(a)*r1],
               [x+Math.cos(b)*r2,start-drop*.68,z+Math.sin(b)*r2],
               [x+Math.sin(phase)*radius*.14,tip,z+Math.cos(phase)*radius*.10],
               color);
        // Sparse branch feathers break a large triangular silhouette,
        // rather than another whole ring of billboard foliage.
        if(i%7===0 && layer<2 && j%3===0){
          const a2=a+.22,b2=b-.16;
          const green=tone.map((v,k)=>Math.min(1,v*(k===1?1.18:.92)));
          addTri(
            [x+Math.cos(a2)*r1*.87,start-drop*.5,z+Math.sin(a2)*r1*.87],
            [x+Math.cos(b2)*r2*.72,start+treeH*.02,z+Math.sin(b2)*r2*.72],
            [x+Math.cos(a2+.1)*radius*.28,tip-treeH*.08,z+Math.sin(a2+.1)*radius*.28],
            green);
          stats.branchlets++;
        }
        if(winter>.39 && j%4===0 && layer<whorlCount-1 && i%3===0){
          const snow=[.65+.17*winter,.78+.12*winter,.82+.10*winter];
          addTri([x+Math.cos(a)*r1*.82,start+.035,z+Math.sin(a)*r1*.82],
                 [x+Math.cos(b)*r2*.83,start+.03,z+Math.sin(b)*r2*.83],
                 [x+Math.sin(phase)*radius*.14,tip+.045,z+Math.cos(phase)*radius*.12],
                 snow);
          stats.snowBoughs++;
        }
      }
      stats.foliageWhorls++;
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
