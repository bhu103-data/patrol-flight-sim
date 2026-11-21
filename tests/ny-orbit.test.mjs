import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

// Execute the real portal in a minimal document. Replace only the asynchronous
// module import to observe the exact URL and simulate a successful NYC renderer.
function harness(){
  let js=readFileSync(new URL('../assets/cosmos/portal.js',import.meta.url),'utf8');
  assert.ok(js.includes('import(nyModuleUrl)'));
  js=js.replace('import(nyModuleUrl)','window.__loadNy(nyModuleUrl)');
  const handlers=new Map(),buttons=[];
  const add=(type,fn)=>handlers.set(type,[...(handlers.get(type)||[]),fn]);
  const event=type=>(handlers.get(type)||[]).forEach(fn=>fn());
  const button=()=>{
    const listeners={};
    const el={style:{},listeners,
      addEventListener(name,fn){listeners[name]=fn;},
      cloneNode(){return button();},
      removeAttribute(){},insertAdjacentElement(){}};
    buttons.push(el);
    return el;
  };
  const form={querySelector(){return null;}};
  const flight={map:'manhattan',aircraft:'fighter',playing:true,altitude:145,
    climb:0,position:[0,145,0],yaw:0,pitch:0,speed:21};
  let time=10000,tick,entries=0,exits=0,suspends=0,active=false;
  let importUrl='',navigation=0;
  const win={
    addEventListener:add,
    setInterval(fn){tick=fn;return 1;},
    clearInterval(){throw new Error('Auto orbit watcher must remain active');},
    PatrolSpaceBridge:{getState(){return flight;},suspendForOrbit(){suspends++;}},
    __loadNy(url){importUrl=url;return Promise.resolve({
      enter(){entries++;active=true;}
    });}
  };
  win.PatrolNYCosmos={
    isActive(){return active;},
    exit(){exits++;active=false;event('patrol:orbitReturn');}
  };
  const doc={
    baseURI:'https://example.test/patrol-flight-sim/index.html',
    currentScript:{src:'https://example.test/patrol-flight-sim/assets/cosmos/portal.js'},
    createElement:button,
    getElementById(id){
      if(id==='flightSetup')return form;
      if(id==='titleOverlay')return {};
      if(id==='startFlight')return {insertAdjacentElement(){}};
      return null;
    },
    querySelector(){return {prepend(){}};},body:{prepend(){}}
  };
  const context={
    window:win,document:doc,URL,URLSearchParams,
    FormData:class{
      get(name){return name==='flightMap'?'manhattan':name==='aircraft'?'fighter':null;}
    },
    location:{href:doc.baseURI,pathname:'/patrol-flight-sim/index.html',search:'',
      assign(){navigation++;}},
    performance:{now(){return time;}},sessionStorage:{setItem(){}},
    history:{replaceState(){}},console
  };
  new Script(js,{filename:'assets/cosmos/portal.js'}).runInNewContext(context);
  return {
    click:()=>buttons[0].listeners.click(),
    tick:()=>tick(),
    exit:()=>win.PatrolNYCosmos.exit(),
    moveToOrbit:()=>{flight.altitude=179.9;flight.climb=1;},
    clock:ms=>{time+=ms;},
    flush:async()=>{await Promise.resolve();await Promise.resolve();},
    info:()=>({entries,exits,suspends,active,importUrl,navigation,
      buttonText:buttons[0].textContent})
  };
}

test('NYC dynamic import resolves within assets/cosmos on GitHub Pages',async()=>{
  const h=harness();
  h.click();await h.flush();
  assert.equal(h.info().entries,1);
  assert.equal(h.info().importUrl,
    'https://example.test/patrol-flight-sim/assets/cosmos/ny-cosmos.js');
  assert.equal(h.info().suspends,1);
  assert.equal(h.info().navigation,0);
});

test('NYC orbit remains accessible after multiple return-and-climb cycles',async()=>{
  const h=harness();
  h.click();await h.flush();
  h.exit();
  h.clock(1800);
  h.click();await h.flush();
  assert.equal(h.info().entries,2);
  h.exit();
  h.clock(1800);
  h.moveToOrbit();
  h.tick();await h.flush();
  assert.equal(h.info().entries,3);
  assert.match(h.info().buttonText,/ORBIT 179\/180/);
  h.exit();
  h.clock(1800);
  h.tick();await h.flush();
  assert.equal(h.info().entries,4);
  assert.equal(h.info().navigation,0);
});
