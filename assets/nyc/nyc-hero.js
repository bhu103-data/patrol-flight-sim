// PATROL_NYC_HERO_CORRIDOR_V6 — bounded visual-detail asset, WebGL2 only.
// Fits PATROL's fictional X/Z scale. Inspired by 11-point Fort Wood layout;
// NOT a surveyed, real-metre reconstruction or photogrammetry capture.
export function buildNycHeroScenery({addQuad,box,beam,waterY,groundY,spawn,liberty}){
  const x0=liberty[0],z0=liberty[1],ground=groundY;
  const stone=[.54,.52,.47],limestone=[.67,.65,.60],
    coping=[.75,.72,.66],mortar=[.30,.31,.29],
    weatheredCopper=[.28,.51,.43],iron=[.25,.29,.31],
    timber=[.38,.33,.27],asphalt=[.34,.35,.33];
  // 11-pointed Fort Wood perimeter with 22 distinct inward/outward corners.
  const N=22,points=[],starTop=Math.max(waterY+.64,ground-.35);
  for(let i=0;i<N;i++){
    const angle=i*Math.PI/11-.55;
    const radius=i%2===0?24.8:18.1;
    points.push([x0+Math.sin(angle)*radius,z0+Math.cos(angle)*radius]);
  }
  for(let i=0;i<N;i++){
    const [ax,az]=points[i],[bx,bz]=points[(i+1)%N];
    addQuad([ax,waterY+.12,az],[bx,waterY+.12,bz],
      [bx,starTop,bz],[ax,starTop,az],stone);
    // Accurate-looking weathered coping and wall edge band: visual approximation.
    addQuad([ax,starTop+.10,az],[bx,starTop+.10,bz],
      [bx,starTop+.19,bz],[ax,starTop+.19,az],coping);
    if(i%2===0){
      const mx=(ax+bx)*.5,mz=(az+bz)*.5;
      const vx=mx-x0,vz=mz-z0,r=Math.hypot(vx,vz)||1;
      box(mx,starTop-.38,mz,.64,.61,.44,limestone);
      box(mx,starTop-.14,mz,.42,.30,.14,mortar);
      beam([mx,starTop-.20,mz],[mx+vx/r*.24,starTop+.06,mz+vz/r*.24],
        .056,iron);
    }
  }
  // Low, irregular hardscape concentric walks, with separate granite joints
  // and grass strips. These must not bury the existing statue pedestal.
  for(let i=0;i<44;i++){
    const a=i*Math.PI/22,b=(i+1)*Math.PI/22;
    function at(r,theta,y=ground+.055){
      return [x0+Math.sin(theta)*r,y,z0+Math.cos(theta)*r];
    }
    const p=at(10.0,a),q=at(10.0,b),r=at(13.4,b),t=at(13.4,a);
    addQuad(p,q,r,t,i%3===0?stone:limestone);
    addQuad(at(13.4,a,ground+.062),at(13.4,b,ground+.062),
      at(13.52,b,ground+.067),at(13.52,a,ground+.067),mortar);
    if(i%2===0){
      const mid=(a+b)*.5;
      const loc=at(15.4,mid,ground+.04);
      box(loc[0],ground+.14,loc[2],.50,.24,.50,stone);
    }
  }
  // Path from the star perimeter toward the airport-facing harbor spawn.
  const dx=spawn[0]-x0,dz=spawn[1]-z0,len=Math.hypot(dx,dz)||1;
  const ux=dx/len,uz=dz/len,nx=-uz,nz=ux;
  const point=(along,side,y)=>[x0+ux*along+nx*side,y,z0+uz*along+nz*side];
  const deckY=waterY+1.32;
  for(let i=0;i<8;i++){
    const u=18+i*2.5,v=u+2.5;
    const startY=i<3?ground+.05-(ground+.05-deckY)*(i/3):deckY;
    const endY=i<2?ground+.05-(ground+.05-deckY)*((i+1)/3):deckY;
    addQuad(point(u,-2.25,startY),point(v,-2.25,endY),
      point(v,2.25,endY),point(u,2.25,startY),timber);
    addQuad(point(u,-2.25,startY-.12),point(v,-2.25,endY-.12),
      point(v,2.25,endY-.12),point(u,2.25,startY-.12),iron);
    for(let side of [-1,1]){
      const edge=(u+v)*.5;
      const beamZ=point(edge,side*2.20,startY);
      box(beamZ[0],beamZ[1]+.05,beamZ[2],.10,.11,.10,coping);
    }
  }
  // Real-looking ferry jetty structure (rails/pylons/fenders/cleats).
  for(let along=19;along<=37;along+=3){
    for(const side of [-1,1]){
      const [x,y,z]=point(along,side*2.15,deckY);
      beam([x,waterY-.75,z],[x,deckY+1.04,z],.088,iron);
      const [tx,ty,tz]=point(along,side*2.15,deckY+1.07);
      box(tx,ty,tz,.12,.15,.13,coping);
      if(along<36){
        beam(point(along,side*2.15,deckY+1.02),
          point(along+3,side*2.15,deckY+1.02),.067,iron);
      }
    }
    if(along%2===1){
      const [mx,my,mz]=point(along,0,deckY+.06);
      box(mx,my,mz,4.1,.04,.070,stone);
    }
  }
  for(const along of [24,33]){
    const [px,py,pz]=point(along,2.70,deckY+.23);
    box(px,py,pz,.41,.46,.43,mortar);
    box(px,py+.28,pz,.59,.13,.55,iron);
    for(const offset of [-.42,.42]){
      const [bx,by,bz]=point(along+offset,2.83,deckY-.28);
      box(bx,by,bz,.19,.56,.18,stone);
    }
  }
  // Terminal display and safety bollards; lit by the existing city lighting.
  const [sx,sy,sz]=point(16.3,-3.25,ground+1.18);
  box(sx,sy,sz,2.10,1.78,.18,iron);
  box(sx,sy+.22,sz+.11,1.74,.93,.06,[.15,.38,.37]);
  for(let i=0;i<4;i++){
    const [bx,by,bz]=point(17+i*4.2,-3.1,deckY+.44);
    box(bx,by,bz,.22,.88,.22,weatheredCopper);
    box(bx,by+.42,bz,.29,.12,.30,stone);
  }
  // Island paths, shaded copper-green vegetation, and spot bollards.
  for(let i=0;i<16;i++){
    const a=i*2.39996323;
    const rr=15.7+2.7*(.5+.5*Math.sin(i*5.38));
    const tx=x0+Math.sin(a)*rr,tz=z0+Math.cos(a)*rr;
    // Skip the ferry approach sightline.
    if((tx-x0)*ux+(tz-z0)*uz>rr*.81)continue;
    const top=[tx-.03,ground+4.6+(i%3)*.25,tz+.04];
    beam([tx,ground+.10,tz],top,.12,[.35,.30,.24]);
    for(let b=0;b<5;b++){
      const angle=b*2.39996+i*.19,spread=1.12+(b%2)*.24;
      const tip=[top[0]+Math.cos(angle)*spread,
        top[1]-(b%3)*.20,top[2]+Math.sin(angle)*spread];
      beam([tx,ground+3.20,tz],tip,.047,[.27,.34,.27]);
      box(tip[0],tip[1]+.03,tip[2],.63,.52,.60,[.21,.39+(i%3)*.03,.27]);
    }
    const lx=x0+Math.sin(a+.36)*12.7,lz=z0+Math.cos(a+.36)*12.7;
    box(lx,ground+.37,lz,.17,.73,.17,iron);
    box(lx,ground+.73,lz,.28,.10,.28,coping);
  }
  // Low-profile high-detail shoreline fenders and repeated coastal fixtures.
  for(let j=0;j<11;j++){
    const a=(j+.33)*Math.PI*2/11;
    const tx=x0+Math.sin(a)*24.6,tz=z0+Math.cos(a)*24.6;
    box(tx,starTop-.54,tz,.42,.84,.41,mortar);
    box(tx,starTop+.09,tz,.55,.08,.53,stone);
  }
  return {starPoints:11,walkwayPanels:44,pierPanels:8,shorelineFixtures:11};
}
