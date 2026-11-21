import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=JSON.parse(readFileSync(new URL('../assets/nyc/official-financial-footprints.json',import.meta.url),'utf8'));
const a=html.indexOf('  function buildOfficialFootprintMesh(');
const b=html.indexOf('  function buildCityBuildings(',a);
assert.ok(a>=0&&b>a);
const fn=new Function(html.slice(a,b)+'return buildOfficialFootprintMesh;')();
function build(rec,detail=3,destroyed=false){
 const [id,x,z,w,d,h,poly]=rec;
 const tris=[],quads=[];
 const stats=fn((...args)=>tris.push(args),(...args)=>quads.push(args),
   [x,z,w,d,h,(id%101)/101,destroyed,poly,id],14.58,detail);
 return {stats,tris,quads};
}
test('existing lower Manhattan OTI outlines generate finite, bounded near-flight details',()=>{
 let entrances=0,cornices=0;
 for(const lot of source.footprints){
  const {stats,tris,quads}=build(lot);
  const {stats:low}=build(lot,1);
  assert.ok(stats.streetEntrances>=0&&stats.streetEntrances<=2);
  assert.ok(stats.corniceBands>=0&&stats.corniceBands<=8);
  assert.equal(low.streetEntrances,0);
  assert.equal(low.corniceBands,0);
  assert.equal(stats.roof,low.roof,'unchanged municipal roof tessellation');
  assert.equal(stats.walls,low.walls,'unchanged polygon wall topology');
  assert.ok(quads.length<400,'decorative quads remain bounded per existing building');
  assert.ok(tris.every(t=>t.slice(0,3).every(p=>p.every(Number.isFinite))));
  assert.ok(quads.every(t=>t.slice(0,4).every(p=>p.every(Number.isFinite))));
  entrances+=stats.streetEntrances;cornices+=stats.corniceBands;
 }
 assert.ok(entrances>=12,'real OTI lower-Manhattan frontage gains shop/entry relief');
 assert.ok(cornices>=30,'existing polygon rooflines gain measurable cornice geometry');
});
test('destroyed buildings never receive intact storefront/roof ornaments',()=>{
 for(const lot of source.footprints.slice(0,25)){
  const {stats}=build(lot,3,true);
  assert.equal(stats.streetEntrances,0);
  assert.equal(stats.corniceBands,0);
 }
});
test('no new lot files, collision rules, roads or flying controls',()=>{
 const diffSource=html.slice(a,b);
 assert.match(diffSource,/streetEntrances<2/);
 assert.match(diffSource,/corniceBands<8/);
 assert.match(diffSource,/roofY-\.30/);
 assert.match(diffSource,/detailBand===3/);
 assert.match(html,/official-financial-footprints\.json/);
 assert.match(html,/officialLotAt\(east,north\)\|\|cityParcels\.get/);
});

