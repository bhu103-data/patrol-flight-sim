// Chongqing Pilot: original lightweight urban night sky (no external imagery).
// Cool zenith, warm humid sky glow, high thin cloud banks; no extra texture downloads.
export function createChongqingAtmosphere(THREE,scene,camera) {
  const uniforms={uTime:{value:0},uDaylight:{value:.38}};
  const shader=new THREE.ShaderMaterial({
    uniforms,depthWrite:false,depthTest:true,side:THREE.BackSide,fog:false,
    vertexShader:[
      'varying vec3 vDir;',
      'void main(){vDir=normalize(position);',
      'vec4 p=viewMatrix*modelMatrix*vec4(position,1.);',
      'gl_Position=projectionMatrix*p;}'
    ].join('\n'),
    fragmentShader:[
      'precision highp float;',
      'uniform float uTime;uniform float uDaylight;varying vec3 vDir;',
      'float hash(vec2 p){p=fract(p*vec2(123.34,345.45));',
      'p+=dot(p,p+34.345);return fract(p.x*p.y);}',
      'float noise(vec2 p){vec2 i=floor(p),f=fract(p);',
      'vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),',
      'mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);}',
      'void main(){vec3 d=normalize(vDir);float up=max(d.y,0.);',
      'float horizon=exp(-pow(d.y/.24,2.));',
      'vec3 rgb=mix(vec3(.011,.020,.036),vec3(.051,.067,.081),pow(1.-up,2.1));',
      'float district=pow(max(0.,.5+.5*cos(d.x*6.+d.z*2.8)),2.);',
      'rgb+=vec3(.092,.054,.029)*horizon*(.38+.62*district);',
      'vec3 dayZenith=vec3(.19,.36,.56);',
      'vec3 dayHorizon=vec3(.57,.65,.72);',
      'vec3 daylight=mix(dayZenith,dayHorizon,pow(1.-up,2.3));',
      'float warmBand=horizon*(1.-uDaylight)*.42;',
      'daylight+=vec3(.14,.075,.032)*warmBand;',
      'rgb=mix(rgb,daylight,uDaylight);',
      'vec2 coord=vec2(atan(d.z,d.x)*2.3,d.y*8.5);',
      'vec2 drift=vec2(uTime*.00055,uTime*.00021);',
      'float n1=noise(coord*2.2+drift),n2=noise(coord*4.4+drift*1.3);',
      'float clouds=smoothstep(.45,.75,n1*.68+n2*.32);',
      'float band=smoothstep(-.02,.04,d.y)*(1.-smoothstep(.65,.88,d.y));',
      'vec3 cloud=mix(vec3(.047,.057,.065),vec3(.082,.071,.068),horizon);',
      'rgb=mix(rgb,cloud,clouds*band*(.44+uDaylight*.12));',
      'rgb+=hash(gl_FragCoord.xy)*.0021;',
      'gl_FragColor=vec4(rgb,1.);}'
    ].join('\n')
  });
  const dome=new THREE.Mesh(new THREE.SphereGeometry(2400,36,22),shader);
  dome.renderOrder=-100;
  dome.frustumCulled=false;
  scene.add(dome);
  return {
    setDaylight(value){uniforms.uDaylight.value=Math.min(1,Math.max(0,value));},
    update(dt){
      uniforms.uTime.value+=Math.min(Math.max(dt,0),.05);
      dome.position.copy(camera.position);
    },
    dispose(){scene.remove(dome);dome.geometry.dispose();shader.dispose();}
  };
}