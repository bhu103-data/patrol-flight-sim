// PATROL Chongqing: real stone courses on the otherwise completely blank
// 72x14 hotpot entrance slab. Local authored geometry, using the game's
// existing Poly Haven CC0 photographic stone rather than imported assets.
// Keep this layer independent from the shared Chongqing details/roof work.
export function buildChongqingHotpotPaving({THREE,scene,pbr,shopX,shopZ,shopFloor}) {
  if(![shopX,shopZ,shopFloor].every(Number.isFinite))
    throw new RangeError('Hotpot paving requires a finite existing shop floor');
  const left=shopX-35.4,right=shopX+35.4;
  const startZ=shopZ+25.25;
  const rowPitch=2.37, columnPitch=(right-left)/18;
  const unit=new THREE.BoxGeometry(1,1,1);
  const dummy=new THREE.Object3D();
  const stone=pbr?.stone?.clone?.() ??
    new THREE.MeshStandardMaterial({color:0xa8a6a1,roughness:.96});
  // Preserve the CC0 PBR normal/roughness layers when available; instance
  // colors only vary the weathered stone's tint between neighboring courses.
  stone.roughness=.95;stone.metalness=0;
  const pavers=[];
  for(let row=0;row<5;row++){
    for(let col=0;col<=(row%2?18:17);col++){
      const center=left+(col+(row%2?0:.5))*columnPitch;
      const a=Math.max(left,center-columnPitch*.5);
      const b=Math.min(right,center+columnPitch*.5);
      if(b-a<.6)continue;
      // Small, reproducible chip widths and shade variance; each edge stays
      // inside the existing slab. No raised step or altered collision surface.
      const weather=((row*37+col*19+11)%7)-3;
      const breadth=b-a-.15-((row+col)%3)*.018;
      const depth=rowPitch-.145-(Math.abs(weather)*.013);
      const palette=[0xc0c3be,0xb7bab3,0xc5c4bb,0xadb3af,
        0xc1b9b1,0xb0bab7,0xbfc1b8];
      pavers.push({
        x:(a+b)*.5,y:shopFloor+.741,z:startZ+row*rowPitch+rowPitch*.5,
        width:breadth,height:.081,depth,color:palette[(row*3+col*5)%7]
      });
    }
  }
  const tiles=new THREE.InstancedMesh(unit,stone,pavers.length);
  tiles.name='hotpot-forecourt-cut-stone-courses';
  tiles.count=pavers.length;
  tiles.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  for(let i=0;i<pavers.length;i++){
    const p=pavers[i];
    dummy.position.set(p.x,p.y,p.z);
    dummy.scale.set(p.width,p.height,p.depth);
    dummy.rotation.set(0,0,0);
    dummy.updateMatrix();
    tiles.setMatrixAt(i,dummy.matrix);
    tiles.setColorAt(i,new THREE.Color(p.color));
  }
  tiles.instanceMatrix.needsUpdate=true;
  tiles.instanceColor.needsUpdate=true;
  tiles.receiveShadow=true;
  scene.add(tiles);

  // Narrow slotted storm-drain immediately before the uphill footpath.
  // Inset inside the existing slab; metal bars stay below paver tops.
  const bars=[];
  const count=40,span=68.4;
  for(let i=0;i<count;i++){
    bars.push({x:shopX-span*.5+(i+.5)*span/count,
      y:shopFloor+.733,z:shopZ+37.82,
      width:span/count-.13,height:.026,depth:.33});
  }
  const grate=new THREE.InstancedMesh(unit,
    new THREE.MeshStandardMaterial({color:0x383f42,roughness:.70,metalness:.38}),bars.length);
  grate.name='hotpot-forecourt-storm-drain';
  grate.count=bars.length;
  grate.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  for(let i=0;i<bars.length;i++){
    const b=bars[i];
    dummy.position.set(b.x,b.y,b.z);dummy.scale.set(b.width,b.height,b.depth);
    dummy.rotation.set(0,0,0);dummy.updateMatrix();
    grate.setMatrixAt(i,dummy.matrix);
  }
  grate.instanceMatrix.needsUpdate=true;
  grate.receiveShadow=true;
  scene.add(grate);
  return {tiles,grate,stoneCount:pavers.length,drainBarCount:bars.length,
    drawCalls:2,triangleBudget:(pavers.length+bars.length)*12,
    left,right,front:startZ,back:shopZ+38.1};
}
