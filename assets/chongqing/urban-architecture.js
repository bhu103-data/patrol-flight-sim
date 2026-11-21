// PATROL_CHONGQING_HERO_ARCH_V2 — authored WebGL2/Three.js building geometry.
// Landmark corridors retain existing authored models. No Google photogrammetry.
// Styles represent distinct Chongqing slab residential, office and mixed-use massing.
import {roadReserveAtSite} from './road-clearance.js';

export const CHONGQING_BUILDING_STYLES=[
  {name:'residential-terrace',bevel:.018,facadeFloors:24,material:'residentialFacade',
    layers:[[-.5,1,1],[.25,1,1],[.25,.94,.93],[.46,.94,.93],[.46,.86,.84],[.5,.86,.84]]},
  {name:'office-glass',bevel:.16,facadeFloors:42,material:'curtainWall',
    layers:[[-.5,1,1],[.34,1,1],[.34,.94,.94],[.47,.94,.94],[.5,.92,.91]]},
  {name:'mixed-step-tower',bevel:.06,facadeFloors:32,material:'commercialFacade',
    layers:[[-.5,1,1],[-.28,1,1],[-.28,.88,.94],[.20,.88,.94],
      [.20,.72,.81],[.45,.72,.81],[.45,.65,.72],[.5,.65,.72]]},
  {name:'riverfront-midrise',bevel:.035,facadeFloors:18,material:'residentialFacade',
    layers:[[-.5,1,1],[.05,1,1],[.05,.96,.95],[.40,.96,.95],
      [.40,.91,.9],[.5,.91,.9]]},
  {name:'slender-skyscraper',bevel:.115,facadeFloors:48,material:'curtainWall',
    layers:[[-.5,1,1],[.31,1,1],[.31,.85,.84],[.47,.85,.84],[.5,.77,.76]]}
];
function ring(w,d,bevel) {
 const bx=Math.min(bevel,w*.49),bz=Math.min(bevel,d*.49);
 return [[-w,-d+bz],[-w,d-bz],[-w+bx,d],
  [w-bx,d],[w,d-bz],[w,-d+bz],[w-bx,-d],[-w+bx,-d]];
}
// Physical facade envelope at an exact normalized height. Used by all
// attachments so they follow stepped building tiers, not the base box.
export function chongqingTowerEnvelopeAt(style,level){
 if(!style||!Array.isArray(style.layers)||style.layers.length<2)
   throw Error('Missing architectural layers');
 const layers=style.layers;
 const y=Math.max(layers[0][0],Math.min(layers[layers.length-1][0],level));
 for(let i=1;i<layers.length;i++){
   const a=layers[i-1],b=layers[i];
   // Reconstructed world-space height can land 1e-16 below a repeated
   // terrace boundary. Snap both paths to the UPPER facade at the ledge.
   if(y>=b[0]-1e-8&&i<layers.length-1)continue;
   const delta=b[0]-a[0];
   const t=delta>1e-9?Math.max(0,Math.min(1,(y-a[0])/delta)):1;
   return {width:a[1]+(b[1]-a[1])*t,depth:a[2]+(b[2]-a[2])*t};
 }
 const end=layers[layers.length-1];return {width:end[1],depth:end[2]};
}
export function makeChongqingTowerProfile(style){
 if(!style||!Array.isArray(style.layers)||style.layers.length<2)throw Error('Missing architectural layers');
 const positions=[],uvs=[],normals=[],indices=[];
 const verticalTiles=Math.max(1,Math.min(3.5,(style.facadeFloors??32)/16));
 const push=(a,b,c,d,u0,v0,u1,v1)=>{
   const first=positions.length/3;
   positions.push(...a,...b,...c,...d);
   uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);
   indices.push(first,first+1,first+2,first,first+2,first+3);
 };
 for(let level=0;level<style.layers.length-1;level++){
   const [y0,w0,d0]=style.layers[level], [y1,w1,d1]=style.layers[level+1];
   const low=ring(w0*.5,d0*.5,style.bevel*.5);
   const high=ring(w1*.5,d1*.5,style.bevel*.5);
   for(let k=0;k<8;k++){
     const next=(k+1)%8;
     // UVs repeat the facade atlas vertically: window rhythm remains visible
     // across a 50-200m game-scale tower without separate window draw calls.
     push([low[k][0],y0,low[k][1]],[low[next][0],y0,low[next][1]],
       [high[next][0],y1,high[next][1]],[high[k][0],y1,high[k][1]],
       k*.42,(y0+.5)*verticalTiles,(k+1)*.42,(y1+.5)*verticalTiles);
   }
 }
 const top=style.layers[style.layers.length-1],perimeter=ring(top[1]*.5,top[2]*.5,style.bevel*.5);
 for(let k=0;k<8;k++){
   // Clockwise in XZ yields upwards on top when reversing winding.
   const a=perimeter[k],b=perimeter[(k+1)%8],c=[0,0];
   const i=positions.length/3;
   positions.push(0,top[0],0,a[0],top[0],a[1],b[0],top[0],b[1]);
   uvs.push(.04,.04,.04,.04,.04,.04);
   // XZ ring has outward-facing walls; fan center->edge->next points +Y.
   indices.push(i,i+1,i+2);
 }
 if(positions.some(x=>!Number.isFinite(x))||indices.some(x=>x<0||x>=positions.length/3))
   throw Error('Bad tower profile geometry');
 return {positions,uvs,indices};
}
// Survey a full 5x5 terrain patch before placing a hillside tower. A center
// height alone can float an entire high-rise across a 30m Chongqing cliff.
// Four hard-edged aluminum rails form a REAL opening, not a solid dark
// rectangle behind glass. One shared geometry draws every scenic window
// through an instanced batch; none of the distant tower shells are expanded.
export function makeChongqingWindowFrameGeometry(THREE){
 const vertices=[],indices=[],edge=.085;
 const rails=[
   [0,(1-edge)*.5,1,edge,1],
   [0,-(1-edge)*.5,1,edge,1],
   [-(1-edge)*.5,0,edge,1-2*edge,1],
   [(1-edge)*.5,0,edge,1-2*edge,1]
 ];
 const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],
   [3,7,6,2],[0,4,7,3],[1,2,6,5]];
 for(const [cx,cy,w,h,d] of rails){
   const pts=[
     [cx-w*.5,cy-h*.5,-d*.5],[cx+w*.5,cy-h*.5,-d*.5],
     [cx+w*.5,cy+h*.5,-d*.5],[cx-w*.5,cy+h*.5,-d*.5],
     [cx-w*.5,cy-h*.5,d*.5],[cx+w*.5,cy-h*.5,d*.5],
     [cx+w*.5,cy+h*.5,d*.5],[cx-w*.5,cy+h*.5,d*.5]
   ];
   for(const face of faces){
     const first=vertices.length/3;
     for(const corner of face)vertices.push(...pts[corner]);
     indices.push(first,first+1,first+2,first,first+2,first+3);
   }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();
 return geometry;
}

