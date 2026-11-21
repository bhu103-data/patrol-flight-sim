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
  const hash=(n)=>{const s=Math.sin(n*127.1+78.233)*43758.5453;return s-Math.floor(s);};
  const lift=(p,y)=>[p[0],p[1]+y,p[2]];
  // Match the existing Glacier Head mesh in index.html. These cracks are a
  // surface-only detail pass; they must not alter sampled collision elevations.
  const cols=20,rows=17;
  function glacierPoint(col,row) {
    const across=2*col/cols-1, t=row/rows;
    const x=-34+across*(78-28*t)+Math.sin(t*3.9)*21;
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

  // Fjord floes with irregular perimeter (not repeated cone-shaped icebergs).
  // Filter water via the SAME CPU terrain sampler used for vehicle collision.
  // No shoreline changes or terrain tessellation.
  for (let i=0;i<86;i++) {
    const h=hash(i*11+17),j=hash(i*13+37);
    const north= i<56 ? 260+h*187 : -600+h*215;
    const east= i<56 ? -118+j*212 : -43+j*157;
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
  return stats;
}
