/* The actual WGS84/ECEF/ENU frame for a source-derived DUMBO building pilot.
 * World axes: +X east, +Y up, +Z north. Metres without fictional scaling.
 * NYC OTI HEIGHT_ROOF is a height ABOVE LOCAL GROUND, not a roof altitude.
 * This module never modifies PATROL's main scene, roads, collision, or flight.
 */
const WGS84_A=6378137;
const WGS84_F=1/298.257223563;
const WGS84_E2=WGS84_F*(2-WGS84_F);
const R=Math.PI/180;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

export function wgs84Ecef(longitude,latitude,ellipsoidHeightMetres=0){
  if(![longitude,latitude,ellipsoidHeightMetres].every(finite)||
     longitude<-180||longitude>180||latitude<-90||latitude>90)
    throw new RangeError('Invalid WGS84 coordinate');
  const lam=longitude*R,phi=latitude*R;
  const sn=Math.sin(phi),cs=Math.cos(phi),cl=Math.cos(lam),sl=Math.sin(lam);
  const n=WGS84_A/Math.sqrt(1-WGS84_E2*sn*sn);
  return [(n+ellipsoidHeightMetres)*cs*cl,
    (n+ellipsoidHeightMetres)*cs*sl,
    (n*(1-WGS84_E2)+ellipsoidHeightMetres)*sn];
}
export function makeDumboMetreFrame(origin){
  if(!origin||!finite(origin.longitude)||!finite(origin.latitude)||
      !finite(origin.ellipsoidHeightMetres))
    throw new TypeError('Explicit WGS84 origin required');
  const [lon,lat,h]=[origin.longitude,origin.latitude,
    origin.ellipsoidHeightMetres];
  const p0=wgs84Ecef(lon,lat,h);
  const cl=Math.cos(lon*R),sl=Math.sin(lon*R),
    cp=Math.cos(lat*R),sp=Math.sin(lat*R);
  const east=[-sl,cl,0];
  const north=[-sp*cl,-sp*sl,cp];
  const up=[cp*cl,cp*sl,sp];
  return {
    origin:{...origin},
    project(lon2,lat2,height=0){
      const p=wgs84Ecef(lon2,lat2,height),
        d=p.map((v,i)=>v-p0[i]);
      return [dot(east,d),dot(up,d),dot(north,d)];
    },
    // For an exact source-space metadata round trip; never a game placement.
    unproject(x,y,z){
      if(![x,y,z].every(finite))throw new RangeError('Nonfinite ENU');
      const p=p0.map((v,i)=>v+east[i]*x+up[i]*y+north[i]*z);
      const lam=Math.atan2(p[1],p[0]),q=Math.hypot(p[0],p[1]);
      let phi=Math.atan2(p[2],q*(1-WGS84_E2));
      for(let i=0;i<8;i++){
        const sn=Math.sin(phi),n=WGS84_A/
          Math.sqrt(1-WGS84_E2*sn*sn);
        const hh=q/Math.cos(phi)-n;
        phi=Math.atan2(p[2],
          q*(1-WGS84_E2*n/(n+hh)));
      }
      const n=WGS84_A/Math.sqrt(1-WGS84_E2*Math.sin(phi)**2);
      return [lam/R,phi/R,q/Math.cos(phi)-n];
    }
  };
}
const area=ring=>ring.reduce((s,p,i)=>{
  const n=ring[(i+1)%ring.length];
  return s+p[0]*n[2]-n[0]*p[2];
},0)*.5;
const cross=(a,b,c)=>(b[0]-a[0])*(c[2]-a[2])-
  (b[2]-a[2])*(c[0]-a[0]);
function inTri(p,a,b,c,eps=1e-8){
  const u=cross(a,b,p),v=cross(b,c,p),w=cross(c,a,p);
  return u>=-eps&&v>=-eps&&w>=-eps;
}
export function roofTriangulation(points){
  if(!Array.isArray(points)||points.length<3)
    throw new RangeError('Invalid polygon');
  const polygon=points.map(p=>[p[0],0,p[2]]);
  if(area(polygon)<0)polygon.reverse();
  const indices=polygon.map((_,i)=>i),result=[];
  for(let iterations=0;indices.length>3&&iterations<200;iterations++){
    let clipped=false;
    for(let i=0;i<indices.length;i++){
      const prev=indices[(i+indices.length-1)%indices.length],
        here=indices[i],next=indices[(i+1)%indices.length];
      const a=polygon[prev],b=polygon[here],c=polygon[next];
      if(cross(a,b,c)<1e-5)continue;
      if(indices.some(j=>j!==prev&&j!==here&&j!==next&&
        inTri(polygon[j],a,b,c)))continue;
      // Roof face order has +Y normals in this X-east/Z-north frame.
      result.push([a,c,b]);indices.splice(i,1);clipped=true;break;
    }
    if(!clipped)throw new Error('OTI polygon contains non-simple / degenerate ring');
  }
  if(indices.length!==3)throw new Error('Roof clip failed');
  const [a,b,c]=indices.map(i=>polygon[i]);
  result.push([a,c,b]);
  const originalArea=Math.abs(area(polygon));
  const roofArea=result.reduce((sum,t)=>sum+Math.abs(cross(t[0],t[1],t[2]))*.5,0);
  if(Math.abs(originalArea-roofArea)>Math.max(0.01,originalArea*1e-5))
    throw new Error('Roof triangle area not equal to source polygon');
  return {triangles:result,areaSquareMetres:originalArea};
}
export function prepareDumboBuildings(data){
  if(data?.crs!=='EPSG:4326'||data?.buildings?.length!==3)
    throw new Error('Expected three source-exact WGS84 buildings');
  const frame=makeDumboMetreFrame(data.origin);
  const buildings=data.buildings.map(record=>{
    const {fid,bin,heightAboveGroundFeet,ring}=record;
    if(!Number.isInteger(fid)||!Number.isInteger(bin)||
       !finite(heightAboveGroundFeet)||heightAboveGroundFeet<=0||
       !Array.isArray(ring)||ring.length<3)
      throw new Error('Invalid original NYC OTI feature');
    // Remove sub-30cm survey micro-edges ONLY in display mesh, never in data.
    const raw=ring.map(([lon,lat])=>frame.project(lon,lat,0));
    let flat=[];
    for(const p of raw)
      if(!flat.length||Math.hypot(p[0]-flat.at(-1)[0],
        p[2]-flat.at(-1)[2])>.3)flat.push(p);
    if(flat.length>3&&Math.hypot(flat[0][0]-flat.at(-1)[0],
      flat[0][2]-flat.at(-1)[2])<=.3)flat.pop();
    if(flat.length<3)throw new Error('Degenerate source footprint '+fid);
    if(area(flat)<0)flat.reverse(); // CCW x/z for roof triangulation.
    const h=heightAboveGroundFeet*0.3048;
    const roof=roofTriangulation(flat);
    const center=flat.reduce((r,p)=>{
      r[0]+=p[0]/flat.length;r[1]+=p[2]/flat.length;return r;
    },[0,0]);
    return {fid,bin,heightMetres:h,sourceHeightFeet:heightAboveGroundFeet,
      ring:flat,centerEastNorthMetres:center,roof,
      sourceWgs84Ring:ring};
  });
  return {origin:data.origin,frame,buildings};
}