test('solid cornices stay within the official-footprint batch budget and face outward',()=>{
 let totalQuads=0;
 for(const lot of source.footprints)totalQuads+=build(lot).quads.length;
 assert.equal(totalQuads,8898,'100-footprint pilot mesh with true cut-out doors');
 assert.ok(totalQuads<9000,'original OTI facade batch budget');
 const outline=[[-105,-455],[-93,-455],[-93,-447],[-105,-447]];
 // Both valid NYC polygon winding directions must keep cap normals correct.
 for(const [id,poly] of [[300,outline],[303,[...outline].reverse()]]){
  const {stats,quads}=build([id,-100,-450,12,8,20,poly]);
  const roofY=14.58+20;
  const atLevel=height=>quads.filter(q=>q[5]===9&&
    q.slice(0,4).every(p=>Math.abs(p[1]-height)<1e-7));
  const normalY=q=>{
    const [a,b,c]=q;
    return (b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
  };
  const tops=atLevel(roofY-.19),bottoms=atLevel(roofY-.30);
  assert.ok(stats.corniceBands>0);
  assert.equal(tops.length,stats.corniceBands);
  assert.equal(bottoms.length,stats.corniceBands);
  assert.ok(tops.every(q=>normalY(q)>0),'top cap faces sky');
  assert.ok(bottoms.every(q=>normalY(q)<0),'bottom cap faces ground');
 }
});

test('entrance center is truly cut from original wall and glazing faces outside from recess',()=>{
 const y=14.58,outline=[[-105,-455],[-93,-455],[-93,-447],[-105,-447]];
 for(const [id,poly] of [[300,outline],[303,[...outline].reverse()]]){
  const {stats,quads}=build([id,-100,-450,12,8,20,poly]);
  assert.equal(stats.streetEntrances,2,'synthetic two eligible street fronts');
  const area=poly.reduce((sum,a,i)=>{
   const b=poly[(i+1)%poly.length];
   return sum+a[0]*b[1]-a[1]*b[0];
  },0);
  const sign=Math.sign(area),centerHeight=y+1.1;
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length];
   const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   const outward=[sign*dz/length,-sign*dx/length];
   if(!(outward[0]<-.30||outward[1]<-.20))continue;
   const points=q=>q.slice(0,4);
   const offset=p=>(p[0]-a[0])*outward[0]+(p[2]-a[1])*outward[1];
   const t=p=>((p[0]-a[0])*dx+(p[2]-a[1])*dz)/(length*length);
   const spansHeight=q=>{
    const ys=points(q).map(p=>p[1]);
    return Math.min(...ys)<centerHeight&&Math.max(...ys)>centerHeight;
   };
   const opaque=quads.filter(q=>q[5]===9&&spansHeight(q)&&
    points(q).every(p=>Math.abs(offset(p))<1e-7)&&
    Math.min(...points(q).map(t))<.5&&Math.max(...points(q).map(t))>.5);
   assert.equal(opaque.length,0,'no opaque exterior wall crosses doorway center');
   const glazing=quads.filter(q=>q[5]===10&&spansHeight(q)&&
    points(q).every(p=>offset(p)<-.10)&&
    Math.min(...points(q).map(t))<=.32&&
    Math.max(...points(q).map(t))>=.68);
   assert.equal(glazing.length,1,'one source-aligned recessed glass panel');
   const [p0,p1,p2]=glazing[0],u=p1.map((v,i)=>v-p0[i]),
     v=p2.map((w,i)=>w-p0[i]);
   const outwardArea=(u[1]*v[2]-u[2]*v[1])*outward[0]+
     (u[0]*v[1]-u[1]*v[0])*outward[1];
   assert.ok(outwardArea>0,'recess glazing normal faces outside, both windings');
  }
 }
});

test('pedestrian scenic camera is anchored to an actual OTI doorway source edge',()=>{
 const lot=source.footprints.find(lot=>lot[0]===119028);
 assert.ok(lot,'OTI source doorway parcel exists');
 const ring=lot[6],a=ring[12],b=ring[(12+1)%ring.length];
 assert.ok(a&&b,'inspected source edge exists');
 const midpoint=[(a[0]+b[0])*.5,(a[1]+b[1])*.5];
 assert.ok(Math.abs(midpoint[0]+102.88)<.02);
 assert.ok(Math.abs(midpoint[1]+487.14)<.02);
 assert.match(html,/name:'Lower Manhattan · Street Entrance',x:-102\.88,z:-487\.14,height:3\.50/);
 assert.match(html,/bearing:201\.7,radius:5\.6,rise:\.55/);
 // Scenic zoom 68 now places the camera close to the original OTI edge,
 // not 9+ units down the generic urban canyon. Never enter an OTI polygon.
 const zoom=.68,distance=5.6*(1.24+(.56-1.24)*zoom);
 const angle=201.7*Math.PI/180;
 const eye=[midpoint[0]+distance*Math.sin(angle),
            midpoint[1]+distance*Math.cos(angle)];
 assert.ok(distance>3&&distance<5,'near view remains outside source wall');
 const inside=(p,poly)=>{
  let value=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if((a[1]>p[1])!==(b[1]>p[1]) &&
     p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])
    value=!value;
  }
  return value;
 };
 assert.ok(!source.footprints.some(l=>inside(eye,l[6])),
   'source-aligned camera must remain outside all existing OTI buildings');
});
