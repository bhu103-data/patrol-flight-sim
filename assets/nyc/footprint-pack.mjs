const MAGIC=0x3150464e; // NFP1
const SCALE=100;
const HEADER=12, ROW=20;
const q=n=>Math.round(n*SCALE);

export function encodeFootprints(rows, kind){
  const out=new ArrayBuffer(HEADER+rows.reduce((s,r)=>s+ROW+r[6].length*4,0));
  const v=new DataView(out);
  v.setUint32(0,MAGIC,true);v.setUint32(4,rows.length,true);
  v.setUint32(8,kind,true);
  let o=HEADER;
  for(const [id,x,z,w,d,h,poly,borough=1] of rows){
    const a=q(x),b=q(z),sizes=[w,d,h].map(q);
    if(sizes.some(n=>n<1||n>65535)||poly.length<3||poly.length>64)
      throw Error('Footprint cannot be packed');
    v.setUint32(o,id,true);v.setInt32(o+4,a,true);v.setInt32(o+8,b,true);
    sizes.forEach((n,i)=>v.setUint16(o+12+2*i,n,true));
    // Store borough and ring size in one byte each.
    v.setUint8(o+18,borough);v.setUint8(o+19,poly.length);o+=ROW;
    for(const [px,pz] of poly){
      const dx=q(px)-a,dz=q(pz)-b;
      if(Math.abs(dx)>32767||Math.abs(dz)>32767)throw Error('Ring offset overflow');
      v.setInt16(o,dx,true);v.setInt16(o+2,dz,true);o+=4;
    }
  }
  return out;
}

export function decodeFootprints(buffer,kind){
  const v=new DataView(buffer);
  if(v.byteLength<HEADER||v.getUint32(0,true)!==MAGIC||v.getUint32(8,true)!==kind)
    throw Error('Invalid NYC footprint header');
  const count=v.getUint32(4,true);
  if(count<1||count>50000||count*(ROW+12)>v.byteLength-HEADER)throw Error('Invalid NYC row count');
  const rows=new Array(count);
  let o=HEADER;
  for(let i=0;i<count;i++){
    if(o+ROW>v.byteLength)throw Error('Truncated NYC footprint record');
    const id=v.getUint32(o,true),a=v.getInt32(o+4,true),b=v.getInt32(o+8,true);
    const w=v.getUint16(o+12,true)/SCALE,d=v.getUint16(o+14,true)/SCALE,h=v.getUint16(o+16,true)/SCALE;
    const borough=v.getUint8(o+18),n=v.getUint8(o+19);o+=ROW;
    if(!id||Math.abs(a)>100000||Math.abs(b)>100000||!w||!d||!h||
      (kind===1?borough!==1:borough<2||borough>4)||n<3||n>64||o+n*4>v.byteLength)
      throw Error('Invalid NYC footprint record');
    const poly=new Array(n);
    for(let j=0;j<n;j++,o+=4)
      poly[j]=[(a+v.getInt16(o,true))/SCALE,(b+v.getInt16(o+2,true))/SCALE];
    rows[i]=kind===1?[id,a/SCALE,b/SCALE,w,d,h,poly]:[id,a/SCALE,b/SCALE,w,d,h,poly,borough];
  }
  if(o!==v.byteLength)throw Error('Trailing NYC footprint data');
  return rows;
}
