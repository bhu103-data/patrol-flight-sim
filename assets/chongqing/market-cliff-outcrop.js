// Original close-range shale outcrop for the steep, existing market hillside.
// It is NOT surveyed terrain, a downloaded 3D model or a collision replacement.
// Respect the terrain renderer's exact 208x148 triangle interpolation: sample
// the displayed mesh, not the analytic ground() height between coarse vertices.
export const MARKET_ROCK_BOUNDS=Object.freeze({
  minX:268,maxX:282,minZ:334,maxZ:359,nx:18,nz:24
});
const TERRAIN=Object.freeze({x0:-990,z0:-690,dx:1980/208,dz:1380/148});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function sampleChongqingRenderedTerrain(x,z,ground){
  if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('finite terrain sample required');
  const gx=clamp((x-TERRAIN.x0)/TERRAIN.dx,0,208-1e-8),
    gz=clamp((z-TERRAIN.z0)/TERRAIN.dz,0,148-1e-8);
  const ix=Math.floor(gx),iz=Math.floor(gz),u=gx-ix,v=gz-iz;
  const x0=TERRAIN.x0+ix*TERRAIN.dx,z0=TERRAIN.z0+iz*TERRAIN.dz;
  const y00=ground(x0,z0),y10=ground(x0+TERRAIN.dx,z0),
    y01=ground(x0,z0+TERRAIN.dz),y11=ground(x0+TERRAIN.dx,z0+TERRAIN.dz);
  // Existing index order: (00,01,10), (10,01,11).
  const y=u+v<=1?y00*(1-u-v)+y01*v+y10*u:
    y10*(1-v)+y01*(1-u)+y11*(u+v-1);
  if(!Number.isFinite(y))throw Error('terrain must have finite vertex heights');
  return y;
}
export function buildChongqingMarketRockOutcrop({THREE,scene,ground,pbr}){
  const {minX,maxX,minZ,maxZ,nx,nz}=MARKET_ROCK_BOUNDS;
  const vertices=[],uvs=[],indices=[],colors=[],offsets=[];
  // One continuous, locally subdivided rock skin, not repeated cube boulders.
  // A taper on ALL edges avoids a wall-like silhouette at patch boundaries.
  for(let iz=0;iz<=nz;iz++){
    const v=iz/nz,z=minZ+(maxZ-minZ)*v;
    for(let ix=0;ix<=nx;ix++){
      const u=ix/nx,x=minX+(maxX-minX)*u;
      const taper=Math.pow(Math.sin(Math.PI*u)*Math.sin(Math.PI*v),1.15);
      const bedding=Math.sin((x-268)*2.2+(z-334)*.39+
        .63*Math.sin((z-334)*.33));
      const fractured=Math.sin(x*1.73-z*.69)*Math.cos(z*.91+x*.43);
      // 0.055 baseline clears z-fighting; at most ~0.67 m of visual relief.
      // The main collision heightfield is neither edited nor displaced.
      const lift=.055+taper*(.24+.22*bedding+.16*fractured);
      const height=sampleChongqingRenderedTerrain(x,z,ground)+lift;
      vertices.push(x,height,z);
      uvs.push(x/12,z/12);offsets.push(lift);
      // Existing hillside atlas remains visible; variable stone face shade
      // makes physical lamina and naturally staggered rock joints legible.
      const grain=.84+.10*bedding+.05*fractured;
      colors.push(grain,grain*.99,grain*.94);
    }
  }
  for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
    const a=iz*(nx+1)+ix,b=a+nx+1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();
  const rockMaterial=pbr.hillside.clone();
  rockMaterial.vertexColors=true;
  rockMaterial.color.setHex(0xe0ddd1);
  rockMaterial.roughness=.95;rockMaterial.metalness=0;
  rockMaterial.bumpScale=.10;
  const mesh=new THREE.Mesh(geometry,rockMaterial);
  mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.frustumCulled=true;
  scene.add(mesh);
  return {mesh,stats:{
    patches:1,triangleCount:indices.length/3,drawCalls:1,
    vertices:vertices.length/3,verticalReliefMax:Math.max(...offsets),
    bounds:MARKET_ROCK_BOUNDS
  }};
}
