/**
 * Small Central Park landmark additions. All geometry is baked into the
 * Manhattan mesh; game-space locations are approximate, not surveyed.
 * No third-party model or remote texture dependencies.
 */
export function buildCentralParkAmenities({addQuad,addTri,box,beam,ribbon,terrainAt,grid,waterY,quality='high'}){
  const ex=(u,z)=>grid.offset+grid.tilt*z+u;
  const y=(u,z)=>terrainAt(ex(u,z),z);
  const TAU=2*Math.PI;
  const stone=[.70,.68,.60],pale=[.79,.77,.69],granite=[.53,.53,.49],
    steel=[.30,.34,.35],roof=[.38,.34,.31],bronze=[.44,.35,.23],
    wood=[.44,.31,.21],glass=[.28,.39,.43],gravel=[.60,.56,.48],
    grass=[.26,.42,.24],dark=[.20,.27,.26];
  const stats={attractions:0,boats:0,benches:0,lamps:0};
  // Strawberry Fields: an original radial pattern near West 72nd Street.
  const mu=-28,mz=130,mx=ex(mu,mz),my=y(mu,mz)+.19;
  const ring=(radius,t)=>[mx+radius*Math.cos(t),my,mz+radius*Math.sin(t)];
  for(let i=0;i<36;i++){
    const a=i/36*TAU,b=(i+1)/36*TAU;
    addQuad(ring(3.65,a),ring(3.65,b),ring(2.65,b),ring(2.65,a),stone);
    addQuad(ring(2.56,a),ring(2.56,b),ring(1.62,b),ring(1.62,a),
      i%2===0?dark:pale);
    addTri([mx,my,mz],ring(1.58,b),ring(1.58,a),
      i%3===0?bronze:granite);
  }
  stats.attractions++;
  // Central Park Zoo: low limestone pavilions, fenced walkway and aviary.
  const zu=27,zz=89,zy=y(zu,zz),zx=ex(zu,zz);
  box(zx,zy+.12,zz,13.2,.18,7.7,gravel);
  for(const [u,z,w,d] of [[22,86.4,4.0,2.4],[32,90.5,3.7,2.4]]){
    const x=ex(u,z),base=y(u,z);
    box(x,base+1.10,z,w,2.2,d,stone);
    box(x,base+2.27,z,w+.30,.22,d+.35,roof);
    for(const t of [-.30,0,.30])
      box(x+w*t,base+1.40,z+d*.52,.38,.82,.08,glass);
  }
  for(const side of [-1,1]){
    const u=zu+side*6.60,x=ex(u,zz);
    for(let j=-3;j<=3;j++){
      const z=zz+j*1.02;
      beam([x,zy+.07,z],[x,zy+1.33,z],.044,steel);
    }
    beam([x,zy+1.33,zz-3.65],[x,zy+1.33,zz+3.65],.070,steel);
  }
  for(let i=0;i<16;i++){
    const a=i/16*TAU;
    const u=zu+2.3*Math.cos(a),z=zz+1.5*Math.sin(a);
    beam([ex(u,z),zy+.17,z],[zx,zy+3.15,zz],.051,steel);
  }
  stats.attractions++;
  // Loeb Boathouse: pitched roof, glass facade, veranda and rowing boats.
  const hu=18,hz=157,hx=ex(hu,hz),hy=y(hu,hz);
  box(hx,hy+1.27,hz,9.1,2.42,5.8,stone);
  for(const side of [-1,1]){
    const z=hz+side*3.03;
    addTri([hx-4.95,hy+2.48,z],[hx,hy+4.08,z],
      [hx+4.95,hy+2.48,z],roof);
  }
  addQuad([hx-4.95,hy+2.48,hz-3.03],
    [hx-4.95,hy+2.48,hz+3.03],
    [hx,hy+4.08,hz+3.03],[hx,hy+4.08,hz-3.03],granite);
  addQuad([hx,hy+4.08,hz-3.03],[hx,hy+4.08,hz+3.03],
    [hx+4.95,hy+2.48,hz+3.03],
    [hx+4.95,hy+2.48,hz-3.03],granite);
  for(let j=-3;j<=3;j++){
    const x=ex(hu+j*1.12,hz);
    box(x,hy+1.40,hz-2.95,.70,1.05,.09,glass);
    if(j%2===0)beam([x,hy,hz-4.05],
      [x,hy+2.40,hz-4.05],.070,bronze);
  }
  const lakeWater=waterY+2.83;
  // Four actually volumetric, independently oriented lake rowboats.
  // The previous assets were flat colored rectangles laid on the water.
  // Keep the same bounded water-safe centers and one existing draw batch.
  for(let i=0;i<4;i++){
    const u=-14+24*.53*Math.cos(i*1.35+.5),
      z=150+16.2*.55*Math.sin(i*1.35+.5);
    const cx=ex(u,z),heading=.34+i*.69,
      forward=[Math.cos(heading),Math.sin(heading)],
      sideAxis=[-forward[1],forward[0]];
    const at=(fore,side,lift)=>[
      cx+forward[0]*fore+sideAxis[0]*side,
      lakeWater+lift,
      z+forward[1]*fore+sideAxis[1]*side
    ];
    const hull=i%2===0?[.42,.28,.20]:[.29,.34,.36];
    const inside=[.25,.23,.21],rim=[.57,.43,.28];
    // Width tapers toward both pointed ends, with rising sheer and a
    // submerged keel. Every plank is a 3D face, not a billboard.
    const sections=[[-1.48,.035],[-.96,.35],[-.18,.46],
      [.86,.36],[1.48,.035]];
    const sheer=t=>.22+.12*Math.pow(Math.abs(t)/1.48,3);
    const keel=t=>-.12+.14*Math.pow(Math.abs(t)/1.48,2);
    for(let k=1;k<sections.length;k++){
      const [a,wa]=sections[k-1],[b,wb]=sections[k];
      for(const side of [-1,1]){
        const topA=at(a,side*wa,sheer(a)),topB=at(b,side*wb,sheer(b));
        const chineA=at(a,side*wa*.58,keel(a)),
          chineB=at(b,side*wb*.58,keel(b));
        if(side<0)addQuad(topA,topB,chineB,chineA,hull);
        else addQuad(topB,topA,chineA,chineB,hull);
        const innerA=at(a,side*wa*.74,.068),
          innerB=at(b,side*wb*.74,.068);
        if(side<0)addQuad(topB,topA,innerA,innerB,inside);
        else addQuad(topA,topB,innerB,innerA,inside);
        beam(topA,topB,.034,rim);
      }
      const floorA=wa*.68,floorB=wb*.68;
      addQuad(at(a,-floorA,.056),at(a,floorA,.056),
        at(b,floorB,.056),at(b,-floorB,.056),inside);
    }
    // Solid pointed stems close the small gap between the gunwale and keel.
    for(const tip of [-1.48,1.48]){
      addTri(at(tip,-.036,sheer(tip)),at(tip,.036,sheer(tip)),
        at(tip,0,keel(tip)),hull);
    }
    // Independent wood thwarts and foot braces are visible from above.
    for(const fore of [-.43,.42]){
      addQuad(at(fore-.10,-.32,.16),at(fore-.10,.32,.16),
        at(fore+.10,.32,.16),at(fore+.10,-.32,.16),wood);
      beam(at(fore,-.31,.11),at(fore,.31,.11),.032,bronze);
    }
    // Port and starboard oars with narrow wooden blades touching water.
    for(const side of [-1,1]){
      beam(at(.04,side*.34,.25),at(-.14,side*1.55,.12),.034,wood);
      addQuad(at(-.40,side*1.48,.105),at(-.40,side*1.82,.105),
        at(-.08,side*1.82,.105),at(-.08,side*1.48,.105),rim);
    }
    stats.boats++;
  }
  stats.attractions++;
  // Gapstow Bridge: short stone arch crossing The Pond.
  for(let i=0;i<14;i++){
    const t=i/14,n=(i+1)/14,u0=13+t*14,u1=13+n*14;
    const h0=lakeWater+1.25+.72*Math.sin(t*Math.PI),
      h1=lakeWater+1.25+.72*Math.sin(n*Math.PI);
    const x0=ex(u0,78),x1=ex(u1,78);
    addQuad([x0,h0,76.95],[x0,h0,79.05],
      [x1,h1,79.05],[x1,h1,76.95],stone);
    for(const side of [-1,1]){
      const z=78+side*1.06;
      beam([x0,h0+.77,z],[x1,h1+.77,z],.082,granite);
      if(i%2===0)beam([x0,h0,z],[x0,h0+.77,z],.052,steel);
    }
  }
  stats.attractions++;
  // Conservatory Garden: hedges and individually shaded blooms.
  const flowers=[[.71,.42,.48],[.48,.41,.65],[.86,.84,.79]];
  for(let z=318;z<=329;z+=2.3)for(const u of [17,21,27,31]){
    const x=ex(u,z),base=y(u,z)+.11;
    box(x,base+.16,z,1.25,.31,1.17,grass);
    for(let j=0;j<3;j++){
      const dx=j*.32-.35,col=flowers[(j+Math.round(z))%3];
      addTri([x+dx,base+.33,z-.22],
        [x+dx+.13,base+.58,z],[x+dx+.27,base+.33,z+.21],col);
    }
  }
  stats.attractions++;
  // Park furniture follows paths, with a bounded low/high count.
  const count=quality==='low'?9:17;
  for(let i=0;i<count;i++){
    const z=68+i*274/(count-1),u=i%2?-31:31;
    const x=ex(u,z),base=y(u,z);
    beam([x,base,z],[x,base+2.62,z],.075,steel);
    beam([x,base+2.61,z],[x+.29,base+2.97,z],.055,bronze);
    box(x+.32,base+2.94,z,.36,.17,.32,pale);
    stats.lamps++;
    if(i%2===0){
      for(const side of [-1,1])
        beam([x+side*.75,base+.10,z+.5],
          [x+side*.75,base+.72,z+.5],.06,steel);
      for(const h of [.65,.89])
        beam([x-.88,base+h,z+.5],[x+.88,base+h,z+.5],.12,wood);
      stats.benches++;
    }
  }

  // East Lake / Loeb Boathouse: original seven-slat park settee.
  // A deliberately single, game-scale near-view landmark, not a surveyed
  // Conservancy bench or an imported CC0 candidate (see independent audit #98).
  // Check all footprint corners against the SAME irregular Lake shore used
  // by central-park.js, not just the dry center point.
  const benchU=9,benchZ=163;
  const lakeClearance=(u,z)=>{
    const dx=(u+14)/24,dz=(z-150)/16.2;
    const angle=Math.atan2(dz,dx);
    const shore=1+.055*Math.sin(3*angle+1.15)+
      .025*Math.cos(7*angle-1.15);
    return Math.hypot(dx,dz)/shore;
  };
  const dryBench=[-0.58,0.58].every(du=>
    [-0.95,0.95].every(dz=>
      lakeClearance(benchU+du,benchZ+dz)>1.19));
  if(quality==='high' && dryBench &&
     Math.abs(benchU)+1<grid.parkHalfWidth){
    const bx=ex(benchU,benchZ),bz=benchZ,by=y(benchU,benchZ);
    const iron=[.15,.20,.18],plankA=[.37,.25,.17],plankB=[.39,.27,.18];
    // Five independent seat slats, each fully three-dimensional with narrow
    // gaps and subtle alternating weathered timber colors.
    for(let slat=0;slat<5;slat++){
      const u=benchU-.31+slat*.155;
      box(ex(u,bz),by+.475,bz,.135,.065,1.80,
        slat%2?plankB:plankA);
    }
    // Two broad back slats, behind the seat facing the lake (-x).
    for(const [j,h] of [.69,.855].entries()){
      box(ex(benchU+.475+j*.035,bz),by+h,bz,.075,.145,1.80,
        j?plankA:plankB);
    }
    // Four feet land on individually sampled dry terrain heights.
    // The curved cast-iron frame, arm rests and under-seat straps remain in
    // the existing NYC batched mesh; no colliders or texture fetches.
    for(const end of [-.76,.76]){
      const z=bz+end;
      for(const du of [-.29,.30]){
        const u=benchU+du,x=ex(u,z),foot=y(u,z);
        box(x,foot+.031,z,.16,.06,.19,iron);
        beam([x,foot+.06,z],[x,by+.43,z],.052,iron);
      }
      beam([ex(benchU-.37,z),by+.425,z],
        [ex(benchU+.34,z),by+.425,z],.065,iron);
      beam([ex(benchU+.30,z),by+.42,z],
        [ex(benchU+.55,z),by+.92,z],.055,iron);
      beam([ex(benchU-.39,z),by+.65,z],
        [ex(benchU+.37,z),by+.65,z],.042,iron);
      beam([ex(benchU-.39,z),by+.65,z],
        [ex(benchU-.30,z),by+.43,z],.038,iron);
      // Visible bolt heads at seat-to-frame and backrest joints.
      for(const h of [.48,.70,.86]){
        box(ex(benchU+.40,z),by+h,z,.043,.043,.085,bronze);
      }
    }
    stats.benches++;
  }
  return stats;
}
