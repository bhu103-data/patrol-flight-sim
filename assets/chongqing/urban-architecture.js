// PATROL_CHONGQING_HERO_ARCH_V2 — authored WebGL2/Three.js building geometry.
// Landmark corridors retain existing authored models. No Google photogrammetry.
// Styles represent distinct Chongqing slab residential, office and mixed-use massing.
import {roadReserveAtSite} from './road-clearance.js';

export const CHONGQING_BUILDING_STYLES=[
  {name:'residential-terrace',bevel:.018,material:'residentialFacade',
    layers:[[-.5,1,1],[.25,1,1],[.25,.94,.93],[.46,.94,.93],[.46,.86,.84],[.5,.86,.84]]},
  {name:'office-glass',bevel:.16,material:'curtainWall',
    layers:[[-.5,1,1],[.34,1,1],[.34,.94,.94],[.47,.94,.94],[.5,.92,.91]]},
  {name:'mixed-step-tower',bevel:.06,material:'commercialFacade',
    layers:[[-.5,1,1],[-.28,1,1],[-.28,.88,.94],[.20,.88,.94],
      [.20,.72,.81],[.45,.72,.81],[.45,.65,.72],[.5,.65,.72]]},
  {name:'riverfront-midrise',bevel:.035,material:'residentialFacade',
    layers:[[-.5,1,1],[.05,1,1],[.05,.96,.95],[.40,.96,.95],
      [.40,.91,.9],[.5,.91,.9]]},
  {name:'slender-skyscraper',bevel:.115,material:'curtainWall',
    layers:[[-.5,1,1],[.31,1,1],[.31,.85,.84],[.47,.85,.84],[.5,.77,.76]]}
];
function ring(w,d,bevel) {
 const bx=Math.min(bevel,w*.49),bz=Math.min(bevel,d*.49);
 return [[-w,-d+bz],[-w,d-bz],[-w+bx,d],
  [w-bx,d],[w,d-bz],[w,-d+bz],[w-bx,-d],[-w+bx,-d]];
}
export function makeChongqingTowerProfile(style){
 if(!style||!Array.isArray(style.layers)||style.layers.length<2)throw Error('Missing architectural layers');
 const positions=[],uvs=[],normals=[],indices=[];
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
       k*.42,(y0+.5)*3.25,(k+1)*.42,(y1+.5)*3.25);
   }
 }
 const top=style.layers[style.layers.length-1],perimeter=ring(top[1]*.5,top[2]*.5,style.bevel*.5);
 for(let k=0;k<8;k++){
   // Clockwise in XZ yields upwards on top when reversing winding.
   const a=perimeter[k],b=perimeter[(k+1)%8],c=[0,0];
   const i=positions.length/3;
   positions.push(0,top[0],0,a[0],top[0],a[1],b[0],top[0],b[1]);
   uvs.push(.5,.5,a[0]+.5,a[1]+.5,b[0]+.5,b[1]+.5);
   // XZ ring has outward-facing walls; fan center->edge->next points +Y.
   indices.push(i,i+1,i+2);
 }
 if(positions.some(x=>!Number.isFinite(x))||indices.some(x=>x<0||x>=positions.length/3))
   throw Error('Bad tower profile geometry');
 return {positions,uvs,indices};
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
 const windows=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),
   new THREE.MeshBasicMaterial({color:0xffe6b5,side:THREE.DoubleSide,
     transparent:true,opacity:.68,depthWrite:false}),4800);
 const stats={towers:0,balconies:0,airConditioners:0,rooftops:0,litWindows:0,
   residential:0,office:0,mixedUse:0,skippedRoadOverlap:0,skippedBridgeOverlap:0,skippedAdjacentBuilding:0};
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
 function tower(x,z,w,dz,h,styleIndex,colIndex){
   const style=styleMeshes[styleIndex],base=ground(x,z),n=style.count;
   if(n>=100)return;
   set(style,n,x,base+h*.5,z,w,h,dz);
   const variants=colors[styleIndex],tint=variants[colIndex%variants.length];
   style.setColorAt(n,color.set(tint));
   style.count++;stats.towers++;
   if(styleIndex===0||styleIndex===3)stats.residential++;
   else if(styleIndex===1||styleIndex===4)stats.office++;
   else stats.mixedUse++;
   obstacles.push({x,z,w:w+2,d:dz+2,base,top:base+h});
   // Roof ledge, mechanical bulkheads and rooftop chillers break flat silhouettes.
   if(stats.rooftops<360){
     set(roof,stats.rooftops++,x+(colIndex%3-1)*w*.18,base+h+.46,z,
       w*.20,.92,dz*.18);
   }
   const units=styleIndex===0||styleIndex===3?6:styleIndex===2?3:0;
   for(let i=0;i<units;i++){
     const yy=base+h*(.19+i*.105),xx=x+((i%3)-1)*w*.26;
     if(stats.balconies<2200){
       set(balconies,stats.balconies++,xx,yy,z+dz*.50+.67,
         w*.21,.10,1.42);
     }
     if(i%2===0&&stats.airConditioners<900){
       set(acs,stats.airConditioners++,x+w*.50+.24,yy-.44,
         z+dz*(i%3-1)*.22,.54,.47,.70);
     }
   }
   // Irregular interior lighting, not a complete repeated matrix on every tower.
   const floorCount=Math.max(6,Math.min(26,Math.round(h/7.3)));
   const windowCols=Math.max(2,Math.min(7,Math.round(w/5.5)));
   for(let row=1;row<floorCount-1;row+=2)for(let col=0;col<windowCols;col++){
     if(rand()>.31||stats.litWindows>=4800)continue;
     const xx=x-w*.5+(col+.5)*w/windowCols,
       yy=base+(row+.45)*h/floorCount;
     set(windows,stats.litWindows,xx,yy,z+dz*.5+.075,
       Math.max(.78,w/windowCols*.40),Math.max(.55,h/floorCount*.40),1);
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
     // Match the +2-unit actual collision box, not the smaller facade dimensions.
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
     const styleIndex=(Math.abs(col*11+tier*7+side*13)%5);
     tower(x,z,w,d,h,styleIndex,col+tier*3);
   }
 }
 for(const mesh of styleMeshes){
   mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   if(mesh.count>0)mesh.computeBoundingSphere();
 }
 for(const [mesh,n] of [[roof,stats.rooftops],[balconies,stats.balconies],
   [acs,stats.airConditioners],[windows,stats.litWindows]]){
   mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   if(n>0)mesh.computeBoundingSphere();
   scene.add(mesh);
 }
 return {stats,setQuality(mode){
   const low=mode==='low';balconies.visible=!low;acs.visible=!low;
   windows.visible=!low;
 }};
}
