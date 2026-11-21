// NYC OTI derived bounded midrange building envelope prototype.
// Visual-only; not a survey or gameplay/collision replacement.
// Individual setback positions, windows, parapets are authored approximations.
const SURFACE={masonry:6,glass:7,roof:8};
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1]},0)*.5;
function validRing(r){return r.length>=3&&r.length<=80&&r.every(p=>p.length===2&&p.every(Number.isFinite))&&Math.abs(area(r))>.01}
function convex(r){const sign=Math.sign(area(r));return r.every((p,i)=>cross(p,r[(i+1)%r.length],r[(i+2)%r.length])*sign>=-1e-6)}
function triangulate(r,addTri,y,color){ // Ear clipping for non-convex footprints.
 const p=area(r)>0?r:r.slice().reverse(),ix=p.map((_,i)=>i);
 let count=0;
 for(let guard=0;ix.length>3&&guard<r.length*r.length;guard++){
  let found=false;
  for(let i=0;i<ix.length;i++){
   const ia=ix[(i+ix.length-1)%ix.length],ib=ix[i],ic=ix[(i+1)%ix.length];
   const a=p[ia],b=p[ib],c=p[ic];
   if(cross(a,b,c)<=1e-7)continue;
   if(ix.some(j=>j!==ia&&j!==ib&&j!==ic&&
    cross(a,b,p[j])>=-1e-7&&cross(b,c,p[j])>=-1e-7&&cross(c,a,p[j])>=-1e-7))continue;
   addTri([a[0],y,a[1]],[c[0],y,c[1]],[b[0],y,b[1]],color,SURFACE.roof);
   ix.splice(i,1);found=true;count++;break;
  }
  if(!found)return {count,complete:false};
 }
 if(ix.length===3){const [a,b,c]=ix.map(i=>p[i]);
  addTri([a[0],y,a[1]],[c[0],y,c[1]],[b[0],y,b[1]],color,SURFACE.roof);count++;
 }
 return {count,complete:ix.length===3};
}
export function murrayHillSilhouettes(snapshot,emit,{origin=[-73.979,40.750],metersPerUnit=9.09}={}){
 if(snapshot?.schema!=='patrol-nyc-murray-hill-visual-only-v1'||snapshot.collision!==false||snapshot.viewOnly!==true)throw new TypeError('Not a visual-only NYC snapshot');
 if(!(metersPerUnit>0))throw new RangeError('Scale must be positive');
 const project=([lon,lat])=>[(lon-origin[0])*84200/metersPerUnit,(lat-origin[1])*111200/metersPerUnit];
 let count=0,tiers=0;
 for(const b of snapshot.buildings){
  if(b.roofHeightSource!=='HEIGHT_ROOF'||b.ring?.length<3||!Number.isFinite(b.heightFt)||b.heightFt<=0)continue;
  const ring=b.ring.map(project),h=Math.min(55,b.heightFt*.3048/metersPerUnit);
  if(h<1||!validRing(ring))continue;
  const topEligible=convex(ring)&&ring.length<=8&&h>=8;
  const cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length;
  const inset=topEligible?ring.map(([x,z])=>[cx+(x-cx)*.83,cz+(z-cz)*.83]):null;
  emit({kind:'footprint',id:b.id,ring,height:topEligible?h*.82:h});
  if(inset){emit({kind:'approximate-inset-terrace',id:b.id,ring:inset,height:h,baseHeight:h*.82,source:'authored approximation'});tiers++}
  count++;
 }
 return {buildings:count,approximateRoofTiers:tiers,visualOnly:true};
}
export function buildMurrayHillVisualMesh(snapshot,{addQuad,addTri},{origin=[-73.979,40.750],metersPerUnit=9.09,ground=14.58,maxBuildings=80,maxFacadeQuads=2800}={}){
 if(typeof addQuad!=='function'||typeof addTri!=='function')throw new TypeError('Geometry callbacks required');
 if(!Number.isFinite(ground))throw new RangeError('Ground must be finite');
 const mesh={buildings:0,roofTriangles:0,facadeQuads:0,windowQuads:0,approximateTerraces:0,visualOnly:true};
 const mat=[[.52,.50,.47],[.41,.46,.48],[.57,.51,.45],[.47,.42,.40]],glass=[.17,.27,.32],roof=[.38,.39,.39];
 const quad=(a,b,c,d,col,surface)=>{addQuad(a,b,c,d,col,surface);mesh.facadeQuads++};
 const wall=(ring,y0,y1,id,decorate)=>{
  const color=mat[id%mat.length];
  ring=area(ring)>0?ring:ring.slice().reverse();
  for(let k=0;k<ring.length;k++){
   const p=ring[k],q=ring[(k+1)%ring.length],len=Math.hypot(p[0]-q[0],p[1]-q[1]);
   if(len<.10)continue;
   quad([q[0],y0,q[1]],[p[0],y0,p[1]],[p[0],y1,p[1]],[q[0],y1,q[1]],color,SURFACE.masonry);
   if(!decorate||mesh.facadeQuads>maxFacadeQuads-20||len<2.5||y1-y0<4)continue;
   const bays=Math.min(5,Math.floor(len/2.4)),floors=Math.min(8,Math.floor((y1-y0-1.1)/2.5));
   for(let f=0;f<floors;f++)for(let j=0;j<bays;j++){
    if(mesh.facadeQuads>=maxFacadeQuads)break;
    const u=(j+.27)/bays,v=(j+.73)/bays,wy=y0+1.4+f*2.5,ty=Math.min(y1-.38,wy+1.12);
    if(ty<=wy)continue;
    const nx=(q[1]-p[1])/len*.026,nz=-(q[0]-p[0])/len*.026;
    const point=(t,y)=>[p[0]+(q[0]-p[0])*t+nx,y,p[1]+(q[1]-p[1])*t+nz];
    quad(point(u,wy),point(v,wy),point(v,ty),point(u,ty),glass,SURFACE.glass);
    mesh.windowQuads++;
   }
  }
 };
 murrayHillSilhouettes(snapshot,shape=>{
  if(shape.kind==='footprint'){
   if(mesh.buildings>=maxBuildings)return;
   const y=ground+shape.height;
   wall(shape.ring,ground,y,shape.id,true);
   const result=triangulate(shape.ring,addTri,y,roof);
   mesh.roofTriangles+=result.count;mesh.buildings++;
  }else if(shape.kind==='approximate-inset-terrace'&&mesh.buildings<=maxBuildings){
   const bottom=ground+shape.baseHeight,top=ground+shape.height;
   wall(shape.ring,bottom,top,shape.id,false);
   mesh.roofTriangles+=triangulate(shape.ring,addTri,top,roof).count;
   mesh.approximateTerraces++;
  }
 },{origin,metersPerUnit});
 return mesh;
}
