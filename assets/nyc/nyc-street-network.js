// PATROL_NYC_STREETS_V10 — native WebGL2 static scene geometry.
// Game-space representation of Manhattan avenues and cross streets, not GIS
// coordinates. No Google Maps imagery or proprietary vehicle models copied.
// Roads reuse PATROL's CC0 Photo/PBR street materials in the main mesh shader.
export function buildNycStreetNetwork({
  addQuad, box, beam, ribbon, terrainAt, detailBand,
  grid, streetY, waterY, timesBounds, existingStreets, lettering
}) {
  const asphalt=[.25,.28,.30],sidewalk=[.53,.54,.51],granite=[.59,.58,.54],
    paint=[.85,.86,.81],yellow=[.83,.73,.45],iron=[.26,.30,.32],
    gutter=[.17,.19,.21],patch=[.22,.25,.27],steel=[.45,.48,.49],
    leaf=[.22,.42,.31],hydrant=[.72,.18,.13],signalYellow=[.86,.69,.24];
  const roadY=streetY+.086,markY=streetY+.117,paveY=streetY+.154;
  const stats={avenues:0,streets:0,intersections:0,signals:0,
    crosswalks:0,hotDogCarts:0,streetFixtures:0,civilianCars:0,
    skippedWater:0,skippedLOD:0};
  const hash=(x,z,k=0)=>{
    let n=Math.imul(Math.floor(x),374761393)^Math.imul(Math.floor(z),668265263)^
      Math.imul(k+1,1442695041);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967295;
  };
  const avenueX=(i,z)=>i*grid.blockWidth+grid.tilt*z+grid.offset;
  const point=(x,z,y=roadY)=>[x,y,z];
  const slab=(a,b,width,col,y=roadY)=>ribbon(point(a[0],a[1],y),
    point(b[0],b[1],y),width,col);
  const shift=(a,b,d)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;
    return [[a[0]+dz/l*d,a[1]-dx/l*d],[b[0]+dz/l*d,b[1]-dx/l*d]];
  };
  const inTimes=(x,z)=>{
    const [l,r,s,n]=timesBounds;
    return x>l-9&&x<r+9&&z>s-8&&z<n+8;
  };
  function permitted(x,z){
    if(inTimes(x,z)||detailBand(x,z)<2){stats.skippedLOD++;return false;}
    if(terrainAt(x,z)<waterY+1.55){stats.skippedWater++;return false;}
    return true;
  }
  function nearOld(x,z,clearance=5.8){
    for(const path of existingStreets)for(let k=1;k<path.length;k++){
      const a=path[k-1],b=path[k],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,
        ((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
      if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<clearance)return true;
    }
    return false;
  }
  function rect(x,z,w,d,color,y=roadY){
    addQuad([x-w/2,y,z-d/2],[x+w/2,y,z-d/2],
      [x+w/2,y,z+d/2],[x-w/2,y,z+d/2],color);
  }
  function streetSegment(a,b,kind,i,j){
    const mid=[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
    if(!permitted(...mid)||!permitted(...a)||!permitted(...b)||
      nearOld(...mid,7.8))return false;
    const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(distance<4)return false;
    const width=kind==='avenue'?6.35:5.65,half=width/2;
    slab(a,b,width,asphalt);
    // Independent stone sidewalks, raised curb faces and drainage channels.
    // They sit OUTSIDE the asphalt: no two large overlapping quads.
    for(const side of [-1,1]){
      const p=shift(a,b,side*(half+.53));
      slab(p[0],p[1],.88,sidewalk,paveY);
      const c=shift(a,b,side*(half+.035));
      slab(c[0],c[1],.22,granite,roadY+.127);
      const g=shift(a,b,side*(half-.18));
      slab(g[0],g[1],.115,gutter,markY);
      addQuad(point(c[0][0],c[0][1],roadY),
        point(c[1][0],c[1][1],roadY),
        point(c[1][0],c[1][1],roadY+.128),
        point(c[0][0],c[0][1],roadY+.128),granite);
    }
    const lines=kind==='avenue'?2:1;
    for(let along=4;along<distance-1.5;along+=7.4){
      const t=along/distance,u=Math.min(1,(along+2.6)/distance);
      const p=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],
        q=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
      slab(p,q,.105,lines===2?yellow:paint,markY);
      if(lines===2){
        const off=shift(p,q,.20);
        slab(off[0],off[1],.065,yellow,markY);
      }
    }
    if(hash(i,j,9)>.65){
      const c=[a[0]*.64+b[0]*.36,a[1]*.64+b[1]*.36],
        d=[a[0]*.42+b[0]*.58,a[1]*.42+b[1]*.58];
      const p=shift(c,d,(hash(i,j,7)-.5)*2.2);
      slab(p[0],p[1],.46,patch,roadY+.007);
    }
    const center=[a[0]*.65+b[0]*.35,a[1]*.65+b[1]*.35];
    if(hash(i,j,12)>.68 && !nearOld(...center,13)){
      const a1=shift(center,[center[0]+.01,center[1]+1],half-.30)[0];
      // Flush, dark drainage grate, with ribs rather than a flat metal patch.
      rect(a1[0],a1[1],.51,.38,iron,markY);
      for(let k=-2;k<=2;k++)rect(a1[0]+k*.073,a1[1],.019,.30,steel,markY+.006);
      stats.streetFixtures++;
    }
    if(kind==='avenue')stats.avenues++;else stats.streets++;
    return true;
  }
  // Unified surface-road generation. Positions align with the EXISTING
  // Manhattan building parcel basis (24 x 33 compressed game units).
  const segmentMap=new Set();
  for(let i=-10;i<=8;i++)for(let j=-17;j<=9;j++){
    const a=[avenueX(i,j*grid.blockLength),j*grid.blockLength],
      b=[avenueX(i,(j+1)*grid.blockLength),(j+1)*grid.blockLength],
      key='a'+i+':'+j;
    if(segmentMap.has(key))continue;
    segmentMap.add(key);
    streetSegment(a,b,'avenue',i,j);
  }
  for(let j=-16;j<=9;j++)for(let i=-10;i<=7;i++){
    const z=j*grid.blockLength;
    streetSegment([avenueX(i,z),z],[avenueX(i+1,z),z],'street',i,j);
  }
  function signal(x,z,phase=0){
    const base=streetY+.16;
    // NYC yellow traffic signal heads and dark pedestrian walk/countdown box.
    box(x,base+2.05,z,.115,4.10,.115,iron);
    box(x,base+4.08,z,.20,.14,.20,iron);
    beam([x,base+3.93,z],[x-.96,base+3.93,z],.075,steel);
    box(x-.96,base+3.59,z,.36,.84,.35,signalYellow);
    box(x-.96,base+3.59,z+.194,.265,.75,.045,iron);
    const lights=[[.26,[.72,.12,.11]],[.0,[.67,.50,.12]],[-.26,[.15,.60,.28]]];
    for(let k=0;k<lights.length;k++){
      const [delta,active]=lights[k];
      const bright=k===(phase%3);
      const rgb=bright?active:active.map(v=>v*.26);
      box(x-.96,base+3.59+delta,z+.224,.175,.17,.028,rgb);
      box(x-.96,base+3.59+delta,z+.184,.25,.04,.12,iron);
    }
    box(x,base+2.48,z+.13,.37,.58,.26,iron);
    box(x,base+2.53,z+.278,.25,.40,.028,
      phase%2===0?[.82,.49,.22]:[.15,.60,.47]);
    box(x,base+.56,z,.18,1.13,.18,steel);
    stats.signals++;
  }
  function crosswalk(x,z,i,j){
    const s=grid.blockWidth;
    // Opposing ladder crosswalks plus recessed stop bars.
    for(const side of [-1,1]){
      const zz=z+side*3.75;
      for(let k=-3;k<=3;k++){
        const xk=x+k*.77;
        rect(xk,zz,.47,1.30,paint,markY+.006);
        stats.crosswalks++;
      }
      rect(x,z+side*5.0,s*.32,.10,paint,markY+.004);
    }
    // Sewer chamber and slab-joint at the crosswalk nose.
    if((i+j)%3===0){
      const xx=x+4.33,zz=z+4.38;
      rect(xx,zz,.72,.50,iron,markY+.007);
      for(let k=-2;k<=2;k++)
        rect(xx+k*.115,zz,.034,.41,steel,markY+.010);
    }
    const cornerX=x+4.48,cornerZ=z+4.55;
    if(hash(i,j,3)>.40){
      signal(cornerX,cornerZ,(Math.abs(i)+j+30)%3);
      stats.intersections++;
    }
    // A curb-side NYC red hydrant and street waste bin, with restrained count.
    if(hash(i,j,4)>.71){
      box(x-4.20,streetY+.48,z-4.56,.23,.75,.24,hydrant);
      box(x-4.2,streetY+.83,z-4.56,.35,.14,.36,hydrant);
      box(x+4.35,streetY+.41,z-4.65,.53,.61,.47,iron);
      box(x+4.35,streetY+.75,z-4.65,.61,.08,.55,steel);
      stats.streetFixtures+=2;
    }
  }
  for(let j=-16;j<=9;j++)for(let i=-10;i<=8;i++){
    const z=j*grid.blockLength,x=avenueX(i,z);
    // Extra conservative building/bridge and Times Square safety margin.
    if(!permitted(x,z)||nearOld(x,z,11.2)||
      !permitted(x-4,z-4)||!permitted(x+4,z+4))continue;
    crosswalk(x,z,i,j);
  }
  // Hot-dog sidewalk cart — visibly stainless steel with under-counter
  // storage, 10-sided umbrella, menu, condiment bottles and a small wheelbase.
  // Original generic text; no food-cart brand names or artwork reproduced.
  function hotDogCart(x,z,variant=0){
    const y=streetY+.18, blue=[.12,.31,.65],gold=[.96,.77,.17],
      stainless=[.67,.71,.72],dark=[.20,.24,.26],bread=[.75,.48,.26];
    // Slightly elevated paving / curb plaza, never in an existing car lane.
    box(x,y-.05,z,3.45,.09,2.70,sidewalk);
    box(x,y+.87,z,2.48,1.54,1.41,stainless);
    box(x,y+1.58,z,2.65,.15,1.55,[.82,.83,.79]);
    box(x,y+.86,z+.735,2.44,1.36,.055,blue);
    box(x,y+.86,z-.735,2.44,1.36,.055,gold);
    for(const side of [-1,1])for(const zz of [-.52,.52]){
      const cx=x+side*1.03,cz=z+zz;
      for(let k=0;k<10;k++){
        const a=k*Math.PI/5,b=(k+1)*Math.PI/5;
        // Polygonal rubber wheels with lighter circular wheel hubs.
        const A=[cx,.36+y+Math.sin(a)*.26,cz+Math.cos(a)*.26],
          B=[cx,.36+y+Math.sin(b)*.26,cz+Math.cos(b)*.26];
        addQuad(A,B,[cx+side*.11,B[1],B[2]],
          [cx+side*.11,A[1],A[2]],dark);
      }
      box(cx+side*.11,y+.36,cz,.055,.20,.20,steel);
    }
    box(x,y+2.42,z,.085,1.82,.082,steel);
    const canopyTop=[x,y+3.57,z],N=10,rad=2.05;
    const rim=a=>[x+Math.cos(a)*rad,y+3.06,z+Math.sin(a)*rad*.76];
    for(let k=0;k<N;k++){
      const a=2*Math.PI*k/N,b=2*Math.PI*(k+1)/N;
      addQuad(rim(a),rim(b),[x,y+3.57,z],canopyTop,
        (k+variant)%2===0?blue:gold);
      beam(rim(a),canopyTop,.027,steel);
    }
    // Refrigerator vents, steel drawers and steaming hot-dog roller.
    for(let k=-2;k<=2;k++)box(x+k*.40,y+.93,z+.77,.21,.07,.04,dark);
    box(x,y+1.72,z-.25,1.18,.14,.72,dark);
    for(let k=-2;k<=2;k++)
      box(x+k*.215,y+1.84,z-.24,.14,.09,.55,bread);
    for(const [k,col] of [[-1,[.90,.15,.12]],[0,[.88,.76,.18]],[1,[.87,.88,.74]]])
      box(x+k*.32,y+1.93,z+.32,.13,.40,.14,col);
    box(x-.85,y+1.74,z-.28,.46,.39,.30,stainless);
    box(x-.85,y+1.93,z-.28,.51,.04,.34,gold);
    if(lettering){
      lettering('HOT DOGS',[x-.88,y+1.02,z+.77],1.77,.28,[.97,.94,.83]);
      lettering('PRETZELS',[x-.95,y+.68,z+.77],1.87,.21,[.98,.92,.69]);
    }
    stats.hotDogCarts++;
  }
  // Two tourist-vendor stands within the dedicated, wide Times Square
  // pedestrian plaza; no guesswork on actual permit/vendor coordinates.
  // Times Square vendors only stand on exposed, dry pedestrian paving.
  for(const [x,z,v] of [[-4.4,9.1,0],[-4.2,24.0,1]]){
    if(terrainAt(x,z)>waterY+1.55)hotDogCart(x,z,v);
  }
  // Downtown commercial corridor: two hand-placed pedestrian corners,
  // skipping any place that is flooded or inside the building heightfield.
  for(const [x,z,k] of [[-58,-345,2],[-33,-390,3],[-14,-314,4]]){
    if(terrainAt(x,z)>waterY+1.7 && detailBand(x,z)>=2&&!nearOld(x,z,3.1))
      hotDogCart(x,z,k);
  }
  return stats;
}
