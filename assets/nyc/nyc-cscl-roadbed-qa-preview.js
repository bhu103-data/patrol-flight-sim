// NONPRODUCTION diagnostic ONLY. A source CSCL centerline with a published
// paved-area width is visualized as a symmetric band. This is NOT a surveyed
// NYC curb, sidewalk, plaza, bike lane, signal phasing or drivable mesh.
// Live official data stays in short-lived CI artifact, never checked into game.
export function buildCsclRoadbedQaPreview(source){
  if(source?.licenseApprovedForGame!==false||!Array.isArray(source.records))
    throw Error('Expected read-only official CSCL source audit records');
  const positions=[],normals=[],colors=[];
  let vehicleRoads=0,nonVehicleLines=0,roadTriangles=0,
    unverifiedVehicleWidth=0,skippedSegments=0;
  const add=(a,b,c,tint)=>{
    for(const p of [a,b,c]){
      positions.push(p[0],p[1],p[2]);normals.push(0,1,0);
      colors.push(tint[0],tint[1],tint[2]);
    }
    roadTriangles++;
  };
  for(const road of source.records){
    const vehicle=Boolean(road.constructedVehicleCandidate);
    if(vehicle)vehicleRoads++;
    else nonVehicleLines++;
    // Unknown motor width means NO generated paved surface.
    const width=vehicle?road.widthMeters:.70;
    if(vehicle&&!(Number.isFinite(width)&&width>0)){
      unverifiedVehicleWidth++;continue;
    }
    // Non-vehicular sources use a thin centerline marker, NOT paved width.
    const tint=vehicle?[.31,.34,.37]:[.75,.43,.13];
    const yy=vehicle?.11:.14;
    for(const line of road.lines||[])for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i],dx=b[0]-a[0],dz=b[1]-a[1],
        len=Math.hypot(dx,dz);
      if(!Number.isFinite(len)||len<.015){skippedSegments++;continue;}
      const half=width*.5,nx=-dz/len*half,nz=dx/len*half;
      const aL=[a[0]+nx,yy,a[1]+nz],aR=[a[0]-nx,yy,a[1]-nz],
        bL=[b[0]+nx,yy,b[1]+nz],bR=[b[0]-nx,yy,b[1]-nz];
      add(aL,bL,bR,tint);add(aL,bR,aR,tint);
    }
  }
  return {
    positions:new Float32Array(positions),
    normals:new Float32Array(normals),
    colors:new Float32Array(colors),
    stats:{vehicleRoads,nonVehicleLines,roadTriangles,unverifiedVehicleWidth,
      skippedSegments,worldUnitsPerMeter:1,
      warning:'Vehicle bands are symmetric source-STREETWIDTH visual SCREENING only; nonvehicle paths thin indicators, not measured paved widths.'}
  };
}
