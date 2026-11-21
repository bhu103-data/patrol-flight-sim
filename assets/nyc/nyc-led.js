// PATROL NYC original, static LED artwork. No video, no tracking, no remote assets.
// Art imitates Times Square design grammar; it does not reproduce real ads.
const PALETTES=[
  ['#101b31','#067cb5','#d5f8ff'],['#1c092a','#e03974','#fff2d5'],
  ['#111919','#db854c','#fff4d4'],['#08292c','#28b5a7','#ecfff8'],
  ['#170e29','#6552e8','#fff0f0'],['#2b0b18','#ea5548','#fff4e6'],
  ['#111729','#dfc18b','#fff9ea'],['#0b2327','#7cbaae','#e7fff6']
];
function panelArt(ctx,x,y,size,info,index){
  const [base,accent,ink]=PALETTES[index%PALETTES.length];
  const h=size,w=size;
  ctx.save();ctx.translate(x,y);
  const bg=ctx.createLinearGradient(0,0,w,h);
  bg.addColorStop(0,base);bg.addColorStop(0.7,accent);
  bg.addColorStop(1,base);
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  // Realistic advertising layout: photographic-style lighting, product closeups,
  // texture, typography hierarchy, and small commercial/legal copy.
  const halo=ctx.createRadialGradient(w*0.63,h*0.46,0,w*0.63,h*0.46,w*0.78);
  halo.addColorStop(0,'rgba(255,255,255,.42)');
  halo.addColorStop(.26,'rgba(255,255,255,.08)');
  halo.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
  const kind=index%8;
  if(kind===0){
    // Boutique timepiece: beveled bezel, dial, hand, highlights.
    const cx=w*.63,cy=h*.48,r=w*.265;
    ctx.strokeStyle='#121620';ctx.lineWidth=w*.14;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle='#f2eee3';ctx.lineWidth=w*.031;
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#11151b';ctx.beginPath();ctx.arc(cx,cy,r*.83,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#c7bd9b';ctx.lineWidth=w*.012;
    for(let i=0;i<12;i++){let a=i*Math.PI/6;
      ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*r*.62,cy+Math.sin(a)*r*.62);
      ctx.lineTo(cx+Math.cos(a)*r*.75,cy+Math.sin(a)*r*.75);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+r*.46,cy-r*.22);
    ctx.lineTo(cx+r*.11,cy+r*.45);ctx.stroke();
    ctx.fillStyle='#f2eee3';ctx.beginPath();ctx.arc(cx,cy,3,0,7);ctx.fill();
  }else if(kind===1){
    // Editorial fashion silhouette and side-lit studio fabric.
    ctx.fillStyle='rgba(5,6,18,.78)';
    ctx.beginPath();ctx.ellipse(w*.62,h*.23,w*.105,h*.12,-.14,0,7);ctx.fill();
    ctx.beginPath();ctx.moveTo(w*.44,h*.40);ctx.quadraticCurveTo(w*.63,h*.30,w*.82,h*.41);
    ctx.lineTo(w*.95,h*.94);ctx.lineTo(w*.36,h*.94);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,229,226,.35)';ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(w*.57,h*.44);ctx.lineTo(w*.69,h*.86);ctx.stroke();
  }else if(kind===2){
    // Beverage bottle and bright studio reflection.
    const g=ctx.createLinearGradient(w*.42,0,w*.73,0);
    g.addColorStop(0,'#101819');g.addColorStop(.22,'#e3bc7b');
    g.addColorStop(.60,'#ab723e');g.addColorStop(1,'#f4e4b8');
    ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(w*.54,h*.20);ctx.lineTo(w*.67,h*.20);
    ctx.lineTo(w*.66,h*.38);ctx.lineTo(w*.76,h*.48);
    ctx.lineTo(w*.75,h*.91);ctx.lineTo(w*.43,h*.91);
    ctx.lineTo(w*.43,h*.48);ctx.lineTo(w*.54,h*.38);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(15,19,26,.82)';ctx.fillRect(w*.43,h*.56,w*.32,h*.19);
  }else if(kind===3){
    // Metropolitan architecture / skyline tourism poster.
    const sky=ctx.createLinearGradient(0,h*.3,0,h);
    sky.addColorStop(0,'#122930');sky.addColorStop(1,'#051016');
    ctx.fillStyle=sky;ctx.fillRect(0,h*.43,w,h*.57);
    for(let i=0;i<15;i++){const bw=w/14;
      const rh=h*(.14+.42*(.5+.5*Math.sin(i*9.713)));
      const bx=i*bw-2;
      ctx.fillStyle=i%3===0?'#244750':'#0e2d38';ctx.fillRect(bx,h-rh,bw+2,rh);
      ctx.fillStyle='rgba(255,230,143,.47)';
      for(let j=0;j<5;j++)for(let k=0;k<2;k++)
        if((i+j+k)%3===0)ctx.fillRect(bx+4+k*7,h-rh+6+j*12,2,3);
    }
  }else if(kind===4){
    // Product sneaker side profile with grounded midsole, no third-party logo.
    ctx.fillStyle='#f1f0ea';
    ctx.beginPath();ctx.moveTo(w*.25,h*.61);ctx.lineTo(w*.47,h*.52);
    ctx.lineTo(w*.61,h*.62);ctx.quadraticCurveTo(w*.79,h*.72,w*.9,h*.73);
    ctx.quadraticCurveTo(w*.98,h*.77,w*.87,h*.84);
    ctx.lineTo(w*.22,h*.84);ctx.quadraticCurveTo(w*.13,h*.79,w*.25,h*.61);ctx.fill();
    ctx.fillStyle='#151923';ctx.fillRect(w*.2,h*.81,w*.71,h*.045);
    ctx.strokeStyle='#242833';ctx.lineWidth=5;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(w*(.45+i*.055),h*.62);
      ctx.lineTo(w*(.42+i*.055),h*.70);ctx.stroke();}
  }else if(kind===5){
    // Phone launch billboard.
    ctx.fillStyle='#090c18';ctx.fillRect(w*.46,h*.16,w*.35,h*.72);
    const sc=ctx.createLinearGradient(w*.48,h*.3,w*.81,h*.8);
    sc.addColorStop(0,'#dce0f6');sc.addColorStop(.4,'#775bc5');
    sc.addColorStop(1,'#111526');ctx.fillStyle=sc;
    ctx.fillRect(w*.477,h*.18,w*.316,h*.68);
    ctx.fillStyle='#101624';ctx.beginPath();ctx.ellipse(w*.63,h*.20,w*.035,h*.015,0,0,7);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.56)';ctx.lineWidth=3;
    ctx.strokeRect(w*.46,h*.16,w*.35,h*.72);
  }else if(kind===6){
    // Broadway spotlight / cinema promotion.
    ctx.fillStyle='rgba(250,228,156,.20)';
    ctx.beginPath();ctx.moveTo(w*.5,0);ctx.lineTo(w*.18,h);ctx.lineTo(w*.84,h);ctx.closePath();ctx.fill();
    ctx.fillStyle='#0d0c16';
    for(let i=0;i<7;i++){const bx=(i+1)*w/9;
      ctx.beginPath();ctx.arc(bx,h*.78,10+(i%3)*5,0,7);ctx.fill();
      ctx.fillRect(bx-9,h*.80,18,h*.2);}
  }else{
    // High-end skincare / perfume product lighting.
    const shade=ctx.createLinearGradient(w*.4,0,w*.8,0);
    shade.addColorStop(0,'#aaa8a2');shade.addColorStop(.35,'#fbfbf6');
    shade.addColorStop(.75,'#d3d1d0');shade.addColorStop(1,'#8d9190');
    ctx.fillStyle=shade;ctx.fillRect(w*.43,h*.34,w*.36,h*.57);
    ctx.fillStyle='#252d35';ctx.fillRect(w*.48,h*.25,w*.26,h*.09);
    ctx.fillStyle='rgba(20,34,42,.6)';ctx.fillRect(w*.49,h*.61,w*.24,h*.025);
  }
  const label=(info?.label||'NEW YORK').toUpperCase().replace(/[^A-Z0-9 &'-]/g,'').slice(0,24);
  ctx.shadowColor='rgba(0,0,0,.72)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
  ctx.fillStyle=ink;ctx.textBaseline='top';
  ctx.font='800 '+Math.round(size*.095)+'px Arial, sans-serif';
  ctx.fillText(['NOVA','LUMEN','FORM','THE CITY','MOTION','NEXT','ON STAGE','AURA'][kind],
    size*.075,size*.075,size*.85);
  ctx.font='900 '+Math.round(size*.077)+'px Arial, sans-serif';
  const split=label.length>14?label.split(' '):[label];
  if(split.length>1 && label.length>14){
    ctx.fillText(split.slice(0,2).join(' '),size*.07,size*.73,size*.86);
    ctx.fillText(split.slice(2).join(' ')||'NEW YORK',size*.07,size*.82,size*.85);
  }else ctx.fillText(label,size*.07,size*.78,size*.87);
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.strokeStyle='rgba(255,255,255,.50)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(size*.075,size*.17);ctx.lineTo(size*.22,size*.17);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.75)';
  ctx.font=Math.round(size*.032)+'px Arial, sans-serif';
  ctx.fillText(['DISCOVER MORE','NYC EDITION','WINTER 2026','ONLY HERE'][index%4],size*.075,size*.94);
  // Fine, static LED matrix and seam texture, without dynamic animation.
  ctx.fillStyle='rgba(0,0,0,.075)';
  for(let yy=2;yy<size;yy+=5)ctx.fillRect(0,yy,size,1);
  ctx.restore();
}
export function createNycLedAtlas(gl,panels){
  if(!panels||!panels.length)return null;
  const size=2048,cols=8,step=size/cols,canvas=document.createElement('canvas');
  canvas.width=canvas.height=size;
  const c=canvas.getContext('2d',{alpha:false});
  if(!c)throw Error('LED atlas needs a 2D context');
  c.fillStyle='#080a14';c.fillRect(0,0,size,size);
  for(let i=0;i<Math.min(64,panels.length);i++){
    const x=(i%cols)*step,y=Math.floor(i/cols)*step;
    panelArt(c,x+2,y+2,step-4,panels[i],i);
  }
  const texture=gl.createTexture(),flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  gl.activeTexture(gl.TEXTURE10);
  gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  try{
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
  }finally{
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);
    gl.activeTexture(gl.TEXTURE0);
  }
  return texture;
}
