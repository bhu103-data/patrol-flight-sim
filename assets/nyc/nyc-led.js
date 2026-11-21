// PATROL NYC original, static LED artwork. No video, no tracking, no remote assets.
// Art imitates Times Square design grammar; it does not reproduce real ads.
// PATROL_NYC_UNIQUE_ADS_V6: non-repeating creatives within a
// retained browser history. Campaign IDs are monotonic across scenery rebuilds.
let ephemeralCampaign=0;
function reserveCreativeSerials(count) {
  let previous=ephemeralCampaign;
  try {
    const stored=Number(localStorage.getItem('patrol.nyc.led.nextCreative')||'0');
    if(Number.isSafeInteger(stored)&&stored>=0)previous=Math.max(previous,stored);
  }catch(_error){}
  const nonce=(typeof crypto!=='undefined'&&crypto.getRandomValues)?
    crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*4294967296);
  const start=previous+1;
  ephemeralCampaign=previous+count;
  try{localStorage.setItem('patrol.nyc.led.nextCreative',String(ephemeralCampaign));}
  catch(_error){}
  return {start,nonce};
}
function campaignDetails(serial,nonce) {
  const prefixes=['ASTRA','MERIDIAN','ARCADIA','VANTAGE','ORIGIN','SKYLARK',
    'CALDER','CIRRUS','AURORA','NEXUS','ATELIER','KINETIC','LANTERN',
    'HORIZON','ELEVATE','SOLSTICE','NORTH','MARQUE','STELLAR','CRESCENT',
    'MOSAIC','AXIOM','NOVA','EMBER','CITADEL','FLUX','ECHO','SPECTRUM','VERVE'];
  const suffixes=['STUDIO','COLLECTION','FUTURE','MOTION','ATELIER','EDITION',
    'WORKS','JOURNEY','NIGHTS','VISION','CITY','CRAFT','FORM','OBJECT','SERIES',
    'DESIGN','LIFE','LIGHT','LAB','NEW YORK','UNIVERSE','GALLERY','CULTURE'];
  const key=((Math.imul(serial,2654435761)^nonce)>>>0);
  // Pairwise different art genres for the first 16 adjacent billboards.
  // The session number is also exposed as a distinctive graphic, not only
  // as invisible bookkeeping or small-print copyright.
  const artGenre=(Math.imul(serial,11)+(nonce>>>8))%16;
  return {title:prefixes[key%prefixes.length]+' '+suffixes[Math.floor(key/29)%suffixes.length],
    serial:serial.toString(36).toUpperCase().padStart(6,'0'),
    seed:key,theme:artGenre};
}
const PALETTES=[
  ['#101b31','#067cb5','#d5f8ff'],['#1c092a','#e03974','#fff2d5'],
  ['#111919','#db854c','#fff4d4'],['#08292c','#28b5a7','#ecfff8'],
  ['#170e29','#6552e8','#fff0f0'],['#2b0b18','#ea5548','#fff4e6'],
  ['#111729','#dfc18b','#fff9ea'],['#0b2327','#7cbaae','#e7fff6']
];
function panelArt(ctx,x,y,size,info,index,campaign){
  // VICE '86 / HEAT art-direction reference: distinct poster compositions,
  // deliberately generated here. No HEAT code, images or IP are included.
  // PATROL_NYC_AD_DIVERSITY_V7.
  const [base,accent,ink]=PALETTES[campaign.theme%PALETTES.length];
  const serial=campaign.serial;
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
  // Per-campaign color grade, diagonal cuts, graphic hierarchy and halation:
  // even the same product family is visually a different creative.
  const hue=(campaign.seed>>>12)%360;
  ctx.fillStyle='hsla('+hue+',82%,53%,.24)';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle='rgba(255,255,255,.045)';
  const slant=(campaign.seed>>>22)%5;
  for(let v=0;v<slant+1;v++){
    ctx.beginPath();
    ctx.moveTo(w*(.10+v*.16),0);
    ctx.lineTo(w*(.18+v*.16),0);
    ctx.lineTo(w*(.55+v*.16),h);
    ctx.lineTo(w*(.48+v*.16),h);
    ctx.closePath();ctx.fill();
  }
  const kind=campaign.theme;
  ctx.save();
  const offsetX=(((campaign.seed>>>5)%17)-8)*w*.005;
  const offsetY=(((campaign.seed>>>9)%11)-5)*h*.006;
  ctx.translate(offsetX,offsetY);
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
  }else if(kind===7){
    // High-end skincare / perfume product lighting.
    const shade=ctx.createLinearGradient(w*.4,0,w*.8,0);
    shade.addColorStop(0,'#aaa8a2');shade.addColorStop(.35,'#fbfbf6');
    shade.addColorStop(.75,'#d3d1d0');shade.addColorStop(1,'#8d9190');
    ctx.fillStyle=shade;ctx.fillRect(w*.43,h*.34,w*.36,h*.57);
    ctx.fillStyle='#252d35';ctx.fillRect(w*.48,h*.25,w*.26,h*.09);
    ctx.fillStyle='rgba(20,34,42,.6)';ctx.fillRect(w*.49,h*.61,w*.24,h*.025);
  }else if(kind===8){
    // Premium automobile side profile and cinematic road horizon.
    ctx.fillStyle='#151923';ctx.fillRect(0,h*.74,w,h*.26);
    ctx.fillStyle='#e6e9e8';
    ctx.beginPath();ctx.moveTo(w*.16,h*.69);ctx.lineTo(w*.34,h*.59);
    ctx.lineTo(w*.59,h*.58);ctx.lineTo(w*.73,h*.65);ctx.lineTo(w*.85,h*.68);
    ctx.lineTo(w*.91,h*.80);ctx.lineTo(w*.12,h*.80);ctx.closePath();ctx.fill();
    ctx.fillStyle='#182f42';
    ctx.beginPath();ctx.moveTo(w*.36,h*.62);ctx.lineTo(w*.48,h*.53);
    ctx.lineTo(w*.61,h*.55);ctx.lineTo(w*.70,h*.65);ctx.closePath();ctx.fill();
    for(const cx of [.30,.76]){
      ctx.fillStyle='#14191e';ctx.beginPath();ctx.arc(w*cx,h*.79,w*.088,0,7);ctx.fill();
      ctx.strokeStyle='#d8d9de';ctx.lineWidth=w*.020;ctx.stroke();
    }
  }else if(kind===9){
    // Over-ear headphones, softly lit driver and halo arch.
    ctx.lineCap='round';ctx.strokeStyle='#f7eee3';ctx.lineWidth=w*.096;
    ctx.beginPath();ctx.arc(w*.61,h*.50,w*.235,Math.PI*1.12,Math.PI*1.88);ctx.stroke();
    ctx.fillStyle='#252936';ctx.fillRect(w*.31,h*.48,w*.14,h*.31);
    ctx.fillRect(w*.76,h*.48,w*.14,h*.31);
    ctx.fillStyle='#dbb67d';ctx.fillRect(w*.335,h*.51,w*.08,h*.20);
    ctx.fillRect(w*.78,h*.51,w*.08,h*.20);
  }else if(kind===10){
    // Destination travel: layered natural landform and broad sky.
    ctx.fillStyle='rgba(232,238,224,.55)';
    ctx.beginPath();ctx.arc(w*.75,h*.33,w*.13,0,7);ctx.fill();
    ctx.fillStyle='#2a4853';ctx.beginPath();ctx.moveTo(0,h*.82);
    ctx.lineTo(w*.36,h*.43);ctx.lineTo(w*.55,h*.65);
    ctx.lineTo(w*.69,h*.47);ctx.lineTo(w,h*.82);ctx.closePath();ctx.fill();
    ctx.fillStyle='#779594';ctx.beginPath();ctx.moveTo(0,h);
    ctx.lineTo(w*.30,h*.68);ctx.lineTo(w*.66,h*.85);ctx.lineTo(w,h*.61);
    ctx.lineTo(w,h);ctx.closePath();ctx.fill();
  }else if(kind===11){
    // Fine jewelry: pearl, chain, and gem cut facets.
    ctx.strokeStyle='#eddfb6';ctx.lineWidth=w*.022;
    ctx.beginPath();ctx.arc(w*.63,h*.54,w*.21,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle='#f4f2e6';ctx.beginPath();ctx.arc(w*.63,h*.54,w*.075,0,7);ctx.fill();
    ctx.fillStyle='#f9dfc3';ctx.beginPath();ctx.moveTo(w*.52,h*.33);
    ctx.lineTo(w*.63,h*.22);ctx.lineTo(w*.76,h*.34);ctx.lineTo(w*.63,h*.49);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle='#fff8ed';ctx.lineWidth=3;ctx.stroke();
  }else if(kind===12){
    // Restaurant concept: plated food graphic and rich ceramic highlights.
    ctx.fillStyle='#f5ebd7';ctx.beginPath();ctx.ellipse(w*.61,h*.59,w*.30,h*.25,0,0,7);ctx.fill();
    ctx.fillStyle='#343c3b';ctx.beginPath();ctx.ellipse(w*.61,h*.59,w*.255,h*.20,0,0,7);ctx.fill();
    for(let j=0;j<7;j++){
      const a=j*2.399963,wj=w*(.49+Math.sin(a)*.12),hj=h*(.58+Math.cos(a)*.095);
      ctx.fillStyle=j%2?'#d48a51':'#b9ba74';ctx.beginPath();
      ctx.ellipse(wj,hj,w*.058,h*.026,a,0,7);ctx.fill();
    }
  }else if(kind===13){
    // Handheld game console with modular control hardware.
    ctx.fillStyle='#e8eaf1';ctx.fillRect(w*.27,h*.39,w*.63,h*.36);
    ctx.fillStyle='#1b2335';ctx.fillRect(w*.39,h*.42,w*.38,h*.30);
    ctx.fillStyle='#98ced7';ctx.fillRect(w*.415,h*.45,w*.33,h*.245);
    ctx.fillStyle='#182030';
    ctx.beginPath();ctx.arc(w*.34,h*.57,w*.033,0,7);ctx.fill();
    ctx.beginPath();ctx.arc(w*.82,h*.54,w*.032,0,7);ctx.fill();
  }else if(kind===14){
    // Architectural exhibition poster with a luminous model tower.
    ctx.fillStyle='#c9d8e0';ctx.beginPath();ctx.moveTo(w*.42,h*.89);
    ctx.lineTo(w*.49,h*.28);ctx.lineTo(w*.68,h*.21);ctx.lineTo(w*.80,h*.84);
    ctx.closePath();ctx.fill();
    ctx.fillStyle='#172d44';
    for(let j=0;j<10;j++)ctx.fillRect(w*(.49+j*.018),h*.37,w*.007,h*.41);
    ctx.strokeStyle='#eef4e9';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(w*.41,h*.89);ctx.lineTo(w*.80,h*.84);ctx.stroke();
  }else{
    // Boutique camera and lens assembly, distinct from mobile-phone artwork.
    ctx.fillStyle='#1a2229';ctx.fillRect(w*.40,h*.35,w*.47,h*.40);
    ctx.fillRect(w*.47,h*.27,w*.18,h*.09);
    ctx.fillStyle='#d0ceca';ctx.beginPath();ctx.arc(w*.63,h*.55,w*.14,0,7);ctx.fill();
    ctx.fillStyle='#1c3543';ctx.beginPath();ctx.arc(w*.63,h*.55,w*.115,0,7);ctx.fill();
    ctx.fillStyle='#789ba9';ctx.beginPath();ctx.arc(w*.63,h*.55,w*.052,0,7);ctx.fill();
    ctx.fillStyle='#e8d2a0';ctx.fillRect(w*.75,h*.39,w*.055,h*.035);
  }
  ctx.restore();
  const label=(info?.label||'NEW YORK').toUpperCase().replace(/[^A-Z0-9 &'-]/g,'').slice(0,24);
  const variant=(campaign.seed>>>12)%7;
  ctx.save();ctx.globalAlpha=.10;ctx.fillStyle=ink;
  for(let j=0;j<2+variant;j++){
    const phase=((campaign.seed>>>((j%4)*6))&63)/63;
    ctx.fillRect(size*(.08+.84*phase),size*(.23+j*.075),size*.010,size*.045);
  }
  ctx.restore();
  ctx.shadowColor='rgba(0,0,0,.72)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
  ctx.fillStyle=ink;ctx.textBaseline='top';
  ctx.font='800 '+Math.round(size*.095)+'px Arial, sans-serif';
  ctx.fillText(campaign.title,size*.075,size*.075,size*.85);
  ctx.font='800 '+Math.round(size*.048)+'px Arial, sans-serif';
  ctx.fillText('CREATIVE '+serial,size*.075,size*.185,size*.80);
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
  ctx.fillText(['DISCOVER MORE','NYC EDITION','WINTER 2026','ONLY HERE'][index%4]
    +'  /  CAMPAIGN '+serial,size*.075,size*.94);
  // Fine, static LED matrix and seam texture, without dynamic animation.
  ctx.fillStyle='rgba(0,0,0,.075)';
  for(let yy=2;yy<size;yy+=5)ctx.fillRect(0,yy,size,1);
  ctx.restore();
}
export function createNycLedAtlas(gl,panels){
  if(!panels||!panels.length)return null;
  // Low-memory and touch devices need only a 1K atlas; desktop keeps sharp 2K artwork.
  // Texture contents are still generated uniquely for each campaign.
  const smallDevice=(typeof navigator!=='undefined' && Number(navigator.deviceMemory)>0 && navigator.deviceMemory<=4)
    || (typeof matchMedia==='function' && matchMedia('(pointer:coarse)').matches);
  const size=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE)||2048,smallDevice?1024:2048),
    cols=Math.max(8,Math.ceil(Math.sqrt(panels.length))),
    step=size/cols,canvas=document.createElement('canvas');
  const creativeRun=reserveCreativeSerials(panels.length);
  canvas.width=canvas.height=size;
  const c=canvas.getContext('2d',{alpha:false});
  if(!c)throw Error('LED atlas needs a 2D context');
  c.fillStyle='#080a14';c.fillRect(0,0,size,size);
  for(let i=0;i<panels.length;i++){
    const x=(i%cols)*step,y=Math.floor(i/cols)*step;
    const campaign=campaignDetails(creativeRun.start+i,creativeRun.nonce);
    panelArt(c,x+2,y+2,step-4,panels[i],i,campaign);
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
