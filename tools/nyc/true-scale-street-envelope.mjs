// Official NYC DCM street-width-derived RIGHT-OF-WAY ribbon display.
// This is not surveyed carriageway/asphalt/curb placement, lane counts,
// traffic direction, plazas or sidewalk boundaries. NYC source Streetwidth
// is a recorded width attribute and some records are blank.
const finite=p=>Array.isArray(p)&&p.length>=2&&p.slice(0,2).every(Number.isFinite);
const paper=r=>/^(y|yes|true|1)$/i.test(String(r.paperStreet||''));
export function buildOfficialStreetWidthEnvelopes(source){
  if(!Array.isArray(source?.roads))throw Error('NYC DCM road lines are required');
  const positions=[],colors=[],normals=[],features=new Set();
  let skippedMissingWidth=0,skippedNoncity=0,segments=0;
  const emit=p=>{
    positions.push(p[0],.055,p[1]);
    colors.push(.23,.32,.34);
    normals.push(0,1,0);
  };
  for(const road of source.roads){
    if(paper(road)||String(road.featureStatus||'')!=='City_St'||
       !/improved/i.test(String(road.buildStatus||''))){
      skippedNoncity++;continue;
    }
    const widthFt=road.streetWidthFeet;
    if(!Number.isFinite(widthFt)||widthFt<=0||widthFt>200){
      skippedMissingWidth++;continue;
    }
    const halfWidthM=widthFt*.3048*.5;
    let valid=false;
    for(const line of road.lines||[])for(let j=1;j<line.length;j++){
      const a=line[j-1],b=line[j];
      if(!finite(a)||!finite(b))continue;
      const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      if(len<.02)continue;
      // Perpendicular width is exactly the source Streetwidth metres.
      const ux=-dz/len*halfWidthM,uz=dx/len*halfWidthM;
      const A=[a[0]+ux,a[1]+uz],B=[a[0]-ux,a[1]-uz],
        C=[b[0]-ux,b[1]-uz],D=[b[0]+ux,b[1]+uz];
      for(const p of [A,B,C,A,C,D])emit(p);
      valid=true;segments++;
    }
    if(valid)features.add(road.objectId);
  }
  return {positions,colors,normals,stats:{
    derivedWidthFeatures:features.size,missingWidthRecords:skippedMissingWidth,
    excludedNoncityRecords:skippedNoncity,
    segments,triangles:segments*2,
    role:'Official DCM Streetwidth RIGHT-OF-WAY hint, NOT surveyed paved roadbed'
  }};
}
