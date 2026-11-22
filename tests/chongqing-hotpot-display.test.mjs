// Verify the actual exported restaurant prop without Three.js/CDN or GPU.
// This is an intentionally bounded replacement of the giant red-ball prop.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../assets/chongqing/hotpot-display.js',import.meta.url),'utf8');
const {buildChongqingHotpotDisplay}=await import('data:text/javascript;base64,'+
  Buffer.from(code).toString('base64'));
const game=await readFile(new URL('../assets/chongqing/chongqing.js',import.meta.url),'utf8');

class Pose{
  set(x,y,z){this.x=x;this.y=y;this.z=z;}
}
class Group{
  constructor(){this.children=[];this.position=new Pose();}
  add(x){this.children.push(x);}
}
class Mesh{
  constructor(geometry,material){
    this.geometry=geometry;this.material=material;
    this.position=new Pose();this.rotation=new Pose();this.scale=new Pose();
  }
}
class Geometry{
  constructor(...args){this.args=args;}
}
class Material{
  constructor(args){Object.assign(this,args);}
}
const THREE={
  Group,Mesh,MeshStandardMaterial:Material,BoxGeometry:Geometry,
  CylinderGeometry:Geometry,CircleGeometry:Geometry,
  TorusGeometry:Geometry,SphereGeometry:Geometry,DoubleSide:'double'
};
function create(siteY=49.686){
  const scene={children:[],add(m){this.children.push(m);}};
  const calls=[];
  const result=buildChongqingHotpotDisplay({
    THREE,scene,ground:(x,z)=>{calls.push([x,z]);return siteY;},
    x:278,z:256,stone:{source:'original-PBR-cut-stone'}
  });
  return {scene,result,calls};
}

test('production Chongqing hotpot no longer uses the giant solid red sphere',()=>{
  assert.match(game,/buildChongqingHotpotDisplay\(\{/);
  assert.match(game,/from '\.\/hotpot-display\.js'/);
  assert.doesNotMatch(game,/ball\(278,shopY\+7\.2,hotpot\.z\+31,5,M\.red\)/);
  assert.doesNotMatch(game,/const cauldron=box\(278,shopY\+4\.5/);
  const {scene,result}=create();
  assert.equal(scene.children.length,1);
  assert.equal(result.root.name,'patrol-chongqing-hotpot-display');
  assert.equal(result.partCount,21);
  const names=result.root.children.map(x=>x.name);
  for(const expected of ['plinth','stove','firebox','cast-iron-bowl',
    'broth-spicy','broth-mild','divider','rolled-rim',
    'loop-handle--1','loop-handle-1'])
      assert.ok(names.includes('hotpot-'+expected),'Missing '+expected);
  assert.equal(names.filter(n=>n.startsWith('hotpot-garnish-')).length,8);
});
test('hotpot is grounded at original courtyard and bounded to human scale',()=>{
  const {result,calls}=create();
  assert.deepEqual(calls,[[278,256]]);
  assert.deepEqual([result.root.position.x,result.root.position.y,
    result.root.position.z],[278,49.686,256]);
  assert.ok(result.radius<=2.25&&result.radius>=1.8);
  assert.ok(result.topY-result.groundY<2.5);
  assert.ok(result.root.children.every(m=>m.position.y>=0&&m.position.y<=2.3));
  const face=result.root.children.filter(m=>m.name.includes('broth-'));
  assert.equal(face.length,2);
  assert.ok(face.every(m=>m.rotation.x===-Math.PI/2));
  assert.equal(face[0].geometry.args[3],Math.PI);
  assert.equal(face[1].geometry.args[2],Math.PI);
  assert.ok(!result.root.children.some(m=>m.geometry.args[0]===5&&
    m.geometry.args.length>=3));
});
test('hotpot rejects nonfinite coordinates and invalid terrain sample',()=>{
  const scene={add(){}};
  assert.throws(()=>buildChongqingHotpotDisplay({
    THREE,scene,ground:()=>0,x:Infinity,z:256,stone:{}
  }),TypeError);
  assert.throws(()=>buildChongqingHotpotDisplay({
    THREE,scene,ground:()=>NaN,x:278,z:256,stone:{}
  }),RangeError);
});
