// Original, grounded two-broth cast-iron hotpot display. No borrowed 3D assets.
// Replaces the oversized red sphere without changing terrain, quests or physics.
export function buildChongqingHotpotDisplay({THREE,scene,ground,x,z,stone}) {
  if(!Number.isFinite(x)||!Number.isFinite(z)||typeof ground!=='function')
    throw new TypeError('A valid hotpot display site is required');
  const groundY=ground(x,z);
  if(!Number.isFinite(groundY))throw new RangeError('Invalid hotpot ground height');
  const root=new THREE.Group();
  root.name='patrol-chongqing-hotpot-display';
  root.position.set(x,groundY,z);
  scene.add(root);
  const material=(color,roughness,metalness=0,extra={})=>
    new THREE.MeshStandardMaterial({color,roughness,metalness,
      side:THREE.DoubleSide,...extra});
  const iron=material(0x343940,.39,.60),
    stove=material(0x555153,.69,.28),
    spicy=material(0x91371f,.56,.06),
    mild=material(0xad9870,.65,.03),
    ember=material(0x733b23,.66,0,{emissive:0x692c14,emissiveIntensity:.18});
  const add=(name,geometry,mat,px,py,pz,rx=0,ry=0)=>{
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.name='hotpot-'+name;
    mesh.position.set(px,py,pz);
    mesh.rotation.set(rx,ry,0);
    mesh.castShadow=!name.startsWith('broth-');
    mesh.receiveShadow=true;
    root.add(mesh);
    return mesh;
  };
  add('plinth',new THREE.BoxGeometry(4.6,.30,4.4),stone,0,.15,0);
  add('stove',new THREE.BoxGeometry(3.20,1.04,3.10),stove,0,.83,0);
  add('firebox',new THREE.BoxGeometry(1.22,.64,.045),iron,0,.82,1.57);
  for(let i=-1;i<=1;i++)add('vent-'+(i+1),
    new THREE.BoxGeometry(.16,.35,.051),ember,i*.31,.85,1.61);
  // An open tapered bowl, two horizontal liquid halves and a thin divider.
  add('cast-iron-bowl',new THREE.CylinderGeometry(1.88,1.67,.98,28,1,true),
    iron,0,1.72,0);
  add('broth-spicy',new THREE.CircleGeometry(1.75,32,0,Math.PI),
    spicy,0,2.155,0,-Math.PI/2);
  add('broth-mild',new THREE.CircleGeometry(1.75,32,Math.PI,Math.PI),
    mild,0,2.155,0,-Math.PI/2);
  add('divider',new THREE.BoxGeometry(3.50,.12,.085),iron,0,2.17,0);
  add('rolled-rim',new THREE.TorusGeometry(1.88,.092,8,36),
    iron,0,2.22,0,-Math.PI/2);
  const handles=new THREE.TorusGeometry(.38,.072,7,18);
  for(const side of [-1,1])add('loop-handle-'+side,handles,iron,
    side*2.05,1.77,0,0,Math.PI/2);
  // Sparse ingredients instead of a shiny opaque red dome.
  const garnishGeo=new THREE.SphereGeometry(.11,7,5);
  for(let i=0;i<8;i++){
    const angle=i*2.399963+.34,r=.37+(i%3)*.24;
    const garnish=add('garnish-'+i,garnishGeo,i%2?stove:ember,
      Math.cos(angle)*r,2.177,Math.sin(angle)*r);
    garnish.scale.set(.96,.15,1.44);
  }
  return {root,groundY,topY:groundY+2.32,radius:2.20,
    partCount:root.children.length};
}
