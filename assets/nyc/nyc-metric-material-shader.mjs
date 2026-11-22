// Original lightweight world-metre procedural surface study, deliberately
// NOT a photo PBR library or a depiction of surveyed Manhattan finishes.
// Applied only with ?materials=preview; default shader compiles untouched.
export const NYC_MATERIAL_PREVIEW_GLSL=[
  'if(vMaterial>2.5&&vMaterial<5.5){',
  'vec2 wallUV=abs(n.z)>abs(n.x)?vPosition.xy:vPosition.zy;',
  // 0.62m x 0.21m brick courses, authored appearance only.
  'if(vMaterial<3.5){',
  'vec2 b=wallUV/vec2(.62,.21);',
  'float row=floor(b.y);vec2 cell=fract(vec2(b.x+mod(row,2.)*.5,b.y));',
  'float mortar=step(.065,cell.x)*step(cell.x,.935)*step(.07,cell.y)*step(cell.y,.93);',
  'float grain=fract(sin(dot(floor(b),vec2(12.9898,78.233)))*43758.5453);',
  'base=mix(vec3(.245,.25,.25),vColor*(.75+.22*grain),mortar)*(.66+.42*lit);',
  // 1.5m x 3.6m illustrated glazing units, not true real-world mullions.
  '}else if(vMaterial<4.5){',
  'vec2 pane=fract(wallUV/vec2(1.5,3.6));',
  'float interior=step(.04,pane.x)*step(pane.x,.96)*step(.035,pane.y)*step(pane.y,.965);',
  'float glint=pow(1.-abs(dot(n,normalize(uEye-vPosition))),3.);',
  'vec3 glazing=mix(vColor*.68,vec3(.43,.64,.73),glint*.55);',
  'base=mix(vec3(.22,.26,.30),glazing,interior)*(.72+.28*lit);',
  // Matte stone blocks: no unlicensed normal/roughness maps imported.
  '}else{',
  'vec2 stone=wallUV/vec2(1.,.5);',
  'float joint=step(.035,fract(stone.x))*step(.045,fract(stone.y));',
  'float grain=fract(sin(dot(floor(stone*4.),vec2(16.35,24.19)))*8147.61);',
  'base=mix(vColor*.57,vColor*(.80+.11*grain),joint)*(.70+.32*lit);',
  '}',
  '}'
];