export function surveyChongqingBuildingPad({x,z,w,d,ground,riverDist,maxGrade=10}){
 if(![x,z,w,d,maxGrade].every(Number.isFinite)||w<=0||d<=0||
    typeof ground!=='function'||typeof riverDist!=='function')return null;
 let minGround=Infinity,maxGround=-Infinity;
 for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++){
   const px=x+w*ix/4,pz=z+d*iz/4;
   const h=ground(px,pz),shore=riverDist(px,pz);
   if(!Number.isFinite(h)||Number.isNaN(shore)||shore<5||h<=0)
     return null;
   minGround=Math.min(minGround,h);maxGround=Math.max(maxGround,h);
 }
 const grade=maxGround-minGround;
 if(grade>maxGrade)return null;
 const boundary=[[-.5,-.5],[0,-.5],[.5,-.5],[.5,0],
   [.5,.5],[0,.5],[-.5,.5],[-.5,0]];
 const perimeter=boundary.map(([u,v])=>{
   const px=x+w*u,pz=z+d*v;
   return [px,ground(px,pz),pz];
 });
 return {base:maxGround+.24,minGround,maxGround,grade,perimeter};
}
export function createChongqingUrbanArchitecture({THREE,scene,ground,riverDist,riverCenter,rand,obstacles,pbr,plannedRoads=[]}){
 const styleMeshes=CHONGQING_BUILDING_STYLES.map((style)=>{
   const geo=makeChongqingTowerProfile(style),geometry=new THREE.BufferGeometry();
   geometry.setAttribute('position',new THREE.Float32BufferAttribute(geo.positions,3));
   geometry.setAttribute('uv',new THREE.Float32BufferAttribute(geo.uvs,2));
   geometry.setIndex(geo.indices);geometry.computeVertexNormals();
   const fallback=new THREE.MeshStandardMaterial({color:0xc2c4c1,roughness:.81});
   const mesh=new THREE.InstancedMesh(geometry,pbr?.[style.material]||fallback,100);
   mesh.count=0;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
   mesh.castShadow=false;mesh.receiveShadow=true;
   scene.add(mesh);return mesh;
 });
 const unit=new THREE.BoxGeometry(1,1,1),d=new THREE.Object3D();
 const roofMat=new THREE.MeshStandardMaterial({color:0x747d80,metalness:.42,roughness:.61});
 const balconyMat=new THREE.MeshStandardMaterial({color:0x8b9593,metalness:.17,roughness:.73});
 const acMat=new THREE.MeshStandardMaterial({color:0xd0d1cb,metalness:.39,roughness:.55});
 const roof=new THREE.InstancedMesh(unit,roofMat,360);
 const balconies=new THREE.InstancedMesh(unit,balconyMat,2200);
 const acs=new THREE.InstancedMesh(unit,acMat,900);
 // PATROL_CQ_ADAPTIVE_LIGHTING_V5: glazing stays in the PBR atlas.
 // Sparse interior lights disappear by day to avoid unrealistic glow
 // and cut one transparent draw of thousands of windows.
 const interiorLightMaterial=new THREE.MeshBasicMaterial({
   color:0xffe6b5,side:THREE.DoubleSide,
   transparent:true,opacity:.38,depthWrite:false
 });
 const windows=new THREE.InstancedMesh(
   new THREE.PlaneGeometry(1,1),interiorLightMaterial,4800);
 // Real-depth riverfront facade details reuse five GPU batches across the
 // 44 closest buildings. Building shells/PBR atlases remain the primary mass;
 // these windows have separate dark reveals, reflective glass, mullions and
 // stone sill projections rather than billboard-like painted squares.
 const facadeCap=3200;
 const facadeFrameMat=new THREE.MeshStandardMaterial({
   color:0x26343a,metalness:.23,roughness:.53
 });
 const facadeGlassMat=new THREE.MeshStandardMaterial({
   color:0x527181,metalness:.27,roughness:.25,side:THREE.DoubleSide
 });
 const sillMat=new THREE.MeshStandardMaterial({
   color:0xb2b1aa,metalness:.05,roughness:.83
 });
 const awningMat=new THREE.MeshStandardMaterial({
   color:0x48565a,metalness:.15,roughness:.7
 });
 const facadeFrames=new THREE.InstancedMesh(
   makeChongqingWindowFrameGeometry(THREE),facadeFrameMat,facadeCap);
 const facadeGlazing=new THREE.InstancedMesh(
   new THREE.PlaneGeometry(1,1),facadeGlassMat,facadeCap);
 const facadeMullions=new THREE.InstancedMesh(unit,facadeFrameMat,facadeCap);
 const facadeSills=new THREE.InstancedMesh(unit,sillMat,facadeCap);
 const shopGlazing=new THREE.InstancedMesh(
   new THREE.PlaneGeometry(1,1),facadeGlassMat,32);
 const shopAwnings=new THREE.InstancedMesh(unit,awningMat,32);
 for(const mesh of [facadeFrames,facadeGlazing,facadeMullions,
   facadeSills,shopGlazing,shopAwnings]){
   mesh.count=0;mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
   mesh.castShadow=false;mesh.receiveShadow=true;
 }
 const stats={facadeBuildings:0,facadePanels:0,storefronts:0,
   towers:0,balconies:0,airConditioners:0,rooftops:0,litWindows:0,
   residential:0,office:0,mixedUse:0,skippedRoadOverlap:0,skippedBridgeOverlap:0,
   skippedAdjacentBuilding:0,skippedUnbuildableTerrain:0,retainingWallTriangles:0,
   maxAcceptedGrade:0};
 // One shared slope-draped concrete retaining-wall mesh (no 200 separate draws).
 // Eight wall panels per building anchor to real corner and mid-edge terrain.
 const foundationPositions=[],foundationUvs=[],foundationIndices=[];
 function addFoundation(pad){
   const top=pad.base+.025,edge=pad.perimeter;
   for(let k=0;k<edge.length;k++){
     const a=edge[k],b=edge[(k+1)%edge.length];
     const first=foundationPositions.length/3;
     // Building perimeter is clockwise viewed from above; reverse winding
     // so the visible wall normals face OUT of the building.
     foundationPositions.push(
       b[0],b[1]-.35,b[2], a[0],a[1]-.35,a[2],
       a[0],top,a[2], b[0],top,b[2]);
     const length=Math.hypot(b[0]-a[0],b[2]-a[2]);
     foundationUvs.push(0,0,length/4,0,length/4,(top-a[1])/4,0,(top-b[1])/4);
     foundationIndices.push(first,first+1,first+2,first,first+2,first+3);
     stats.retainingWallTriangles+=2;
   }
 }
 const glassGlow=new THREE.Color(), color=new THREE.Color();
 const set=(mesh,index,x,y,z,w,h,depth,rot=0)=>{
   d.position.set(x,y,z);d.scale.set(w,h,depth);d.rotation.set(0,rot,0);
   d.updateMatrix();mesh.setMatrixAt(index,d.matrix);
 };
 const colors=[
   ['#d1c8bc','#b7b4a9','#c6c0b9'],
   ['#9fbdca','#a2b7c0','#b8c7ca'],
   ['#b0aa9d','#c4b7ae','#a7adaf'],
   ['#c9bdb3','#b8bebc','#d5c6b8'],
   ['#8ea9b5','#aec1c9','#c2ccd2']
 ];
 function tower(x,z,w,dz,h,styleIndex,colIndex,pad){
   const style=styleMeshes[styleIndex],
    profile=CHONGQING_BUILDING_STYLES[styleIndex],
    base=pad.base,n=style.count;
   if(n>=100)return;
   set(style,n,x,base+h*.5,z,w,h,dz);
   const variants=colors[styleIndex],tint=variants[colIndex%variants.length];
   style.setColorAt(n,color.set(tint));
   style.count++;stats.towers++;
   if(styleIndex===0||styleIndex===3)stats.residential++;
   else if(styleIndex===1||styleIndex===4)stats.office++;
   else stats.mixedUse++;
   // The collider extends down through the podium; an underpass may not
   // sneak through the visible retaining wall below the facade.
   obstacles.push({x,z,w:w+2,d:dz+2,base:pad.minGround-.35,
     top:base+h,padBase:base,grade:pad.grade});
   addFoundation(pad);
   stats.maxAcceptedGrade=Math.max(stats.maxAcceptedGrade,pad.grade);
   // Roof ledge, mechanical bulkheads and rooftop chillers break flat silhouettes.
   if(stats.rooftops<360){
     set(roof,stats.rooftops++,x+(colIndex%3-1)*w*.18,base+h+.46,z,
       w*.20,.92,dz*.18);
   }
   const units=styleIndex===0||styleIndex===3?6:styleIndex===2?3:0;
   for(let i=0;i<units;i++){
     const fraction=.19+i*.105,
       envelope=chongqingTowerEnvelopeAt(profile,fraction-.5),
       yy=base+h*fraction,
       xx=x+((i%3)-1)*w*.26*envelope.width;
     if(stats.balconies<2200){
       set(balconies,stats.balconies++,xx,yy,
         z+dz*.50*envelope.depth+.67,
         w*.21*envelope.width,.10,1.42);
     }
     if(i%2===0&&stats.airConditioners<900){
       set(acs,stats.airConditioners++,
         x+w*.50*envelope.width+.24,yy-.44,
         z+dz*envelope.depth*(i%3-1)*.22,.54,.47,.70);
     }
   }
   // Geometry-backed close-range windows face the river on BOTH banks.
   // Respect setbacks at every storey; do not float frames off a narrower
   // upper tier or spill their projections into the reserved street corridor.
   const scenic=Math.hypot(x-285,z-225)<580;
   const face=z>=riverCenter(x)?-1:1;
   if(scenic&&h>=44&&stats.facadeBuildings<44){
     stats.facadeBuildings++;
     const rows=Math.min(16,Math.max(7,Math.floor(h/7.2)));
     const cols=styleIndex===1||styleIndex===4?4:3;
     for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
       if(stats.facadePanels>=facadeCap)break;
       const fraction=.066+(row+.46)*.82/rows;
       const envelope=chongqingTowerEnvelopeAt(profile,fraction-.5);
       const frontage=w*envelope.width*.78;
       const xx=x-frontage*.5+(col+.5)*frontage/cols;
       const yy=base+h*fraction;
       const span=frontage/cols;
       const paneWidth=Math.min(2.95,span*.71);
       const paneHeight=Math.min(2.45,Math.max(1.35,h/rows*.31));
       const front=z+face*dz*envelope.depth*.5;
       const id=stats.facadePanels++;
       // Metal reveal surrounds a true opening; glazing is recessed
       // behind its front face instead of sitting over a painted box.
       set(facadeFrames,id,xx,yy,front+face*.205,
         paneWidth+.27,paneHeight+.32,.16);
       set(facadeGlazing,id,xx,yy,front+face*.153,
         paneWidth,paneHeight,1,face>0?0:Math.PI);
       set(facadeMullions,id,xx,yy,front+face*.245,
         .065,paneHeight+.05,.085);
       set(facadeSills,id,xx,yy-paneHeight*.5-.19,front+face*.30,
         paneWidth+.47,.11,.46);
     }
     // Ground-floor cafe/shop windows and restrained metal canopies only on
     // gently graded pads. Avoid the visibly floating storefront illusion on
     // steep retaining walls where actual footpaths are several floors below.
     if((styleIndex===2||styleIndex===3)&&pad.grade<2.8&&
         stats.storefronts<32){
       const id=stats.storefronts++,low=chongqingTowerEnvelopeAt(profile,-.47),
         front=z+face*(dz*low.depth*.5+.18);
       set(shopGlazing,id,x,base+2.25,front,
         w*low.width*.53,3.15,1,face>0?0:Math.PI);
       set(shopAwnings,id,x,base+4.14,front+face*.78,
         w*low.width*.58,.23,1.45);
     }
   }
   // Irregular interior lighting, not a complete repeated matrix on every tower.
   const floorCount=Math.max(8,Math.min(72,Math.round(h/3.5)));
   const windowCols=Math.max(2,Math.min(7,Math.round(w/5.5)));
   for(let row=1;row<floorCount-1;row+=3)for(let col=0;col<windowCols;col++){
     if(rand()>.31||stats.litWindows>=4800)continue;
     const frac=(row+.45)/floorCount,
       envelope=chongqingTowerEnvelopeAt(profile,frac-.5),
       frontage=w*envelope.width,
       xx=x-frontage*.5+(col+.5)*frontage/windowCols,
       yy=base+frac*h;
     set(windows,stats.litWindows,xx,yy,
       z+dz*envelope.depth*.5+.075,
       Math.max(.66,frontage/windowCols*.42),
       Math.max(.46,h/floorCount*.42),1);
     windows.setColorAt(stats.litWindows,glassGlow.set(rand()>.33?'#e2d2b1':'#7a9aa5'));
     stats.litWindows++;
   }
 }
 for(const side of [-1,1])for(let tier=0;tier<5;tier++){
   for(let col=0;col<34&&stats.towers<340;col++){
     const offset=(rand()-.5)*15,x=-948+col*57.8+offset;
     const bankDistance=180+tier*102+(rand()-.5)*15;
     const z=riverCenter(x)+side*bankDistance;
     if(z<-603||z>603||x<-950||x>950||riverDist(x,z)<28)continue;
     if(Math.hypot(x-285,z-225)<112||Math.hypot(x-160,z-150)<175)continue;
     if(Math.abs(x+355)<220&&Math.abs(z-176)<106)continue;
     if(Math.abs(x+121)<85&&Math.abs(z+254)<78)continue;
     if(Math.abs(x+135)<58&&Math.abs(z-335)<60)continue;
     const w=18+rand()*22,d=17+rand()*23;
     const business=x>-525&&x<590&&tier<4;
     const heightBand=business?76:38;
     const h=(heightBand+rand()*(business?165:76))*(rand()<.20?.52:1);
     // Reject the entire footprint, not just the center. A building cannot
     // extend into an asphalt ribbon, the bridge deck, or the next tower.
     // Preserve road-free collision footprint including 2-unit facade clearance.
     const site={x,z,w:w+2,d:d+2};
     if(roadReserveAtSite(site,plannedRoads,0,2.2)){
       stats.skippedRoadOverlap++;continue;
     }
     if([40,470].some(bx=>Math.abs(x-bx)<(w+2+17)*.5+2.5&&
       Math.abs(z)<(d+2+335)*.5+2.5)){
       stats.skippedBridgeOverlap++;continue;
     }
     if(obstacles.some(o=>Math.abs(x-o.x)<(w+o.w)*.5+2.0&&
       Math.abs(z-o.z)<(d+o.d)*.5+2.0)){
       stats.skippedAdjacentBuilding++;continue;
     }
     const pad=surveyChongqingBuildingPad({
       x,z,w,d,ground,riverDist,maxGrade:10
     });
     if(!pad){stats.skippedUnbuildableTerrain++;continue;}
     const styleIndex=(Math.abs(col*11+tier*7+side*13)%5);
     tower(x,z,w,d,h,styleIndex,col+tier*3,pad);
   }
 }
 if(foundationPositions.length){
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(foundationPositions,3));
   geo.setAttribute('uv',new THREE.Float32BufferAttribute(foundationUvs,2));
   geo.setIndex(foundationIndices);geo.computeVertexNormals();
   const material=pbr?.concrete||new THREE.MeshStandardMaterial({
     color:0x9fa19b,roughness:.88,metalness:0
   });
   const foundations=new THREE.Mesh(geo,material);
   foundations.castShadow=false;foundations.receiveShadow=true;
   scene.add(foundations);
 }
 for(const mesh of styleMeshes){
   mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   if(mesh.count>0)mesh.computeBoundingSphere();
 }
 for(const [mesh,n] of [[roof,stats.rooftops],[balconies,stats.balconies],
   [acs,stats.airConditioners],[windows,stats.litWindows],
   [facadeFrames,stats.facadePanels],[facadeGlazing,stats.facadePanels],
   [facadeMullions,stats.facadePanels],[facadeSills,stats.facadePanels],
   [shopGlazing,stats.storefronts],[shopAwnings,stats.storefronts]]){
   mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   if(n>0)mesh.computeBoundingSphere();
   scene.add(mesh);
 }
 let lowDetail=false,timeOfDay='dusk';
 function updateInteriorLight(){
   windows.visible=!lowDetail&&timeOfDay!=='day';
   interiorLightMaterial.opacity=timeOfDay==='night'?.76:.38;
 }
 updateInteriorLight();
 return {stats,
   setTimeOfDay(preset){
     timeOfDay=['day','dusk','night'].includes(preset)?preset:'dusk';
     updateInteriorLight();
   },
   setQuality(mode){
     lowDetail=mode==='low';
     balconies.visible=!lowDetail;
     acs.visible=!lowDetail;
     // Preserve full solid building envelopes in low mode; omit only the
     // small close-up trim batches that are not needed from a distant aircraft.
     facadeFrames.visible=!lowDetail;
     // Glazing itself stays visible in economy mode; the LOD drops only
     // close-up physical trim, never windows from the facade silhouette.
     facadeGlazing.visible=true;
     shopGlazing.visible=true;
     facadeMullions.visible=!lowDetail;
     facadeSills.visible=!lowDetail;
     shopAwnings.visible=!lowDetail;
     updateInteriorLight();
   }
 };
}
